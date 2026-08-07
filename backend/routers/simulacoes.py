from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from config import Settings, get_settings
from db import get_db
from domain.minimo_existencial import margem_disponivel, minimo_existencial
from domain.simulacao import DividaSimulavel, economia_vs_minimo, simular

router = APIRouter(prefix="/v1/dividas", tags=["Simulacoes"])


def mes_atual() -> str:
    hoje = date.today()
    return f"{hoje.year}-{hoje.month:02d}"


def carregar_dividas_simulaveis(
    db: Session, tenant: str, ids: list[str] | None
) -> list[DividaSimulavel]:
    """
    Monta a entrada do motor a partir do que está persistido.

    Pública porque o chat (M5) monta o card de plano com exatamente as mesmas
    dívidas que o simulador usa. Duas leituras diferentes dariam dois planos
    diferentes para a mesma pergunta.

    SALDO E PARCELA MÍNIMA VÊM DAS PARCELAS REAIS quando existe cronograma. Sem
    cronograma, o saldo é o valor cobrado e a parcela mínima é ZERO — nenhum
    valor de prestação é inventado. Na prática, essa dívida só recebe pagamento
    quando chega à frente da fila, e é assim que ela deve entrar: sem número
    que o usuário não forneceu.
    """
    consulta = select(orm.Divida).where(
        orm.Divida.tenant_id == tenant,
        orm.Divida.excluido_em.is_(None),
        orm.Divida.situacao != "quitada",
    )
    if ids is not None:
        consulta = consulta.where(orm.Divida.id.in_(ids))

    dividas = db.scalars(consulta).all()

    if ids is not None and len(dividas) != len(set(ids)):
        # 404, nunca 403: um 403 confirmaria que o id existe em outro tenant.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos alguma das dívidas escolhidas."},
        )

    simulaveis: list[DividaSimulavel] = []
    for d in dividas:
        pendentes = db.scalars(
            select(orm.Parcela)
            .where(
                orm.Parcela.divida_id == d.id,
                orm.Parcela.tenant_id == tenant,
                orm.Parcela.cancelada_em.is_(None),
                orm.Parcela.paga_em.is_(None),
            )
            .order_by(orm.Parcela.vencimento)
        ).all()

        if pendentes:
            saldo = sum(p.valor for p in pendentes)
            minima = pendentes[0].valor
        else:
            saldo = d.valor_cobrado
            minima = 0

        if saldo <= 0:
            continue

        simulaveis.append(
            DividaSimulavel(
                divida_id=d.id,
                credor=d.credor,
                saldo=saldo,
                taxa_mensal_bps=d.taxa_juros_mensal,
                parcela_minima=minima,
            )
        )

    return simulaveis


def _validar_aporte(
    db: Session, tenant: str, aporte: int, dividas: list[DividaSimulavel], settings: Settings
) -> None:
    """
    Recusa aporte que invade o mínimo existencial.

    O produto não sugere plano que comprometa o básico da vida (Decreto
    11.150/2022, art. 3º, na redação do Decreto 11.567/2023, via
    domain/minimo_existencial.py).

    LIMITAÇÃO DECLARADA: sem renda informada no perfil não há o que comparar, e
    a simulação segue. Bloquear quem não preencheu a renda tiraria a ferramenta
    de quem mais precisa dela; o painel já convida a informar. O mesmo vale para
    o piso não configurado.
    """
    perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    renda = perfil.renda_mensal if perfil and perfil.renda_mensal else None
    if not renda:
        return

    minimo = minimo_existencial(settings.minimo_existencial_centavos)
    if minimo is None:
        return

    # O comprometimento aqui é a soma das MESMAS parcelas mínimas que o motor
    # usa. Reaproveitar a estimativa do painel produziria uma margem diferente
    # da que a simulação enxerga, e o usuário veria o aporte ser recusado por um
    # número que não aparece em lugar nenhum da tela.
    comprometido = sum(d.parcela_minima for d in dividas)
    margem = margem_disponivel(renda, minimo, comprometido)

    if aporte > margem:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": (
                    "Esse aporte passa do que sobra depois do mínimo para viver. "
                    "Tente um valor menor — um plano que você consegue manter vale "
                    "mais que um plano rápido no papel."
                ),
                "campo": "aporteExtraMensal",
            },
        )


