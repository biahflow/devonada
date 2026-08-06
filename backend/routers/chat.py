import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from assistente import (
    ContextoDoUsuario,
    DividaDoContexto,
    ErroDeAssistente,
    PedidoDeCard,
    PropostaDeDivida,
    obter_assistente,
)
from auth import tenant_atual
from db import get_db
from domain.simulacao import economia_vs_minimo, simular
from routers.revisao import revisar_divida
from routers.simulacoes import carregar_dividas_simulaveis, mes_atual

router = APIRouter(prefix="/v1/chat", tags=["Chat"])

TETO_HISTORICO = 50

Card = (
    schemas.DividaResumoCard
    | schemas.PlanoSugeridoCard
    | schemas.DividaPropostaCard
    | schemas.ValorJustoCard
)


def _contexto(db: Session, tenant: str) -> ContextoDoUsuario:
    """
    O que o assistente sabe. IDENTIFICAÇÃO, nunca valores.

    Só dívidas deste tenant entram — e como o assistente só pode pedir card de
    id que está no contexto, o isolamento entre tenants vale também para o que
    ele consegue exibir.
    """
    dividas = db.scalars(
        select(orm.Divida).where(
            orm.Divida.tenant_id == tenant, orm.Divida.excluido_em.is_(None)
        )
    ).all()
    perfil = db.scalar(select(orm.Perfil).where(orm.Perfil.tenant_id == tenant))

    return ContextoDoUsuario(
        dividas=[
            DividaDoContexto(
                divida_id=d.id, credor=d.credor, tipo=d.tipo, situacao=d.situacao
            )
            for d in dividas
        ],
        tem_renda_informada=bool(perfil and perfil.renda_mensal),
    )


def _saldo_e_vencimento(db: Session, tenant: str, divida: orm.Divida) -> tuple[int, date | None]:
    """Saldo pelas parcelas em aberto quando há cronograma; senão, o valor cobrado."""
    pendentes = db.scalars(
        select(orm.Parcela)
        .where(
            orm.Parcela.divida_id == divida.id,
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
            orm.Parcela.paga_em.is_(None),
        )
        .order_by(orm.Parcela.vencimento)
    ).all()

    if pendentes:
        return sum(p.valor for p in pendentes), pendentes[0].vencimento
    if divida.situacao == "quitada":
        return 0, None
    return divida.valor_cobrado, divida.proximo_vencimento


