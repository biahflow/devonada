from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from config import get_settings
from db import get_db
from domain import revisao as dominio
from domain.parcelas import situacao_da_parcela
from domain.script import montar_script
from extracao.base import limpar_campos_sem_evidencia
from juridico import trilhas as trilhas_juridicas
from routers.juridico import para_schema as trilha_para_schema
from leitura import capacidade_atual, carregar_dividas_simulaveis

router = APIRouter(prefix="/v1", tags=["Revisão"])


def _tetos() -> dominio.Tetos:
    s = get_settings()
    return dominio.Tetos(
        consignado_inss_bps=s.teto_juros_consignado_inss_bps,
        cartao_consignado_bps=s.teto_juros_cartao_consignado_bps,
        vigentes_em=s.tetos_vigentes_em,
    )


def _campos(db: Session, tenant: str, extracao_id: str | None) -> schemas.CamposContrato | None:
    """
    Os campos da extração que originou a dívida, se houve uma.

    Já passaram por `limpar_campos_sem_evidencia()` antes de serem gravados, o
    que é o que garante que todo achado derivado daqui carrega trecho literal.
    """
    if not extracao_id:
        return None
    e = db.scalar(
        select(orm.Extracao).where(
            orm.Extracao.id == extracao_id,
            orm.Extracao.tenant_id == tenant,
        )
    )
    if e is None or not e.campos_json:
        return None

    # Reaplica o guardrail 8.1 NA LEITURA, e não só antes de gravar. A extração
    # já passou por aqui, então isto é redundante hoje — e é de propósito: a
    # garantia de que todo achado carrega trecho literal passa a valer pela
    # forma da função, não pela confiança em quem escreveu a linha do banco.
    return limpar_campos_sem_evidencia(
        schemas.CamposContrato.model_validate_json(e.campos_json)
    )


def _contrato(divida: orm.Divida, campos: schemas.CamposContrato | None) -> dominio.Contrato:
    if campos is None:
        # Dívida cadastrada à mão: o domínio recebe só o que existe, e devolve
        # zero achado. É a verdade, não uma falha a mascarar.
        return dominio.Contrato(valor_cobrado=divida.valor_cobrado)

    return dominio.Contrato(
        valor_cobrado=divida.valor_cobrado,
        modalidade=campos.modalidade.valor,
        # A taxa da dívida vence a do contrato: uma renegociação altera a
        # primeira e não a segunda, e revisar contra a taxa antiga apontaria um
        # achado que já não existe.
        taxa_juros_mensal_bps=divida.taxa_juros_mensal or campos.taxaJurosMensal.valor,
        multa_moratoria_bps=campos.multaMoratoriaMensal.valor,
        tarifa_cadastro=campos.tarifaCadastro.valor,
        seguro_prestamista=campos.seguroPrestamista.valor,
        cet_anual_bps=campos.cet.valor,
        trecho_multa=campos.multaMoratoriaMensal.trecho,
        trecho_tarifa=campos.tarifaCadastro.trecho,
        trecho_seguro=campos.seguroPrestamista.trecho,
        trecho_taxa=campos.taxaJurosMensal.trecho,
    )


def _parcelas_atrasadas(db: Session, tenant: str, divida_id: str) -> list[int]:
    """Valores das parcelas em atraso — a base sobre a qual a multa incide."""
    parcelas = db.scalars(
        select(orm.Parcela).where(
            orm.Parcela.divida_id == divida_id,
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
            orm.Parcela.paga_em.is_(None),
        )
    ).all()
    return [
        p.valor for p in parcelas if situacao_da_parcela(p.vencimento, p.paga_em) == "atrasada"
    ]


def _houve_divida_anterior(db: Session, tenant: str, divida: orm.Divida) -> bool:
    """
    Indício de relacionamento anterior com o mesmo credor.

    É indício, não prova: "relacionamento" com a instituição é mais amplo do que
    "dívida cadastrada neste app". O achado que usa isto declara o indício e
    condiciona a conclusão — ver `domain/revisao.py`.
    """
    outra = db.scalar(
        select(orm.Divida).where(
            orm.Divida.tenant_id == tenant,
            orm.Divida.credor == divida.credor,
            orm.Divida.id != divida.id,
            orm.Divida.data_origem < divida.data_origem,
            orm.Divida.excluido_em.is_(None),
        )
    )
    return outra is not None


def _montar_script(
    canal: schemas.Canal,
    credor: str,
    achados: list[dominio.Achado],
    capacidade_mensal: int | None,
) -> schemas.ScriptNegociacao:
    """
    Traduz os blocos tipados de `domain/script.montar_script` para o contrato.

    O motor é o módulo PURO (sem sessão, sem LLM): o guardrail 3 manda que
    fundamento legal e a copy de negociação sejam curados no backend, nunca
    improvisados por modelo. Aqui só há a conversão dataclass → Pydantic; a
    decisão de forma e de posicionamento da oferta mora inteira no domínio.
    """
    blocos = montar_script(canal, credor, achados, capacidade_mensal)
    return schemas.ScriptNegociacao(
        canal=canal,
        blocos=[
            schemas.BlocoScript(
                id=b.id,
                titulo=b.titulo,
                texto=b.texto,
                momento=b.momento,
                copiavel=b.copiavel,
            )
            for b in blocos
        ],
    )


