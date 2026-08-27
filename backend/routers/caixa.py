from dataclasses import replace
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from config import Settings, get_settings
from db import get_db
from domain.caixa import (
    EntradaCaixa,
    ProvisaoPendente,
    aporte_de_provisao,
    caixa_defasado,
    calcular_caixa,
    meses_ate_vencimento,
    meses_entre,
    percentual_invade_o_piso,
    renda_tipica,
    respiro_invade_o_piso,
)
from domain.dinheiro import aplicar_percentual
from domain.simulacao import custo_em_meses
from leitura import carregar_dividas_simulaveis, montar_entrada_caixa

router = APIRouter(prefix="/v1/caixa", tags=["Caixa"])

"""
Módulo de caixa.

Toda a aritmética vive em `domain/caixa.py`, que é puro. Este arquivo carrega,
persiste e traduz para o contrato — nenhuma conta acontece aqui.

DADO MAIS SENSÍVEL DO PRODUTO: renda e gasto não vão para log nem para mensagem
de erro (guardrail 5). Nenhuma `message` deste router carrega valor.
"""


def _nao_encontrado(o_que: str) -> HTTPException:
    """404, nunca 403: um 403 confirmaria que o id existe em outro tenant."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"message": f"Não encontramos {o_que}."},
    )


# --- Leitura da cascata ------------------------------------------------------


def _mes_de_hoje() -> str:
    hoje = date.today()
    return f"{hoje.year}-{hoje.month:02d}"


def _ultimo_fechamento(db: Session, tenant: str) -> str | None:
    return db.scalar(
        select(orm.FechamentoMes.mes)
        .where(orm.FechamentoMes.tenant_id == tenant)
        .order_by(orm.FechamentoMes.mes.desc())
        .limit(1)
    )


def _caixa_schema(db: Session, tenant: str, settings: Settings) -> schemas.Caixa:
    """
    Traduz a cascata para o contrato e acrescenta a defasagem.

    A defasagem é decidida em `domain.caixa_defasado`, não aqui: "a partir de
    quando o número está velho" é escolha de método, e escolha de método mora no
    domínio com o porquê no docstring.
    """
    # A VIRADA DO MÊS É APURADA NA LEITURA, antes de montar a entrada: sem job e
    # sem cron, é a primeira leitura que percebe que o mês mudou que rola o
    # saldo (api-contract 3.13). Idempotente por `ultimo_mes_apurado`.
    _apurar_virada_do_mes(db, tenant)
    caixa = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
    ultimo = _ultimo_fechamento(db, tenant)
    meses = meses_entre(ultimo, _mes_de_hoje()) if ultimo else None
    return schemas.Caixa(
        rendaBrutaTipica=caixa.renda_bruta_tipica,
        origemRenda=caixa.origem_renda,  # type: ignore[arg-type]
        impostoReservado=caixa.imposto_reservado,
        rendaLiquida=caixa.renda_liquida,
        essenciais=caixa.essenciais,
        naoEssenciais=caixa.nao_essenciais,
        provisaoMensal=caixa.provisao_mensal,
        aporteReserva=caixa.aporte_reserva,
        aporteAposentadoria=caixa.aporte_aposentadoria,
        comprometidoDividas=caixa.comprometido_dividas,
        capacidadeHoje=caixa.capacidade_hoje,
        capacidadeMaxima=caixa.capacidade_maxima,
        aporteMaximo=caixa.aporte_maximo,
        respiro=caixa.respiro,
        respiroAtivo=caixa.respiro_ativo,
        respiroUsadoNoMes=caixa.respiro_usado_no_mes,
        respiroDisponivelNoMes=caixa.respiro_disponivel_no_mes,
        respiroSaldoAcumulado=caixa.respiro_saldo_acumulado,
        compromissoPercentualBps=caixa.compromisso_percentual_bps,
        compromissoPercentual=caixa.compromisso_percentual,
        impostoNaoDeclarado=caixa.imposto_nao_declarado,
        mesAncoraRenda=caixa.mes_ancora_renda,
        minimoExistencial=caixa.minimo_existencial,
        minimoExistencialVigenteEm=settings.minimo_existencial_vigente_em or None,
        abaixoDoPiso=caixa.abaixo_do_piso,
        naoFecha=caixa.nao_fecha,
        preenchimento=caixa.preenchimento,  # type: ignore[arg-type]
        ultimoFechamentoMes=ultimo,
        mesesDesdeFechamento=meses,
        caixaDefasado=caixa_defasado(meses),
    )


@router.get("", response_model=schemas.RespostaCaixa)
def obter(
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """A cascata atual. Leitura pura — o snapshot é gravado pelas mutações."""
    return schemas.RespostaCaixa(caixa=_caixa_schema(db, tenant, settings))


def registrar_snapshot(db: Session, tenant: str, settings: Settings) -> None:
    """
    Congela a cascata depois de toda mudança. APPEND-ONLY: sempre INSERT.

    É o que responde, seis meses depois, "com base em qual renda eu propus
    aquele acordo?". Um UPDATE aqui apagaria justamente a resposta.
    """
    c = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
    db.add(
        orm.CaixaSnapshot(
            tenant_id=tenant,
            renda_bruta_tipica=c.renda_bruta_tipica,
            origem_renda=c.origem_renda,
            imposto_reservado=c.imposto_reservado,
            renda_liquida=c.renda_liquida,
            essenciais=c.essenciais,
            nao_essenciais=c.nao_essenciais,
            provisao_mensal=c.provisao_mensal,
            aporte_reserva=c.aporte_reserva,
            aporte_aposentadoria=c.aporte_aposentadoria,
            comprometido_dividas=c.comprometido_dividas,
            capacidade_hoje=c.capacidade_hoje,
            capacidade_maxima=c.capacidade_maxima,
            aporte_maximo=c.aporte_maximo,
            minimo_existencial=c.minimo_existencial,
            nao_fecha=c.nao_fecha,
            # `None` para quem não declarou respiro, e é a verdade: a foto não
            # pode afirmar zero declarado por quem não escolheu nada.
            respiro=c.respiro,
            # Mesma regra, mesma razão: a linha que derruba a
            # `capacidade_maxima` tem de aparecer na foto que a explica. Já vem
            # em centavos da cascata, e `None` de quem nunca declarou atravessa
            # até aqui sem virar zero.
            compromisso_percentual=c.compromisso_percentual,
        )
    )
    db.commit()


@router.get("/historico", response_model=schemas.HistoricoCaixa)
def historico(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    linhas = db.scalars(
        select(orm.CaixaSnapshot)
        .where(orm.CaixaSnapshot.tenant_id == tenant)
        .order_by(orm.CaixaSnapshot.calculado_em.desc())
        .limit(50)
    ).all()
    return schemas.HistoricoCaixa(
        snapshots=[
            schemas.SnapshotCaixa(
                id=s.id,
                calculadoEm=s.calculado_em,
                rendaBrutaTipica=s.renda_bruta_tipica,
                rendaLiquida=s.renda_liquida,
                essenciais=s.essenciais,
                capacidadeHoje=s.capacidade_hoje,
                capacidadeMaxima=s.capacidade_maxima,
                aporteMaximo=s.aporte_maximo,
                naoFecha=s.nao_fecha,
            )
            for s in linhas
        ]
    )


# --- Fechamento do mês -------------------------------------------------------


def _mes_anterior(mes: str) -> str:
    """`AAAA-MM` − 1, atravessando o ano."""
    ano, m = int(mes[:4]), int(mes[5:7])
    return f"{ano - 1}-12" if m == 1 else f"{ano}-{m - 1:02d}"


@router.get("/fechamento", response_model=schemas.RespostaFechamento)
def propor_fechamento(
    mes: str | None = None,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    O que precisa ser confirmado neste mês, já pré-preenchido.

    PROPÕE, NÃO GRAVA. Nada aqui toca o banco: a confirmação é um POST separado,
    e é o usuário quem a dispara. Pré-preencher e pedir confirmação custa dois
    toques; replicar em silêncio faria um número que ninguém conferiu entrar na
    capacidade — e daí no plano que a pessoa leva a um credor (guardrail 8.1).

    Entram só as duas coisas que mudam de valor: o recebimento de fonte
    `variavel` e o gasto `fixo=False`. Gasto fixo e provisão são registros
    permanentes e já valem sem redigitar — é a forma do modelo que resolve a
    recorrência, não uma função de cópia.
    """
    alvo = mes or _mes_de_hoje()
    anterior = _mes_anterior(alvo)
    itens: list[schemas.ItemFechamento] = []

    fontes = db.scalars(
        select(orm.FonteRenda).where(
            orm.FonteRenda.tenant_id == tenant,
            orm.FonteRenda.ativo.is_(True),
            orm.FonteRenda.variavel.is_(True),
        )
    ).all()
    for f in fontes:
        # O valor do mês alvo, se já registrado, tem precedência: quem está
        # refazendo um fechamento vê o que gravou, não o mês anterior de novo.
        deste_mes = db.scalar(
            select(orm.Recebimento.valor).where(
                orm.Recebimento.tenant_id == tenant,
                orm.Recebimento.fonte_id == f.id,
                orm.Recebimento.mes == alvo,
            )
        )
        do_anterior = db.scalar(
            select(orm.Recebimento.valor).where(
                orm.Recebimento.tenant_id == tenant,
                orm.Recebimento.fonte_id == f.id,
                orm.Recebimento.mes == anterior,
            )
        )
        if deste_mes is not None:
            sugerido, origem, referencia = deste_mes, "valor_atual", None
        elif do_anterior is not None:
            sugerido, origem, referencia = do_anterior, "mes_anterior", anterior
        else:
            # Sem referência o campo vai VAZIO, nunca zero: zero afirmaria que a
            # pessoa não recebeu nada.
            sugerido, origem, referencia = None, "sem_referencia", None

        itens.append(
            schemas.ItemFechamento(
                tipo="recebimento",
                id=f.id,
                descricao=f.nome,
                valorSugerido=sugerido,
                origem=origem,  # type: ignore[arg-type]
                mesDeReferencia=referencia,
            )
        )

    variaveis = db.scalars(
        select(orm.Gasto).where(
            orm.Gasto.tenant_id == tenant,
            orm.Gasto.ativo.is_(True),
            orm.Gasto.fixo.is_(False),
        )
    ).all()
    for g in variaveis:
        itens.append(
            schemas.ItemFechamento(
                tipo="gasto",
                id=g.id,
                descricao=g.descricao,
                valorSugerido=g.valor_mensal,
                origem="valor_atual",
            )
        )

    return schemas.RespostaFechamento(
        proposta=schemas.PropostaFechamento(mes=alvo, itens=itens)
    )


