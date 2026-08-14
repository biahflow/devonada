from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.metas import MetaPendente, aporte_sugerido, status as status_da_meta

router = APIRouter(prefix="/v1/metas", tags=["Metas"])

"""
Metas nomeadas — a "Rota de Chegada" da fase verde.

NÃO É `/v1/caixa/metas`. Aquele endpoint guarda os seis potes fixos do `Perfil`
(imposto, reserva, aposentadoria) que entram na CASCATA do fechamento do mês;
este guarda uma coleção livre que a pessoa cria e apaga, e que não entra em
cálculo de capacidade nenhum. A colisão de nome é dívida assumida na ADR 0017,
porque unificar os dois obrigaria a recalcular a cascata.

Toda a aritmética vive em `domain/metas.py`, que é puro. Este arquivo carrega,
persiste e traduz para o contrato.
"""


def _mes_de_hoje() -> str:
    return date.today().strftime("%Y-%m")


def _nao_encontrada() -> HTTPException:
    """404, nunca 403: um 403 confirmaria que o id existe em outro tenant."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"erro": "nao_encontrado", "message": "Não encontrei essa meta."},
    )


def _buscar(db: Session, tenant: str, meta_id: str) -> orm.Meta:
    m = db.scalar(
        select(orm.Meta).where(orm.Meta.id == meta_id, orm.Meta.tenant_id == tenant)
    )
    if m is None:
        raise _nao_encontrada()
    return m


def _schema(m: orm.Meta) -> schemas.Meta:
    """
    Os derivados entram AQUI, a cada resposta, e não em coluna.

    `aporteSugerido` depende do mês em que a pergunta é feita: a mesma meta pede
    R$ 500 em agosto e R$ 1.000 em novembro. Persistir isso deixaria a tela
    mostrando o número de quando a meta foi criada.
    """
    pendente = MetaPendente(
        valor_alvo=m.valor_alvo,
        saldo=m.saldo,
        data_alvo=m.data_alvo,
        aporte_mensal=m.aporte_mensal,
    )
    mes = _mes_de_hoje()
    return schemas.Meta(
        id=m.id,
        nome=m.nome,
        emoji=m.emoji,
        valorAlvo=m.valor_alvo,
        saldo=m.saldo,
        dataAlvo=m.data_alvo,
        aporteMensal=m.aporte_mensal,
        ativa=m.ativa,
        aporteSugerido=aporte_sugerido(pendente, mes),
        status=status_da_meta(pendente, mes),
    )


@router.get("", response_model=schemas.ListaMetas)
def listar(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    metas = db.scalars(
        select(orm.Meta).where(orm.Meta.tenant_id == tenant).order_by(orm.Meta.criada_em)
    ).all()
    return schemas.ListaMetas(metas=[_schema(m) for m in metas])


@router.post("", response_model=schemas.RespostaMeta, status_code=201)
def criar(
    entrada: schemas.NovaMeta,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    m = orm.Meta(
        tenant_id=tenant,
        nome=entrada.nome,
        emoji=entrada.emoji,
        valor_alvo=entrada.valorAlvo,
        saldo=entrada.saldo,
        data_alvo=entrada.dataAlvo,
        aporte_mensal=entrada.aporteMensal,
        ativa=entrada.ativa,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return schemas.RespostaMeta(meta=_schema(m))


@router.patch("/{meta_id}", response_model=schemas.RespostaMeta)
def editar(
    meta_id: str,
    entrada: schemas.MetaPatch,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    `exclude_unset`, e é isso que faz `null` significar "apaga".

    Campo ausente fica como está; campo enviado como `null` grava ausência — é
    como a pessoa remove o prazo ou o aporte de uma meta. Sem essa distinção, não
    haveria como desfazer nenhum dos dois.
    """
    m = _buscar(db, tenant, meta_id)
    dados = entrada.model_dump(exclude_unset=True)
    for campo, coluna in (
        ("nome", "nome"),
        ("emoji", "emoji"),
        ("valorAlvo", "valor_alvo"),
        ("saldo", "saldo"),
        ("dataAlvo", "data_alvo"),
        ("aporteMensal", "aporte_mensal"),
        ("ativa", "ativa"),
    ):
        if campo in dados:
            setattr(m, coluna, dados[campo])
    db.commit()
    db.refresh(m)
    return schemas.RespostaMeta(meta=_schema(m))


@router.delete("/{meta_id}", status_code=204)
def excluir(
    meta_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Exclusão de verdade, como fonte de renda e ao contrário de dívida.

    Meta cadastrada errado é ruído de cadastro, não histórico financeiro. Quem
    quer guardar a meta sem vê-la na lista usa `ativa: false`.
    """
    m = _buscar(db, tenant, meta_id)
    db.delete(m)
    db.commit()
