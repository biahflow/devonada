from dataclasses import dataclass

"""
O que o TIPO da fonte de renda muda no domínio (M12, ADR 0021).

POR QUE ESTE MÓDULO EXISTE: `fonte_renda.tipo` é coluna desde o M7, validada em
seis valores, gravada e devolvida pelo CRUD — e
`grep -rn "pj_hora\\|autonomo" backend/domain/` voltava vazio. O usuário
escolhia o tipo, o banco guardava, e o plano tratava CLT e autônomo igual. Aqui
o tipo passa a ter efeito.

NENHUM COEFICIENTE FINANCEIRO NASCE AQUI. Este módulo não multiplica renda, não
estima alíquota, não projeta 13º nem vacância — os quatro estão proibidos pelo
`Out of Scope` do contrato de F-011 e pela ADR 0009. Ele descreve COMO cada tipo
se comporta: a renda oscila? separa imposto? compromete percentual do que entra?
tem evento previsível? tem dia de pagamento próprio? Essas são decisões de
produto declaradas — não regras de lei e não valores derivados. Onde há lei — 13º
e férias existem por lei —, a FONTE entra no docstring da função que a cita; o
VALOR de tudo, sem exceção, continua sendo dado do usuário.
"""


@dataclass(frozen=True)
class ComportamentoRenda:
    """
    Como um tipo de fonte se comporta na cascata e na tela.

    São BOOLEANOS DE COMPORTAMENTO e RÓTULOS, nunca coeficientes: nada aqui
    multiplica dinheiro. O que estes campos decidem é o que o app pergunta e o
    que ele reserva — e é o que faz o tipo deixar de ser rótulo inerte.
    """

    tipo: str
    # A renda oscila mês a mês? É o que separa quem tem "salário fixo no dia 5"
    # de quem tem mês fraco — e metade deste público não tem o primeiro.
    variavel: bool
    # Esta renda chega BRUTA e precisa reservar imposto à parte? `pj_hora` é a
    # única em que o modelo espera taxa × horas no bruto com uma alíquota
    # separada; nas demais o usuário declara o valor já líquido. Sem alíquota
    # numa fonte que reserva imposto, NADA é reservado e a tela diz isso, em vez
    # de exibir R$ 0,00 como se fosse reserva (ADR 0009, `domain.md:148`).
    reserva_imposto: bool
    # Compromete PERCENTUAL do que entra, em vez de um valor fixo que o mês fraco
    # derruba? É o caminho do compromisso percentual para a renda variável.
    usa_compromisso_percentual: bool
    # Recebimentos extras previsíveis — 13º e férias — fazem sentido para este
    # tipo? Eles NÃO entram na cascata nem na janela do `min()` (ADR 0021,
    # decisão 2): o app só reconhece que existem e quando caem.
    tem_eventos_previsiveis: bool
    # Tem data de pagamento própria que importa para a tela — a que não é o dia 5
    # de ninguém?
    usa_dia_pagamento: bool
    # Comportamento genérico, sem especialização por tipo — e a tela DIZ que é
    # genérico, em vez de fingir um fluxo dedicado que não existe.
    generico: bool
    # O nome do mês de queda característico deste tipo, ou `None` quando a renda
    # não tem queda característica. É RÓTULO, não número: nomeia o modo de falha
    # que a tela reconhece (a vacância do aluguel, o mês sem trabalho do
    # autônomo), e nenhuma taxa é estimada a partir dele.
    queda_caracteristica: str | None


def clt() -> ComportamentoRenda:
    """
    Vínculo CLT: líquido mensal fixo, mais os eventos previsíveis do calendário.

    FONTE dos eventos previsíveis: o 13º salário é a Lei nº 4.090/1962; as férias
    com o terço constitucional são a CF, art. 7º, XVII, e a CLT, arts. 129 e 130.
    O app reconhece que eles EXISTEM e quando caem; o VALOR continua vindo do que
    o usuário declara, e eles não entram na cascata nem na janela do `min()`
    (ADR 0021, decisão 2). Projetar o 13º a partir da renda exigiria vínculo,
    avos e proporção, e sairia na tela como direito líquido da pessoa — o que a
    ADR 0009 proíbe.

    Não há imposto a reservar aqui: o líquido mensal é declarado direto pelo
    usuário, e o que ele informa já é o que cai na conta.
    """
    return ComportamentoRenda(
        tipo="clt",
        variavel=False,
        reserva_imposto=False,
        usa_compromisso_percentual=False,
        tem_eventos_previsiveis=True,
        usa_dia_pagamento=False,
        generico=False,
        queda_caracteristica=None,
    )