@router.post("/fechamento", response_model=schemas.RespostaConfirmacao)
def confirmar_fechamento(
    entrada: schemas.ConfirmacaoFechamento,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Grava o que o usuário confirmou, e só isso.

    ITEM OMITIDO NÃO É GRAVADO e não vira zero — quem não confirmou uma linha
    não afirmou que ela é zero. Mesma disciplina do `extracaoParaProposta`, que
    descarta campo sem evidência mesmo tendo o valor em mãos.

    UMA TRANSAÇÃO E UM SNAPSHOT. As mutações avulsas do módulo gravam um
    snapshot cada; um fechamento com oito itens produziria oito fotos idênticas
    e sujaria o histórico que existe para responder "com base em qual renda eu
    propus aquele acordo?".
    """
    for item in entrada.itens:
        if item.tipo == "recebimento":
            _buscar_fonte(db, tenant, item.id)
            r = db.scalar(
                select(orm.Recebimento).where(
                    orm.Recebimento.tenant_id == tenant,
                    orm.Recebimento.fonte_id == item.id,
                    orm.Recebimento.mes == entrada.mes,
                )
            )
            if r is None:
                db.add(
                    orm.Recebimento(
                        tenant_id=tenant,
                        fonte_id=item.id,
                        mes=entrada.mes,
                        valor=item.valor,
                    )
                )
            else:
                r.valor = item.valor
        else:
            g = db.scalar(
                select(orm.Gasto).where(
                    orm.Gasto.tenant_id == tenant, orm.Gasto.id == item.id
                )
            )
            if g is None:
                raise _nao_encontrado("esse gasto")
            g.valor_mensal = item.valor

    fechamento = db.scalar(
        select(orm.FechamentoMes).where(
            orm.FechamentoMes.tenant_id == tenant, orm.FechamentoMes.mes == entrada.mes
        )
    )
    if fechamento is None:
        db.add(orm.FechamentoMes(tenant_id=tenant, mes=entrada.mes))
    else:
        # Refechar o mesmo mês atualiza a confirmação em vez de duplicar.
        fechamento.confirmado_em = func.now()

    db.commit()
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaConfirmacao(caixa=_caixa_schema(db, tenant, settings))


# --- Fontes de renda ---------------------------------------------------------


def _fonte_schema(f: orm.FonteRenda) -> schemas.FonteRenda:
    return schemas.FonteRenda(
        id=f.id,
        nome=f.nome,
        tipo=f.tipo,  # type: ignore[arg-type]
        valorTipicoInformado=f.valor_tipico_informado,
        variavel=f.variavel,
        ativo=f.ativo,
        impostoBps=f.imposto_bps,
        diaPagamento=f.dia_pagamento,
    )


def _buscar_fonte(db: Session, tenant: str, fonte_id: str) -> orm.FonteRenda:
    f = db.scalar(
        select(orm.FonteRenda).where(
            orm.FonteRenda.id == fonte_id, orm.FonteRenda.tenant_id == tenant
        )
    )
    if f is None:
        raise _nao_encontrado("essa fonte de renda")
    return f


@router.get("/fontes", response_model=schemas.ListaFontesRenda)
def listar_fontes(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    fontes = db.scalars(
        select(orm.FonteRenda)
        .where(orm.FonteRenda.tenant_id == tenant)
        .order_by(orm.FonteRenda.criada_em)
    ).all()
    return schemas.ListaFontesRenda(fontes=[_fonte_schema(f) for f in fontes])


@router.post("/fontes", response_model=schemas.RespostaFonteRenda, status_code=201)
def criar_fonte(
    entrada: schemas.NovaFonteRenda,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    f = orm.FonteRenda(
        tenant_id=tenant,
        nome=entrada.nome,
        tipo=entrada.tipo,
        valor_tipico_informado=entrada.valorTipicoInformado,
        variavel=entrada.variavel,
        ativo=entrada.ativo,
        imposto_bps=entrada.impostoBps,
        dia_pagamento=entrada.diaPagamento,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaFonteRenda(fonte=_fonte_schema(f))


@router.patch("/fontes/{fonte_id}", response_model=schemas.RespostaFonteRenda)
def editar_fonte(
    fonte_id: str,
    entrada: schemas.FonteRendaPatch,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    f = _buscar_fonte(db, tenant, fonte_id)
    dados = entrada.model_dump(exclude_unset=True)
    for campo, coluna in (
        ("nome", "nome"),
        ("tipo", "tipo"),
        ("valorTipicoInformado", "valor_tipico_informado"),
        ("variavel", "variavel"),
        ("ativo", "ativo"),
        ("impostoBps", "imposto_bps"),
        ("diaPagamento", "dia_pagamento"),
    ):
        if campo in dados:
            setattr(f, coluna, dados[campo])
    db.commit()
    db.refresh(f)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaFonteRenda(fonte=_fonte_schema(f))


@router.delete("/fontes/{fonte_id}", status_code=204)
def excluir_fonte(
    fonte_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Exclusão de verdade, ao contrário de dívida.

    Fonte de renda cadastrada errado é ruído de cadastro, não histórico
    financeiro. Quem quer preservar o histórico usa `ativo: false`, que é a
    chave de liga/desliga e mantém os recebimentos.
    """
    f = _buscar_fonte(db, tenant, fonte_id)
    db.delete(f)
    db.commit()
    registrar_snapshot(db, tenant, settings)


@router.post(
    "/fontes/{fonte_id}/recebimentos",
    response_model=schemas.RespostaRecebimento,
    status_code=201,
)
def registrar_recebimento(
    fonte_id: str,
    entrada: schemas.NovoRecebimento,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    O que de fato caiu no mês.

    Reenviar o mesmo mês SOBRESCREVE em vez de duplicar: corrigir um valor
    digitado errado é o caso comum, e duas linhas do mesmo mês fariam o pior mês
    ser calculado sobre um dado fantasma.
    """
    _buscar_fonte(db, tenant, fonte_id)

    r = db.scalar(
        select(orm.Recebimento).where(
            orm.Recebimento.tenant_id == tenant,
            orm.Recebimento.fonte_id == fonte_id,
            orm.Recebimento.mes == entrada.mes,
        )
    )
    if r is None:
        r = orm.Recebimento(
            tenant_id=tenant, fonte_id=fonte_id, mes=entrada.mes, valor=entrada.valor
        )
        db.add(r)
    else:
        r.valor = entrada.valor
    db.commit()
    db.refresh(r)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaRecebimento(
        recebimento=schemas.Recebimento(id=r.id, mes=r.mes, valor=r.valor)
    )


# --- Eventos previsíveis (M12, ADR 0021, decisão 2) --------------------------
#
# 13º, férias e o que mais cai uma vez por ano. NÃO ENTRAM NA CASCATA e não
# ocupam vaga na janela do `min()`: `GET /v1/caixa` não muda nenhum número por
# causa deles. São munição de negociação à vista — o app reconhece que existem e
# quando caem, e o valor é declarado pelo usuário.


def _evento_schema(e: orm.EventoPrevisivel) -> schemas.EventoPrevisivel:
    return schemas.EventoPrevisivel(
        id=e.id,
        tipo=e.tipo,  # type: ignore[arg-type]
        mesPrevisto=e.mes_previsto,
        valor=e.valor,
        fonteId=e.fonte_id,
    )


def _buscar_evento(db: Session, tenant: str, evento_id: str) -> orm.EventoPrevisivel:
    e = db.scalar(
        select(orm.EventoPrevisivel).where(
            orm.EventoPrevisivel.id == evento_id,
            orm.EventoPrevisivel.tenant_id == tenant,
        )
    )
    if e is None:
        raise _nao_encontrado("esse evento previsível")
    return e


@router.get("/eventos-previsiveis", response_model=schemas.ListaEventosPrevisiveis)
def listar_eventos_previsiveis(
    db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)
):
    linhas = db.scalars(
        select(orm.EventoPrevisivel)
        .where(orm.EventoPrevisivel.tenant_id == tenant)
        .order_by(orm.EventoPrevisivel.mes_previsto)
    ).all()
    return schemas.ListaEventosPrevisiveis(eventos=[_evento_schema(e) for e in linhas])


@router.post(
    "/eventos-previsiveis",
    response_model=schemas.RespostaEventoPrevisivel,
    status_code=201,
)
def criar_evento_previsivel(
    entrada: schemas.NovoEventoPrevisivel,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    # Fonte informada tem de ser do tenant: 404, nunca 403, como o resto do
    # módulo. Sem `fonteId` o evento é do tenant sem fonte identificada.
    if entrada.fonteId is not None:
        _buscar_fonte(db, tenant, entrada.fonteId)

    e = orm.EventoPrevisivel(
        tenant_id=tenant,
        tipo=entrada.tipo,
        mes_previsto=entrada.mesPrevisto,
        valor=entrada.valor,
        fonte_id=entrada.fonteId,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaEventoPrevisivel(evento=_evento_schema(e))


@router.patch(
    "/eventos-previsiveis/{evento_id}",
    response_model=schemas.RespostaEventoPrevisivel,
)
def editar_evento_previsivel(
    evento_id: str,
    entrada: schemas.EventoPrevisivelPatch,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    e = _buscar_evento(db, tenant, evento_id)
    dados = entrada.model_dump(exclude_unset=True)
    if dados.get("fonteId") is not None:
        _buscar_fonte(db, tenant, dados["fonteId"])
    for campo, coluna in (
        ("tipo", "tipo"),
        ("mesPrevisto", "mes_previsto"),
        ("valor", "valor"),
        ("fonteId", "fonte_id"),
    ):
        if campo in dados:
            setattr(e, coluna, dados[campo])
    db.commit()
    db.refresh(e)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaEventoPrevisivel(evento=_evento_schema(e))


@router.delete("/eventos-previsiveis/{evento_id}", status_code=204)
def excluir_evento_previsivel(
    evento_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    e = _buscar_evento(db, tenant, evento_id)
    db.delete(e)
    db.commit()
    registrar_snapshot(db, tenant, settings)


# --- Gastos ------------------------------------------------------------------


def _gasto_schema(g: orm.Gasto) -> schemas.Gasto:
    return schemas.Gasto(
        id=g.id,
        descricao=g.descricao,
        categoria=g.categoria,  # type: ignore[arg-type]
        essencial=g.essencial,
        fixo=g.fixo,
        valorMensal=g.valor_mensal,
        ativo=g.ativo,
    )


@router.get("/gastos", response_model=schemas.ListaGastos)
def listar_gastos(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    gastos = db.scalars(
        select(orm.Gasto).where(orm.Gasto.tenant_id == tenant).order_by(orm.Gasto.criado_em)
    ).all()
    return schemas.ListaGastos(gastos=[_gasto_schema(g) for g in gastos])


@router.post("/gastos", response_model=schemas.RespostaGasto, status_code=201)
def criar_gasto(
    entrada: schemas.NovoGasto,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    g = orm.Gasto(
        tenant_id=tenant,
        descricao=entrada.descricao,
        categoria=entrada.categoria,
        essencial=entrada.essencial,
        fixo=entrada.fixo,
        valor_mensal=entrada.valorMensal,
        ativo=entrada.ativo,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaGasto(gasto=_gasto_schema(g))


@router.patch("/gastos/{gasto_id}", response_model=schemas.RespostaGasto)
def editar_gasto(
    gasto_id: str,
    entrada: schemas.GastoPatch,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    g = db.scalar(select(orm.Gasto).where(orm.Gasto.id == gasto_id, orm.Gasto.tenant_id == tenant))
    if g is None:
        raise _nao_encontrado("esse gasto")

    dados = entrada.model_dump(exclude_unset=True)
    for campo, coluna in (
        ("descricao", "descricao"),
        ("categoria", "categoria"),
        ("essencial", "essencial"),
        ("fixo", "fixo"),
        ("valorMensal", "valor_mensal"),
        ("ativo", "ativo"),
    ):
        if campo in dados:
            setattr(g, coluna, dados[campo])
    db.commit()
    db.refresh(g)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaGasto(gasto=_gasto_schema(g))


@router.delete("/gastos/{gasto_id}", status_code=204)
def excluir_gasto(
    gasto_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    g = db.scalar(select(orm.Gasto).where(orm.Gasto.id == gasto_id, orm.Gasto.tenant_id == tenant))
    if g is None:
        raise _nao_encontrado("esse gasto")
    db.delete(g)
    db.commit()
    registrar_snapshot(db, tenant, settings)


# --- Provisões anuais --------------------------------------------------------


def _provisao_schema(p: orm.ProvisaoAnual, mes_atual: int) -> schemas.Provisao:
    pendente = ProvisaoPendente(
        descricao=p.descricao,
        valor_anual=p.valor_anual,
        saldo_acumulado=p.saldo_acumulado,
        mes_vencimento=p.mes_vencimento,
    )
    return schemas.Provisao(
        id=p.id,
        descricao=p.descricao,
        valorAnual=p.valor_anual,
        mesVencimento=p.mes_vencimento,
        saldoAcumulado=p.saldo_acumulado,
        ativa=p.ativa,
        aporteMensal=aporte_de_provisao(pendente, mes_atual),
        mesesRestantes=meses_ate_vencimento(p.mes_vencimento, mes_atual),
    )


@router.get("/provisoes", response_model=schemas.ListaProvisoes)
def listar_provisoes(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    mes = date.today().month
    linhas = db.scalars(
        select(orm.ProvisaoAnual)
        .where(orm.ProvisaoAnual.tenant_id == tenant)
        .order_by(orm.ProvisaoAnual.mes_vencimento)
    ).all()
    return schemas.ListaProvisoes(provisoes=[_provisao_schema(p, mes) for p in linhas])


@router.post("/provisoes", response_model=schemas.RespostaProvisao, status_code=201)
def criar_provisao(
    entrada: schemas.NovaProvisao,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    p = orm.ProvisaoAnual(
        tenant_id=tenant,
        descricao=entrada.descricao,
        valor_anual=entrada.valorAnual,
        mes_vencimento=entrada.mesVencimento,
        saldo_acumulado=entrada.saldoAcumulado,
        ativa=entrada.ativa,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaProvisao(provisao=_provisao_schema(p, date.today().month))


@router.patch("/provisoes/{provisao_id}", response_model=schemas.RespostaProvisao)
def editar_provisao(
    provisao_id: str,
    entrada: schemas.ProvisaoPatch,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    p = db.scalar(
        select(orm.ProvisaoAnual).where(
            orm.ProvisaoAnual.id == provisao_id, orm.ProvisaoAnual.tenant_id == tenant
        )
    )
    if p is None:
        raise _nao_encontrado("essa provisão")

    dados = entrada.model_dump(exclude_unset=True)
    for campo, coluna in (
        ("descricao", "descricao"),
        ("valorAnual", "valor_anual"),
        ("mesVencimento", "mes_vencimento"),
        ("saldoAcumulado", "saldo_acumulado"),
        ("ativa", "ativa"),
    ):
        if campo in dados:
            setattr(p, coluna, dados[campo])
    db.commit()
    db.refresh(p)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaProvisao(provisao=_provisao_schema(p, date.today().month))


@router.delete("/provisoes/{provisao_id}", status_code=204)
def excluir_provisao(
    provisao_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    p = db.scalar(
        select(orm.ProvisaoAnual).where(
            orm.ProvisaoAnual.id == provisao_id, orm.ProvisaoAnual.tenant_id == tenant
        )
    )
    if p is None:
        raise _nao_encontrado("essa provisão")
    db.delete(p)
    db.commit()
    registrar_snapshot(db, tenant, settings)


# --- Metas -------------------------------------------------------------------


def _metas_schema(p: orm.Perfil | None) -> schemas.MetasCaixa:
    """Perfil inexistente devolve campos AUSENTES, nunca zerados."""
    if p is None:
        return schemas.MetasCaixa()
    return schemas.MetasCaixa(
        impostoBps=p.imposto_bps,
        reservaMetaMeses=p.reserva_meta_meses,
        reservaSaldo=p.reserva_saldo,
        reservaAporte=p.reserva_aporte,
        aposentadoriaAporte=p.aposentadoria_aporte,
        rendimentoEsperadoBps=p.rendimento_esperado_bps,
        compromissoPercentualBps=p.compromisso_percentual_bps,
    )


@router.get("/metas", response_model=schemas.RespostaMetas)
def obter_metas(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    p = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    return schemas.RespostaMetas(metas=_metas_schema(p))


@router.put("/metas", response_model=schemas.RespostaMetas)
def gravar_metas(
    entrada: schemas.MetasCaixa,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Renda e metas são dado sensível: não vão para log nem para erro
    (guardrail 5). `None` GRAVA ausência — é como o usuário desfaz uma meta.

    O PISO É DA LEI; A ALOCAÇÃO ACIMA DELE É DO USUÁRIO. Compromisso percentual
    que empurre o que sobra abaixo do mínimo existencial é recusado com 422, no
    MESMO registro de `gravar_respiro` acima — a mensagem diz o que aconteceu, em
    pt-BR, não carrega valor (guardrail 5) e não chama o usuário de nada. Incide
    sobre a renda LÍQUIDA típica (ADR 0021, Nota de desempate), a mesma base do
    piso. A faixa 0–10000 bps já é do schema; aqui é só o piso, que depende da
    renda e por isso não cabe num `Field`.
    """
    # SEM CAIXA PREENCHIDO NÃO HÁ O QUE COMPARAR — mesma limitação declarada de
    # `_validar_aporte` e de `gravar_respiro`: com renda e essenciais em zero,
    # qualquer percentual "invadiria" o piso, e a recusa diria a quem nunca
    # informou nada que a escolha dele é ilegal.
    if entrada.compromissoPercentualBps is not None:
        caixa = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
        compromisso = aplicar_percentual(
            caixa.renda_liquida, entrada.compromissoPercentualBps
        )
        if caixa.preenchimento != "vazio" and percentual_invade_o_piso(
            caixa.renda_liquida, caixa.essenciais, compromisso, caixa.minimo_existencial
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    # Sem valor na mensagem (guardrail 5): renda e custo de vida
                    # são o dado mais sensível do produto e não vazam em erro.
                    "message": (
                        "Com esse compromisso, o que sobra no seu mês fica abaixo do "
                        "mínimo existencial, que é o piso que a lei protege. Tente um "
                        "percentual menor: o piso é da lei, e a escolha acima dele "
                        "continua sendo sua."
                    ),
                    "campo": "compromissoPercentualBps",
                },
            )

    p = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))
    if p is None:
        p = orm.Perfil(tenant_id=tenant)
        db.add(p)

    p.imposto_bps = entrada.impostoBps
    p.reserva_meta_meses = entrada.reservaMetaMeses
    p.reserva_saldo = entrada.reservaSaldo
    p.reserva_aporte = entrada.reservaAporte
    p.aposentadoria_aporte = entrada.aposentadoriaAporte
    p.rendimento_esperado_bps = entrada.rendimentoEsperadoBps
    p.compromisso_percentual_bps = entrada.compromissoPercentualBps
    db.commit()
    db.refresh(p)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaMetas(metas=_metas_schema(p))


