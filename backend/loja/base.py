from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, runtime_checkable

"""
Camada de loja de aplicativos.

Este pacote é a ÚNICA parte do backend que fala com a App Store e com o Google
Play. Quem confere uma compra — hoje só `routers/assinatura.py` — usa `Loja` e
não sabe o que está do outro lado.

Mesmo desenho da camada de LLM (ADR 0007) e do correio, e pelos mesmos dois
motivos: a suíte precisa exercitar o caminho inteiro sem tocar a rede, e trocar
de loja não pode significar editar a rota que grava a assinatura.

POR QUE VALIDAÇÃO NO SERVIDOR, E NÃO NO APP: o cliente é a parte que o usuário
controla. Um app modificado que diga "comprei" é trivial de construir, e a única
resposta possível é não perguntar a ele. O recibo vem do aparelho porque é lá
que a loja o entrega, mas quem decide se ele vale é a loja, consultada daqui.

O QUE NÃO PASSA POR AQUI: dado financeiro do usuário. A loja recebe um recibo e
um identificador de transação, nunca renda, dívida, saldo ou credor
(guardrail 5). Ela não precisa, e o que não é enviado não vaza.
"""


@dataclass(frozen=True)
class Compra:
    """
    O que a loja afirma sobre uma assinatura, normalizado entre as duas.

    `transacao_original_id` é a CHAVE ESTÁVEL: ele não muda quando a assinatura
    renova, e é por isso que ele — e não o id da transação da vez — identifica a
    assinatura no nosso banco. Renovação mensal produz transação nova todo mês;
    gravar por ela criaria uma assinatura nova a cada cobrança.

    `expira_em` é sempre em UTC e é sempre absoluto. Nunca guardamos "faltam N
    dias": o relógio do aparelho é do usuário, e quem tem o relógio tem a
    assinatura.

    `cancelada_em` preenchido NÃO significa acesso encerrado. Cancelar desliga a
    renovação; o período já pago continua valendo até `expira_em`, e cobrar de
    novo alguém que já pagou até o dia 30 é o tipo de erro que vira avaliação de
    uma estrela.
    """

    transacao_original_id: str
    produto_id: str
    expira_em: datetime
    ambiente: str
    renovacao_automatica: bool

    # O QUE MANDAR PARA `conferir` NA PRÓXIMA VEZ.
    #
    # Existe porque as duas lojas não perguntam pela mesma coisa, e descobrir
    # isso tarde custaria uma migration: a Apple consulta por
    # `originalTransactionId`, o Google por `purchaseToken` — e o `orderId` do
    # Google, que é o análogo do id da Apple, NÃO serve para consultar nada.
    # Sem este campo, a reconferência funcionaria no iPhone e falharia no
    # Android, que é o pior tipo de defeito: o que só existe em metade dos
    # aparelhos.
    #
    # É o adaptador que decide o valor, porque é ele quem sabe o que vai precisar.
    chave_consulta: str = ""

    cancelada_em: datetime | None = None


class ErroDeLoja(Exception):
    """
    Falha de conferência que o USUÁRIO precisa entender.

    A mensagem chega à tela: pt-BR, para leigo, sem detalhe de SDK nem código de
    status da Apple. Toda exceção de rede ou de parsing é convertida para cá
    dentro do adaptador.

    ATENÇÃO AO TOM: quem vê esta mensagem acabou de ser cobrado. "Recibo
    inválido" soa como acusação de fraude para quem pagou de verdade e caiu numa
    instabilidade da loja. A frase diz o que houve e o que fazer.
    """


@runtime_checkable
class Loja(Protocol):
    def conferir(self, recibo: str) -> Compra: ...
