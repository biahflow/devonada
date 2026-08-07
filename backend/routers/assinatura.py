from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from config import Settings, get_settings
from db import get_db
from leitura import situacao_da_assinatura
from loja import Compra, ErroDeLoja, obter_loja

router = APIRouter(prefix="/v1/assinatura", tags=["Assinatura"])

"""
As duas rotas da cobrança.

ELAS FICAM FORA DA TRAVA de `backend/assinatura.py`, e isso não é exceção
concedida a um recurso: uma trava que exigisse assinatura para assinar é um
deadlock, e ele só apareceria no primeiro usuário pagante de verdade.

NENHUMA ROTA DE ESCRITA DE DADO FINANCEIRO NASCE AQUI. A assinatura é uma linha
sobre cobrança; ela não toca dívida, caixa nem contrato.
"""


def _para_schema(db: Session, tenant: str, settings: Settings) -> schemas.SituacaoAssinatura:
    situacao = situacao_da_assinatura(db, tenant, settings)
    linha = db.scalars(select(orm.Assinatura).where(orm.Assinatura.tenant_id == tenant)).first()

    return schemas.SituacaoAssinatura(
        status=situacao.status,
        podeEscrever=situacao.pode_escrever,
        expiraEm=situacao.expira_em,
        diasRestantes=situacao.dias_restantes,
        produtoId=linha.produto_id if linha else None,
        renovacaoAutomatica=linha.renovacao_automatica if linha else None,
    )


@router.get("", response_model=schemas.SituacaoAssinatura)
def situacao_atual(
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    A situação de agora.

    RECONFERE NA LOJA quando o registro local já passou de `expira_em`. É isto
    que substitui webhook: a renovação mensal acontece no servidor da loja sem
    nos avisar, e sem reconferir o usuário que pagou em dia veria "expirada" até
    tocar em comprar de novo — e alguns tocariam, pagando duas vezes.

    POR QUE NÃO WEBHOOK, e não é preguiça: *App Store Server Notifications V2* e
    o RTDN do Google exigem URL pública, que o `roadmap.md` lista como pendente
    na mesma linha da página de exclusão, e o RTDN exige ainda um projeto GCP com
    Pub/Sub. Reconferir sob demanda dá o mesmo resultado com a latência de uma
    abertura do app. Webhook entra quando houver domínio, e substitui isto sem
    mudar o contrato desta rota.

    A FALHA DE REDE NÃO DERRUBA NINGUÉM. Se a loja não responde, respondemos com
    o que está gravado. Tirar acesso de quem pagou porque a Apple teve
    instabilidade é o erro caro; dar algumas horas a mais é o barato.
    """
    linha = db.scalars(select(orm.Assinatura).where(orm.Assinatura.tenant_id == tenant)).first()

    if linha is not None and _venceu(linha.expira_em):
        try:
            compra = obter_loja(linha.plataforma).conferir(linha.chave_consulta)
            _gravar(db, tenant, linha.plataforma, compra)
            db.commit()
        except ErroDeLoja:
            db.rollback()

    return _para_schema(db, tenant, settings)


@router.post("/compra", response_model=schemas.SituacaoAssinatura)
def registrar_compra(
    entrada: schemas.PedidoCompra,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    settings: Settings = Depends(get_settings),
):
    """
    Confere o recibo com a loja e grava o resultado.

    É TAMBÉM A RESTAURAÇÃO, e por isso não existe uma segunda rota para ela. O
    botão "Restaurar compras" que a Apple exige na diretriz 3.1.1 manda o mesmo
    recibo para cá; a unicidade de `transacao_original_id` no banco faz o
    reenvio encontrar a linha que já existe em vez de criar assinatura nova.
    Duas rotas fariam o mesmo trabalho com duas chances de divergir.

    O 409 PROTEGE UM CASO REAL: dois tenants apresentando o mesmo
    `transacao_original_id` é uma assinatura sendo compartilhada entre contas —
    a mesma Apple ID logada em duas contas do nosso app. Recusar a segunda é o
    comportamento certo, e a frase diz o que houve sem acusar ninguém.
    """
    try:
        compra = obter_loja(entrada.plataforma).conferir(entrada.recibo)
    except ErroDeLoja as e:
        # 422 e não 500: não é defeito do servidor, é um recibo que a loja não
        # reconheceu. A frase vem do adaptador já em pt-BR e para leigo.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(e)},
        ) from e

    try:
        _gravar(db, tenant, entrada.plataforma, compra)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "Essa assinatura já está vinculada a outra conta. "
                    "Entre com a conta que a comprou, ou fale com o suporte."
                )
            },
        ) from e

    return _para_schema(db, tenant, settings)


def _gravar(db: Session, tenant: str, plataforma: str, compra: Compra) -> None:
    """
    Uma linha por tenant, sobrescrita — não é extrato de cobranças.

    `db.flush()` e não `commit()`: quem chama decide a transação, porque as duas
    rotas acima tratam o `IntegrityError` de formas diferentes.
    """
    linha = db.scalars(select(orm.Assinatura).where(orm.Assinatura.tenant_id == tenant)).first()

    if linha is None:
        linha = orm.Assinatura(tenant_id=tenant)
        db.add(linha)

    linha.plataforma = plataforma
    linha.produto_id = compra.produto_id
    linha.transacao_original_id = compra.transacao_original_id
    linha.chave_consulta = compra.chave_consulta
    linha.expira_em = compra.expira_em
    linha.ambiente = compra.ambiente
    linha.renovacao_automatica = compra.renovacao_automatica
    linha.atualizado_em = datetime.now(timezone.utc)

    db.flush()


def _venceu(quando: datetime) -> bool:
    """SQLite devolve data ingênua; Postgres, com fuso. Ver `domain/assinatura._utc`."""
    referencia = quando if quando.tzinfo else quando.replace(tzinfo=timezone.utc)
    return referencia <= datetime.now(timezone.utc)
