import re

import schemas
from extracao import regras
from extracao.base import (
    ArquivoContrato,
    ErroDeExtracao,
    ResultadoExtracao,
    limpar_campos_sem_evidencia,
)
from llm import BlocoDocumento, BlocoImagem, BlocoTexto, ClienteLLM, ErroDeLLM

MIMES_IMAGEM = ("image/jpeg", "image/png")

DATA_BR = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def _normalizar_datas(campos: dict, nomes: tuple[str, ...]) -> dict:
    """
    Converte `DD/MM/AAAA` para ISO antes da validação, nos campos de data do tipo.

    O prompt já pede ISO, mas prompt não é garantia — e um documento brasileiro
    escreve a data no formato brasileiro em toda página. Sem esta rede, o
    modelo devolver "12/03/2025" derrubava a EXTRAÇÃO INTEIRA por um formato,
    perdendo os campos que vieram certos. Aconteceu na primeira leitura real.

    Age SÓ nos campos que o tipo declara como data (`campos_data`): converter
    qualquer string com cara de data alcançaria uma linha digitável ou uma
    referência por engano.
    """
    for nome in nomes:
        campo = campos.get(nome)
        if isinstance(campo, dict) and isinstance(campo.get("valor"), str):
            casou = DATA_BR.match(campo["valor"].strip())
            if casou:
                dia, mes, ano = casou.groups()
                campo["valor"] = f"{ano}-{mes}-{dia}"
    return campos


class ExtratorLLM:
    """
    A única implementação de extração por modelo — para qualquer provedor e para
    qualquer tipo de documento.

    Antes existia uma classe por provedor, cada uma repetindo o prompt, o schema
    e o guardrail 8.1. Agora o que é específico de provedor vive em `llm/`, o que
    é específico de TIPO de documento vive em `extracao/regras.py`, e esta classe
    só orquestra: escolhe a regra pelo tipo, monta o bloco, chama o modelo, e
    aplica o descarte de campo sem evidência — uma vez, para os quatro tipos.
    """

    def __init__(self, cliente: ClienteLLM) -> None:
        self.cliente = cliente

    def extrair(self, arquivo: ArquivoContrato) -> ResultadoExtracao:
        regra = regras.REGRAS.get(arquivo.tipo)
        if regra is None:
            raise ErroDeExtracao(
                "Esse tipo de documento não é suportado. Você pode cadastrar a dívida à mão."
            )

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
                system=regra.system,
                blocos=[bloco, BlocoTexto(texto=regra.instrucao)],
                schema=regra.schema,
                nome_schema=regra.nome_schema,
                max_tokens=16000,
            )
        except ErroDeLLM as e:
            # A frase do provedor é genérica; aqui ela ganha o caminho de saída
            # que existe nesta tela específica.
            raise ErroDeExtracao(f"{e} Você pode cadastrar a dívida à mão.") from e

        try:
            normalizados = _normalizar_datas(bruto["campos"], regra.campos_data)
            campos = regra.modelo.model_validate(normalizados)
            alertas = [
                schemas.AlertaContrato(id=f"alerta-{i}", **a)
                for i, a in enumerate(bruto.get("alertas", []))
            ]
        except (KeyError, TypeError, ValueError) as e:
            raise ErroDeExtracao(
                "A leitura do documento voltou em um formato que não reconheço. "
                "Você pode cadastrar a dívida à mão."
            ) from e

        # Guardrail 8.1 aplicado no SERVIDOR: campo com valor e sem trecho
        # literal é zerado antes de sair da rota.
        return ResultadoExtracao(campos=limpar_campos_sem_evidencia(campos), alertas=alertas)
