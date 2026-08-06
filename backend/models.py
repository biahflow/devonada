from pydantic import BaseModel
from typing import Optional, List

class NovaDivida(BaseModel):
    credor: str
    valorCobrado: int
    dataOrigem: str
    tipo: str

class Divida(NovaDivida):
    id: int
    valorCorrigido: Optional[int] = None
    possivelPrescricao: Optional[bool] = None


class SendMessageRequest(BaseModel):
    content: str


        