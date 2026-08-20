"""
Script de negociação por canal — blocos tipados, não string.

Substitui `routers/revisao.py::montar_script` (a rota deixa de ter a própria
cópia da função em T2). Módulo PURO: sem sessão de banco, sem I/O e —
principalmente — SEM LLM. O guardrail 3 (`docs/guardrails.md`, seção 3) diz
que fundamento legal e a copy de negociação são curados no backend; um
modelo poderia improvisar uma citação ou uma promessa que ninguém revisou, e
é exatamente essa frase que o usuário levaria a um credor de verdade. Cada
texto aqui é fixo, revisado por humano (gate de pré-lançamento do roadmap),
nunca gerado.

O verbete `canal` de `docs/domain.md:316-336` é a especificação literal desta
tarefa. Duas regras de segurança valem — no texto do próprio verbete —
SOMENTE para os canais ESCRITOS (`chat`, `email`), não para `telefone`: é
nos canais escritos que o golpe de falsa negociação (WhatsApp, e-mail
forjado) acontece; uma ligação é para um número que o próprio usuário
discou.

  - `_ALERTA_VALIDACAO_CANAL` abre todo script escrito.
  - `_REGRA_PAGAMENTO` fecha todo script escrito.

`telefone` não leva essas duas constantes como blocos: é conversa em tempo
real, guia de fala — não mensagem para copiar e colar linha a linha.

Posicionamento da oferta — ADR 0021, item 5 — é a segunda especificação
literal, e o motivo é de negociação, não de estilo: quem diz primeiro
quanto pode pagar entrega a âncora da conversa.

  - `telefone` — a oferta entra no fluxo normal, antes do fechamento: não
    existe segunda mensagem numa ligação, então não há "depois" para
    guardá-la.
  - `chat` — a oferta vira bloco separado (`momento="oferta"`), marcado para
    uso DEPOIS que o credor propuser algo — nunca na abertura.
  - `email` — o primeiro e-mail não leva oferta; o texto do segundo (com a
    oferta) fica pronto ao lado, como bloco `momento="oferta"` distinto.

Script mínimo de segurança: sem achado nenhum, `montar_script` NUNCA
devolve `None` — era o comportamento de `routers/revisao.py:134-135`, que
esta tarefa substitui. Sem achado, o alerta e a regra de pagamento (nos
canais escritos) continuam presentes: é o alvo preferencial do golpe — quem
cadastrou a dívida sem contrato — quem mais precisa deles (ADR 0021,
consequência 3).

Nenhuma afirmação de ilegalidade ou direito entra aqui (guardrail 3):
"vale contestar", nunca "é ilegal" ou "você tem direito a receber de
volta".
"""

from dataclasses import dataclass
from typing import Literal

from domain.dinheiro import formatar_brl
from domain.revisao import Achado

Canal = Literal["telefone", "chat", "email"]
Momento = Literal["abertura", "argumento", "oferta", "fechamento"]

# Os dois canais em que o texto é literalmente copiado e colado numa
# mensagem — é ali que as duas regras de segurança do verbete `canal` se
# aplicam, e é ali que cada bloco precisa de botão de copiar próprio.
_CANAIS_ESCRITOS: tuple[Canal, ...] = ("chat", "email")


@dataclass(frozen=True)
class BlocoScript:
    """
    Um pedaço do script, tipado por `momento`.

    `copiavel` existe porque, nos canais escritos, cada bloco tem botão de
    copiar PRÓPRIO (guardrail 1.2) — a tela nunca oferece um texto único que
    alguém precisaria fatiar à mão para mandar em mensagens separadas. No
    canal `telefone` o script é guia de fala, não mensagem a copiar, e todo
    bloco sai `copiavel=False`.
    """

    id: str
    titulo: str | None
    texto: str
    momento: Momento
    copiavel: bool


# Fonte: docs/domain.md:316-336, verbete `canal`. "Golpe de falsa negociação
# por WhatsApp é epidêmico, e o alvo preferencial é exatamente quem está
# endividado." Abre todo script ESCRITO — chat e email, nunca telefone.
_ALERTA_VALIDACAO_CANAL = (
    "Confira o número ou o e-mail do credor no site oficial dele antes de "
    "continuar. Nunca negocie com um contato que entrou em contato com "
    "você primeiro — golpe de falsa negociação é comum, e quem está "
    "endividado é o alvo preferencial."
)

# Fonte: docs/domain.md:316-336, verbete `canal`. Fecha todo script
# ESCRITO — chat e email, nunca telefone.
_REGRA_PAGAMENTO = (
    "Pagamento só por boleto ou Pix em nome do credor — confira o CNPJ. "
    "Nunca pague em CPF de pessoa física."
)