# --- Respiro (M11, ADR 0019) -------------------------------------------------

# ESCOLHA DE MÉTODO, não regra de lei: o preço em meses é medido na AVALANCHE,
# a mesma estratégia que o card `plano_sugerido` do chat já usa quando precisa
# responder com um número só (`routers/chat.py`). Medir na bola de neve daria
# outro prazo para a mesma escolha, e o usuário veria dois preços para um
# respiro só.
ESTRATEGIA_DO_PRECO = "avalanche"


def _proximo_mes(mes: str) -> str:
    """`AAAA-MM` + 1, atravessando o ano. Espelho de `_mes_anterior`."""
    ano, m = int(mes[:4]), int(mes[5:7])
    return f"{ano + 1}-01" if m == 12 else f"{ano}-{m + 1:02d}"


def _janela_do_mes(mes: str) -> tuple[date, date]:
    """Primeiro dia do mês e primeiro dia do seguinte — intervalo semiaberto."""
    ano, m = int(mes[:4]), int(mes[5:7])
    inicio = date(ano, m, 1)
    fim = date(ano + 1, 1, 1) if m == 12 else date(ano, m + 1, 1)
    return inicio, fim


def _usos_no_mes(db: Session, tenant: str, mes: str) -> int:
    """Quanto de respiro foi gasto num `AAAA-MM`. Zero quando não houve uso."""
    inicio, fim = _janela_do_mes(mes)
    return sum(
        db.scalars(
            select(orm.RespiroUso.valor).where(
                orm.RespiroUso.tenant_id == tenant,
                orm.RespiroUso.data >= inicio,
                orm.RespiroUso.data < fim,
            )
        ).all()
    )


