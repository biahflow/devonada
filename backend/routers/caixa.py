from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
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
    calcular_caixa,
    meses_ate_vencimento,
    renda_tipica,
)
from domain.minimo_existencial import minimo_existencial
from routers.simulacoes import carregar_dividas_simulaveis

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


def montar_entrada(db: Session, tenant: str, settings: Settings) -> EntradaCaixa:
    """
    Junta o que está persistido no formato que o motor puro espera.

    Pública porque o simulador (M4) precisa da MESMA capacidade que a aba de
    caixa exibe. Duas leituras diferentes dariam dois tetos diferentes para o
    mesmo aporte, e o usuário veria o valor ser recusado por um número que não
    aparece em tela nenhuma — foi exatamente o cuidado que `_validar_aporte` já
    tomava com as parcelas mínimas.
    """
    hoje = date.today()

    fontes = db.scalars(
        select(orm.FonteRenda).where(
            orm.FonteRenda.tenant_id == tenant, orm.FonteRenda.ativo.is_(True)
        )
    ).all()

    # A renda típica é por FONTE, não do total: uma fonte fixa não deve ser
    # puxada para baixo pelo pior mês de uma fonte variável.
    bruta = 0
    origem = "informada"
    for f in fontes:
        recebimentos = db.scalars(
            select(orm.Recebimento.valor)
            .where(
                orm.Recebimento.tenant_id == tenant,
                orm.Recebimento.fonte_id == f.id,
            )
            .order_by(orm.Recebimento.mes)
        ).all()
        valor, origem_da_fonte = renda_tipica(f.valor_tipico_informado, list(recebimentos))
        bruta += valor
        # Basta uma fonte vir do histórico para a origem deixar de ser "só o que
        # o usuário digitou" — e é isso que a tela precisa dizer.
        if origem_da_fonte == "pior_mes_registrado":
            origem = "pior_mes_registrado"

    gastos = db.scalars(
        select(orm.Gasto).where(orm.Gasto.tenant_id == tenant, orm.Gasto.ativo.is_(True))
    ).all()
    essenciais = sum(g.valor_mensal for g in gastos if g.essencial)
    nao_essenciais = sum(g.valor_mensal for g in gastos if not g.essencial)

    provisoes = db.scalars(
        select(orm.ProvisaoAnual).where(
            orm.ProvisaoAnual.tenant_id == tenant, orm.ProvisaoAnual.ativa.is_(True)
        )
    ).all()

    perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))

    # O comprometido sai das MESMAS dívidas que o simulador enxerga.
    comprometido = sum(d.parcela_minima for d in carregar_dividas_simulaveis(db, tenant, None))

    return EntradaCaixa(
        renda_bruta_tipica=bruta,
        origem_renda=origem,
        imposto_bps=perfil.imposto_bps if perfil else None,
        essenciais=essenciais,
        nao_essenciais=nao_essenciais,
        provisoes=tuple(
            ProvisaoPendente(
                descricao=p.descricao,
                valor_anual=p.valor_anual,
                saldo_acumulado=p.saldo_acumulado,
                mes_vencimento=p.mes_vencimento,
            )
            for p in provisoes
        ),
        aporte_reserva=(perfil.reserva_aporte or 0) if perfil else 0,
        aporte_aposentadoria=(perfil.aposentadoria_aporte or 0) if perfil else 0,
        comprometido_dividas=comprometido,
        minimo_existencial=minimo_existencial(settings.minimo_existencial_centavos),
        mes_atual=hoje.month,
    )


@router.get("", response_model=schemas.RespostaCaixa)
def obter(
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """A cascata atual. Leitura pura — o snapshot é gravado pelas mutações."""
    caixa = calcular_caixa(montar_entrada(db, tenant, settings))
    return schemas.RespostaCaixa(
        caixa=schemas.Caixa(
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
            minimoExistencial=caixa.minimo_existencial,
            minimoExistencialVigenteEm=settings.minimo_existencial_vigente_em or None,
            abaixoDoPiso=caixa.abaixo_do_piso,
            naoFecha=caixa.nao_fecha,
            preenchimento=caixa.preenchimento,  # type: ignore[arg-type]
        )
    )


def registrar_snapshot(db: Session, tenant: str, settings: Settings) -> None:
    """
    Congela a cascata depois de toda mudança. APPEND-ONLY: sempre INSERT.

    É o que responde, seis meses depois, "com base em qual renda eu propus
    aquele acordo?". Um UPDATE aqui apagaria justamente a resposta.
    """
    c = calcular_caixa(montar_entrada(db, tenant, settings))
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


# --- Fontes de renda ---------------------------------------------------------


def _fonte_schema(f: orm.FonteRenda) -> schemas.FonteRenda:
    return schemas.FonteRenda(
        id=f.id,
        nome=f.nome,
        tipo=f.tipo,  # type: ignore[arg-type]
        valorTipicoInformado=f.valor_tipico_informado,
        variavel=f.variavel,
        ativo=f.ativo,
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
    """
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
    db.commit()
    db.refresh(p)
    registrar_snapshot(db, tenant, settings)
    return schemas.RespostaMetas(metas=_metas_schema(p))
