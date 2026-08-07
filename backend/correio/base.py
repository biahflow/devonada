from dataclasses import dataclass
from typing import Protocol, runtime_checkable

"""
Camada de envio de e-mail.

Este pacote é a ÚNICA parte do backend que fala SMTP. Quem envia — hoje só a
recuperação de senha — usa `Correio` e não sabe o que está do outro lado.

Mesmo desenho da camada de LLM (ADR 0007), e pelo mesmo motivo: a suíte precisa
exercitar o caminho de envio sem tocar a rede, e trocar de provedor não pode
significar editar a rota que envia.

O QUE NÃO PASSA POR AQUI: dado financeiro. Um e-mail atravessa servidores que
não controlamos e fica guardado em caixas que não controlamos. Valor, saldo,
credor e nome de dívida não entram em mensagem nenhuma (guardrail 5) — o único
e-mail do produto leva um código de seis dígitos.
"""


@dataclass(frozen=True)
class Mensagem:
    para: str
    assunto: str
    corpo: str


class ErroDeCorreio(Exception):
    """
    Falha de envio que o USUÁRIO precisa entender.

    A mensagem chega à tela: pt-BR, para leigo, sem detalhe de servidor. Toda
    exceção de `smtplib` é convertida para cá dentro do adaptador.
    """


@runtime_checkable
class Correio(Protocol):
    def enviar(self, mensagem: Mensagem) -> None: ...
