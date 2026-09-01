from dataclasses import dataclass

from juridico.fontes import obter

"""
"Como calculamos" — a trilha de auditoria de cada número derivado.

O BACKEND SEMPRE TEVE A FONTE, em docstring: `domain/minimo_existencial.py` cita
o Decreto 11.150 e conta que a redação mudou; `domain/prescricao.py` cita o
Código Civil e diz que o resultado é sinal, não sentença; `domain/caixa.py` diz
qual conta produz `naoFecha`. Nada disso saía do repositório. O usuário via o
número e tinha de acreditar — que é exatamente a postura que este produto recusa
em todo o resto.

A TRILHA NÃO CARREGA OS VALORES, e essa é a decisão que evita o defeito óbvio:
se ela repetisse os números que a resposta já traz ao lado, existiriam duas
cópias do mesmo dado, e um dia elas divergiriam — a tela mostraria uma sobra na
cascata e outra na explicação da cascata. Ela carrega a FÓRMULA em palavras, os
PASSOS em ordem, as FONTES por id e — o que mais importa num produto que
prometeu não inventar — as LIMITAÇÕES: o que aquela conta não faz.

`limitacoes` não é rodapé de cortesia. É onde mora o que o app sabe que não
sabe: que o mínimo existencial não escala por dependente, que a prescrição
depende de interrupção que ninguém aqui conhece, que achado sem valor não entra
na subtração. Sem esse campo, "como calculamos" viraria propaganda da conta.

TEXTO CURADO, nunca gerado — mesmo regime de `domain/script.py`. Cada frase
daqui é lida por alguém que está prestes a levar o número para uma negociação
real.
"""


@dataclass(frozen=True)
class Trilha:
    """
    A explicação de UM número derivado.

    `chave` é o nome do campo que ela explica, exatamente como ele aparece na
    resposta (`capacidadeHoje`, `valorJusto`). É por ela que a tela liga o
    disclosure ao número certo, em vez de por posição na lista.
    """

    chave: str
    titulo: str
    formula: str
    passos: tuple[str, ...]
    fontes: tuple[str, ...]
    limitacoes: tuple[str, ...]


def _conferida(trilha: Trilha) -> Trilha:
    """
    Falha no import se uma trilha citar id que não existe.

    É a mesma disciplina de `FonteDesconhecida`: id inválido é erro nosso, e
    descobri-lo quando o processo sobe é infinitamente melhor que descobri-lo
    na tela de quem abriu o disclosure.
    """
    for id_da_fonte in trilha.fontes:
        obter(id_da_fonte)
    return trilha


CAPACIDADE = _conferida(
    Trilha(
        chave="capacidadeHoje",
        titulo="Como chegamos na sua sobra por mês",
        formula=(
            "renda típica − impostos e reservas − mínimo existencial − respiro − gastos "
            "essenciais − gastos não essenciais"
        ),
        passos=(
            "Partimos da sua renda típica, não da do melhor mês.",
            "Tiramos o que você reserva de imposto em cada fonte, quando declarou a alíquota.",
            "Tiramos o mínimo existencial: o piso que a lei protege de qualquer plano de "
            "pagamento.",
            "Tiramos o respiro que você mesmo declarou, se declarou.",
            "Tiramos os gastos essenciais e depois os não essenciais.",
            "O que sobra é a sobra por mês — e é ela, não a renda, que cabe num acordo.",
        ),
        fontes=("decreto-11150-3", "cdc-6-xi"),
        limitacoes=(
            "O mínimo existencial da lei é um valor único e NÃO cresce por dependente. "
            "Guardamos quantos dependentes você tem, mas inventar um multiplicador seria "
            "criar regra sem fonte.",
            "Os gastos são os que você informou. O que não foi informado não entra — e por "
            "isso a sobra pode parecer maior do que é.",
            "O piso vem de configuração datada. A data ao lado dele diz a idade do número.",
        ),
    )
)

