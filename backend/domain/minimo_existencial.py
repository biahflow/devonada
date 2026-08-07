"""
Mínimo existencial.

FONTE: Decreto 11.150/2022, art. 3º, **com a redação dada pelo Decreto 11.567,
de 19 de junho de 2023**: considera-se mínimo existencial a renda mensal do
consumidor pessoa natural equivalente a **R$ 600,00 (seiscentos reais)**.

HISTÓRICO, porque a diferença é dinheiro real: a redação ORIGINAL do art. 3º
dizia "vinte e cinco por cento do salário mínimo vigente na data de publicação
deste Decreto", e era isso que este módulo calculava — 25% de R$ 1.518,00 =
R$ 379,50. O Decreto 11.567/2023 trocou o percentual por um valor fixo de
R$ 600,00 e REVOGOU o § 2º (que dizia que o reajuste do salário mínimo não
atualizaria o valor). Usar a redação antiga produzia um piso R$ 220,50 mais
baixo que o da lei — ou seja, o produto aceitava plano de pagamento que invade
a proteção que o decreto garante.

O valor NÃO é derivado do salário mínimo e não deve voltar a ser. Ele vem de
config datada (`minimo_existencial_centavos` + `minimo_existencial_vigente_em`),
como os tetos do consignado: quem opera o servidor é responsável por mantê-lo, e
a data viaja para a tela para o usuário ver a idade do número.

Art. 3º, § 3º: compete ao Conselho Monetário Nacional atualizar o valor.

SOB QUESTIONAMENTO: o decreto tem ADPFs pendentes no STF (1005, 1006 e 1097),
inclusive sobre a exclusão do crédito consignado da aferição. O produto aplica
o texto vigente e não toma partido — se a decisão mudar o número, muda a config.

LIMITAÇÃO DECLARADA: o decreto não escala o mínimo existencial por número de
dependentes. Coletamos `dependentes` no perfil e o guardamos, mas ele não entra
nesta conta — inventar um multiplicador por dependente seria criar regra sem
fonte e apresentá-la ao usuário como se fosse lei.
"""


def minimo_existencial(valor_configurado_centavos: int) -> int | None:
    """
    O piso legal, em centavos. `None` quando não configurado.

    Devolver `None` em vez de um default silencioso é deliberado: um piso
    chutado é pior que piso nenhum, porque vira número na tela do usuário. Sem
    configuração, quem consome exibe "ainda não calculado".
    """
    return valor_configurado_centavos if valor_configurado_centavos > 0 else None


def margem_disponivel(
    renda_mensal: int, minimo: int, comprometido_mensal: int
) -> int:
    """
    O que sobra por mês depois do mínimo existencial e do que já está
    comprometido com dívida. Pode ser negativo — e nesse caso o número negativo
    é a informação, não um erro a esconder.

    FONTE do método: Decreto 11.150/2022, art. 3º, § 1º — a apuração é feita
    "considerando a base mensal, por meio da contraposição entre a renda total
    mensal do consumidor e as parcelas das suas dívidas vencidas e a vencer no
    mesmo mês".

    LIMITAÇÃO DECLARADA: o art. 4º do mesmo decreto EXCLUI da aferição várias
    parcelas — financiamento imobiliário, crédito com garantia real, crédito com
    fiança ou aval, crédito rural, financiamento de atividade produtiva, dívida
    já renegociada na forma do CDC, tributos e condomínio, **crédito consignado
    regido por lei específica** e operações de antecipação/desconto/cessão.
    Nenhuma dessas exclusões está implementada aqui: o app só conhece a
    modalidade da dívida quando o contrato foi lido, e aplicar a exclusão sem
    saber a modalidade erraria para os dois lados. Enquanto isso, esta margem é
    **mais conservadora** que a do decreto — ela desconta parcelas que a lei
    mandaria ignorar, e errar para o lado de propor menos é o lado certo de
    errar.
    """
    return renda_mensal - minimo - comprometido_mensal
