import re

import schemas
from extracao.base import (
    ArquivoContrato,
    ErroDeExtracao,
    ResultadoExtracao,
    limpar_campos_sem_evidencia,
)
from extracao.regras import SCHEMA_EXTRACAO, SYSTEM
from llm import BlocoDocumento, BlocoImagem, BlocoTexto, ClienteLLM, ErroDeLLM

MIMES_IMAGEM = ("image/jpeg", "image/png")

DATA_BR = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def _normalizar_data(campos: dict) -> dict:
    """
    Converte `DD/MM/AAAA` para ISO antes da validação.

    O prompt já pede ISO, mas prompt não é garantia — e um contrato brasileiro
    escreve a data no formato brasileiro em toda página. Sem esta rede, o
    modelo devolver "12/03/2025" derrubava a EXTRAÇÃO INTEIRA por um formato,
    perdendo os seis campos que vieram certos. Aconteceu na primeira leitura
    real.
    """
    campo = campos.get("dataOrigem")
    if isinstance(campo, dict) and isinstance(campo.get("valor"), str):
        casou = DATA_BR.match(campo["valor"].strip())
        if casou:
            dia, mes, ano = casou.groups()
            campo["valor"] = f"{ano}-{mes}-{dia}"
    return campos


class ExtratorLLM:
    """
    A única implementação de extração por modelo — para qualquer provedor.

    Antes existia uma classe por provedor, cada uma repetindo o prompt, o schema
    e o guardrail 8.1. Agora o que é específico de provedor vive em `llm/`, e o
    que é regra do produto vive aqui e em `extracao/regras.py`, uma vez só.
    """

    def __init__(self, cliente: ClienteLLM) -> None:
        self.cliente = cliente

    def extrair(self, arquivo: ArquivoContrato) -> ResultadoExtracao:
        if arquivo.mime_type == "application/pdf":
            bloco = BlocoDocumento(
                dados=arquivo.conteudo, mime_type=arquivo.mime_type, nome=arquivo.nome
            )
        elif arquivo.mime_type in MIMES_IMAGEM:
            bloco = BlocoImagem(dados=arquivo.conteudo, mime_type=arquivo.mime_type)
        else:
            raise ErroDeExtracao(
                "Esse formato de arquivo não é suportado. Envie um PDF ou uma foto."
            )

        try:
            bruto = self.cliente.responder_json(
                system=SYSTEM,
                blocos=[
                    bloco,
                    BlocoTexto(texto="Extraia os dados deste contrato conforme as regras."),
                ],
                schema=SCHEMA_EXTRACAO,
                nome_schema="extracao_de_contrato",
                max_tokens=16000,
            )
        except ErroDeLLM as e:
            # A frase do provedor é genérica; aqui ela ganha o caminho de saída
            # que existe nesta tela específica.
            raise ErroDeExtracao(f"{e} Você pode cadastrar a dívida à mão.") from e

        try:
            campos = schemas.CamposContrato.model_validate(_normalizar_data(bruto["campos"]))
            alertas = [
                schemas.AlertaContrato(id=f"alerta-{i}", **a)
                for i, a in enumerate(bruto.get("alertas", []))
            ]
        except (KeyError, TypeError, ValueError) as e:
            raise ErroDeExtracao(
                "A leitura do contrato voltou em um formato que não reconheço. "
                "Você pode cadastrar a dívida à mão."
            ) from e

        # Guardrail 8.1 aplicado no SERVIDOR: campo com valor e sem trecho
        # literal é zerado antes de sair da rota.
        return ResultadoExtracao(campos=limpar_campos_sem_evidencia(campos), alertas=alertas)
