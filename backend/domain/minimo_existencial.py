from domain.dinheiro import aplicar_percentual

"""
Mínimo existencial.

FONTE: Decreto 11.150/2022, art. 3º — o mínimo existencial corresponde a 25%
do salário mínimo vigente. Ambos os números (salário e percentual) vêm de
variável de ambiente, porque mudam por lei e não podem ficar cravados no
código.

LIMITAÇÃO DECLARADA: o decreto NÃO escala o mínimo existencial por número de
dependentes. Coletamos `dependentes` no perfil e o guardamos, mas ele não entra
nesta fórmula — inventar um multiplicador por dependente seria criar uma regra
de negócio sem fonte e apresentá-la ao usuário como se fosse lei. Quando houver
uma regra definida, ela entra aqui, citada.
"""


def minimo_existencial(salario_minimo_centavos: int, percentual_bps: int) -> int:
    """25% do salário mínimo, em centavos inteiros."""
    return aplicar_percentual(salario_minimo_centavos, percentual_bps)


def margem_disponivel(
    renda_mensal: int, minimo: int, comprometido_mensal: int
) -> int:
    """
    O que sobra por mês depois do mínimo existencial e do que já está
    comprometido com dívida. Pode ser negativo — e nesse caso o número negativo
    é a informação, não um erro a esconder.
    """
    return renda_mensal - minimo - comprometido_mensal
