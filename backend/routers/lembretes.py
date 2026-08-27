from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db

router = APIRouter(prefix="/v1/lembretes", tags=["Lembretes"])


# Texto ÚNICO, genérico e constante — o padrão aprovado do guardrail 4
# (`docs/guardrails.md`, seção 4, discrição por padrão). A tela de bloqueio é
# pública e vergonha é o sentimento central deste público: uma notificação NÃO
# pode delatar credor, valor, vencimento nem a palavra "dívida" para quem estiver
# ao lado. "Sua dívida do Nubank vence amanhã" é o modelo PROIBIDO; "Você tem um
# passo hoje" é o APROVADO.
#
# Por isso o identificador da parcela viaja SÓ no payload de dados da notificação
# (`dividaId`/`parcelaId`, ver `src/notificacoes.ts`), nunca no texto visível: é
# o que o deep link do card precisa, e é invisível na tela de bloqueio.
#
# Não há formatação de moeda neste módulo — de propósito. Sem `_formatar_brl` aqui,
# valor não tem por onde vazar para o texto. Tom neutro continua obrigatório: nada
# de "ATENÇÃO", contagem regressiva ou linguagem de cobrança.
_TITULO = "Você tem um passo hoje"
_CORPO = "Abra o devo.nada para ver o que você combinou."


def _texto() -> tuple[str, str]:
    """
    Título e corpo do lembrete de parcela, discretos e idênticos para toda parcela.

    FONTE: `docs/guardrails.md`, seção 4 (discrição por padrão). O texto não
    depende de credor, valor nem vencimento — é o que garante que nenhum dos três
    apareça na tela de bloqueio.
    """
    return _TITULO, _CORPO


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
        # Avisar no dia da antecedência; se já estamos dentro da janela, hoje.
        data_lembrete = max(hoje, parcela.vencimento - timedelta(days=antecedencia))
        titulo, corpo = _texto()
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
