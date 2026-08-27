from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db

router = APIRouter(prefix="/v1", tags=["Negociações"])

"""
Registro e leitura do RESULTADO de uma negociação (M12, F-012, ADR 0021).

`orm.Renegociacao` é grava-e-esquece: nasce só do acordo, é escrita num ponto só
(`parcelas.renegociar`) e nenhum `GET` a devolve. Recusa, contraproposta e
silêncio do credor são metade da informação do benchmark, e hoje são jogados
fora. `ResultadoNegociacao` os comporta, e estas rotas são a leitura que hoje
não existe — sem ela não há benchmark.

O canal aqui PERSISTE (é fato do que aconteceu, e é o que o benchmark lê), ao
contrário da leitura do script, onde ele é só parâmetro de visualização
(ADR 0021, item 7). Registrar um resultado NÃO dispara marco: `primeira_
negociacao` continua nascendo do acordo fechado, em `parcelas.renegociar`.
"""


def _buscar_divida(db: Session, tenant: str, divida_id: str) -> orm.Divida:
    """404, nunca 403: um 403 confirmaria que o id existe em outro tenant."""
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


def _para_schema(r: orm.ResultadoNegociacao) -> schemas.ResultadoNegociacao:
    return schemas.ResultadoNegociacao(
        id=r.id,
        dividaId=r.divida_id,
        canal=r.canal,  # type: ignore[arg-type]
        desfecho=r.desfecho,  # type: ignore[arg-type]
        valorProposto=r.valor_proposto,
        valorObtido=r.valor_obtido,
        renegociacaoId=r.renegociacao_id,
        observacao=r.observacao,
        registradoEm=r.registrado_em,
    )


@router.post(
    "/dividas/{divida_id}/negociacoes",
    response_model=schemas.RespostaResultadoNegociacao,
    status_code=status.HTTP_201_CREATED,
)
def registrar(
    divida_id: str,
    entrada: schemas.RegistroNegociacaoInput,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Registra o que aconteceu na conversa — inclusive quando NÃO houve acordo.

    É registro ADICIONAL, não substituto: fechar um acordo continua chamando
    `POST /v1/dividas/{id}/renegociacao`, que reescreve as parcelas e dispara o
    marco. Este registro guarda o desfecho da conversa para o benchmark, e não
    mexe em parcela nenhuma.
    """
    _buscar_divida(db, tenant, divida_id)

    resultado = orm.ResultadoNegociacao(
        tenant_id=tenant,
        divida_id=divida_id,
        canal=entrada.canal,
        desfecho=entrada.desfecho,
        valor_proposto=entrada.valorProposto,
        valor_obtido=entrada.valorObtido,
        renegociacao_id=entrada.renegociacaoId,
        observacao=entrada.observacao,
    )
    db.add(resultado)
    db.commit()
    db.refresh(resultado)
    return schemas.RespostaResultadoNegociacao(resultado=_para_schema(resultado))


@router.get(
    "/dividas/{divida_id}/negociacoes",
    response_model=schemas.ListaResultadosNegociacao,
)
def listar_da_divida(
    divida_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """O histórico de uma dívida, do mais recente ao mais antigo."""
    _buscar_divida(db, tenant, divida_id)
    resultados = db.scalars(
        select(orm.ResultadoNegociacao)
        .where(
            orm.ResultadoNegociacao.divida_id == divida_id,
            orm.ResultadoNegociacao.tenant_id == tenant,
        )
        .order_by(orm.ResultadoNegociacao.registrado_em.desc())
    ).all()
    return schemas.ListaResultadosNegociacao(resultados=[_para_schema(r) for r in resultados])


@router.get("/negociacoes", response_model=schemas.ListaResultadosNegociacao)
def listar_do_tenant(
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Todas as negociações do tenant — é o que constrói o benchmark do próprio
    usuário (por credor, por canal, por desfecho). Agregar entre tenants é
    decisão de privacidade que ninguém tomou, e está fora de escopo.
    """
    resultados = db.scalars(
        select(orm.ResultadoNegociacao)
        .where(orm.ResultadoNegociacao.tenant_id == tenant)
        .order_by(orm.ResultadoNegociacao.registrado_em.desc())
    ).all()
    return schemas.ListaResultadosNegociacao(resultados=[_para_schema(r) for r in resultados])
