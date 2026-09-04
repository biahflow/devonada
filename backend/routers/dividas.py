from dataclasses import dataclass
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.correcao import valor_corrigido
from domain.marcos import marcos_atingidos
from domain.prescricao import possivel_prescricao
from routers.marcos import registrar_marcos
from routers.parcelas import ajustar_parcelas_pendentes, criar_parcelas

router = APIRouter(prefix="/v1/dividas", tags=["Dividas"])


@dataclass(frozen=True)
class AgregadoDeParcelas:
    """
    Fecha as limitações 24 e 25 do inventário.

    `divida.parcelas_pagas` e `divida.proximo_vencimento` são colunas que
    ninguém no backend de produção mantém atualizadas — a rota de pagamento
    nunca as toca. Este agregado deriva os dois fatos da lista real de
    `orm.Parcela`, que é quem de fato muda a cada pagamento (mesma lição de
    `tabelas_do_tenant()` no M8: coluna que ninguém escreve envelhece,
    verificação derivada não).
    """

    pagas: int
    proximo_vencimento: date | None
    tem_parcelas: bool


def _agregados_de_parcelas(
    db: Session, tenant: str, divida_ids: list[str]
) -> dict[str, AgregadoDeParcelas]:
    """
    Um agregado por dívida, numa ÚNICA query — o resto é agregado em Python.

    Nada de `COUNT(...) FILTER` nem `case()` dentro de agregação: a suíte roda
    em SQLite e a produção é Postgres, e construção específica de dialeto é
    exatamente o defeito que passa no teste e quebra no ar. Buscar as linhas
    de parcela das dívidas pedidas e agregar aqui evita as duas coisas ao
    mesmo tempo — inclusive o N+1 de uma query por dívida em `listar()`.
    """
    if not divida_ids:
        return {}

    linhas = db.execute(
        select(orm.Parcela.divida_id, orm.Parcela.paga_em, orm.Parcela.vencimento).where(
            orm.Parcela.divida_id.in_(divida_ids),
            orm.Parcela.tenant_id == tenant,
            orm.Parcela.cancelada_em.is_(None),
        )
    ).all()

    pagas: dict[str, int] = {}
    proximos: dict[str, date] = {}

    for divida_id, paga_em, vencimento in linhas:
        if paga_em is not None:
            pagas[divida_id] = pagas.get(divida_id, 0) + 1
        else:
            atual = proximos.get(divida_id)
            if atual is None or vencimento < atual:
                proximos[divida_id] = vencimento

    presentes = {divida_id for divida_id, _paga_em, _vencimento in linhas}
    return {
        divida_id: AgregadoDeParcelas(
            pagas=pagas.get(divida_id, 0),
            proximo_vencimento=proximos.get(divida_id),
            tem_parcelas=True,
        )
        for divida_id in presentes
    }


def _para_schema(d: orm.Divida, agregado: AgregadoDeParcelas | None = None) -> schemas.Divida:
    """
    ORM → contrato de API, aplicando as regras derivadas.

    `valorCorrigido` sai como None quando a dívida não tem taxa — o app exibe
    "ainda não calculado", que é a verdade, em vez de um número inventado.

    `agregado` fecha as limitações 24 e 25: quando a dívida TEM parcelas, os
    dois campos vêm da lista real, não da coluna que ninguém escreve. Sem
    agregado (dívida sem cronograma), a coluna continua sendo a resposta —
    "sem cronograma" não é "zero pagas". `agregado` tem default `None` só
    para não quebrar `routers.parcelas.renegociar()`, que importa esta função
    e está fora do escopo desta mudança.
    """
    saldo = d.valor_cobrado if d.situacao != "quitada" else 0

    tem_parcelas = agregado is not None and agregado.tem_parcelas
    parcelas_pagas = agregado.pagas if tem_parcelas else d.parcelas_pagas
    proximo_vencimento = agregado.proximo_vencimento if tem_parcelas else d.proximo_vencimento

    return schemas.Divida(
        id=d.id,
        credor=d.credor,
        valorCobrado=d.valor_cobrado,
        dataOrigem=d.data_origem,
        tipo=d.tipo,  # type: ignore[arg-type]
        valorCorrigido=valor_corrigido(d.valor_cobrado, d.taxa_juros_mensal, d.data_origem),
        possivelPrescricao=possivel_prescricao(d.data_origem),
        situacao=d.situacao,  # type: ignore[arg-type]
        saldoDevedor=saldo,
        taxaJurosMensal=d.taxa_juros_mensal,
        totalParcelas=d.total_parcelas,
        parcelasPagas=parcelas_pagas,
        proximoVencimento=proximo_vencimento,
        extracaoId=d.extracao_id,
    )


