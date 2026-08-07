import logging

from correio.base import Correio, Mensagem

"""
Correio que não envia nada.

Existe para a suíte — o `conftest.py` já declara que NENHUM TESTE TOCA A REDE, e
essa regra vale para e-mail também. Também serve para desenvolvimento local sem
provedor: o código de recuperação fica alcançável pela caixa, e ninguém precisa
de conta de SMTP para exercitar o fluxo.

A caixa é de MÓDULO, não de instância: a rota constrói o correio a cada chamada,
e uma lista por instância não sobreviveria à requisição que o teste quer
inspecionar.
"""

CAIXA: list[Mensagem] = []

logger = logging.getLogger("buddy.correio")


class CorreioMemoria(Correio):
    def enviar(self, mensagem: Mensagem) -> None:
        CAIXA.append(mensagem)

        # IMPRIME no log do servidor, além de guardar na lista.
        #
        # Sem isto o provedor de memória só serve para a suíte, que lê a CAIXA
        # de dentro do processo — quem roda o servidor local não tem como
        # alcançar o código, e o fluxo de recuperação fica inexercitável sem
        # conta de SMTP.
        #
        # NÃO é exceção ao guardrail 5. O que sai aqui é o código de seis
        # dígitos e o destinatário, nunca dado financeiro — a mensagem já nasce
        # sem ele, por decisão da própria camada. E este provedor é escolha
        # explícita por `BUDDY_CORREIO=memoria`: o padrão é `smtp`, e um
        # servidor de produção que caia aqui está mal configurado de um jeito
        # muito maior que o log.
        logger.warning(
            "[correio de memória] nada foi enviado. Para %s: %s",
            mensagem.para,
            mensagem.corpo.replace("\n", " "),
        )


def limpar() -> None:
    CAIXA.clear()
