from identidade.base import Identidade
from identidade.openid import como_booleano, conferir_id_token

"""
Sign in with Apple.

A AUDIÊNCIA É O BUNDLE ID DO APP, e pode ser mais de uma: um Services ID entra
na lista no dia em que houver login pela web. Ela vem de `DEVONADA_APPLE_CLIENT_IDS`
e NÃO cai de volta em `DEVONADA_APPLE_BUNDLE_ID`, que é da compra in-app — as duas
credenciais são da mesma empresa e do mesmo app, mas configurá-las juntas por
acidente é como uma passa a valer pela outra sem ninguém decidir isso.

O E-MAIL VEM EM TODO LOGIN, mas pode ser o de encaminhamento privado
(`@privaterelay.appleid.com`) quando a pessoa escolhe "Ocultar meu e-mail". Para
nós ele é um e-mail como outro qualquer: identifica, recebe o código de
recuperação e é único. O que ele não faz é servir para comparar com o e-mail que
a mesma pessoa usa no Google — e é por isso que a conta é identificada por `sub`.

NÃO PEDIMOS O NOME. `FULL_NAME` é um escopo separado, entregue só no primeiro
login, e nenhuma tela do app mostra nome de usuário. Coletar para guardar é o
oposto de minimização (guardrail 5).
"""

JWKS = "https://appleid.apple.com/auth/keys"
EMISSOR = "https://appleid.apple.com"


class IdentidadeApple:
    def __init__(self, client_ids: tuple[str, ...]) -> None:
        self._client_ids = client_ids

    def verificar(self, token: str) -> Identidade:
        claims = conferir_id_token(
            token,
            jwks_uri=JWKS,
            emissores=(EMISSOR,),
            audiencias=self._client_ids,
            provedor_para_o_usuario="a Apple",
        )

        email = claims.get("email")
        return Identidade(
            provedor="apple",
            sub=str(claims["sub"]),
            email=str(email).strip().lower() if email else None,
            # A Apple manda `email_verified` como string; a normalização é
            # compartilhada porque errá-la aqui abriria o caminho de
            # reconhecimento por e-mail para qualquer valor.
            email_verificado=como_booleano(claims.get("email_verified")),
        )
