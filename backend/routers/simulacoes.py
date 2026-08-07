from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from config import Settings, get_settings
from db import get_db
from domain.caixa import PRAZO_MAXIMO_REPACTUACAO_MESES
from domain.minimo_existencial import margem_disponivel, minimo_existencial
from domain.simulacao import DividaSimulavel, economia_vs_minimo, simular
from leitura import capacidade_atual, carregar_dividas_simulaveis

router = APIRouter(prefix="/v1/dividas", tags=["Simulacoes"])


def mes_atual() -> str:
    hoje = date.today()
    return f"{hoje.year}-{hoje.month:02d}"


def _validar_aporte(
    db: Session, tenant: str, aporte: int, dividas: list[DividaSimulavel], settings: Settings
) -> None:
    """
    Recusa aporte que a pessoa não tem como sustentar.

    DOIS CRITÉRIOS, e o primeiro é muito melhor que o segundo.

    1. CAPACIDADE REAL (M7), quando o usuário preencheu o caixa. O teto é
       `aporte_maximo` — o que sobra depois de imposto, custo de vida real,
       provisões e os potes que ele definiu, já descontadas as parcelas atuais.

    2. MÍNIMO EXISTENCIAL, o comportamento antigo, para quem ainda não preencheu
       o caixa. Ele usa o piso legal (R$ 600,00) como se fosse custo de vida, e
       isso é OTIMISTA a ponto de ser perigoso: aceita plano que consome quase
       toda a renda de quem tem aluguel e carro. Continua aqui porque recusar
       tudo de quem não preencheu o caixa tiraria a ferramenta de quem ainda não
       chegou nela — mas é fallback, não o caminho principal.

    LIMITAÇÃO DECLARADA: sem caixa e sem renda no perfil não há o que comparar,
    e a simulação segue sem validação.
    """
    caixa = capacidade_atual(db, tenant, settings)
    if caixa is not None:
        if aporte > caixa.aporte_maximo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    # Sem valor na mensagem (guardrail 5). O número certo já
                    # está na tela de caixa, e repeti-lo aqui vazaria renda para
                    # um corpo de erro.
                    "message": (
                        "Esse valor passa do que sobra no seu mês depois das contas, "
                        "das provisões e do que você já separa. Um plano que você "
                        "consegue manter vale mais que um plano rápido no papel."
                    ),
                    "campo": "aporteExtraMensal",
                },
            )
        return

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
                acimaDoPrazoDeRepactuacao=(
                    r.meses_ate_quitacao > PRAZO_MAXIMO_REPACTUACAO_MESES
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
