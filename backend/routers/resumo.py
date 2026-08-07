from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from config import Settings, get_settings
from db import get_db
from domain.minimo_existencial import margem_disponivel, minimo_existencial
from domain.parcelas import situacao_da_parcela
from domain.resumo import (
    ParcelaEstimada,
    comprometimento_mensal,
    comprometimento_renda_bps,
    custo_medio_juros_mensal,
)
from leitura import capacidade_atual

router = APIRouter(prefix="/v1/dividas", tags=["Resumo"])

ORDEM_CRITICIDADE = ["juros_abusivos", "com_garantia", "essencial", "consumo"]


def _mes_atual() -> str:
    hoje = date.today()
    return f"{hoje.year}-{hoje.month:02d}"


def _registrar_snapshot(db: Session, tenant: str, mes: str, saldo: int) -> None:
    """
    Grava a foto do saldo do mês, se ainda não houver.

    Só escreve o MÊS CORRENTE e só uma vez: consultar o resumo dez vezes hoje
    não pode gerar dez pontos no gráfico. É o que faz `evolucaoSaldo` acumular
    dado real a partir de hoje, em vez de inventar histórico retroativo.
    """
    if mes != _mes_atual():
        return

    existente = db.scalar(
        select(orm.SaldoSnapshot).where(
            orm.SaldoSnapshot.tenant_id == tenant, orm.SaldoSnapshot.mes == mes
        )
    )
    if existente is None:
        db.add(orm.SaldoSnapshot(tenant_id=tenant, mes=mes, saldo=saldo))
    else:
        existente.saldo = saldo
    db.commit()


def _renda_minimo_e_margem(
    db: Session, tenant: str, settings: Settings, comprometido: int
) -> tuple[int | None, int | None, int | None]:
    """
    De onde o painel tira renda, mínimo existencial e margem.

    O CAIXA É A FONTE DA RENDA (M7); o perfil é fallback. `fonte_renda` é onde a
    renda passou a morar, e a migration do M7 já declarava que `renda_mensal`
    viraria leitura derivada. Enquanto esta rota lia só a coluna, quem preenchia
    o caixa via o painel vazio — dois lugares para informar a mesma coisa, e o
    número aparecendo em nenhum. É o mesmo caminho de `simulacoes._validar_aporte`.

    A RENDA É A LÍQUIDA, não a bruta. O limite de 30% se lê sobre o que de fato
    entra, e quem é PJ recebe dinheiro que em parte não é dele. Sem `imposto_bps`
    informado nada é reservado e a líquida degrada para a bruta — ninguém perde
    número por não ter preenchido imposto.

    A MARGEM SÓ VEM DO CAIXA QUANDO O CAIXA CONHECE A SAÍDA. Renda informada e
    nenhum gasto é o Nível 0: sabemos o que entra e nada do que sai. A margem ali
    seria a renda quase inteira — o número mais perigoso que este produto poderia
    exibir, porque tem cara de calculado e afirma que a pessoa pode comprometer
    tudo. Sem gasto, provisão ou pote registrado, a margem continua saindo do
    piso legal, que é o proxy de custo de vida que a lei dá.

    Quando ela vem do caixa, é `aporte_maximo`, não `capacidade_hoje`. As duas
    descontam custo de vida real, provisões e potes; só `aporte_maximo` desconta
    também as parcelas que já existem, que é o que a margem antiga
    (`renda − mínimo − comprometido`) respondia e o que o rótulo "Sobra por mês"
    promete. `capacidade_hoje` é o total que PODE ir para dívida, parcelas
    incluídas — exibi-lo como sobra contaria duas vezes o dinheiro que já sai. De
    quebra, `aporte_maximo` é o mesmo teto que o simulador aplica ao aporte
    extra: o painel para de anunciar uma sobra que o simulador recusa.
    """
    caixa = capacidade_atual(db, tenant, settings)
    if caixa is not None and caixa.renda_liquida > 0:
        conhece_saida = (
            caixa.essenciais > 0
            or caixa.nao_essenciais > 0
            or caixa.provisao_mensal > 0
            or caixa.aporte_reserva > 0
            or caixa.aporte_aposentadoria > 0
        )
        if conhece_saida:
            return caixa.renda_liquida, caixa.minimo_existencial, caixa.aporte_maximo
        renda, minimo = caixa.renda_liquida, caixa.minimo_existencial
    else:
        perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
        renda = perfil.renda_mensal if perfil and perfil.renda_mensal else None
        if not renda:
            return None, None, None
        minimo = minimo_existencial(settings.minimo_existencial_centavos)

    # Sem piso configurado não há margem: subtrair zero devolveria um número
    # otimista com cara de calculado. Ausente é a resposta honesta.
    margem = margem_disponivel(renda, minimo, comprometido) if minimo is not None else None
    return renda, minimo, margem


