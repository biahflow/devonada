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
from domain import renda
from domain.dinheiro import aplicar_percentual
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

    SEM LINHA DE `respiro`, OS QUATRO CAMPOS SEGUEM `None` e a entrada fica
    idêntica à de antes do M11. É o que garante que quem nunca declarou respiro
    não perde capacidade nenhuma: não existe default, e a ausência não vira zero
    em lugar nenhum do caminho (ADR 0019).

    O IMPOSTO TAMBÉM É APURADO POR FONTE (M12, ADR 0021, decisão 1), no mesmo
    laço e pelo mesmo motivo: a alíquota de um contrato PJ não é a do CLT ao
    lado. `imposto_por_fonte` só é preenchido quando ALGUMA fonte declarou a
    sua; sem nenhuma, ele segue `None` e a cascata faz a multiplicação de sempre
    sobre a renda somada — que é bit a bit o número de hoje.
    """
    hoje = date.today()

    perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))

    fontes = db.scalars(
        select(orm.FonteRenda).where(
            orm.FonteRenda.tenant_id == tenant, orm.FonteRenda.ativo.is_(True)
        )
    ).all()

    bruta = 0
    origem = "informada"
    # O MÊS QUE ANCOROU A RENDA (M12, ADR 0021, decisão 3). A renda típica é
    # apurada por fonte, então há um mês âncora por fonte que veio do histórico;
    # o que viaja para a tela é o da ÚLTIMA fonte histórica do laço. Para quem tem
    # uma fonte só — o caso da copy "dimensionado pelo pior mês, que foi março" —
    # é o único, e não há ambiguidade. Fica `None` enquanto nenhuma fonte veio do
    # histórico, coerente com `origem = "informada"`.
    mes_ancora: str | None = None
    # O fallback da fonte que não declarou nada é o `Perfil`, exatamente como
    # antes desta linha existir.
    imposto_do_perfil = perfil.imposto_bps if perfil else None
    alguma_fonte_declarou_aliquota = False
    imposto_somado_por_fonte = 0
    # AUSÊNCIA TIPADA DE ALÍQUOTA (M12, ADR 0021, decisão 1): liga quando uma
    # fonte que reserva imposto — hoje só `pj_hora`, via `domain.renda` — está
    # ativa sem alíquota própria e sem o fallback do `Perfil`.
    imposto_nao_declarado = False
    for f in fontes:
        recebimentos = db.execute(
            select(orm.Recebimento.mes, orm.Recebimento.valor)
            .where(orm.Recebimento.tenant_id == tenant, orm.Recebimento.fonte_id == f.id)
            .order_by(orm.Recebimento.mes)
        ).all()
        valor, origem_da_fonte, mes_da_fonte = renda_tipica(
            f.valor_tipico_informado, [(mes, v) for mes, v in recebimentos]
        )
        bruta += valor
        if origem_da_fonte == "pior_mes_registrado":
            origem = "pior_mes_registrado"
            mes_ancora = mes_da_fonte

        # A ALÍQUOTA DA PRÓPRIA FONTE TEM PRECEDÊNCIA; sem ela, vale a do
        # `Perfil`. `is not None` e não truthiness: 0% declarado na fonte é uma
        # afirmação — "esta renda não reserva imposto" — e cair no perfil ali
        # reservaria imposto que a pessoa disse não dever.
        if f.imposto_bps is not None:
            alguma_fonte_declarou_aliquota = True
            aliquota = f.imposto_bps
        else:
            aliquota = imposto_do_perfil
        if aliquota:
            imposto_somado_por_fonte += aplicar_percentual(valor, aliquota)

        # Só a fonte que RESERVA imposto e ficou sem alíquota nenhuma acende o
        # sinal — uma fonte `aluguel` ou `outro` sem alíquota não o liga, porque o
        # modelo não espera reserva dela. O `Perfil` como fallback conta: se ele
        # existe, a fonte tem alíquota e o sinal não acende.
        if (
            renda.comportamento(f.tipo).reserva_imposto
            and f.imposto_bps is None
            and imposto_do_perfil is None
        ):
            imposto_nao_declarado = True

    gastos = db.scalars(
        select(orm.Gasto).where(orm.Gasto.tenant_id == tenant, orm.Gasto.ativo.is_(True))
    ).all()

    provisoes = db.scalars(
        select(orm.ProvisaoAnual).where(
            orm.ProvisaoAnual.tenant_id == tenant, orm.ProvisaoAnual.ativa.is_(True)
        )
    ).all()

    respiro = db.scalar(select(orm.Respiro).where(orm.Respiro.tenant_id == tenant))
    respiro_valor: int | None = None
    respiro_ativo: bool | None = None
    respiro_usado: int | None = None
    respiro_saldo: int | None = None
    if respiro is not None:
        # A janela é o MÊS CORRENTE. O disponível zera na virada porque a fatia
        # é mensal; o que não foi usado não some — vai para `saldo_acumulado`,
        # e a rolagem que o move é da leitura que perceber a virada.
        primeiro_do_mes = hoje.replace(day=1)
        primeiro_do_proximo = (
            date(hoje.year + 1, 1, 1)
            if hoje.month == 12
            else date(hoje.year, hoje.month + 1, 1)
        )
        usos = db.scalars(
            select(orm.RespiroUso.valor).where(
                orm.RespiroUso.tenant_id == tenant,
                orm.RespiroUso.data >= primeiro_do_mes,
                orm.RespiroUso.data < primeiro_do_proximo,
            )
        ).all()
        respiro_valor = respiro.valor_mensal
        respiro_ativo = respiro.ativo
        # Zero AQUI é fato, não ausência: com respiro declarado e nada gasto, o
        # usado do mês é zero mesmo.
        respiro_usado = sum(usos)
        respiro_saldo = respiro.saldo_acumulado

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
        respiro=respiro_valor,
        respiro_ativo=respiro_ativo,
        respiro_usado_no_mes=respiro_usado,
        respiro_saldo_acumulado=respiro_saldo,
        compromisso_percentual_bps=(
            perfil.compromisso_percentual_bps if perfil else None
        ),
        # `None` enquanto NENHUMA fonte declarou alíquota: é o que faz a cascata
        # cair na conta de sempre em vez de trocar uma multiplicação sobre a soma
        # por um somatório de multiplicações — os dois diferem por centavos de
        # arredondamento, e ninguém que não declarou nada pode mudar de número.
        imposto_por_fonte=(
            imposto_somado_por_fonte if alguma_fonte_declarou_aliquota else None
        ),
        mes_ancora_renda=mes_ancora,
        imposto_nao_declarado=imposto_nao_declarado,
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