def _respiro_schema(r: orm.Respiro, saldo_acumulado: int) -> schemas.Respiro:
    """
    O SALDO VEM DE FORA, e nunca de `r.saldo_acumulado`: a coluna guarda o que
    veio dos meses fechados, e o que o uso deste mês passou da fatia é
    descontado na leitura da cascata (`domain/caixa.calcular_caixa`). Ler a
    coluna aqui exporia um saldo maior que o real até a virada.
    """
    return schemas.Respiro(
        valorMensal=r.valor_mensal, ativo=r.ativo, saldoAcumulado=saldo_acumulado
    )


def _buscar_respiro(db: Session, tenant: str) -> orm.Respiro:
    """
    A linha declarada, ou 404.

    Registrar uso ou destinar saldo de um respiro que não existe não é erro de
    validação de campo: é operação sobre um recurso ausente, e o 404 diz isso
    sem inventar um respiro de zero para quem nunca declarou nada.
    """
    r = db.scalar(select(orm.Respiro).where(orm.Respiro.tenant_id == tenant))
    if r is None:
        raise _nao_encontrado("um respiro declarado")
    return r


def _saldo_efetivo(db: Session, tenant: str, settings: Settings) -> int:
    """
    O saldo acumulado como o usuário o vê: o dos meses fechados, menos o que o
    uso deste mês passou da fatia, com piso em zero.

    A CONTA NÃO ACONTECE AQUI — ela é a mesma de `domain/caixa.calcular_caixa`,
    que já a faz para `GET /v1/caixa`. Repeti-la neste arquivo daria dois
    números para a mesma pergunta, que é o modo de falha que o módulo inteiro
    evita.
    """
    caixa = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
    return caixa.respiro_saldo_acumulado or 0


