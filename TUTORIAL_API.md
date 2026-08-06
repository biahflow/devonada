# Aula: Construindo a API Backend (FastAPI + Python)

Este documento guarda todo o passo a passo que fizemos para subir o servidor backend falso (Mock) do Buddy Financeiro, que permite ao aplicativo funcionar localmente. Usamos **Python** e **FastAPI**, deixando a estrutura pronta para integrações futuras com Inteligência Artificial (Langchain/LangSmith).

---

## Passo 1: Preparando o Ambiente (Virtual Environment)

Para não misturarmos as bibliotecas desse projeto com o resto do seu computador, criamos uma pasta `backend` e um **ambiente virtual isolado**.

No terminal, rodamos:
```bash
# Criar e entrar na pasta do backend
mkdir backend
cd backend

# Criar o ambiente virtual (venv)
python3 -m venv venv

# Ativar o ambiente virtual (sempre que for trabalhar no backend, precisa ativar!)
source venv/bin/activate
```

---

## Passo 2: Instalando as Bibliotecas

Com o ambiente ativado, instalamos as 3 ferramentas principais do nosso servidor:
```bash
pip install fastapi uvicorn pydantic
```
- **FastAPI**: O framework que cria o servidor web e as rotas.
- **Uvicorn**: O servidor (motor) que faz o código rodar e escutar na porta 8000.
- **Pydantic**: Biblioteca que garante que os dados enviados pelo aplicativo estão no formato correto.

---

## Passo 3: O Cérebro da API (`main.py`)

Criamos o arquivo `backend/main.py` para inicializar a API. Configuramos o **CORS** (Cross-Origin Resource Sharing), que é a permissão de segurança necessária para que o aplicativo do celular consiga "conversar" com a API que está rodando no computador.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import dividas, chat  # Importando as rotas (Passo 5 e 6)

app = FastAPI(title="Buddy Financeiro API")

# Permite que qualquer origem (celular) consiga fazer requisições
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectando as rotas separadas
app.include_router(dividas.router)
app.include_router(chat.router)

@app.get("/")
def read_root():
    return {"status": "ok", "mensagem": "API do Buddy Financeiro rodando!"}
```

---

## Passo 4: Os Modelos de Dados (`models.py`)

No aplicativo (TypeScript), tínhamos as "Interfaces". No Python, criamos os mesmos modelos usando o `BaseModel` do Pydantic. Isso garante que a API não vai quebrar se receber um texto onde deveria ser um número.

Arquivo: `backend/models.py`
```python
from pydantic import BaseModel
from typing import Optional, List

class NovaDivida(BaseModel):
    credor: str
    valorCobrado: int
    dataOrigem: str
    tipo: str

class Divida(NovaDivida):
    id: str
    valorCorrigido: Optional[int] = None
    possivelPrescricao: Optional[bool] = None

class SendMessageRequest(BaseModel):
    content: str
```

---

## Passo 5: Rotas de Dívidas (`routers/dividas.py`)

Para não deixarmos o `main.py` gigante e bagunçado, agrupamos os endpoints em arquivos separados usando o `APIRouter`.

Arquivo: `backend/routers/dividas.py`
```python
from fastapi import APIRouter
from typing import List
import uuid
from models import Divida, NovaDivida

router = APIRouter(prefix="/v1", tags=["Dividas"])

# Simula um banco de dados em memória
dividas_db: List[Divida] = []

@router.get("/dividas")
def listar_dividas():
    return {"dividas": dividas_db}

@router.post("/dividas")
def criar_divida(nova_divida: NovaDivida):
    id_gerado = str(uuid.uuid4())
    valor_com_juros = int(nova_divida.valorCobrado * 1.1)

    divida_salva = Divida(
        **nova_divida.model_dump(),
        id=id_gerado,
        valorCorrigido=valor_com_juros,
        possivelPrescricao=False
    )
    
    dividas_db.append(divida_salva)
    return {"divida": divida_salva}
```

---

## Passo 6: Rotas de Chat Simulando IA (`routers/chat.py`)

No chat, devolvemos uma resposta fictícia que simula o comportamento que o Langchain terá no futuro. Retornamos também um `ActionCard` para que o aplicativo exiba aquela interface rica (o card de Valor Justo).

Arquivo: `backend/routers/chat.py`
```python
from fastapi import APIRouter
import uuid
import datetime
from models import SendMessageRequest

router = APIRouter(prefix="/v1", tags=["Chat"])

@router.post("/chat/messages")
def enviar_mensagem(req: SendMessageRequest):
    card_valor_justo = {
        "kind": "valor_justo",
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000, 
        "valorJusto": 90000,    
        "script": "Olá! Verifiquei que meu saldo devedor principal é R$ 900,00...",
        "fundamentos": ["Art. 39, V, do CDC", "Art. 42 do CDC"]
    }
    
    resposta_ia = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": f"Você disse: '{req.content}'.\n\nAnalisei a situação. Veja o card abaixo!",
        "cards": [card_valor_justo],
        "createdAt": datetime.datetime.now().isoformat()
    }
    
    return {"message": resposta_ia}
```

---

## Como Rodar o Servidor Novamente?

Sempre que desligar o Mac e for voltar a trabalhar no projeto, abra o terminal e rode:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.73 --port 8000 --reload
```

> **Dica**: Se você mudar de rede Wi-Fi, seu IP do computador pode mudar de `0.0.0.73` para outro número. Caso isso aconteça, você precisará atualizar o IP no comando acima e também no arquivo `.env` na raiz do projeto (`EXPO_PUBLIC_API_BASE_URL`).