def _buscar(db: Session, tenant: str, divida_id: str) -> orm.Divida:
    """
    Busca escopada por tenant.

    Recurso de outro tenant devolve 404, NUNCA 403: um 403 confirmaria que o
    id existe, que é justamente o que não queremos revelar.
    """
    d = db.scalar(
        select(orm.Divida).where(
            orm.Divida.id == divida_id,
            orm.Divida.tenant_id == tenant,
            orm.Divida.excluido_em.is_(None),
        )
    )
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos essa dívida."},
        )
    return d


def _extracao_ligavel(db: Session, tenant: str, extracao_id: str) -> orm.Extracao:
    """
    Extração pronta para ser ligada a uma dívida (F-019, ADR 0025).

    Busca escopada por tenant, como `_buscar`. Extração de outro tenant devolve
    404, NUNCA 403: um 403 confirmaria que o id existe, que é justamente o que
    não queremos revelar. Extração que ainda não terminou devolve 409 —
    conflito de estado, não payload inválido.
    """
    e = db.scalar(
        select(orm.Extracao).where(
            orm.Extracao.id == extracao_id,
            orm.Extracao.tenant_id == tenant,
        )
    )
    if e is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos esse documento."},
        )
    if e.status != "concluida":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "A leitura desse documento ainda não terminou."},
        )
    return e


@router.get("", response_model=schemas.ListaDividas)
def listar(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    dividas = db.scalars(
        select(orm.Divida)
        .where(orm.Divida.tenant_id == tenant, orm.Divida.excluido_em.is_(None))
        .order_by(orm.Divida.criado_em.desc())
    ).all()
    # UMA query para todas as dívidas da página — N+1 aqui seria a regressão
    # que o desenho de `_agregados_de_parcelas` existe para evitar.
    agregados = _agregados_de_parcelas(db, tenant, [d.id for d in dividas])
    return schemas.ListaDividas(
        dividas=[_para_schema(d, agregados.get(d.id)) for d in dividas]
    )


@router.post("", response_model=schemas.RespostaDivida, status_code=status.HTTP_201_CREATED)
def criar(
    nova: schemas.NovaDivida,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    if nova.dataOrigem > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "A data de origem não pode estar no futuro.", "campo": "dataOrigem"},
        )

    # Os dois andam juntos: um sem o outro produz meia informação — parcelas sem
    # datas, ou uma data que não gera cronograma nenhum.
    if bool(nova.totalParcelas) != bool(nova.primeiroVencimento):
        faltando = "primeiroVencimento" if nova.totalParcelas else "totalParcelas"
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Para montar o carnê, informe o número de parcelas e a data da primeira.",
                "campo": faltando,
            },
        )

    # F-019 / ADR 0025, decisão 5: o mesmo validador da rota de ligação passa a
    # valer aqui. Extração inexistente, de outro tenant ou não concluída falha
    # onde antes era gravada crua — mudança de comportamento declarada.
    if nova.extracaoId is not None:
        _extracao_ligavel(db, tenant, nova.extracaoId)

    d = orm.Divida(
        tenant_id=tenant,
        credor=nova.credor.strip(),
        valor_cobrado=nova.valorCobrado,
        data_origem=nova.dataOrigem,
        tipo=nova.tipo,
        taxa_juros_mensal=nova.taxaJurosMensal,
        extracao_id=nova.extracaoId,
        total_parcelas=nova.totalParcelas,
        proximo_vencimento=nova.primeiroVencimento,
    )
    db.add(d)
    db.flush()

    if nova.totalParcelas and nova.primeiroVencimento:
        criar_parcelas(
            db, tenant, d.id, nova.valorCobrado, nova.totalParcelas, nova.primeiroVencimento
        )

    db.commit()
    db.refresh(d)
    # As parcelas só existem depois deste commit — o agregado tem de ser lido
    # aqui, não antes.
    agregado = _agregados_de_parcelas(db, tenant, [d.id]).get(d.id)
    return schemas.RespostaDivida(divida=_para_schema(d, agregado))


