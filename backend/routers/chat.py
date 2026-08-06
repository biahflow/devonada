from fastapi import APIRouter
from pydantic import BaseModel
import uuid
import datetime

# Usamos o modelo SendMessageRequest que criamos no models.py
from models import SendMessageRequest

router = APIRouter(prefix="/v1", tags=["Chat"])

@router.post("/chat/messages")
def enviar_mensagem(req: SendMessageRequest):
    """
    Simula o Langchain recebendo uma mensagem do usuário 
    e devolvendo a resposta da IA.
    """
    
    # Aqui, futuramente, você chamará o Langchain enviando o req.content
    # e ele processará a resposta. Por enquanto, criamos uma resposta fixa.
    
    # Vamos simular que o assistente identificou a dívida e sugeriu um "Valor Justo"
    card_valor_justo = {
        "kind": "valor_justo",
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000, # 1500,00 reais em centavos
        "valorJusto": 90000,    # 900,00 reais
        "script": "Olá! Verifiquei que meu saldo devedor principal é R$ 900,00. Gostaria de quitar à vista por esse valor. Podemos fechar acordo?",
        "fundamentos": [
            "Art. 39, V, do CDC (Vantagem manifestamente excessiva)",
            "Art. 42 do CDC (Cobrança abusiva)"
        ]
    }
    
    # Resposta simulada do modelo de IA (Assistant)
    resposta_ia = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": f"Você disse: '{req.content}'.\n\nComo seu assistente, eu analisei essa situação e criei uma estratégia para você renegociar essa dívida pagando um valor justo. Veja o card abaixo!",
        "cards": [card_valor_justo],
        "createdAt": datetime.datetime.now().isoformat()
    }
    
    # O aplicativo espera `{ message: {...} }`
    return {"message": resposta_ia}
