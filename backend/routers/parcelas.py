from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.parcelas import gerar_cronograma, situacao_da_parcela

router = APIRouter(prefix="/v1", tags=["Parcelas"])


def _para_schema(p: orm.Parcela) -> schemas.Parcela:
    return schemas.Parcela(
        id=p.id,
        numero=p.numero,
        total=p.total,
        valor=p.valor,
        vencimento=p.vencimento,
        situacao=situacao_da_parcela(p.vencimento, p.paga_em),  # type: ignore[arg-type]
        pagoEm=p.paga_em,
        valorPago=p.valor_pago,
    )


def criar_parcelas(
    db: Session,
    tenant: str,
    divida_id: str,
    valor_total: int,
    total_parcelas: int,
    primeiro_vencimento: date,
) -> None:
    """Gera e persiste o cronograma. Usado no cadastro e na renegociação."""
    for g in gerar_cronograma(valor_total, total_parcelas, primeiro_vencimento):
        db.add(
            orm.Parcela(
                tenant_id=tenant,
                divida_id=divida_id,
                numero=g.numero,
                total=g.total,
                valor=g.valor,
                vencimento=g.vencimento,
            )
        )


def _buscar_divida(db: Session, tenant: str, divida_id: str) -> orm.Divida:
    d = db.scalar(
        select(orm.Divida).where(
            orm.Divida.id == divida_id,
            orm.Divida.tenant_id == tenant,
            orm.Divida.excluido_em.is_(None),
        )
    )
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos essa dívida."},
        )
    return d


@router.get("/dividas/{divida_id}/parcelas", response_model=schemas.ListaParcelas)
def listar(
    divida_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    _buscar_divida(db, tenant, divida_id)
    parcelas = db.scalars(
        select(orm.Parcela)
        .where(
            orm.Parcela.divida_id == divida_id,
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
        )
        .order_by(orm.Parcela.numero)
    ).all()
    return schemas.ListaParcelas(parcelas=[_para_schema(p) for p in parcelas])


@router.post("/parcelas/{parcela_id}/pagamento", response_model=schemas.RespostaParcela)
def pagar(
    parcela_id: str,
    entrada: schemas.PagamentoInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    p = db.scalar(
        select(orm.Parcela).where(
            orm.Parcela.id == parcela_id,
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
        )
    )
    if p is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos essa parcela."},
        )
    if p.paga_em is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Essa parcela já está paga."},
        )

    p.paga_em = entrada.pagoEm
    p.valor_pago = entrada.valorPago

    # Última parcela paga quita a dívida — o usuário não deveria precisar
    # marcar duas coisas para dizer a mesma coisa.
    pendentes = db.scalar(
        select(orm.Parcela).where(
            orm.Parcela.divida_id == p.divida_id,
            orm.Parcela.cancelada_em.is_(None),
            orm.Parcela.paga_em.is_(None),
            orm.Parcela.id != p.id,
        )
    )
    if pendentes is None:
        d = db.scalar(select(orm.Divida).where(orm.Divida.id == p.divida_id))
        if d is not None and d.situacao == "ativa":
            d.situacao = "quitada"
            d.data_quitacao = entrada.pagoEm

    db.commit()
    db.refresh(p)
    return schemas.RespostaParcela(parcela=_para_schema(p))


@router.post("/dividas/{divida_id}/renegociacao", response_model=schemas.RespostaDivida)
def renegociar(
    divida_id: str,
    entrada: schemas.RenegociacaoInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Registra um acordo: cancela as parcelas PENDENTES e gera as novas.

    Parcelas já pagas e o registro do acordo permanecem. Apagar o histórico
    tiraria do usuário justamente a prova do que ele já pagou antes do acordo.
    """
    from routers.dividas import _para_schema as divida_para_schema

    d = _buscar_divida(db, tenant, divida_id)

    agora = datetime.now(timezone.utc)
    pendentes = db.scalars(
        select(orm.Parcela).where(
            orm.Parcela.divida_id == divida_id,
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
            orm.Parcela.paga_em.is_(None),
        )
    ).all()
    for p in pendentes:
        p.cancelada_em = agora

    db.add(
        orm.Renegociacao(
            tenant_id=tenant,
            divida_id=divida_id,
            valor_anterior=d.valor_cobrado,
            novo_valor=entrada.novoValor,
            novo_total_parcelas=entrada.novoTotalParcelas,
            nova_taxa_juros_mensal=entrada.novaTaxaJurosMensal,
            primeiro_vencimento=entrada.primeiroVencimento,
            observacao=entrada.observacao,
        )
    )

    d.valor_cobrado = entrada.novoValor
    d.total_parcelas = entrada.novoTotalParcelas
    if entrada.novaTaxaJurosMensal is not None:
        d.taxa_juros_mensal = entrada.novaTaxaJurosMensal
    d.situacao = "renegociada"
    d.proximo_vencimento = entrada.primeiroVencimento

    criar_parcelas(
        db,
        tenant,
        divida_id,
        entrada.novoValor,
        entrada.novoTotalParcelas,
        entrada.primeiroVencimento,
    )

    db.commit()
    db.refresh(d)
    return schemas.RespostaDivida(divida=divida_para_schema(d))
