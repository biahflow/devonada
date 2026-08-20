from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.marcos import TIPOS

router = APIRouter(prefix="/v1/marcos", tags=["Marcos"])

"""
Marcos: eventos gravados, nunca recalculados.

ESTE ARQUIVO NÃO CALCULA MARCO NENHUM. `GET /v1/marcos` lê linha de tabela, e é
essa a coisa mais importante do módulo (ADR 0019, item 4). Um predicado sobre o
estado atual se desfaria: a porcentagem da rota anda para trás quando o usuário
cadastra uma dívida nova, e a pessoa perderia uma conquista por ter sido honesta
sobre a própria situação. Quem decide QUANDO o gatilho ocorreu é `domain/marcos`,
chamado pelos routers onde o evento acontece; aqui só se grava e se lê.

Se algum dia aparecer uma conta dentro de `listar`, o marco virou predicado e a
promessa da feature morreu junto.
"""


def _nao_encontrado() -> HTTPException:
    """
    404, e não 409 nem 403.

    Tipo inexistente e marco ainda não atingido são a mesma resposta de
    propósito: nos dois casos não há recurso para celebrar, e devolver códigos
    diferentes contaria ao cliente qual dos dois é — sem que ele possa fazer
    nada de diferente com a informação.
    """
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"message": "Não encontramos esse marco."},
    )


def registrar_marcos(db: Session, tenant: str, tipos: Sequence[str]) -> tuple[str, ...]:
    """
    Grava os marcos que ainda não existem, e devolve os que nasceram agora.

    IDEMPOTENTE POR `(tenant_id, tipo)`, e a idempotência é ESCRITA AQUI porque
    o banco não a impõe: não há UNIQUE nessa dupla — nenhuma tabela deste banco
    tem. Sem esta checagem, um marco gravado duas vezes vira conquista duplicada
    e tela que reaparece. Ela vale por três caminhos que chegam ao mesmo tipo: a
    quitação é detectada em dois lugares (`parcelas.pagar` e `dividas.quitar`) e
    a rota é reavaliada em toda leitura do resumo.

    NÃO COMMITA. Quem chama fecha a transação, porque nos três routers de
    escrita a gravação do marco faz parte da MESMA mutação que o disparou — um
    commit aqui gravaria a conquista antes de a quitação estar salva. `resumo`,
    que só lê, commita explicitamente quando esta função devolve algo.

    LIMITAÇÃO CONHECIDA: duas requisições simultâneas do mesmo tenant podem
    passar juntas pelo SELECT e inserir a mesma linha duas vezes. Sem UNIQUE não
    há como travar isso na gravação, e por isso `listar` agrega por tipo — a
    resposta continua com uma entrada por marco, e `atingidoEm` continua sendo a
    data mais antiga. A dupla vira linha órfã, nunca conquista dobrada.
    """
    if not tipos:
        return ()

    ja_gravados = set(
        db.scalars(
            select(orm.Marco.tipo).where(
                orm.Marco.tenant_id == tenant, orm.Marco.tipo.in_(tuple(tipos))
            )
        ).all()
    )

    novos = tuple(dict.fromkeys(t for t in tipos if t not in ja_gravados))
    for tipo in novos:
        db.add(orm.Marco(tenant_id=tenant, tipo=tipo))
    return novos


@router.get("", response_model=schemas.ListaMarcos)
def listar(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    """
    Os cinco tipos, com o par `atingidoEm`/`celebradoEm`.

    OS CINCO SEMPRE, inclusive para quem não atingiu nenhum: a ausência é dita
    com nulo, e não omitida. A tela precisa saber que o marco existe e não foi
    alcançado — isso é rota, não erro.

    LEITURA PURA. Nenhuma conta, nenhum limiar, nenhuma comparação com o estado
    atual: o que veio da tabela é a resposta.

    A AGREGAÇÃO POR TIPO não é enfeite. Como o banco não tem UNIQUE em
    `(tenant_id, tipo)`, uma corrida entre duas requisições poderia deixar duas
    linhas do mesmo marco; `MIN(atingido_em)` mantém a data da conquista original
    e `MIN(celebrado_em)` — que em SQL ignora nulos — mantém a primeira
    celebração. O contrato fica igual com uma linha ou com duas.
    """
    gravados = {
        tipo: (atingido_em, celebrado_em)
        for tipo, atingido_em, celebrado_em in db.execute(
            select(
                orm.Marco.tipo,
                func.min(orm.Marco.atingido_em),
                func.min(orm.Marco.celebrado_em),
            )
            .where(orm.Marco.tenant_id == tenant)
            .group_by(orm.Marco.tipo)
        ).all()
    }

    return schemas.ListaMarcos(
        marcos=[
            schemas.Marco(
                tipo=tipo,  # type: ignore[arg-type]
                atingidoEm=gravados.get(tipo, (None, None))[0],
                celebradoEm=gravados.get(tipo, (None, None))[1],
            )
            for tipo in TIPOS
        ]
    )


@router.post("/{tipo}/celebracao", status_code=status.HTTP_204_NO_CONTENT)
def celebrar(
    tipo: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Grava `celebradoEm` — a tela apareceu.

    É ESCRITA, e por isso passa pela trava de assinatura como qualquer outra. O
    ATINGIMENTO não passa, e essa assimetria é a decisão: a trava bloqueia a
    celebração de quem não está em dia, nunca a conquista. O marco atingido no
    período somente leitura fica com `celebradoEm` nulo e espera a tela voltar,
    em vez de evaporar (`docs/api-contract.md`, 3.13).

    CELEBRAR DE NOVO NÃO MOVE A DATA. O que a coluna guarda é quando a tela
    apareceu pela primeira vez; reescrever transformaria um clique repetido em
    reescrita silenciosa de histórico, no mesmo espírito append-only da tabela.
    Continua devolvendo 204: para o cliente, o estado desejado já é o atual.
    """
    if tipo not in TIPOS:
        raise _nao_encontrado()

    linhas = db.scalars(
        select(orm.Marco).where(orm.Marco.tenant_id == tenant, orm.Marco.tipo == tipo)
    ).all()
    if not linhas:
        raise _nao_encontrado()

    hoje = date.today()
    for linha in linhas:
        if linha.celebrado_em is None:
            linha.celebrado_em = hoje
    db.commit()