def _apurar_virada_do_mes(db: Session, tenant: str) -> None:
    """
    Rola para o acumulado o respiro que o mês fechado não usou.

    SEM JOB, SEM NOTIFICAÇÃO E SEM PERGUNTA (ADR 0019, item 5). Quem apura é a
    primeira leitura que percebe que o mês mudou. Perguntar todo mês o que fazer
    com o saldo transformaria o respiro em item de prestação de contas mensal —
    o tom exato que o guardrail 4.1 existe para proibir.

    `ultimo_mes_apurado` É O ÚLTIMO MÊS JÁ ACERTADO, e nunca o mês corrente:
    a fatia do mês que está sendo vivido ainda é disponível, não saldo.

    A IDEMPOTÊNCIA DEPENDE INTEIRAMENTE DE `ultimo_mes_apurado`. Sem ele, duas
    leituras no mesmo dia rolariam o saldo duas vezes e o inflariam em silêncio:
    o defeito só apareceria para quem conferisse a conta. O carimbo é gravado na
    mesma transação da soma, e o `FOR UPDATE` impede que duas leituras
    simultâneas do mesmo tenant leiam o carimbo velho ao mesmo tempo (no SQLite
    da suíte a cláusula é inócua; no Postgres é o que segura a corrida).

    ESCOLHAS DE MÉTODO, declaradas porque não vêm de lei nenhuma:

    1. O VALOR VIGENTE VALE PARA OS MESES FECHADOS. Não guardamos histórico do
       valor mês a mês, e a linha é permanente como o aluguel: aplicar o valor
       declarado hoje é a única leitura possível dos meses que passaram sem
       inventar uma série que ninguém registrou.

    2. SEM PRORRATEIO. O mês em que o respiro foi declarado conta inteiro — a
       fatia é mensal, e partir o mês exigiria uma regra de proporção que
       nenhuma fonte dá.

    3. DESATIVADO NÃO ACUMULA, MAS O MÊS É CARIMBADO. Enquanto `ativo` é falso a
       linha não é reservada na cascata, e o que não foi reservado não pode
       acumular. Carimbar mesmo assim é o que impede que reativar meses depois
       faça aparecer, de uma vez, um saldo retroativo que nunca existiu.

    4. A VIRADA LIQUIDA O MÊS FECHADO NAS DUAS PONTAS, na mesma passagem: tira
       do acumulado o que o mês passou da fatia e soma o que ele não usou. Só um
       dos dois termos é diferente de zero em qualquer mês. É o que fecha a
       conta com a derivação da leitura: enquanto o mês corre, o excesso é
       descontado na leitura; quando ele fecha, o desconto vira definitivo — sem
       isso o número desapareceria sozinho na virada.

       O desconto do excesso vale INCLUSIVE COM O RESPIRO DESATIVADO, porque a
       leitura também o desconta sem olhar `ativo` (`domain/caixa.py`). Só a
       soma do não usado depende de `ativo`: o que não foi reservado na cascata
       não pode acumular.

    Este é o único ponto do servidor que grava durante um GET, e ele o faz por
    exigência do contrato (api-contract 3.13). A trava de escrita da assinatura
    não o alcança — ela é derivada do MÉTODO HTTP —, e é o comportamento certo:
    apuração silenciosa de um saldo que já é do usuário não é escrita de dado
    novo, e um marco atingido em período somente leitura tampouco se perde
    (`orm.Marco`).
    """
    respiro = db.scalar(
        select(orm.Respiro).where(orm.Respiro.tenant_id == tenant).with_for_update()
    )
    if respiro is None:
        return

    atual = _mes_de_hoje()

    if respiro.ultimo_mes_apurado is None:
        # Linha sem carimbo: não dá para saber quantos meses ela atravessou, e
        # somá-los seria inventar fatias que ninguém reservou. Carimba o mês
        # ANTERIOR — trivialmente apurado — e sai: o mês corrente rola inteiro
        # na próxima virada, como o de qualquer declaração nova.
        respiro.ultimo_mes_apurado = _mes_anterior(atual)
        db.commit()
        return

    # IDEMPOTÊNCIA: o carimbo já alcançou o mês fechado mais recente, e não há
    # nada a rolar. É esta linha que impede a segunda leitura do dia de inflar o
    # saldo.
    if respiro.ultimo_mes_apurado >= _mes_anterior(atual):
        return

    acumulado = respiro.saldo_acumulado
    mes = _proximo_mes(respiro.ultimo_mes_apurado)
    while mes < atual:
        usos = _usos_no_mes(db, tenant, mes)
        acumulado = max(0, acumulado - max(0, usos - respiro.valor_mensal))
        if respiro.ativo:
            acumulado += max(0, respiro.valor_mensal - usos)
        mes = _proximo_mes(mes)

    respiro.saldo_acumulado = acumulado
    # O mês corrente NÃO entra: ele ainda está sendo vivido, e a fatia dele
    # ainda é disponível, não saldo.
    respiro.ultimo_mes_apurado = _mes_anterior(atual)
    db.commit()


