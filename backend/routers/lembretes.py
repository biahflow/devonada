from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.dinheiro import centavos_para_decimal

router = APIRouter(prefix="/v1/lembretes", tags=["Lembretes"])


def _formatar_brl(centavos: int) -> str:
    """
    Mesma formatação de `src/util/money.ts`, para o texto sair pronto daqui.

    Formatar no servidor evita a moeda ser montada em dois lugares e divergir —
    e é por isso que `titulo` e `corpo` viajam prontos no payload.
    """
    valor = centavos_para_decimal(abs(centavos))
    inteiro, _, dec = f"{valor:.2f}".partition(".")
    milhar = f"{int(inteiro):,}".replace(",", ".")
    sinal = "-" if centavos < 0 else ""
    return f"{sinal}R$ {milhar},{dec}"


def _texto(credor: str, parcela: orm.Parcela, dias: int) -> tuple[str, str]:
    """
    Tom neutro é requisito, não estilo (guardrail 4).

    Nada de "ATENÇÃO", contagem regressiva ou linguagem de cobrança: o app do
    usuário não pode soar como o credor dele.
    """
    if dias == 0:
        quando = "vence hoje"
    elif dias == 1:
        quando = "vence amanhã"
    else:
        quando = f"vence em {dias} dias"

    titulo = f"{credor} {quando}"
    corpo = f"Parcela {parcela.numero} de {parcela.total} — {_formatar_brl(parcela.valor)}"
    return titulo, corpo


@router.get("", response_model=schemas.ListaLembretes)
def listar(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    """
    Parcelas pendentes que vencem na janela de antecedência configurada.

    Devolve DATA, não instante: o aparelho compõe a hora local. Ver o docstring
    de `schemas.Lembrete`.
    """
    perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    antecedencia = perfil.dias_antecedencia_lembrete if perfil else 3
    hora = perfil.hora_lembrete if perfil else "09:00"

    hoje = date.today()
    limite = hoje + timedelta(days=antecedencia)

    linhas = db.execute(
        select(orm.Parcela, orm.Divida)
        .join(orm.Divida, orm.Divida.id == orm.Parcela.divida_id)
        .where(
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
            orm.Parcela.paga_em.is_(None),
            orm.Parcela.vencimento >= hoje,
            orm.Parcela.vencimento <= limite,
            orm.Divida.excluido_em.is_(None),
        )
        .order_by(orm.Parcela.vencimento)
    ).all()

    lembretes = []
    for parcela, divida in linhas:
        dias = (parcela.vencimento - hoje).days
        # Avisar no dia da antecedência; se já estamos dentro da janela, hoje.
        data_lembrete = max(hoje, parcela.vencimento - timedelta(days=antecedencia))
        titulo, corpo = _texto(divida.credor, parcela, dias)
        lembretes.append(
            schemas.Lembrete(
                id=f"lembrete-{parcela.id}",
                dividaId=divida.id,
                parcelaId=parcela.id,
                titulo=titulo,
                corpo=corpo,
                dataLembrete=data_lembrete,
            )
        )

    return schemas.ListaLembretes(lembretes=lembretes, horaLembrete=hora)