@router.get("/resumo", response_model=schemas.RespostaResumo)
def resumo(
    mes: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Agregados do painel. Nada aqui é calculável pelo cliente (ADR 0003).
    """
    mes_alvo = mes or _mes_atual()
    if mes_alvo > _mes_atual():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Ainda não há dados para um mês que não aconteceu.", "campo": "mes"},
        )

    dividas = db.scalars(
        select(orm.Divida).where(
            orm.Divida.tenant_id == tenant, orm.Divida.excluido_em.is_(None)
        )
    ).all()

    ativas = [d for d in dividas if d.situacao != "quitada"]
    total_devido = sum(d.valor_cobrado for d in ativas)

    ano = int(mes_alvo[:4])
    total_quitado_ano = sum(
        d.valor_pago or 0
        for d in dividas
        if d.situacao == "quitada" and d.data_quitacao and d.data_quitacao.year == ano
    )

    itens = [
        ParcelaEstimada(
            valor_cobrado=d.valor_cobrado,
            total_parcelas=d.total_parcelas,
            taxa_juros_mensal=d.taxa_juros_mensal,
            saldo=d.valor_cobrado,
        )
        for d in ativas
    ]

    # Distribuição por criticidade, na ordem de ataque de docs/domain.md.
    por_tipo: dict[str, list[orm.Divida]] = defaultdict(list)
    for d in ativas:
        por_tipo[d.tipo].append(d)

    por_criticidade = [
        schemas.TotalPorCriticidade(
            tipo=tipo,  # type: ignore[arg-type]
            total=sum(d.valor_cobrado for d in por_tipo[tipo]),
            quantidade=len(por_tipo[tipo]),
        )
        for tipo in ORDEM_CRITICIDADE
        if por_tipo.get(tipo)
    ]

    # Parcelas pendentes, com o credor junto: servem para o comprometimento do
    # mês E para os próximos vencimentos. Com elas, as DUAS aproximações
    # declaradas em docs/backend.md deixam de existir.
    pendentes = db.execute(
        select(orm.Parcela, orm.Divida.credor)
        .join(orm.Divida, orm.Divida.id == orm.Parcela.divida_id)
        .where(
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
            orm.Parcela.paga_em.is_(None),
            orm.Divida.excluido_em.is_(None),
        )
        .order_by(orm.Parcela.vencimento)
    ).all()

    do_mes = [
        p.valor for p, _ in pendentes if f"{p.vencimento.year}-{p.vencimento.month:02d}" == mes_alvo
    ]
    comprometido = comprometimento_mensal(itens, do_mes if pendentes else None)
    renda, minimo, margem = _renda_minimo_e_margem(db, tenant, settings, comprometido)
    comprometimento_bps = comprometimento_renda_bps(comprometido, renda) if renda else None

    _registrar_snapshot(db, tenant, mes_alvo, total_devido)

    evolucao = db.scalars(
        select(orm.SaldoSnapshot)
        .where(orm.SaldoSnapshot.tenant_id == tenant, orm.SaldoSnapshot.mes <= mes_alvo)
        .order_by(orm.SaldoSnapshot.mes)
    ).all()

    return schemas.RespostaResumo(
        resumo=schemas.ResumoDividas(
            totalDevido=total_devido,
            totalQuitadoNoAno=total_quitado_ano,
            quantidadeDividas=len(ativas),
            custoMedioJurosMensal=custo_medio_juros_mensal(itens),
            rendaMensal=renda,
            comprometimentoRenda=comprometimento_bps,
            minimoExistencial=minimo,
            margemDisponivel=margem,
            porCriticidade=por_criticidade,
            proximosVencimentos=[
                schemas.VencimentoProximo(
                    dividaId=p.divida_id,
                    credor=credor,
                    valor=p.valor,
                    vencimento=p.vencimento,
                    situacao=situacao_da_parcela(p.vencimento, p.paga_em),  # type: ignore[arg-type]
                )
                for p, credor in pendentes[:5]
            ],
            evolucaoSaldo=[
                schemas.PontoEvolucao(mes=s.mes, saldo=s.saldo) for s in evolucao[-12:]
            ],
        )
    )