def montar_cards(db: Session, tenant: str, pedidos: list[PedidoDeCard]) -> list[Card]:
    """
    Transforma "o assistente pediu o card X" em card com números reais.

    ESTA FUNÇÃO É O GUARDRAIL 7.1 EM CÓDIGO. O modelo escolheu o quê; quem
    preenche saldo, vencimento, prazo e economia é aqui, lendo o banco. Pedido
    que não casa com dado real não vira card vazio: não vira card nenhum.
    """
    cards: list[Card] = []

    for pedido in pedidos:
        if pedido.tipo == "divida_resumo":
            if not pedido.divida_id:
                continue
            d = db.scalar(
                select(orm.Divida).where(
                    orm.Divida.id == pedido.divida_id,
                    orm.Divida.tenant_id == tenant,
                    orm.Divida.excluido_em.is_(None),
                )
            )
            if d is None:
                continue

            saldo, vencimento = _saldo_e_vencimento(db, tenant, d)
            cards.append(
                schemas.DividaResumoCard(
                    dividaId=d.id,
                    credor=d.credor,
                    saldoDevedor=saldo,
                    proximoVencimento=vencimento,
                    situacao=d.situacao,  # type: ignore[arg-type]
                    criticidade=d.tipo,  # type: ignore[arg-type]
                )
            )

        elif pedido.tipo == "valor_justo":
            if not pedido.divida_id:
                continue
            d = db.scalar(
                select(orm.Divida).where(
                    orm.Divida.id == pedido.divida_id,
                    orm.Divida.tenant_id == tenant,
                    orm.Divida.excluido_em.is_(None),
                )
            )
            if d is None:
                continue

            # A MESMA função da rota de revisão (M6). O card da conversa e a
            # tela não podem divergir sobre o mesmo contrato.
            r = revisar_divida(db, tenant, d)
            if r.valorJusto is None or not r.script:
                # Sem achado com valor não há número a mostrar — e um card
                # dizendo "está tudo certo" seria afirmação que não sustentamos.
                continue

            cards.append(
                schemas.ValorJustoCard(
                    dividaId=d.id,
                    credor=r.credor,
                    valorCobrado=r.valorCobrado,
                    valorJusto=r.valorJusto,
                    script=r.script,
                    fundamentos=r.fundamentos,
                )
            )

        elif pedido.tipo == "plano_sugerido":
            dividas = carregar_dividas_simulaveis(db, tenant, None)
            if not dividas:
                continue

            aporte = pedido.aporte_extra_mensal or 0
            mes = mes_atual()
            # A MESMA função do simulador (M4). Uma segunda implementação de
            # amortização produziria dois números para a mesma pergunta.
            resultado = simular(dividas, aporte, "avalanche", mes)
            if resultado is None:
                continue

            cards.append(
                schemas.PlanoSugeridoCard(
                    estrategia="avalanche",
                    aporteExtraMensal=aporte,
                    mesesAteQuitacao=resultado.meses_ate_quitacao,
                    dataLiberdade=resultado.data_liberdade,
                    economia=economia_vs_minimo(dividas, aporte, "avalanche", mes),
                )
            )

        elif pedido.tipo == "divida_proposta":
            # O ÚNICO ramo sem banco de onde tirar valor: o rascunho é a fala
            # da pessoa, e ela não está gravada em lugar nenhum. Por isso este
            # card também não é remontado a cada leitura como os de cima — um
            # saldo envelhece, o que foi dito na conversa não.
            p = pedido.proposta
            if p is None:
                continue

            divida_credor = None
            if pedido.divida_id:
                d = db.scalar(
                    select(orm.Divida).where(
                        orm.Divida.id == pedido.divida_id,
                        orm.Divida.tenant_id == tenant,
                        orm.Divida.excluido_em.is_(None),
                    )
                )
                if d is None:
                    continue
                # Quem diz QUAL dívida vai mudar é o banco, não o nome que o
                # modelo repetiu. `credor` segue sendo o valor proposto — ele
                # pode ser justamente a correção do nome.
                divida_credor = d.credor

            try:
                cards.append(
                    schemas.DividaPropostaCard(
                        dividaId=pedido.divida_id,
                        dividaCredor=divida_credor,
                        credor=p.credor,
                        valorCobrado=p.valor_cobrado,
                        dataOrigem=p.data_origem,  # type: ignore[arg-type]
                        tipo=p.tipo,  # type: ignore[arg-type]
                        taxaJurosMensal=p.taxa_juros_mensal,
                        totalParcelas=p.total_parcelas,
                        primeiroVencimento=p.primeiro_vencimento,  # type: ignore[arg-type]
                    )
                )
            except ValidationError:
                # Rascunho antigo que não passa na regra de hoje não vira card
                # meio preenchido: não vira card.
                continue

    return cards


def _proposta_para_json(p: PropostaDeDivida | None) -> dict | None:
    if p is None:
        return None
    return {
        "credor": p.credor,
        "valorCobrado": p.valor_cobrado,
        "dataOrigem": p.data_origem,
        "tipo": p.tipo,
        "taxaJurosMensal": p.taxa_juros_mensal,
        "totalParcelas": p.total_parcelas,
        "primeiroVencimento": p.primeiro_vencimento,
    }


def _proposta_de_json(bruto: dict | None) -> PropostaDeDivida | None:
    if not bruto:
        return None
    return PropostaDeDivida(
        credor=bruto.get("credor"),
        valor_cobrado=bruto.get("valorCobrado"),
        data_origem=bruto.get("dataOrigem"),
        tipo=bruto.get("tipo"),
        taxa_juros_mensal=bruto.get("taxaJurosMensal"),
        total_parcelas=bruto.get("totalParcelas"),
        primeiro_vencimento=bruto.get("primeiroVencimento"),
    )


