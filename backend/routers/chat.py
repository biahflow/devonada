import datetime
import uuid

from fastapi import APIRouter, Depends

import schemas
from auth import tenant_atual

router = APIRouter(prefix="/v1", tags=["Chat"])


@router.post("/chat/messages")
def enviar_mensagem(req: schemas.SendMessageRequest, _: str = Depends(tenant_atual)):
    """
    AINDA É MOCK. Devolve um card fixo, sem LLM.

    Fica assim de propósito: o chat real é o Bloco 5 e depende dos novos `kind`
    de card do M5. O que mudou aqui é só que a rota agora exige auth, como todas
    as outras — deixá-la aberta seria uma porta sem tranca no meio da casa.
    """
    card = {
        "kind": "valor_justo",
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000,
        "valorJusto": 90000,
        "script": (
            "Olá! Verifiquei que meu saldo devedor principal é R$ 900,00. "
            "Gostaria de quitar à vista por esse valor. Podemos fechar acordo?"
        ),
        "fundamentos": [
            "Art. 39, V, do CDC (vantagem manifestamente excessiva)",
            "Art. 42 do CDC (cobrança abusiva)",
        ],
    }

    return {
        "message": {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": (
                f"Você disse: '{req.content}'.\n\n"
                "Ainda estou em modo de demonstração — este card é um exemplo fixo, "
                "não uma análise da sua dívida."
            ),
            "cards": [card],
            "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    }
