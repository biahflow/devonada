from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import auth
from config import Settings, get_settings
from db import get_db
from leitura import situacao_da_assinatura

"""
A trava de escrita (M9, ADR 0013).

REGRA, inteira: leitura é livre para sempre; escrita exige teste em curso ou
assinatura ativa.

POR QUE DERIVADA DO MÉTODO, e não uma lista de rotas travadas:

Uma lista escrita à mão envelhece na primeira rota de escrita que alguém criar
sem lembrar dela — e o buraco não aparece em teste nenhum, porque a rota
funciona. Ele aparece como receita que não entra, que é o modo de falha mais
silencioso que existe. É o mesmo raciocínio de `routers/conta.tabelas_do_tenant()`,
que deriva a exclusão de conta do metadata em vez de listar tabelas: rota nova de
escrita nasce travada, sem ninguém fazer nada.

O CUSTO É QUE A REGRA PRECISA SER VERDADEIRA. Ela é: nenhuma rota deste servidor
grava por GET, e nenhuma rota de escrita é livre por natureza do recurso. As três
exceções abaixo não são exceções de recurso — são as rotas que existem para
começar, gerenciar e encerrar a relação, e nenhuma delas pode depender de estar
em dia:

- `/v1/auth`   — entrar. Cobrar de quem não conseguiu nem fazer login é absurdo,
                 e o login é POST.
- `/v1/assinatura` — pagar. Uma trava que exige assinatura para assinar é um
                 deadlock, e ele só apareceria no primeiro usuário de verdade.
- `/v1/conta`  — sair. A exclusão de conta é DELETE e a Apple a exige na
                 diretriz 5.1.1(v). Travá-la faria o app reprovar na revisão, e
                 seria reter dado de quem pediu para apagá-lo por não ter pago —
                 o direito do art. 18 do LGPD não é um recurso pago.

LEITURA NUNCA É BLOQUEADA, e isso é decisão de produto, não descuido. Quem parou
de pagar continua vendo as próprias dívidas, o próprio caixa e o próprio
histórico. Trancar alguém endividado para fora da lista das dívidas dele é o
oposto do que este produto existe para fazer.
"""

# Prefixos que a trava não alcança. A ordem não importa; a comparação é por
# prefixo de caminho, e todos os três são grupos inteiros de rota.
LIVRES = ("/v1/auth", "/v1/assinatura", "/v1/conta")

ESCRITA = ("POST", "PUT", "PATCH", "DELETE")

PRECISA_ASSINAR = (
    "Seu período de teste terminou. Assine para voltar a registrar e alterar seus dados — "
    "tudo o que você já cadastrou continua visível."
)


def exigir_assinatura(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Dependência GLOBAL, registrada uma vez em `main.py`.

    Ela roda em toda requisição do servidor, inclusive em `/` e `/exclusao` — e
    é por isso que o caminho do GET sai na primeira linha, antes de CONSULTAR o
    banco. Duas consultas a mais por leitura, num app que lê muito mais do que
    escreve, seriam carga paga por todo mundo para uma regra que só vale na
    escrita.

    A SESSÃO em si continua sendo aberta pelo `Depends(get_db)`, porque o
    FastAPI resolve as dependências antes de chamar a função. Isso não é
    desperdício nas rotas de dado — o FastAPI reaproveita a mesma sessão dentro
    da requisição, e elas já dependiam dela. Sobra uma sessão ociosa em `/` e
    em `/exclusao`, que é o preço de a regra ser global em vez de repetida.
    """
    if request.method not in ESCRITA:
        return

    caminho = request.url.path
    if any(caminho.startswith(p) for p in LIVRES):
        return

    # `tenant_atual` é função comum, não só dependência: dá para chamá-la aqui
    # com o que já temos. Sem token válido ela levanta 401, que é a mesma
    # resposta que a rota daria um passo depois — a trava não inventa um
    # caminho de erro novo para quem não está logado.
    tenant = auth.tenant_atual(request, settings)

    if not situacao_da_assinatura(db, tenant, settings).pode_escrever:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"message": PRECISA_ASSINAR},
        )
