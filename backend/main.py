from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import dividas, chat

app = FastAPI(title="Buddy Financeiro API")

# Configuração de CORS para permitir que o app React Native (Expo) converse com a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todas as origens (para desenvolvimento)
    allow_credentials=True,
    allow_methods=["*"],  # Permitir todos os métodos HTTP
    allow_headers=["*"],  # Permitir todos os cabeçalhos
)

app.include_router(dividas.router)
app.include_router(chat.router)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to Buddy Financeiro API!"}