@router.get("/{divida_id}", response_model=schemas.RespostaDivida)
def obter(
    divida_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    d = _buscar(db, tenant, divida_id)
    agregado = _agregados_de_parcelas(db, tenant, [d.id]).get(d.id)
    return schemas.RespostaDivida(divida=_para_schema(d, agregado))


@router.patch("/{divida_id}", response_model=schemas.RespostaDivida)
def atualizar(
    divida_id: str,
    patch: schemas.PatchDivida,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    d = _buscar(db, tenant, divida_id)
    valor_antes = d.valor_cobrado

    campos = patch.model_dump(exclude_unset=True)
    if "credor" in campos and campos["credor"]:
        d.credor = campos["credor"].strip()
    if "valorCobrado" in campos and campos["valorCobrado"]:
        d.valor_cobrado = campos["valorCobrado"]
    if "dataOrigem" in campos and campos["dataOrigem"]:
        d.data_origem = campos["dataOrigem"]
    if "tipo" in campos and campos["tipo"]:
        d.tipo = campos["tipo"]
    # taxaJurosMensal aceita None explícito — é como o usuário desfaz um valor
    # que ele mesmo digitou errado.
    if "taxaJurosMensal" in campos:
        d.taxa_juros_mensal = campos["taxaJurosMensal"]

    # Limitação 22: valorCobrado mudou ⇒ as parcelas pendentes são redistribuídas
    # para continuar somando o novo total. Sem isso, a dívida diria um número
    # e o carnê continuaria somando outro (limitação 22 do inventário).
    ajustar_parcelas_pendentes(db, tenant, d, valor_antes)

    db.commit()
    db.refresh(d)
    agregado = _agregados_de_parcelas(db, tenant, [d.id]).get(d.id)
    return schemas.RespostaDivida(divida=_para_schema(d, agregado))


@router.post("/{divida_id}/documento", response_model=schemas.RespostaDivida)
def ligar_documento(
    divida_id: str,
    corpo: schemas.LigarDocumento,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Liga um documento já lido a uma dívida existente (F-019, ADR 0025).

    Vínculo e campos aceitos são ATÔMICOS: um único `commit()`, para nunca
    gravar os campos do documento sem o vínculo que os sustenta (achado sem
    procedência) nem o contrário.
    """
    d = _buscar(db, tenant, divida_id)
    e = _extracao_ligavel(db, tenant, corpo.extracaoId)
    valor_antes = d.valor_cobrado

    if corpo.campos is not None:
        campos = corpo.campos.model_dump(exclude_unset=True)
        if "credor" in campos and campos["credor"]:
            d.credor = campos["credor"].strip()
        if "valorCobrado" in campos and campos["valorCobrado"]:
            d.valor_cobrado = campos["valorCobrado"]
        if "dataOrigem" in campos and campos["dataOrigem"]:
            d.data_origem = campos["dataOrigem"]
        if "tipo" in campos and campos["tipo"]:
            d.tipo = campos["tipo"]
        # Divergência deliberada de `atualizar()`: aqui `taxaJurosMensal: null`
        # é IGNORADO, não limpa a taxa. No PATCH, `None` explícito é o usuário
        # desfazendo um valor que ele mesmo digitou; aqui o que chega vem de
        # leitura de documento, e documento não apaga afirmação que a pessoa
        # fez (ADR 0025, decisão 3).
        if "taxaJurosMensal" in campos and campos["taxaJurosMensal"] is not None:
            d.taxa_juros_mensal = campos["taxaJurosMensal"]

    d.extracao_id = e.id

    # Limitação 22: mesmo ajuste do PATCH, para o valor lido de um documento não
    # deixar as parcelas com o total antigo (limitação 22 do inventário).
    ajustar_parcelas_pendentes(db, tenant, d, valor_antes)

    db.commit()
    db.refresh(d)
    agregado = _agregados_de_parcelas(db, tenant, [d.id]).get(d.id)
    return schemas.RespostaDivida(divida=_para_schema(d, agregado))


@router.post("/{divida_id}/quitacao", response_model=schemas.RespostaDivida)
def quitar(
    divida_id: str,
    entrada: schemas.QuitacaoInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    d = _buscar(db, tenant, divida_id)

    if d.situacao == "quitada":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Essa dívida já está quitada."},
        )

    d.situacao = "quitada"
    d.valor_pago = entrada.valorPago
    d.data_quitacao = entrada.dataQuitacao

    # O outro ponto em que a quitação é detectada — o primeiro é
    # `parcelas.pagar`, quando a última parcela pendente cai. Os dois gravam o
    # mesmo marco, e `registrar_marcos` é idempotente por `(tenant_id, tipo)`:
    # quem quita a segunda dívida não ganha uma segunda "primeira quitação".
    registrar_marcos(db, tenant, marcos_atingidos(houve_quitacao=True))

    db.commit()
    db.refresh(d)
    agregado = _agregados_de_parcelas(db, tenant, [d.id]).get(d.id)
    return schemas.RespostaDivida(divida=_para_schema(d, agregado))


@router.delete("/{divida_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    divida_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """Exclusão LÓGICA. Some da listagem; o histórico financeiro permanece."""
    d = _buscar(db, tenant, divida_id)
    d.excluido_em = datetime.now(timezone.utc)
    db.commit()