def _custo_do_respiro(db: Session, tenant: str, settings: Settings) -> int | None:
    """
    O preço da escolha, em meses a mais de quitação.

    NENHUMA CONTA NOVA ACONTECE AQUI. A diferença sai de
    `domain.simulacao.custo_em_meses`, que roda a MESMA `simular` do M4 duas
    vezes. O cenário "sem respiro" também não é fórmula nova: é a mesma cascata
    com a linha tirada da entrada por `dataclasses.replace`, e `calcular_caixa`
    responde qual seria o aporte.

    PISO EM ZERO NO APORTE. Capacidade negativa é informação legítima na tela
    (`domain/caixa.py`, escolha 5), mas não é aporte extra pagável: entregá-la
    ao motor encolheria o orçamento abaixo das parcelas mínimas e produziria um
    plano que ninguém propôs.
    """
    dividas = carregar_dividas_simulaveis(db, tenant, None)
    entrada = montar_entrada_caixa(db, tenant, settings)
    com_respiro = calcular_caixa(entrada)
    sem_respiro = calcular_caixa(replace(entrada, respiro=None))
    return custo_em_meses(
        dividas,
        max(0, com_respiro.aporte_maximo),
        max(0, sem_respiro.aporte_maximo),
        ESTRATEGIA_DO_PRECO,
        _mes_de_hoje(),
    )


