from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import get_settings
from routers import chat, contratos, dividas, perfil, resumo

settings = get_settings()

app = FastAPI(title="Buddy Financeiro API")

# Restrito de propósito. `allow_origins=["*"]` fazia a API responder a qualquer
# página web aberta no navegador do usuário.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(StarletteHTTPException)
async def erro_http(_: Request, exc: StarletteHTTPException):
    """
    Normaliza todo erro para `{ "message": ... }`.

    O cliente lê esse campo e o EXIBE DIRETO ao usuário (src/api/client.ts),
    então ele é pt-BR e para leigo. Quando o detail não vier nesse formato,
    devolvemos uma frase genérica em vez de vazar o texto interno do framework.
    """
    if isinstance(exc.detail, dict) and "message" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": "Não deu certo. Tente de novo."},
    )


@app.exception_handler(RequestValidationError)
async def erro_validacao(_: Request, exc: RequestValidationError):
    """
    422 do Pydantic → mensagem legível, com o campo, para o formulário
    destacar. Sem `loc`, sem `ctx`, sem tipo interno.
    """
    primeiro = exc.errors()[0] if exc.errors() else {}
    campo = next((str(p) for p in reversed(primeiro.get("loc", [])) if isinstance(p, str)), None)
    return JSONResponse(
        status_code=422,
        content={"message": "Confira os dados enviados.", "campo": campo},
    )


# ORDEM IMPORTA: resumo registra /v1/dividas/resumo e dividas registra
# /v1/dividas/{divida_id}. Invertido, "resumo" seria capturado como um id.
app.include_router(resumo.router)
app.include_router(dividas.router)
app.include_router(perfil.router)
app.include_router(contratos.router)
app.include_router(chat.router)


@app.get("/")
def raiz():
    """Health check. Único endpoint sem auth."""
    return {"status": "ok", "message": "Buddy Financeiro API"}
