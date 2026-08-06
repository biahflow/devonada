from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.correcao import valor_corrigido
from domain.prescricao import possivel_prescricao

router = APIRouter(prefix="/v1/dividas", tags=["Dividas"])


def _para_schema(d: orm.Divida) -> schemas.Divida:
    """
    ORM → contrato de API, aplicando as regras derivadas.

    `valorCorrigido` sai como None quando a dívida não tem taxa — o app exibe
    "ainda não calculado", que é a verdade, em vez de um número inventado.
    """
    saldo = d.valor_cobrado if d.situacao != "quitada" else 0

    return schemas.Divida(
        id=d.id,
        credor=d.credor,
        valorCobrado=d.valor_cobrado,
        dataOrigem=d.data_origem,
        tipo=d.tipo,  # type: ignore[arg-type]
        valorCorrigido=valor_corrigido(d.valor_cobrado, d.taxa_juros_mensal, d.data_origem),
        possivelPrescricao=possivel_prescricao(d.data_origem),
        situacao=d.situacao,  # type: ignore[arg-type]
        saldoDevedor=saldo,
        taxaJurosMensal=d.taxa_juros_mensal,
        totalParcelas=d.total_parcelas,
        parcelasPagas=d.parcelas_pagas,
        proximoVencimento=d.proximo_vencimento,
    )


def _buscar(db: Session, tenant: str, divida_id: str) -> orm.Divida:
    """
    Busca escopada por tenant.

    Recurso de outro tenant devolve 404, NUNCA 403: um 403 confirmaria que o
    id existe, que é justamente o que não queremos revelar.
    """
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


@router.get("", response_model=schemas.ListaDividas)
def listar(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    dividas = db.scalars(
        select(orm.Divida)
        .where(orm.Divida.tenant_id == tenant, orm.Divida.excluido_em.is_(None))
        .order_by(orm.Divida.criado_em.desc())
    ).all()
    return schemas.ListaDividas(dividas=[_para_schema(d) for d in dividas])


@router.post("", response_model=schemas.RespostaDivida, status_code=status.HTTP_201_CREATED)
def criar(
    nova: schemas.NovaDivida,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    if nova.dataOrigem > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "A data de origem não pode estar no futuro.", "campo": "dataOrigem"},
        )

    d = orm.Divida(
        tenant_id=tenant,
        credor=nova.credor.strip(),
        valor_cobrado=nova.valorCobrado,
        data_origem=nova.dataOrigem,
        tipo=nova.tipo,
        taxa_juros_mensal=nova.taxaJurosMensal,
        extracao_id=nova.extracaoId,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return schemas.RespostaDivida(divida=_para_schema(d))


@router.get("/{divida_id}", response_model=schemas.RespostaDivida)
def obter(
    divida_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    return schemas.RespostaDivida(divida=_para_schema(_buscar(db, tenant, divida_id)))


@router.patch("/{divida_id}", response_model=schemas.RespostaDivida)
def atualizar(
    divida_id: str,
    patch: schemas.PatchDivida,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    d = _buscar(db, tenant, divida_id)

    campos = patch.model_dump(exclude_unset=True)
    if "credor" in campos and campos["credor"]:
        d.credor = campos["credor"].strip()
    if "valorCobrado" in campos and campos["valorCobrado"]:
        d.valor_cobrado = campos["valorCobrado"]
    if "dataOrigem" in campos and campos["dataOrigem"]:
        d.data_origem = campos["dataOrigem"]
    if "tipo" in campos and campos["tipo"]:
        d.tipo = campos["tipo"]
    # taxaJurosMensal aceita None explícito — é como o usuário desfaz um valor
    # que ele mesmo digitou errado.
    if "taxaJurosMensal" in campos:
        d.taxa_juros_mensal = campos["taxaJurosMensal"]

    db.commit()
    db.refresh(d)
    return schemas.RespostaDivida(divida=_para_schema(d))


@router.post("/{divida_id}/quitacao", response_model=schemas.RespostaDivida)
def quitar(
    divida_id: str,
    entrada: schemas.QuitacaoInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    d = _buscar(db, tenant, divida_id)

    if d.situacao == "quitada":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Essa dívida já está quitada."},
        )

    d.situacao = "quitada"
    d.valor_pago = entrada.valorPago
    d.data_quitacao = entrada.dataQuitacao
    db.commit()
    db.refresh(d)
    return schemas.RespostaDivida(divida=_para_schema(d))


@router.delete("/{divida_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    divida_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """Exclusão LÓGICA. Some da listagem; o histórico financeiro permanece."""
    d = _buscar(db, tenant, divida_id)
    d.excluido_em = datetime.now(timezone.utc)
    db.commit()
