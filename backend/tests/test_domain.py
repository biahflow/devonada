from datetime import date
from decimal import Decimal

from domain.correcao import meses_decorridos, valor_corrigido
from domain.dinheiro import aplicar_percentual, decimal_para_bps, decimal_para_centavos
from domain.minimo_existencial import margem_disponivel, minimo_existencial
from domain.prescricao import possivel_prescricao
from domain.resumo import (
    ParcelaEstimada,
    comprometimento_mensal,
    comprometimento_renda_bps,
    custo_medio_juros_mensal,
)


class TestDinheiro:
    def test_arredonda_meio_para_cima(self):
        assert decimal_para_centavos(Decimal("1.005")) == 101
        assert decimal_para_centavos(Decimal("1.004")) == 100

    def test_percentual_em_centavos_inteiros(self):
        # 25% de R$ 1.518,00
        assert aplicar_percentual(151800, 2500) == 37950

    def test_bps_ida_e_volta(self):
        assert decimal_para_bps(Decimal("0.025")) == 250

    def test_nao_usa_ponto_flutuante(self):
        # O caso que float erraria: 0.1 + 0.2.
        assert decimal_para_centavos(Decimal("0.1") + Decimal("0.2")) == 30


class TestPrescricao:
    def test_menos_de_cinco_anos_nao_prescreve(self):
        assert possivel_prescricao(date(2022, 1, 10), hoje=date(2026, 1, 10)) is False

    def test_exatamente_cinco_anos_ainda_nao_prescreveu(self):
        # A virada é DEPOIS do quinto aniversário, não nele.
        assert possivel_prescricao(date(2021, 1, 10), hoje=date(2026, 1, 10)) is False

    def test_um_dia_depois_de_cinco_anos_prescreve(self):
        assert possivel_prescricao(date(2021, 1, 10), hoje=date(2026, 1, 11)) is True

    def test_dividia_antiga_prescreve(self):
        assert possivel_prescricao(date(2015, 6, 1), hoje=date(2026, 8, 6)) is True

    def test_29_de_fevereiro_nao_quebra(self):
        # 2024 é bissexto; 2029 não é.
        assert possivel_prescricao(date(2024, 2, 29), hoje=date(2029, 3, 1)) is True


class TestCorrecao:
    def test_sem_taxa_devolve_none_nunca_zero(self):
        # A regra que substitui o `valorCobrado * 1.1` inventado.
        assert valor_corrigido(150000, None, date(2021, 6, 1)) is None

    def test_taxa_zero_tambem_devolve_none(self):
        assert valor_corrigido(150000, 0, date(2021, 6, 1)) is None

    def test_mesmo_mes_devolve_o_valor_original(self):
        assert valor_corrigido(150000, 250, date(2026, 8, 1), hoje=date(2026, 8, 6)) == 150000

    def test_juros_compostos_de_um_mes(self):
        # R$ 1.000,00 a 2% a.m. por 1 mês = R$ 1.020,00
        assert valor_corrigido(100000, 200, date(2026, 7, 6), hoje=date(2026, 8, 6)) == 102000

    def test_juros_compostos_de_doze_meses(self):
        # R$ 1.000,00 a 1% a.m. por 12 meses ≈ R$ 1.126,83
        assert valor_corrigido(100000, 100, date(2025, 8, 6), hoje=date(2026, 8, 6)) == 112683

    def test_meses_decorridos_nunca_negativo(self):
        assert meses_decorridos(date(2026, 12, 1), hoje=date(2026, 8, 6)) == 0

    def test_meses_decorridos_conta_dia_do_mes(self):
        # Dia 20 para dia 6 do mês seguinte ainda não fechou um mês.
        assert meses_decorridos(date(2026, 7, 20), hoje=date(2026, 8, 6)) == 0
        assert meses_decorridos(date(2026, 7, 5), hoje=date(2026, 8, 6)) == 1


class TestMinimoExistencial:
    def test_valor_fixo_de_seiscentos_reais(self):
        # Decreto 11.150/2022, art. 3º, na redação do Decreto 11.567/2023.
        # NÃO é 25% do salário mínimo — essa redação foi substituída.
        assert minimo_existencial(60000) == 60000

    def test_sem_configuracao_devolve_none(self):
        # Piso chutado é pior que piso nenhum: ele vira número na tela.
        assert minimo_existencial(0) is None

    def test_margem_pode_ser_negativa(self):
        # Endividado além da renda: o número negativo É a informação.
        assert margem_disponivel(300000, 60000, 400000) == -160000


class TestCustoMedioJuros:
    def test_pondera_pelo_saldo_e_nao_pela_contagem(self):
        itens = [
            ParcelaEstimada(5000, None, 1500, 5000),  # R$ 50 a 15%
            ParcelaEstimada(5000000, None, 200, 5000000),  # R$ 50.000 a 2%
        ]
        # Média aritmética daria 850 bps (8,50%) — um retrato falso do custo.
        # Ponderada pelo saldo dá 201 bps, dominada pela dívida que pesa.
        assert custo_medio_juros_mensal(itens) == 201

    def test_ignora_divida_sem_taxa_em_vez_de_tratar_como_zero(self):
        itens = [
            ParcelaEstimada(100000, None, 300, 100000),
            ParcelaEstimada(100000, None, None, 100000),
        ]
        assert custo_medio_juros_mensal(itens) == 300

    def test_sem_nenhuma_taxa_devolve_none(self):
        assert custo_medio_juros_mensal([ParcelaEstimada(1000, None, None, 1000)]) is None

    def test_lista_vazia(self):
        assert custo_medio_juros_mensal([]) is None


class TestComprometimento:
    def test_estima_parcela_pelo_total_de_parcelas(self):
        itens = [ParcelaEstimada(120000, 12, None, 120000)]
        assert comprometimento_mensal(itens) == 10000

    def test_ignora_divida_sem_total_de_parcelas(self):
        # Chutar prazo produziria um comprometimento inventado.
        itens = [ParcelaEstimada(120000, None, None, 120000)]
        assert comprometimento_mensal(itens) == 0

    def test_proporcao_da_renda_em_bps(self):
        assert comprometimento_renda_bps(110000, 550000) == 2000  # 20%

    def test_sem_renda_devolve_none(self):
        assert comprometimento_renda_bps(110000, 0) is None
