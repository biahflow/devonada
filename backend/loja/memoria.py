import json
import logging
from datetime import datetime, timezone

from loja.base import Compra, ErroDeLoja

"""
Loja que não fala com loja nenhuma.

Existe para a suíte — o `conftest.py` declara que NENHUM TESTE TOCA A REDE, e
essa regra passa a valer para cobrança também. Também serve para desenvolvimento
local: dá para exercitar teste vencido, compra, renovação e cancelamento sem
conta de desenvolvedor em loja alguma.

O RECIBO AQUI É UM JSON QUE DESCREVE A SI MESMO. É o análogo do correio de
memória guardar a mensagem numa lista: em vez de perguntar à Apple o que o
recibo significa, o recibo já diz. Um teste que quer assinatura vencida escreve
`expiraEm` no passado, e não precisa de mock nem de monkeypatch em lugar nenhum.

ELE NÃO É ACEITO EM PRODUÇÃO — só chega aqui quem configurou `DEVONADA_LOJA=memoria`
explicitamente. O padrão é `real`, e um servidor que caia neste adaptador está
mal configurado de um jeito muito maior que a assinatura.
"""

logger = logging.getLogger("devonada.loja")


class LojaMemoria:
    def conferir(self, recibo: str) -> Compra:
        try:
            dados = json.loads(recibo)
        except (TypeError, ValueError) as e:
            raise ErroDeLoja(
                "Não deu para conferir sua compra com a loja. Tente de novo em alguns minutos."
            ) from e

        if not isinstance(dados, dict) or "transacaoOriginalId" not in dados:
            raise ErroDeLoja(
                "Não deu para conferir sua compra com a loja. Tente de novo em alguns minutos."
            )

        logger.warning("[loja de memória] nada foi conferido de verdade: %s", recibo)

        # `fromisoformat` aceita o sufixo Z a partir do 3.11; normalizamos para
        # UTC de qualquer forma, porque uma data ingênua comparada com uma data
        # com fuso levanta TypeError na primeira comparação — e ela aconteceria
        # dentro do domínio, longe daqui.
        expira = datetime.fromisoformat(str(dados["expiraEm"]).replace("Z", "+00:00"))
        if expira.tzinfo is None:
            expira = expira.replace(tzinfo=timezone.utc)

        cancelada = dados.get("canceladaEm")
        if cancelada is not None:
            cancelada = datetime.fromisoformat(str(cancelada).replace("Z", "+00:00"))
            if cancelada.tzinfo is None:
                cancelada = cancelada.replace(tzinfo=timezone.utc)

        return Compra(
            transacao_original_id=str(dados["transacaoOriginalId"]),
            # O próprio JSON: ele descreve a si mesmo, então reconferir com ele
            # devolve exatamente o mesmo resultado. É o que faz o caminho de
            # reconferência do `GET /v1/assinatura` ser exercitável na suíte.
            chave_consulta=recibo,
            produto_id=str(dados.get("produtoId", "assinatura.mensal")),
            expira_em=expira.astimezone(timezone.utc),
            ambiente=str(dados.get("ambiente", "sandbox")),
            renovacao_automatica=bool(dados.get("renovacaoAutomatica", True)),
            cancelada_em=cancelada,
        )