def _capacidade_para_oferta(db: Session, tenant: str, divida_id: str) -> int | None:
    """
    Quanto o usuário pode oferecer por mês NESTE acordo, ou `None` se não
    sabemos.

    Duas decisões, e as duas mudam o número que vai para um credor de verdade:

    1. Parte de `capacidade_hoje`, não de `capacidade_maxima`. A oferta tem de
       caber na vida que a pessoa leva hoje; propor o valor que só existe
       cortando tudo é como o acordo quebra no terceiro mês.

    2. Desconta as parcelas das OUTRAS dívidas, não as desta. Um acordo sobre
       este contrato substitui a prestação dele — então ela volta para o bolo —
       mas as outras continuam saindo todo mês. Oferecer a capacidade cheia a um
       credor quando existem três é prometer o mesmo dinheiro três vezes.
    """
    caixa = capacidade_atual(db, tenant, get_settings())
    if caixa is None:
        return None

    outras = sum(
        d.parcela_minima
        for d in carregar_dividas_simulaveis(db, tenant, None)
        if d.divida_id != divida_id
    )
    return caixa.capacidade_hoje - outras


def revisar_divida(
    db: Session, tenant: str, divida: orm.Divida, canal: schemas.Canal = "email"
) -> schemas.RevisaoCobranca:
    """
    Produz a revisão de uma dívida. Usada pela rota E por `montar_cards` no chat.

    Um caminho só: o card `valor_justo` da conversa e a tela de revisão não podem
    divergir sobre o mesmo contrato.

    `canal` decide só a FORMA do script — o `valorJusto` e os achados são
    idênticos nos três. O default é `email` (PF-1), o formato mais próximo do
    texto único que a rota devolvia antes; o chat, que não escolhe canal, herda
    esse default.
    """
    campos = _campos(db, tenant, divida.extracao_id)
    resultado = dominio.revisar(
        contrato=_contrato(divida, campos),
        tetos=_tetos(),
        parcelas_atrasadas=_parcelas_atrasadas(db, tenant, divida.id),
        credor_ja_tinha_divida_anterior=_houve_divida_anterior(db, tenant, divida),
    )

    achados = [
        schemas.Achado(
            id=a.id,
            titulo=a.titulo,
            explicacao=a.explicacao,
            # `fonte` é derivado do registro (M14) — a citação legível continua
            # viajando para o app instalado que não conhece `fonteIds`.
            fonte=a.fonte,
            fonteIds=list(a.fonte_ids),
            comoConferir=a.como_conferir,
            valorContestavel=a.valor_contestavel,
            evidencia=a.evidencia,
        )
        for a in resultado.achados
    ]

    # Deduplicadas preservando a ordem: duas fontes iguais na lista de
    # fundamentos parecem erro de montagem para quem lê.
    fundamentos = list(dict.fromkeys(a.fonte for a in resultado.achados))

    return schemas.RevisaoCobranca(
        dividaId=divida.id,
        credor=divida.credor,
        valorCobrado=divida.valor_cobrado,
        valorJusto=resultado.valor_justo,
        achados=achados,
        script=_montar_script(
            canal,
            divida.credor,
            resultado.achados,
            _capacidade_para_oferta(db, tenant, divida.id),
        ),
        fundamentos=fundamentos,
        baseLegalVigenteEm=resultado.base_legal_vigente_em,
        # SEMPRE presente, inclusive sem achado nenhum: é justamente quando não
        # há `valorJusto` que explicar por que não há importa mais. A trilha diz
        # que o número seria uma subtração de achados, e que não existe lei
        # dizendo quanto uma dívida deveria custar.
        trilha=trilha_para_schema(trilhas_juridicas.VALOR_JUSTO),
    )


@router.get("/dividas/{divida_id}/revisao", response_model=schemas.RespostaRevisao)
def revisar(
    divida_id: str,
    canal: schemas.Canal = "email",
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    `?canal=telefone|chat|email` escolhe a FORMA do script; `email` é o default
    (PF-1), porque o texto único de antes já era uma mensagem formal e
    estruturada. O canal é parâmetro de VISUALIZAÇÃO e não persiste — é escolha
    de leitura, não fato do que aconteceu (ADR 0021, item 7). O `valorJusto` e
    os achados são idênticos nos três.
    """
    d = db.scalar(
        select(orm.Divida).where(
            orm.Divida.id == divida_id,
            orm.Divida.tenant_id == tenant,
            orm.Divida.excluido_em.is_(None),
        )
    )
    if d is None:
        # 404 e não 403: um 403 confirmaria que o id existe em outro tenant.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos essa dívida."},
        )

    return schemas.RespostaRevisao(revisao=revisar_divida(db, tenant, d, canal))