def _para_schema(db: Session, tenant: str, m: orm.MensagemChat) -> schemas.MensagemChat:
    """
    ORM → contrato, REMONTANDO os cards a partir do banco.

    Os valores não são lidos do que foi gravado: uma parcela paga ontem faria a
    conversa exibir hoje um saldo que não existe mais.

    A exceção é o rascunho de `divida_proposta`, que sai daqui como foi dito —
    ele não tem lastro no banco para remontar, e registro de conversa não
    envelhece.
    """
    pedidos = [
        PedidoDeCard(
            tipo=p["tipo"],
            divida_id=p.get("dividaId"),
            aporte_extra_mensal=p.get("aporteExtraMensal"),
            proposta=_proposta_de_json(p.get("proposta")),
        )
        for p in json.loads(m.cards_json or "[]")
    ]

    return schemas.MensagemChat(
        id=m.id,
        role=m.papel,  # type: ignore[arg-type]
        content=m.conteudo,
        cards=montar_cards(db, tenant, pedidos),
        createdAt=m.criada_em,
    )


def _gravar(
    db: Session, tenant: str, papel: str, conteudo: str, pedidos: list[PedidoDeCard] | None = None
) -> orm.MensagemChat:
    cards_json = (
        json.dumps(
            [
                {
                    "tipo": p.tipo,
                    "dividaId": p.divida_id,
                    "aporteExtraMensal": p.aporte_extra_mensal,
                    "proposta": _proposta_para_json(p.proposta),
                }
                for p in pedidos
            ]
        )
        if pedidos
        else None
    )
    m = orm.MensagemChat(tenant_id=tenant, papel=papel, conteudo=conteudo, cards_json=cards_json)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.get("/messages", response_model=schemas.HistoricoChat)
def historico(
    limite: int = Query(default=TETO_HISTORICO, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    A conversa entre sessões. Devolve as ÚLTIMAS `limite` mensagens em ordem
    cronológica — o app rola para o fim, não para o começo.
    """
    recentes = db.scalars(
        select(orm.MensagemChat)
        .where(orm.MensagemChat.tenant_id == tenant)
        .order_by(orm.MensagemChat.criada_em.desc(), orm.MensagemChat.id.desc())
        .limit(limite)
    ).all()

    return schemas.HistoricoChat(
        mensagens=[_para_schema(db, tenant, m) for m in reversed(recentes)]
    )


@router.post("/messages", response_model=schemas.RespostaMensagem)
def enviar_mensagem(
    req: schemas.SendMessageRequest,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Uma mensagem da conversa, com os dados reais do usuário.

    Deixou de ser mock no M5. O assistente escolhe qual card mostrar; os
    números de todo card são preenchidos por `montar_cards`, a partir do banco.
    """
    texto = req.content.strip()
    if not texto:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Escreva alguma coisa para eu poder responder.", "campo": "content"},
        )

    anteriores = db.scalars(
        select(orm.MensagemChat)
        .where(orm.MensagemChat.tenant_id == tenant)
        .order_by(orm.MensagemChat.criada_em.desc(), orm.MensagemChat.id.desc())
        .limit(TETO_HISTORICO)
    ).all()
    historico_pares = [(m.papel, m.conteudo) for m in reversed(anteriores)]

    _gravar(db, tenant, "user", texto)

    try:
        resposta = obter_assistente().responder(texto, _contexto(db, tenant), historico_pares)
    except ErroDeAssistente as e:
        # A frase vai direto à tela: pt-BR, sem jargão. A pergunta do usuário
        # já foi gravada, então a conversa não perde o que ele escreveu.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(e)}
        ) from e

    gravada = _gravar(db, tenant, "assistant", resposta.content, resposta.cards)
    return schemas.RespostaMensagem(message=_para_schema(db, tenant, gravada))
