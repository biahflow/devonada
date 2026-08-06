import unicodedata

from assistente.base import (
    ContextoDoUsuario,
    PedidoDeCard,
    RespostaAssistente,
)

"""
Assistente sem modelo nenhum.

Existe por dois motivos concretos, não como enfeite:

1. é ele que roda na suíte de testes, sem tocar a rede — o comportamento da
   rota fica provado sem depender de provedor, de chave ou de resposta não
   determinística;
2. é o fallback honesto quando não há chave configurada. Melhor um assistente
   que reconhece três intenções e admite o resto do que uma tela de erro.

LIMITAÇÃO DECLARADA: ele reconhece pouca coisa. É de propósito — cada intenção
aqui é código escrito à mão. Fora do que reconhece, ele DIZ QUE NÃO SABE e
aponta onde a informação está no app (guardrail 7.1: recusar é melhor que
estimar).

Ele também NÃO propõe cadastro (`divida_proposta`). Tirar "mil e quinhentos no
Nubank" de uma frase exigiria um interpretador de dinheiro escrito à mão, e
errar a leitura da fala da pessoa é pior que não propor: ela veria um valor que
não disse já dentro do formulário. Sem chave de LLM, o caminho continua sendo
a aba Dívidas.
"""

PALAVRAS_DE_PLANO = ("plano", "quitar", "simul", "estrategia", "avalanche", "bola de neve")
PALAVRAS_DE_RESUMO = ("quanto devo", "quanto eu devo", "minhas dividas", "resumo", "total")

NAO_SEI = (
    "Sobre isso eu ainda não sei responder. O que eu consigo hoje é te mostrar o retrato "
    "de uma dívida — é só me dizer o nome do credor — ou montar um plano de quitação."
)


def _normalizar(texto: str) -> str:
    """Sem acento e em minúsculas: "dívidas" e "dividas" são a mesma pergunta."""
    sem_acento = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in sem_acento if not unicodedata.combining(c))


class AssistenteDeterminista:
    def responder(
        self,
        mensagem: str,
        contexto: ContextoDoUsuario,
        historico: list[tuple[str, str]],
    ) -> RespostaAssistente:
        texto = _normalizar(mensagem)

        if not contexto.dividas:
            return RespostaAssistente(
                content=(
                    "Ainda não vejo nenhuma dívida cadastrada. Cadastre a primeira na aba "
                    "Dívidas — pode mandar o contrato, que eu leio para você conferir."
                )
            )

        # Credor citado pelo nome tem prioridade: é a pergunta mais específica.
        for divida in contexto.dividas:
            if _normalizar(divida.credor) in texto:
                return RespostaAssistente(
                    content=f"Aqui está o retrato da sua dívida com {divida.credor}.",
                    cards=[PedidoDeCard(tipo="divida_resumo", divida_id=divida.divida_id)],
                )

        if any(p in texto for p in PALAVRAS_DE_PLANO):
            return RespostaAssistente(
                content=(
                    "Montei um plano comparando as duas estratégias de quitação. "
                    "Nenhuma das duas é a certa para todo mundo — vale escolher a que você "
                    "consegue manter."
                ),
                cards=[PedidoDeCard(tipo="plano_sugerido")],
            )

        if any(p in texto for p in PALAVRAS_DE_RESUMO):
            return RespostaAssistente(
                content="Este é o retrato de cada uma das suas dívidas.",
                cards=[
                    PedidoDeCard(tipo="divida_resumo", divida_id=d.divida_id)
                    for d in contexto.dividas[:3]
                ],
            )

        return RespostaAssistente(content=NAO_SEI)
