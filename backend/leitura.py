from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
from config import Settings
from domain.assinatura import AssinaturaConhecida, Situacao
from domain.assinatura import situacao as calcular_situacao
from domain.caixa import (
    Caixa,
    EntradaCaixa,
    ProvisaoPendente,
    calcular_caixa,
    renda_tipica,
)
from domain.minimo_existencial import minimo_existencial
from domain.simulacao import DividaSimulavel

"""
Adaptadores de persistência → domínio.

POR QUE ESTE MÓDULO EXISTE: `carregar_dividas_simulaveis` morava em
`routers/simulacoes.py` e era importada pelo chat e pelo caixa. Quando o
simulador passou a precisar da capacidade (M7, Fase 3), routers/simulacoes e
routers/caixa passariam a se importar mutuamente — ciclo no import.

A saída não é um import preguiçoso dentro da função: é reconhecer que estas
leituras nunca foram do router. Elas traduzem tabela em entrada de função pura,
e três routers diferentes precisam da MESMA tradução. Duas traduções do mesmo
dado dariam dois números para a mesma pergunta, que é o modo de falha que este
produto inteiro tenta evitar.

Nada aqui calcula. As contas continuam em `domain/`.
"""


def carregar_dividas_simulaveis(
    db: Session, tenant: str, ids: list[str] | None
) -> list[DividaSimulavel]:
    """
    Monta a entrada do motor de simulação a partir do que está persistido.

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


def montar_entrada_caixa(db: Session, tenant: str, settings: Settings) -> EntradaCaixa:
    """
    Junta o que está persistido no formato que `domain/caixa.py` espera.

    A RENDA TÍPICA É APURADA POR FONTE, não sobre o total: uma fonte fixa não
    pode ser puxada para baixo pelo pior mês de uma fonte variável. Basta uma
    fonte vir do histórico para a origem deixar de ser "informada" — é isso que
    a tela precisa dizer ao usuário sobre o número que ele está vendo.
    """
    hoje = date.today()

    fontes = db.scalars(
        select(orm.FonteRenda).where(
            orm.FonteRenda.tenant_id == tenant, orm.FonteRenda.ativo.is_(True)
        )
    ).all()

    bruta = 0
    origem = "informada"
    for f in fontes:
        recebimentos = db.scalars(
            select(orm.Recebimento.valor)
            .where(orm.Recebimento.tenant_id == tenant, orm.Recebimento.fonte_id == f.id)
            .order_by(orm.Recebimento.mes)
        ).all()
        valor, origem_da_fonte = renda_tipica(f.valor_tipico_informado, list(recebimentos))
        bruta += valor
        if origem_da_fonte == "pior_mes_registrado":
            origem = "pior_mes_registrado"

    gastos = db.scalars(
        select(orm.Gasto).where(orm.Gasto.tenant_id == tenant, orm.Gasto.ativo.is_(True))
    ).all()

    provisoes = db.scalars(
        select(orm.ProvisaoAnual).where(
            orm.ProvisaoAnual.tenant_id == tenant, orm.ProvisaoAnual.ativa.is_(True)
        )
    ).all()

    perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))

    return EntradaCaixa(
        renda_bruta_tipica=bruta,
        origem_renda=origem,
        imposto_bps=perfil.imposto_bps if perfil else None,
        essenciais=sum(g.valor_mensal for g in gastos if g.essencial),
        nao_essenciais=sum(g.valor_mensal for g in gastos if not g.essencial),
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
        # O comprometido sai das MESMAS dívidas que o simulador enxerga.
        comprometido_dividas=sum(
            d.parcela_minima for d in carregar_dividas_simulaveis(db, tenant, None)
        ),
        minimo_existencial=minimo_existencial(settings.minimo_existencial_centavos),
        mes_atual=hoje.month,
    )


def capacidade_atual(db: Session, tenant: str, settings: Settings) -> Caixa | None:
    """
    A cascata de hoje, ou `None` quando o usuário ainda não preencheu nada.

    O `None` é o que permite ao simulador cair no comportamento antigo em vez de
    tratar caixa vazio como capacidade zero. Zero recusaria qualquer aporte de
    quem nunca abriu a aba de caixa — tiraria a ferramenta de quem ainda não
    chegou nela.
    """
    caixa = calcular_caixa(montar_entrada_caixa(db, tenant, settings))
    return None if caixa.preenchimento == "vazio" else caixa


def situacao_da_assinatura(db: Session, tenant: str, settings: Settings) -> Situacao:
    """
    Traduz `usuario` + `assinatura` na entrada de `domain.assinatura.situacao`.

    Vive aqui, e não no router, pelo motivo declarado no topo deste módulo: dois
    lugares precisam da MESMA tradução — a trava de escrita
    (`backend/assinatura.py`) e a rota que mostra a situação ao usuário
    (`routers/assinatura.py`). Duas traduções dariam duas respostas para a
    mesma pergunta, e aqui isso significaria a tela dizendo "em dia" enquanto a
    escrita leva 402.

    O TESTE COMEÇA NA CONTA MAIS ANTIGA do tenant. Hoje há um usuário por tenant
    e a distinção não aparece; no dia da conta compartilhada, o segundo usuário
    a entrar não reinicia o teste do casal.
    """
    criado_em = db.scalars(
        select(orm.Usuario.criado_em)
        .where(orm.Usuario.tenant_id == tenant)
        .order_by(orm.Usuario.criado_em)
        .limit(1)
    ).first()

    linha = db.scalars(
        select(orm.Assinatura).where(orm.Assinatura.tenant_id == tenant)
    ).first()

    conhecida = (
        AssinaturaConhecida(
            expira_em=linha.expira_em,
            renovacao_automatica=linha.renovacao_automatica,
        )
        if linha
        else None
    )

    return calcular_situacao(
        # Sem usuário, o tenant não tem dono — é o estado do beta antes do M8, e
        # dele não existe mais no banco. `datetime.min` faz o teste já ter
        # vencido, que é o lado seguro: libera menos, nunca mais.
        criado_em=criado_em or datetime.min,
        assinatura=conhecida,
        agora=datetime.now(timezone.utc),
        teste_dias=settings.teste_dias,
    )
