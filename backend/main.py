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
    juridico,
    lembretes,
    marcos,
    metas,
    negociacoes,
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
app = FastAPI(title="devo.nada API", dependencies=[Depends(exigir_assinatura)])

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
app.include_router(negociacoes.router)
app.include_router(revisao.router)
app.include_router(dividas.router)
app.include_router(perfil.router)
app.include_router(lembretes.router)
app.include_router(contratos.router)
app.include_router(chat.router)
app.include_router(caixa.router)
app.include_router(metas.router)
app.include_router(marcos.router)
app.include_router(auth.router)
app.include_router(conta.router)
app.include_router(assinatura.router)
app.include_router(juridico.router)


@app.get("/")
def raiz():
    """Health check."""
    return {"status": "ok", "message": "devo.nada API"}


WEB = Path(__file__).parent / "web"

"""
As páginas públicas.

TRÊS, e todas fora de `/v1/` e sem autenticação de propósito: exclusão de conta,
termos e política de privacidade são exigidas pelas duas lojas como URL que o
revisor abre no navegador, e quem perdeu o acesso à conta é justamente quem mais
precisa da primeira. Servir daqui dá URL real desde o primeiro dia; são arquivos
estáticos e mudam de host quando o DNS de `devonada.com.br` apontar.

`include_in_schema=False` nas quatro: elas não são contrato de API, e listá-las
no OpenAPI faria a superfície documentada mentir sobre o próprio tamanho.
"""


@app.get("/publico.css", response_class=FileResponse, include_in_schema=False)
def estilo_publico():
    """
    A folha compartilhada das três páginas.

    EXTRAÍDA QUANDO A TERCEIRA NASCEU: com uma página, `<style>` embutido era o
    certo; com três, seriam três cópias dos mesmos tokens, e a que ninguém
    atualizasse ficaria com outra cor que as irmãs. Estas páginas são lidas por
    revisor de loja, e divergir de aparência entre elas levanta pergunta.
    """
    return FileResponse(WEB / "publico.css", media_type="text/css")


@app.get("/exclusao", response_class=FileResponse, include_in_schema=False)
def pagina_de_exclusao():
    """
    Página pública de solicitação de exclusão de conta — exigência do Google,
    ADICIONAL à exclusão dentro do app, não substituta dela.
    """
    return FileResponse(WEB / "exclusao.html")


@app.get("/termos", response_class=FileResponse, include_in_schema=False)
def pagina_de_termos():
    """Termos de Uso. Exigência das duas lojas, e linkada da tela de entrada."""
    return FileResponse(WEB / "termos.html")


@app.get("/privacidade", response_class=FileResponse, include_in_schema=False)
def pagina_de_privacidade():
    """
    Política de Privacidade. Exigência das duas lojas, e o documento que sustenta
    o preenchimento do *App Privacy* e do *Data safety*.

    O CONTEÚDO É DERIVADO DO CÓDIGO, e o levantamento que o sustenta está em
    `docs/legal/inventario-de-dados.md`. Quando uma coluna nova guardar dado do
    usuário, ou um provedor novo passar a receber alguma coisa, os dois mudam
    juntos — uma política que descreve um sistema que não existe mais é pior que
    nenhuma.
    """
    return FileResponse(WEB / "privacidade.html")