def pj_hora() -> ComportamentoRenda:
    """
    PJ por hora: taxa × horas, menos o imposto que o usuário informou.

    DADO DO USUÁRIO, NÃO REGRA: taxa, horas e alíquota são todos declarados.
    O app não estima alíquota de enquadramento — ela varia por anexo e faixa de
    receita (ADR 0009) —, e por isso, SEM alíquota informada (na fonte ou no
    `Perfil`), nada é reservado e a tela diz que não está reservando, em vez de
    exibir R$ 0,00 como se fosse reserva (`domain.md:148`).

    Renda que oscila com as horas trabalhadas: o mês fraco é a regra, não a
    exceção, e é o público que o compromisso percentual protege.
    """
    return ComportamentoRenda(
        tipo="pj_hora",
        variavel=True,
        reserva_imposto=True,
        usa_compromisso_percentual=True,
        tem_eventos_previsiveis=False,
        usa_dia_pagamento=False,
        generico=False,
        queda_caracteristica="mes_de_poucas_horas",
    )


def autonomo() -> ComportamentoRenda:
    """
    Autônomo: trabalha com a renda típica e compromete PERCENTUAL do que entra.

    DADO DO USUÁRIO, NÃO REGRA: o percentual é declarado, nunca sugerido — não há
    faixa de fábrica (ADR 0009, ADR 0019). Comprometer um valor fixo quebraria no
    mês fraco, que para quem é autônomo é parte do ano; percentual do que entra é
    o que sobrevive a ele.
    """
    return ComportamentoRenda(
        tipo="autonomo",
        variavel=True,
        reserva_imposto=False,
        usa_compromisso_percentual=True,
        tem_eventos_previsiveis=False,
        usa_dia_pagamento=False,
        generico=False,
        queda_caracteristica="mes_sem_trabalho",
    )


def beneficio() -> ComportamentoRenda:
    """
    Benefício: valor fixo com data de pagamento própria — que não é o dia 5.

    DADO DO USUÁRIO, NÃO REGRA: o valor e o dia de pagamento são declarados.
    Projetar reajuste está FORA DE ESCOPO (contrato de F-011): o índice varia por
    ano e por espécie, e projetá-lo seria inventar regra financeira. O usuário
    atualiza o valor quando ele muda.
    """
    return ComportamentoRenda(
        tipo="beneficio",
        variavel=False,
        reserva_imposto=False,
        usa_compromisso_percentual=False,
        tem_eventos_previsiveis=False,
        usa_dia_pagamento=True,
        generico=False,
        queda_caracteristica=None,
    )


def aluguel() -> ComportamentoRenda:
    """
    Aluguel: renda variável cuja queda característica é a vacância.

    DADO DO USUÁRIO, NÃO REGRA: a vacância é um recebimento zero como qualquer
    outro — não se estima taxa de vacância (contrato de F-011, ADR 0009). O mês
    vago derruba a renda típica daquela fonte, exatamente como o mês sem trabalho
    do autônomo, e a apuração por fonte impede que ele contamine as outras.
    """
    return ComportamentoRenda(
        tipo="aluguel",
        variavel=True,
        reserva_imposto=False,
        usa_compromisso_percentual=True,
        tem_eventos_previsiveis=False,
        usa_dia_pagamento=False,
        generico=False,
        queda_caracteristica="vacancia",
    )


def outro() -> ComportamentoRenda:
    """
    Genérico: o comportamento de hoje, e a tela DIZ que é genérico.

    DADO DO USUÁRIO, NÃO REGRA: não há especialização, coeficiente nem valor
    inventado — o valor é declarado, como em qualquer fonte. É a saída honesta
    para a renda que não se encaixa nos cinco tipos acima; um fluxo genérico
    declarado é melhor que forçar a pessoa num molde que não é o dela.
    """
    return ComportamentoRenda(
        tipo="outro",
        variavel=False,
        reserva_imposto=False,
        usa_compromisso_percentual=False,
        tem_eventos_previsiveis=False,
        usa_dia_pagamento=False,
        generico=True,
        queda_caracteristica=None,
    )


_POR_TIPO = {
    "clt": clt,
    "pj_hora": pj_hora,
    "autonomo": autonomo,
    "beneficio": beneficio,
    "aluguel": aluguel,
    "outro": outro,
}


def comportamento(tipo: str) -> ComportamentoRenda:
    """
    O comportamento de um tipo, ou o genérico para um valor desconhecido.

    Desconhecido cai em `outro` de propósito: um tipo novo que entre no banco sem
    passar por aqui degrada para o genérico em vez de derrubar a leitura da
    cascata — o mesmo espírito do `preenchimento`, que nunca explode.
    """
    return _POR_TIPO.get(tipo, outro)()