NAO_FECHA = _conferida(
    Trilha(
        chave="naoFecha",
        titulo="Por que dissemos que os números não fecham",
        formula="soma das parcelas mínimas > renda típica − impostos − mínimo existencial",
        passos=(
            "Somamos as parcelas mínimas de todas as suas dívidas ativas.",
            "Comparamos com o máximo que sobraria cortando TODO gasto não essencial.",
            "Quando a soma é maior, os números não fecham — é uma subtração, não um "
            "diagnóstico.",
        ),
        fontes=(
            "cdc-104a",
            "cdc-104a-1",
            "cdc-104c",
            "cdc-54a-1",
            "cdc-54a-3",
            "decreto-11150-3",
            "decreto-11150-4",
        ),
        limitacoes=(
            # A PALAVRA PROIBIDA NÃO ENTRA NEM NEGADA. O teste de copy
            # (`test_caixa_api.py::test_o_campo_nunca_se_chama_superendividado`)
            # varre o payload inteiro, e ele está certo: negar um diagnóstico
            # ainda o planta na cabeça de quem lê, e a frase seguinte já diz o
            # que precisa ser dito sem nomeá-lo. O nome do instituto jurídico
            # existe UMA vez, na ementa da norma em `GET /v1/juridico/fontes`,
            # que descreve a lei — não o usuário.
            "Isto é uma subtração, não um diagnóstico. A lei trata o caso de quem não "
            "consegue pagar tudo sem comprometer o mínimo existencial, e exige boa-fé e "
            "dívida de consumo para reconhecê-lo — nenhuma das duas é apurável por um "
            "aplicativo. Quem apura é a conciliação, com você presente.",
            "A repactuação de que a lei fala não alcança dívida com garantia real, "
            "financiamento imobiliário nem crédito rural — e o piso protegido também não "
            "considera essas, nem o consignado.",
            "O caminho também não alcança dívida contraída com fraude ou má-fé, nem compra de "
            "luxo de alto valor. Quem verifica isso é a conciliação.",
            "A conta usa os números que você informou. Renda ou gasto desatualizado muda o "
            "resultado.",
        ),
    )
)

VALOR_JUSTO = _conferida(
    Trilha(
        chave="valorJusto",
        titulo="Como chegamos no valor justo",
        formula="valor cobrado − soma dos achados que têm valor",
        passos=(
            "Lemos o contrato e separamos os pontos que valem contestar.",
            "Cada ponto só entra se tiver o trecho do documento que o sustenta.",
            "Somamos apenas os achados cujo valor está DIRETO no contrato.",
            "Subtraímos essa soma do valor cobrado.",
        ),
        fontes=("cdc-52-1", "cdc-52-ii", "cdc-39-i", "stj-sumula-566", "stj-tema-972"),
        limitacoes=(
            "Não é uma estimativa de quanto a dívida deveria custar: não existe lei que diga "
            "isso, e nós não inventamos o número.",
            "Achado que exigiria recalcular o contrato inteiro aparece na tela e NÃO entra na "
            "subtração — arbitrar esse valor seria estimar disfarçado de apurar.",
            "Achado é convite a investigar, nunca uma sentença sobre a cobrança. Quem julga "
            "isso é o Judiciário, e nós não julgamos nada.",
        ),
    )
)

PRESCRICAO = _conferida(
    Trilha(
        chave="possivelPrescricao",
        titulo="Por que marcamos que pode ter prescrito",
        formula="hoje − data de origem > cinco anos",
        passos=(
            "Contamos cinco anos completos a partir da data em que a dívida começou.",
            "Passou disso, marcamos como algo a investigar.",
        ),
        fontes=("cc-206-5-i",),
        limitacoes=(
            "É sinal para investigar, NUNCA afirmação de que prescreveu. A contagem "
            "reinicia se houve reconhecimento da dívida, acordo ou cobrança judicial — e "
            "nada disso o aplicativo sabe.",
            "A conta parte da data de origem que você informou. Data errada, sinal errado.",
        ),
    )
)


TRILHAS: dict[str, Trilha] = {
    t.chave: t for t in (CAPACIDADE, NAO_FECHA, VALOR_JUSTO, PRESCRICAO)
}