_SAUDACAO: dict[Canal, str] = {
    "telefone": "Bom dia. Sou cliente e gostaria de revisar meu contrato com {credor}.",
    "chat": "Olá, sou cliente e gostaria de revisar meu contrato com {credor}.",
    "email": (
        "Prezados, sou cliente e gostaria de rever alguns pontos do meu "
        "contrato com {credor}."
    ),
}

_PEDIDO_DEMONSTRATIVO = (
    "Peço o demonstrativo detalhado do débito e a revisão desses pontos. "
    "Fico no aguardo de um retorno."
)


def _bloco_argumento(achado: Achado, escrito: bool) -> BlocoScript:
    """Um parágrafo por achado — o mesmo texto e a mesma fonte em todo canal."""
    return BlocoScript(
        id=f"argumento-{achado.id}",
        titulo=achado.titulo,
        texto=f"{achado.explicacao} ({achado.fonte})",
        momento="argumento",
        copiavel=escrito,
    )


def _bloco_oferta(capacidade_mensal: int, canal: Canal) -> BlocoScript:
    """
    A frase da oferta — o MESMO valor nos três canais, só o texto ao redor
    muda (ADR 0021, item 5).
    """
    valor = formatar_brl(capacidade_mensal)
    if canal == "telefone":
        titulo = "Proposta"
        texto = (
            "Tenho interesse em quitar e consigo comprometer até "
            f"{valor} por mês com este acordo."
        )
    elif canal == "chat":
        titulo = "Depois que o credor responder"
        texto = (
            f"Consigo comprometer até {valor} por mês com este acordo. Só "
            "envie esta mensagem depois que o credor apresentar uma "
            "proposta — quem diz primeiro quanto pode pagar entrega a "
            "âncora da negociação."
        )
    else:  # email
        titulo = "Segundo e-mail — depois da resposta"
        texto = (
            f"Consigo comprometer até {valor} por mês com este acordo. "
            "Envie este texto só depois de receber a resposta ou "
            "contraproposta do credor ao primeiro e-mail."
        )
    return BlocoScript(
        id="oferta",
        titulo=titulo,
        texto=texto,
        momento="oferta",
        copiavel=(canal != "telefone"),
    )


def montar_script(
    canal: Canal,
    credor: str,
    achados: list[Achado],
    capacidade_mensal: int | None = None,
) -> tuple[BlocoScript, ...]:
    """
    A mensagem de negociação, montada por TEMPLATE — nunca por LLM (ver o
    docstring do módulo).

    Nos canais escritos (`chat`, `email`) o primeiro bloco é sempre o
    alerta de validação e o último é sempre a regra de pagamento — inclusive
    sem nenhum achado (script mínimo de segurança; `montar_script` nunca
    devolve `None`). `telefone` não leva essas duas constantes: são regras
    de mensagem escrita, e uma ligação não é uma.

    `capacidade_mensal` (herdado de `routers/revisao.py::_capacidade_para_
    oferta`, M7) só vira oferta quando CONHECIDA E POSITIVA — sem caixa
    preenchido ela não aparece, e capacidade negativa não vira oferta:
    prometer o que não se tem é pior que não propor valor nenhum.
    """
    escrito = canal in _CANAIS_ESCRITOS
    ha_oferta = capacidade_mensal is not None and capacidade_mensal > 0

    blocos: list[BlocoScript] = []

    if escrito:
        blocos.append(
            BlocoScript(
                id="alerta-validacao",
                titulo="Antes de negociar",
                texto=_ALERTA_VALIDACAO_CANAL,
                momento="abertura",
                copiavel=True,
            )
        )

    blocos.append(
        BlocoScript(
            id="saudacao",
            titulo=None,
            texto=_SAUDACAO[canal].format(credor=credor),
            momento="abertura",
            copiavel=escrito,
        )
    )

    for achado in achados:
        blocos.append(_bloco_argumento(achado, escrito))

    # telefone: a oferta entra no fluxo normal, antes do fechamento — não há
    # segunda mensagem numa ligação para guardá-la para depois.
    if ha_oferta and canal == "telefone":
        blocos.append(_bloco_oferta(capacidade_mensal, canal))  # type: ignore[arg-type]

    blocos.append(
        BlocoScript(
            id="pedido-demonstrativo",
            titulo=None,
            texto=_PEDIDO_DEMONSTRATIVO,
            momento="fechamento",
            copiavel=escrito,
        )
    )

    # chat/email: a oferta é bloco separado, marcado para uso posterior —
    # entra depois do corpo, mas ainda antes da regra de pagamento, que
    # continua fechando todo script escrito.
    if ha_oferta and canal != "telefone":
        blocos.append(_bloco_oferta(capacidade_mensal, canal))  # type: ignore[arg-type]

    if escrito:
        blocos.append(
            BlocoScript(
                id="regra-pagamento",
                titulo="Como pagar",
                texto=_REGRA_PAGAMENTO,
                momento="fechamento",
                copiavel=True,
            )
        )

    return tuple(blocos)
