from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db

router = APIRouter(prefix="/v1/perfil", tags=["Perfil"])


def _para_schema(p: orm.Perfil | None) -> schemas.PerfilFinanceiro:
    """Perfil inexistente devolve campos AUSENTES, nunca zerados."""
    if p is None:
        return schemas.PerfilFinanceiro()
    return schemas.PerfilFinanceiro(
        rendaMensal=p.renda_mensal,
        dependentes=p.dependentes,
        horaLembrete=p.hora_lembrete or "09:00",
        diasAntecedenciaLembrete=p.dias_antecedencia_lembrete
        if p.dias_antecedencia_lembrete is not None
        else 3,
    )


@router.get("", response_model=schemas.RespostaPerfil)
def obter(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    p = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    return schemas.RespostaPerfil(perfil=_para_schema(p))


@router.put("", response_model=schemas.RespostaPerfil)
def gravar(
    entrada: schemas.PerfilFinanceiro,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Renda é dado sensível: não vai para log, nem para mensagem de erro
    (guardrail 5). Aqui ela só entra na tabela.
    """
    p = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    if p is None:
        p = orm.Perfil(tenant_id=tenant)
        db.add(p)

    p.renda_mensal = entrada.rendaMensal
    p.dependentes = entrada.dependentes
    p.hora_lembrete = entrada.horaLembrete
    p.dias_antecedencia_lembrete = entrada.diasAntecedenciaLembrete
    db.commit()
    db.refresh(p)
    return schemas.RespostaPerfil(perfil=_para_schema(p))