@router.post("/simulacoes", response_model=schemas.RespostaSimulacao)
def simulacoes(
    entrada: schemas.SimulacaoInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Compara estratégias de quitação. É o endpoint que sustenta o ADR 0003: a
    matemática de amortização acontece aqui, nunca no aplicativo.

    Não escreve nada — simulação é leitura.
    """
    dividas = carregar_dividas_simulaveis(db, tenant, entrada.dividasIds)
    if not dividas:
        return schemas.RespostaSimulacao(simulacoes=[], comparacao=None, dividasSemTaxa=[])

    _validar_aporte(db, tenant, entrada.aporteExtraMensal, dividas, settings)

    mes = mes_atual()
    resultados: list[schemas.Simulacao] = []

    # dict.fromkeys em vez de set: preserva a ordem pedida pelo cliente e
    # ignora estratégia repetida sem simular duas vezes.
    for estrategia in dict.fromkeys(entrada.estrategias):
        r = simular(dividas, entrada.aporteExtraMensal, estrategia, mes)
        if r is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": (
                        "Com esse valor por mês, o pagamento não cobre nem os juros — "
                        "a dívida não chega a quitar. Vale tentar um aporte maior ou "
                        "renegociar a taxa antes de simular."
                    ),
                    "campo": "aporteExtraMensal",
                },
            )

        resultados.append(
            schemas.Simulacao(
                estrategia=estrategia,
                mesesAteQuitacao=r.meses_ate_quitacao,
                dataLiberdade=r.data_liberdade,
                totalJurosPagos=r.total_juros_pagos,
                totalPago=r.total_pago,
                economiaVsMinimo=economia_vs_minimo(
                    dividas, entrada.aporteExtraMensal, estrategia, mes
                ),
                ordemPagamento=[
                    schemas.ItemOrdemPagamento(
                        dividaId=q.divida_id,
                        credor=q.credor,
                        posicao=q.posicao,
                        quitadaEm=q.quitada_em,
                        jurosPagos=q.juros_pagos,
                    )
                    for q in r.ordem_pagamento
                ],
                evolucaoSaldo=[
                    schemas.PontoEvolucao(mes=p.mes, saldo=p.saldo) for p in r.evolucao_saldo
                ],
            )
        )

    return schemas.RespostaSimulacao(
        simulacoes=resultados,
        comparacao=_comparar(resultados),
        dividasSemTaxa=[
            schemas.DividaSemTaxa(dividaId=d.divida_id, credor=d.credor)
            for d in dividas
            if d.taxa_mensal_bps is None
        ],
    )


def _comparar(resultados: list[schemas.Simulacao]) -> schemas.ComparacaoEstrategias | None:
    """
    A diferença entre as duas, para o front não subtraí-las.

    Só existe com duas estratégias simuladas — com uma só, não há comparação, e
    inventar uma seria pior que omiti-la. "Melhor" aqui significa apenas MENOS
    JUROS: a copy da tela é quem explica que a estratégia sustentável vale mais
    que a ótima no papel (docs/domain.md, seção 4).
    """
    if len(resultados) != 2:
        return None

    primeira, segunda = resultados
    melhor, pior = (
        (primeira, segunda)
        if primeira.totalJurosPagos <= segunda.totalJurosPagos
        else (segunda, primeira)
    )
    return schemas.ComparacaoEstrategias(
        melhorEstrategia=melhor.estrategia,
        diferencaJuros=pior.totalJurosPagos - melhor.totalJurosPagos,
        diferencaMeses=abs(pior.mesesAteQuitacao - melhor.mesesAteQuitacao),
    )
