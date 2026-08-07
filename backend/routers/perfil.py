from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db

router = APIRouter(prefix="/v1/perfil", tags=["Perfil"])

"""
`rendaMensal` AQUI É UMA VISTA DE `fonte_renda`, não uma coluna.

A migration do M7 (39ab0b1d843c) copiou `perfil.renda_mensal` para `fonte_renda`
e declarou, por escrito, que a coluna "continua sendo lida por GET /v1/perfil,
agora derivada da soma das fontes ativas". A derivação nunca foi escrita, e o
resultado foi renda com dois donos: quem preenchia o caixa não aparecia no painel
e quem preenchia o painel não aparecia no caixa.

O campo continua no contrato porque app instalado que não atualizou ainda o
envia. O que mudou é onde ele pousa: `fonte_renda`, como qualquer outra renda.
A coluna `perfil.renda_mensal` deixa de ser escrita e sobrevive só como dado
legado e para o downgrade da migration.
"""


def _fontes_ativas(db: Session, tenant: str) -> list[orm.FonteRenda]:
    return list(
        db.scalars(
            select(orm.FonteRenda).where(
                orm.FonteRenda.tenant_id == tenant, orm.FonteRenda.ativo.is_(True)
            )
        ).all()
    )


def _renda_derivada(db: Session, tenant: str, p: orm.Perfil | None) -> int | None:
    """
    A soma do que as fontes ativas dizem valer, ou a coluna legada se não há
    fonte nenhuma.

    Usa `valor_tipico_informado` — o que o usuário DIZ que ganha —, não a renda
    típica apurada pelo histórico de recebimentos. Este endpoint devolve o que
    foi informado, para o formulário reexibir; quem quer o número que o plano usa
    pede `GET /v1/caixa`, e é lá que a origem do valor aparece na tela.
    """
    fontes = _fontes_ativas(db, tenant)
    if not fontes:
        return p.renda_mensal if p else None
    total = sum(f.valor_tipico_informado or 0 for f in fontes)
    return total or None


def _para_schema(db: Session, tenant: str, p: orm.Perfil | None) -> schemas.PerfilFinanceiro:
    """Perfil inexistente devolve campos AUSENTES, nunca zerados."""
    renda = _renda_derivada(db, tenant, p)
    if p is None:
        return schemas.PerfilFinanceiro(rendaMensal=renda)
    return schemas.PerfilFinanceiro(
        rendaMensal=renda,
        dependentes=p.dependentes,
        horaLembrete=p.hora_lembrete or "09:00",
        diasAntecedenciaLembrete=p.dias_antecedencia_lembrete
        if p.dias_antecedencia_lembrete is not None
        else 3,
        fechamentoDiaDoMes=p.fechamento_dia_do_mes,
    )


def _gravar_renda(db: Session, tenant: str, valor: int) -> None:
    """
    Leva a renda informada aqui para `fonte_renda`, que é onde ela mora.

    UM ESCALAR NÃO SE REPARTE ENTRE VÁRIAS FONTES. Com duas ou mais fontes
    ativas, dividir o valor ou escolher uma para sobrescrever inventaria dado —
    a rota recusa e manda para a tela que sabe tratar o caso. Sem fonte nenhuma,
    cria a mesma forma que a migration do M7 criou, para os dois caminhos não
    produzirem registros diferentes para a mesma coisa.
    """
    fontes = _fontes_ativas(db, tenant)

    if len(fontes) > 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                # Sem valor na mensagem (guardrail 5).
                "message": (
                    "Você tem mais de uma fonte de renda cadastrada. Ajuste cada uma "
                    "na aba Caixa, para o total continuar batendo."
                ),
                "campo": "rendaMensal",
            },
        )

    if fontes:
        fontes[0].valor_tipico_informado = valor
        return

    db.add(
        orm.FonteRenda(
            tenant_id=tenant,
            nome="Renda informada",
            tipo="outro",
            valor_tipico_informado=valor,
            variavel=False,
            ativo=True,
        )
    )


@router.get("", response_model=schemas.RespostaPerfil)
def obter(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    p = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    return schemas.RespostaPerfil(perfil=_para_schema(db, tenant, p))


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

    # Renda ausente no corpo não apaga a fonte: o formulário de preferências
    # deixou de enviá-la, e tratar ausente como zero apagaria a renda de quem só
    # queria mudar o horário do lembrete.
    if entrada.rendaMensal is not None:
        _gravar_renda(db, tenant, entrada.rendaMensal)

    p.dependentes = entrada.dependentes
    p.hora_lembrete = entrada.horaLembrete
    p.dias_antecedencia_lembrete = entrada.diasAntecedenciaLembrete
    p.fechamento_dia_do_mes = entrada.fechamentoDiaDoMes
    db.commit()
    db.refresh(p)
    return schemas.RespostaPerfil(perfil=_para_schema(db, tenant, p))
