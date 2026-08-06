import re
from datetime import date

from assistente.base import (
    ContextoDoUsuario,
    ErroDeAssistente,
    PedidoDeCard,
    PropostaDeDivida,
    RespostaAssistente,
)
from assistente.regras import CRITICIDADES, SCHEMA_RESPOSTA, SYSTEM, montar_contexto
from llm import BlocoTexto, ClienteLLM, ErroDeLLM

# Sequência de dígitos com dois ou mais algarismos, ou dígito seguido de % ou
# de "reais". Um "um passo de cada vez" não é número; "R$ 1.500" é.
NUMERO_SUSPEITO = re.compile(r"\d[\d.,]*\s*(%|reais)|\d{2,}", re.IGNORECASE)

TETO_HISTORICO = 10
TETO_CREDOR = 200
TETO_PARCELAS = 480

# Só estes dois SUSTENTAM um número no texto livre — ver a varredura no fim de
# `responder`. O critério não é "carrega número do banco", é "vai existir na
# tela com certeza".
#
# `valor_justo` carrega número do banco e mesmo assim fica de fora: a rota só o
# emite quando há achado COM valor, então pedi-lo não garante que ele apareça.
# Contá-lo aqui abriria a porta para um número no texto cujo card foi
# descartado depois — que é exatamente o modo de falha do guardrail 7.1.
CARDS_COM_PROCEDENCIA = ("divida_resumo", "plano_sugerido")
TIPOS_VALIDOS = (*CARDS_COM_PROCEDENCIA, "divida_proposta", "valor_justo")

# Cards que exigem id de uma dívida do contexto. Como o contexto só tem dívidas
# do tenant, esta é também a barreira de isolamento.
EXIGEM_DIVIDA_DO_CONTEXTO = ("divida_resumo", "valor_justo")

ISO_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _inteiro_positivo(valor: object, teto: int | None = None) -> int | None:
    """Zero cai junto com o inválido: 0 é uma afirmação, ausência é outra."""
    if not isinstance(valor, int) or isinstance(valor, bool) or valor <= 0:
        return None
    if teto is not None and valor > teto:
        return None
    return valor


def _data_iso(valor: object) -> str | None:
    if not isinstance(valor, str) or not ISO_DATA.match(valor):
        return None
    try:
        date.fromisoformat(valor)
    except ValueError:
        return None  # 2026-02-31 casa o formato e não existe no calendário.
    return valor


def _texto(valor: object, teto: int) -> str | None:
    if not isinstance(valor, str):
        return None
    # Colapsa espaço e caractere de controle: o credor vai para um campo de
    # formulário, não para uma tela que interpreta o que recebe.
    limpo = " ".join(valor.split())[:teto]
    return limpo or None


def _proposta(bruto: object) -> PropostaDeDivida | None:
    """
    Saneia o rascunho campo a campo.

    Resposta de modelo é ENTRADA NÃO CONFIÁVEL (guardrail 7.3), mesmo quando o
    schema promete o tipo. Campo inválido cai sozinho — derrubar o card
    inteiro por causa de uma data torta perderia o credor e o valor que estão
    certos, e a pessoa digitaria tudo de novo. Rascunho que sobra vazio não
    vira card: não ofereceria nada além do botão que já existe na aba Dívidas.
    """
    if not isinstance(bruto, dict):
        return None

    tipo = bruto.get("tipo")
    proposta = PropostaDeDivida(
        credor=_texto(bruto.get("credor"), TETO_CREDOR),
        valor_cobrado=_inteiro_positivo(bruto.get("valorCobrado")),
        data_origem=_data_iso(bruto.get("dataOrigem")),
        tipo=tipo if tipo in CRITICIDADES else None,
        taxa_juros_mensal=_inteiro_positivo(bruto.get("taxaJurosMensal")),
        total_parcelas=_inteiro_positivo(bruto.get("totalParcelas"), TETO_PARCELAS),
        primeiro_vencimento=_data_iso(bruto.get("primeiroVencimento")),
    )
    return None if proposta.vazia() else proposta


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
            if tipo not in TIPOS_VALIDOS:
                continue

            divida_id = item.get("dividaId")
            # Id que não é do contexto é descartado. O contexto só tem dívidas
            # do tenant, então isto também é a barreira de isolamento.
            if tipo in EXIGEM_DIVIDA_DO_CONTEXTO and divida_id not in ids_validos:
                continue
            # Em `divida_proposta` o id é opcional — sem ele, é cadastro novo.
            # Mas id que veio e não confere derruba o CARD, não só o id:
            # transformar "altere a dívida X" em "cadastre outra" em silêncio
            # seria pior que não propor nada.
            if tipo == "divida_proposta" and divida_id is not None and divida_id not in ids_validos:
                continue

            proposta = _proposta(item.get("proposta")) if tipo == "divida_proposta" else None
            if tipo == "divida_proposta" and proposta is None:
                continue

            aporte = item.get("aporteExtraMensal")
            cards.append(
                PedidoDeCard(
                    tipo=tipo,
                    divida_id=(
                        divida_id
                        if tipo in (*EXIGEM_DIVIDA_DO_CONTEXTO, "divida_proposta")
                        else None
                    ),
                    aporte_extra_mensal=aporte if isinstance(aporte, int) and aporte >= 0 else None,
                    proposta=proposta,
                )
            )

        if not any(c.tipo in CARDS_COM_PROCEDENCIA for c in cards) and NUMERO_SUSPEITO.search(texto):
            # Guardrail 7.1: número no texto sem card que o sustente. O texto
            # inteiro cai, porque não dá para saber qual parte dele é o palpite.
            #
            # Card de rascunho NÃO conta como sustentação: os valores dele são
            # a fala da própria pessoa, não um dado lido do banco. Ele
            # sobrevive à queda do texto, porém — perder o rascunho faria ela
            # digitar de novo o que acabou de dizer.
            rascunhos = [c for c in cards if c.tipo == "divida_proposta"]
            return RespostaAssistente(
                content=(
                    "Prefiro não repetir números de cabeça para não te passar um valor errado. "
                    "Confira no formulário o que eu entendi — nada é salvo até você confirmar."
                    if rascunhos
                    else "Prefiro não responder isso de cabeça para não te passar um número errado. "
                    "Toque na dívida na aba Dívidas para ver os valores exatos."
                ),
                cards=rascunhos,
            )

        if not texto:
            raise ErroDeAssistente("A resposta voltou vazia. Tente perguntar de novo.")

        return RespostaAssistente(content=texto, cards=cards)
