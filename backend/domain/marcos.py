"""
Quais marcos um gatilho atinge — a função pura por trás do evento.

FONTE: nenhuma lei, e isto é declarado, não esquecido. É ESCOLHA DE MÉTODO, e
ela já estava escrita antes deste módulo: os cinco pontos da rota que disparam
celebração — primeira negociação fechada, primeira dívida quitada e os quartos
da rota em 25%, 50% e 75% — vêm da ADR 0019 (item 3), de `docs/domain.md`
(verbete `marco`) e de `docs/api-contract.md`, seção 3.13. Nada aqui foi
escolhido na hora de escrever o código.

NÃO É COEFICIENTE DE ALOCAÇÃO, e a distinção é o que mantém a ADR 0009 de pé:
nenhum valor em dinheiro sai deste módulo. Os três limiares marcam CELEBRAÇÃO —
o marco celebra e libera o acumulado, e nunca altera o valor de respiro que o
usuário declarou (ADR 0019, item 3; guardrail 4.1, "marco celebra; marco não
avalia"). Uma tabela de escala de respiro por marco seria o coeficiente sem
fonte com outro nome, e ela não existe.

EVENTO, NUNCA PREDICADO. Este módulo responde "o que ACABOU de ser atingido", e
quem chama grava. Ele não é — e não pode virar — a fonte de `GET /v1/marcos`: a
porcentagem da rota anda para trás quando o usuário cadastra uma dívida nova, e
um marco derivado do estado atual se desfaria. A pessoa perderia uma conquista
por ter sido honesta sobre a própria situação, que é o oposto exato do que este
produto faz.
"""

from typing import Literal

TipoDeMarco = Literal[
    "primeira_negociacao",
    "primeira_quitacao",
    "rota_25",
    "rota_50",
    "rota_75",
]

# Ordem de exibição, e a mesma em que `GET /v1/marcos` devolve os cinco.
TIPOS: tuple[TipoDeMarco, ...] = (
    "primeira_negociacao",
    "primeira_quitacao",
    "rota_25",
    "rota_50",
    "rota_75",
)

# Em BASIS POINTS, como todo percentual deste backend (2500 = 25,00%).
LIMIARES_DA_ROTA: tuple[tuple[int, TipoDeMarco], ...] = (
    (2500, "rota_25"),
    (5000, "rota_50"),
    (7500, "rota_75"),
)


def marcos_atingidos(
    *,
    houve_renegociacao: bool = False,
    houve_quitacao: bool = False,
    rota_percorrida_bps: int | None = None,
) -> tuple[TipoDeMarco, ...]:
    """
    Os tipos que o gatilho informado atinge, na ordem de `TIPOS`.

    ARGUMENTOS NOMEADOS E COM PADRÃO porque cada chamador conhece um gatilho só:
    a rota vem do resumo, o acordo vem da renegociação, a quitação vem dos dois
    pontos em que ela é detectada hoje. Uma porta só, e cada um informa o que
    de fato aconteceu — em vez de cinco funções que precisariam ser lembradas
    uma a uma quando um tipo novo aparecer.

    `rota_percorrida_bps` AUSENTE NÃO CRUZA LIMIAR NENHUM, e ausência não é
    zero. Quem ainda não tem mês anterior de histórico não percorreu 0% da rota:
    ele acabou de chegar (`domain/resumo.rota_percorrida_bps`). Tratar `None`
    como zero não geraria marco falso hoje, mas trocaria "não sei" por "sei que
    é zero" exatamente no ponto em que a decisão é tomada.

    O LIMIAR É INCLUSIVO: 2500 bps já é 25% da rota percorrida.

    TODOS OS LIMIARES CRUZADOS SAEM JUNTOS, e não só o maior. Quem quita metade
    da dívida de uma vez passou por 25% e por 50% no mesmo instante, e o único
    jeito de não engolir o primeiro é devolver os dois. Registrar duas vezes o
    mesmo tipo é problema de quem grava, e é lá que a idempotência mora.
    """
    atingidos: set[TipoDeMarco] = set()

    if houve_renegociacao:
        atingidos.add("primeira_negociacao")
    if houve_quitacao:
        atingidos.add("primeira_quitacao")
    if rota_percorrida_bps is not None:
        atingidos.update(
            tipo for limiar, tipo in LIMIARES_DA_ROTA if rota_percorrida_bps >= limiar
        )

    return tuple(tipo for tipo in TIPOS if tipo in atingidos)
