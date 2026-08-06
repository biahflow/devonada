import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import db as db_module
import orm
import schemas
from auth import tenant_atual
from db import get_db
from extracao import ArquivoContrato, ErroDeExtracao, obter_extrator

router = APIRouter(prefix="/v1/contratos", tags=["Contratos"])

MIMES_ACEITOS = {"application/pdf", "image/jpeg", "image/png"}
TAMANHO_MAXIMO = 20 * 1024 * 1024  # 20 MB


def _para_schema(e: orm.Extracao) -> schemas.ExtracaoContrato:
    campos = schemas.CamposContrato.model_validate_json(e.campos_json) if e.campos_json else None
    alertas = (
        [schemas.AlertaContrato.model_validate(a) for a in json.loads(e.alertas_json)]
        if e.alertas_json
        else None
    )
    return schemas.ExtracaoContrato(
        id=e.id,
        status=e.status,  # type: ignore[arg-type]
        erro=e.erro,
        campos=campos,
        alertas=alertas,
    )


def _processar(extracao_id: str, arquivo: ArquivoContrato) -> None:
    """
    Roda em background. Abre a própria sessão porque a da request já fechou.

    O CONTEÚDO DO ARQUIVO VIVE SÓ AQUI, em memória, e é descartado quando esta
    função retorna (ADR 0005). Nada é gravado em disco em nenhum momento.
    """
    # Referência pelo MÓDULO, não por valor: o import direto congelaria a
    # fábrica no momento do import e o teste não conseguiria trocá-la.
    db = db_module.SessionLocal()
    try:
        e = db.scalar(select(orm.Extracao).where(orm.Extracao.id == extracao_id))
        if e is None:
            return

        try:
            resultado = obter_extrator().extrair(arquivo)
        except ErroDeExtracao as erro:
            e.status = "falhou"
            e.erro = str(erro)
            db.commit()
            return
        except Exception:
            # Nunca vaza detalhe técnico nem trecho do contrato para a tela.
            e.status = "falhou"
            e.erro = "Algo deu errado na leitura. Tente outro arquivo ou cadastre à mão."
            db.commit()
            return

        e.status = "concluida"
        e.campos_json = resultado.campos.model_dump_json()
        e.alertas_json = json.dumps([a.model_dump(mode="json") for a in resultado.alertas])
        db.commit()
    finally:
        db.close()


@router.post("", response_model=schemas.RespostaExtracao, status_code=status.HTTP_202_ACCEPTED)
async def enviar(
    background: BackgroundTasks,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    if arquivo.content_type not in MIMES_ACEITOS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Envie um PDF ou uma foto do contrato.", "campo": "arquivo"},
        )

    conteudo = await arquivo.read()
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"message": "Esse arquivo é grande demais. O limite é 20 MB."},
        )

    e = orm.Extracao(
        tenant_id=tenant,
        status="processando",
        nome_arquivo=arquivo.filename,
        mime_type=arquivo.content_type,
        arquivo_descartado=True,
    )
    db.add(e)
    db.commit()
    db.refresh(e)

    background.add_task(
        _processar,
        e.id,
        ArquivoContrato(
            conteudo=conteudo, nome=arquivo.filename or "contrato", mime_type=arquivo.content_type
        ),
    )

    return schemas.RespostaExtracao(extracao=_para_schema(e))


@router.get("/{extracao_id}", response_model=schemas.RespostaExtracao)
def acompanhar(
    extracao_id: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    e = db.scalar(
        select(orm.Extracao).where(
            orm.Extracao.id == extracao_id, orm.Extracao.tenant_id == tenant
        )
    )
    if e is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Não encontramos essa leitura."},
        )
    return schemas.RespostaExtracao(extracao=_para_schema(e))
