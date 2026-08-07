from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from assinatura import exigir_assinatura
from config import get_settings
from routers import (
    assinatura,
    auth,
    caixa,
    chat,
    conta,
    contratos,
    dividas,
    lembretes,
    parcelas,
    perfil,
    resumo,
    revisao,
    simulacoes,
)

settings = get_settings()

# A TRAVA DE ESCRITA É REGISTRADA UMA VEZ, AQUI, e não rota a rota.
#
# Leitura é livre; escrita exige teste em curso ou assinatura ativa. O critério
# é o método HTTP, com três grupos de rota fora do alcance — ver o docstring de
# `backend/assinatura.py`, que é onde a decisão está escrita por inteiro.
#
# Uma linha aqui significa que ROTA DE ESCRITA NOVA NASCE TRAVADA. Uma lista por
# rota envelheceria na primeira que alguém criasse sem lembrar dela, e o buraco
# apareceria como receita que não entra — não como teste vermelho. Mesmo
# raciocínio de `routers/conta.tabelas_do_tenant()`, e há um teste em
# `test_assinatura_api.py` que varre `app.routes` e falha se uma rota de escrita
# ficar fora das duas listas.
app = FastAPI(title="Buddy Financeiro API", dependencies=[Depends(exigir_assinatura)])

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


# ORDEM IMPORTA: resumo registra /v1/dividas/resumo, simulacoes registra
# /v1/dividas/simulacoes e dividas registra /v1/dividas/{divida_id}. Invertido,
# "resumo" e "simulacoes" seriam capturados como id.
app.include_router(resumo.router)
app.include_router(simulacoes.router)
app.include_router(parcelas.router)
app.include_router(revisao.router)
app.include_router(dividas.router)
app.include_router(perfil.router)
app.include_router(lembretes.router)
app.include_router(contratos.router)
app.include_router(chat.router)
app.include_router(caixa.router)
app.include_router(auth.router)
app.include_router(conta.router)
app.include_router(assinatura.router)


@app.get("/")
def raiz():
    """Health check."""
    return {"status": "ok", "message": "Buddy Financeiro API"}


@app.get("/exclusao", response_class=FileResponse, include_in_schema=False)
def pagina_de_exclusao():
    """
    Página pública de solicitação de exclusão de conta — exigência do Google,
    ADICIONAL à exclusão dentro do app, não substituta dela.

    Fora de `/v1/` e sem autenticação de propósito: quem perdeu o acesso à conta
    é justamente quem mais precisa dela. Servir daqui dá URL real desde o
    primeiro dia; é um arquivo estático e muda de host quando houver domínio.
    """
    return FileResponse(Path(__file__).parent / "web" / "exclusao.html")
