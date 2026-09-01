import json
import logging

from identidade.base import ErroDeIdentidade, Identidade
from identidade.openid import como_booleano

"""
Provedor que não fala com provedor nenhum.

Existe para a suíte — o `conftest.py` declara que NENHUM TESTE TOCA A REDE, e
essa regra passa a valer para o login social também. Também serve para
desenvolvimento local: dá para exercitar primeiro login, login repetido,
reconhecimento de conta e recusa sem conta na Apple Developer nem projeto no
Google Cloud.

O TOKEN AQUI É UM JSON QUE DESCREVE A SI MESMO, exatamente como o recibo da loja
de memória. Em vez de perguntar ao provedor o que o token significa, o token já
diz. Um teste que quer e-mail não verificado escreve `emailVerificado: false`, e
não precisa de mock nem de monkeypatch em lugar nenhum.

ELE NÃO É ACEITO EM PRODUÇÃO — só chega aqui quem configurou
`DEVONADA_IDENTIDADE=memoria` explicitamente. O padrão é `real`, e um servidor
que caia neste adaptador está mal configurado de um jeito muito maior que o
login social: ele aceita como identidade qualquer coisa que o aparelho digitar.
"""

logger = logging.getLogger("devonada.identidade")


class IdentidadeMemoria:
    """
    `provedor` é o nome de MÁQUINA (`apple`, `google`) — o mesmo que vai para a
    coluna do banco. `rotulo` é como o provedor se chama numa frase em pt-BR.

    Os dois separados porque misturá-los grava "a Apple" na coluna `provedor`, e
    o login seguinte deixa de reconhecer a conta: foi exatamente o que a suíte
    pegou.
    """

    def __init__(self, provedor: str, rotulo: str) -> None:
        self._provedor = provedor
        self._rotulo = rotulo

    def verificar(self, token: str) -> Identidade:
        try:
            dados = json.loads(token)
        except (TypeError, ValueError) as e:
            raise ErroDeIdentidade(
                f"Não deu para confirmar sua entrada com {self._rotulo}. Tente de novo."
            ) from e

        if not isinstance(dados, dict) or not dados.get("sub"):
            raise ErroDeIdentidade(
                f"Não deu para confirmar sua entrada com {self._rotulo}. Tente de novo."
            )

        logger.warning("[identidade de memória] nada foi conferido de verdade")

        email = dados.get("email")
        return Identidade(
            provedor=self._provedor,
            sub=str(dados["sub"]),
            email=str(email).strip().lower() if email else None,
            # Default `True` porque o caminho comum dos dois provedores reais é
            # e-mail verificado; o teste que quer o outro lado escreve `false`.
            email_verificado=como_booleano(dados.get("emailVerificado", True)),
        )
