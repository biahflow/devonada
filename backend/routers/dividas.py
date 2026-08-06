from fastapi import APIRouter
from typing import List
import uuid

from models import Divida, NovaDivida

router = APIRouter(prefix="/v1", tags=["Dividas"])

dividas_db: List[Divida] = []

@router.get("/dividas")
def listar_dividas():
    """Retorna a lista de dívidas cadastradas."""
    return {"dividas": dividas_db}


@router.post("/dividas")
def criar_divida(nova_divida: NovaDivida):
    """Recebe uma nova dívida e a adiciona à lista de dívidas cadastradas."""
    id_gerado = str(uuid.uuid4())

    valor_com_juros = int(nova_divida.valorCobrado * 1.1)

    divida_salva = Divida(
        **nova_divida.model_dump(),
        id=id_gerado,
        valorCorrigido=valor_com_juros,
        possivelPrescricao=False
    )

    dividas_db.append(divida_salva)
    return {"divida": divida_salva}