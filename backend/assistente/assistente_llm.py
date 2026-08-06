import re

from assistente.base import (
    ContextoDoUsuario,
    ErroDeAssistente,
    PedidoDeCard,
    RespostaAssistente,
)
from assistente.regras import SCHEMA_RESPOSTA, SYSTEM, montar_contexto
from llm import BlocoTexto, ClienteLLM, ErroDeLLM

# Sequência de dígitos com dois ou mais algarismos, ou dígito seguido de % ou
# de "reais". Um "um passo de cada vez" não é número; "R$ 1.500" é.
NUMERO_SUSPEITO = re.compile(r"\d[\d.,]*\s*(%|reais)|\d{2,}", re.IGNORECASE)

TETO_HISTORICO = 10


class AssistenteLLM:
    """
    A única implementação por modelo — para qualquer provedor.

    Duas defesas, nesta ordem, porque prompt não é guardrail (guardrails.md,
    cabeçalho: "as camadas são independentes; a falha de uma não pode derrubar
    as outras"):

    1. o schema não tem campo para valor monetário;
    2. o texto que volta é varrido por número, e número sem card correspondente
       é cortado aqui — no servidor, antes de existir como mensagem.
    """

    def __init__(self, cliente: ClienteLLM) -> None:
        self.cliente = cliente

    def responder(
        self,
        mensagem: str,
        contexto: ContextoDoUsuario,
        historico: list[tuple[str, str]],
    ) -> RespostaAssistente:
        conversa = "\n".join(
            f"{'Pessoa' if papel == 'user' else 'Você'}: {texto}"
            for papel, texto in historico[-TETO_HISTORICO:]
        )

        blocos = [
            BlocoTexto(texto=montar_contexto(contexto)),
            BlocoTexto(texto=f"Conversa até agora:\n{conversa}" if conversa else "Início da conversa."),
            BlocoTexto(texto=f"Mensagem da pessoa:\n{mensagem}"),
        ]

        try:
            bruto = self.cliente.responder_json(
                system=SYSTEM,
                blocos=blocos,
                schema=SCHEMA_RESPOSTA,
                nome_schema="resposta_do_assistente",
                max_tokens=2000,
            )
        except ErroDeLLM as e:
            raise ErroDeAssistente(str(e)) from e

        texto = str(bruto.get("texto", "")).strip()
        ids_validos = {d.divida_id for d in contexto.dividas}
        cards: list[PedidoDeCard] = []

        for item in bruto.get("cards", []):
            tipo = item.get("tipo")
            if tipo not in ("divida_resumo", "plano_sugerido"):
                continue

            divida_id = item.get("dividaId")
            # Id que não é do contexto é descartado. O contexto só tem dívidas
            # do tenant, então isto também é a barreira de isolamento.
            if tipo == "divida_resumo" and divida_id not in ids_validos:
                continue

            aporte = item.get("aporteExtraMensal")
            cards.append(
                PedidoDeCard(
                    tipo=tipo,
                    divida_id=divida_id if tipo == "divida_resumo" else None,
                    aporte_extra_mensal=aporte if isinstance(aporte, int) and aporte >= 0 else None,
                )
            )

        if not cards and NUMERO_SUSPEITO.search(texto):
            # Guardrail 7.1: número no texto sem card que o sustente. O texto
            # inteiro cai, porque não dá para saber qual parte dele é o palpite.
            return RespostaAssistente(
                content=(
                    "Prefiro não responder isso de cabeça para não te passar um número errado. "
                    "Toque na dívida na aba Dívidas para ver os valores exatos."
                ),
                cards=[],
            )

        if not texto:
            raise ErroDeAssistente("A resposta voltou vazia. Tente perguntar de novo.")

        return RespostaAssistente(content=texto, cards=cards)