@router.put("/respiro", response_model=schemas.RespostaRespiro)
def gravar_respiro(
    entrada: schemas.RespiroInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Declara a fatia de viver enquanto paga, e devolve o que ela custa.

    QUEM DIZ O TAMANHO DA FATIA É O USUÁRIO (ADR 0019, item 2). Este endpoint
    não sugere valor, faixa nem percentual: ele grava o que a pessoa escolheu e
    responde com a única coisa que o app sabe de verdade — quantos meses a mais
    de quitação aquilo custa. `custoEmMeses` é `None` quando não há dívida com
    dado suficiente para simular, e a tela grava sem preço em vez de exibir
    palpite.

    `ativo: false` PRESERVA `saldo_acumulado` e o valor declarado. Desativar não
    é apagar, e a tela precisa poder distinguir "desativou" de "nunca declarou".

    O PISO É DA LEI; A ALOCAÇÃO ACIMA DELE É DO USUÁRIO. Respiro que empurre o
    que resta abaixo do mínimo existencial é recusado com 422, no mesmo registro
    de `_validar_aporte` — a mensagem diz o que aconteceu, em pt-BR, não carrega
    valor (guardrail 5) e não chama o usuário de nada.
    """
    _apurar_virada_do_mes(db, tenant)

    if entrada.valorMensal < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": (
                    "Respiro não pode ser um valor negativo. Se você não quer reservar "
                    "nada por enquanto, desative o respiro — o que já estava guardado "
                    "continua guardado."
                ),
                "campo": "valorMensal",
            },
        )

    caixa = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
    # SEM CAIXA PREENCHIDO NÃO HÁ O QUE COMPARAR, e o app não afirma o que não
    # sabe: com renda e essenciais em zero, qualquer valor "invadiria" o piso, e
    # a recusa diria a quem nunca informou nada que o respiro dele é ilegal.
    # Mesma limitação declarada de `_validar_aporte` em `routers/simulacoes.py`,
    # que segue sem validar quando não existe capacidade apurada.
    if caixa.preenchimento != "vazio" and respiro_invade_o_piso(
        caixa.renda_liquida, caixa.essenciais, entrada.valorMensal, caixa.minimo_existencial
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                # Sem valor na mensagem (guardrail 5): renda e custo de vida são
                # o dado mais sensível do produto e não vazam em corpo de erro.
                "message": (
                    "Com esse respiro, o que sobra no seu mês fica abaixo do mínimo "
                    "existencial, que é o piso que a lei protege. Tente um valor menor: "
                    "o piso é da lei, e a escolha acima dele continua sendo sua."
                ),
                "campo": "valorMensal",
            },
        )

    r = db.scalar(select(orm.Respiro).where(orm.Respiro.tenant_id == tenant))
    if r is None:
        r = orm.Respiro(
            tenant_id=tenant,
            valor_mensal=entrada.valorMensal,
            ativo=entrada.ativo,
            saldo_acumulado=0,
            # O mês ANTERIOR nasce apurado — a linha não existia nele —, e é o
            # carimbo que faz o mês da declaração rolar inteiro na próxima
            # virada. Sem prorrateio: a fatia é mensal, e partir o mês exigiria
            # uma regra de proporção que nenhuma fonte dá.
            ultimo_mes_apurado=_mes_anterior(_mes_de_hoje()),
        )
        db.add(r)
    else:
        r.valor_mensal = entrada.valorMensal
        r.ativo = entrada.ativo

    db.commit()
    db.refresh(r)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaRespiro(
        respiro=_respiro_schema(r, _saldo_efetivo(db, tenant, settings)),
        custoEmMeses=_custo_do_respiro(db, tenant, settings),
    )


@router.post("/respiro/uso", response_model=schemas.RespostaUsoDeRespiro, status_code=201)
def registrar_uso_de_respiro(
    entrada: schemas.NovoUsoDeRespiro,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Registra um gasto de respiro — o sorvete, o cinema, as unhas.

    ACEITA SEMPRE, INCLUSIVE ACIMA DO DISPONÍVEL. O app não impede ninguém de
    gastar o próprio dinheiro, e recusar aqui seria o policiamento que a feature
    existe para desmontar (guardrail 4.1). O que passa da fatia do mês consome o
    saldo acumulado; passando dos dois, o uso ainda é aceito e o disponível vai
    a zero.

    A RESPOSTA NÃO CARREGA JUÍZO: quanto ainda há, e o id para desfazer. Nenhum
    alerta, aviso, sinal de excesso ou comparação — "você já gastou" é a copy
    que o guardrail 4.1 proíbe pelo nome, e um campo de excesso na resposta
    seria a mesma frase em JSON.

    NADA AQUI ESCREVE EM `saldo_acumulado`. O consumo do acumulado pelo excesso
    é DERIVADO na leitura da cascata e liquidado na virada do mês. Gravá-lo aqui
    tornaria o `DELETE` irreversível, e o lançamento é a única verdade que este
    endpoint tem para gravar.
    """
    _apurar_virada_do_mes(db, tenant)
    _buscar_respiro(db, tenant)

    uso = orm.RespiroUso(
        tenant_id=tenant, valor=entrada.valor, descricao=entrada.descricao
    )
    db.add(uso)
    db.commit()
    db.refresh(uso)
    registrar_snapshot(db, tenant, settings)

    caixa = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
    return schemas.RespostaUsoDeRespiro(
        id=uso.id, respiroDisponivelNoMes=caixa.respiro_disponivel_no_mes
    )


@router.delete("/respiro/uso/{uso_id}", status_code=204)
def excluir_uso_de_respiro(
    uso_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Desfaz um uso registrado. Existe porque valor digitado errado precisa de
    desfazer, e obrigar alguém a conviver com ele transformaria um erro de
    digitação em culpa.

    O DESFAZER É EXATO POR CONSTRUÇÃO, e é por isso que este corpo é só um
    `DELETE`: nem o disponível do mês nem o saldo acumulado foram gravados no
    registro do uso. Os dois são derivados do lançamento, e apagar o lançamento
    devolve os dois ao que eram — inclusive quando o uso tinha consumido o
    acumulado inteiro. Não há nada a estornar porque não houve débito.

    MÊS JÁ FECHADO NÃO É REAPURADO. Apagar um uso de um mês que já virou não
    refaz a liquidação daquela virada: o saldo dela é número que o usuário já
    viu, e reescrevê-lo por trás seria pior que a imprecisão.
    """
    _apurar_virada_do_mes(db, tenant)
    uso = db.scalar(
        select(orm.RespiroUso).where(
            orm.RespiroUso.id == uso_id, orm.RespiroUso.tenant_id == tenant
        )
    )
    if uso is None:
        raise _nao_encontrado("esse uso de respiro")

    db.delete(uso)
    db.commit()
    registrar_snapshot(db, tenant, settings)


@router.post(
    "/respiro/destinacao",
    response_model=schemas.RespostaDestinacaoDeRespiro,
    status_code=201,
)
def destinar_respiro(
    entrada: schemas.NovaDestinacaoDeRespiro,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Manda saldo acumulado de respiro para aporte extra na dívida.

    SEMPRE POR AÇÃO EXPLÍCITA — nunca automático, nunca sugerido em push (ADR
    0019, item 5). O default do saldo é acumular em silêncio; destinar é um
    botão que o usuário aperta se quiser.

    DEBITA O SALDO E GRAVA O LANÇAMENTO, E NADA MAIS. Decidido em 19/08/2026:
    não escreve em parcela, pagamento nem dívida. "Aporte extra" segue sendo
    parâmetro de simulação, não dado gravado — registrar um pagamento real aqui
    exigiria dizer contra qual dívida, e essa decisão não foi tomada.
    """
    _apurar_virada_do_mes(db, tenant)
    respiro = _buscar_respiro(db, tenant)

    # O TETO É O SALDO EFETIVO, não a coluna: o que o uso deste mês passou da
    # fatia já saiu do que o usuário vê, e destinar sobre a coluna crua deixaria
    # ele mandar para a dívida um dinheiro que a tela dele não mostra mais.
    if entrada.valor > _saldo_efetivo(db, tenant, settings):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                # Sem valor na mensagem (guardrail 5). O saldo já está na tela.
                "message": (
                    "Esse valor passa do que você tem guardado de respiro. "
                    "Escolha um valor até o que está guardado."
                ),
                "campo": "valor",
            },
        )

    respiro.saldo_acumulado -= entrada.valor
    db.add(orm.RespiroDestinacao(tenant_id=tenant, valor=entrada.valor))
    db.commit()
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaDestinacaoDeRespiro(
        respiroSaldoAcumulado=_saldo_efetivo(db, tenant, settings)
    )
