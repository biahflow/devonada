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
    custo_diario_juros,
    custo_medio_juros_mensal,
    dividas_sem_taxa,
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


class TestCustoDiarioJuros:
    def test_divide_os_juros_do_mes_pelo_mes_comercial(self):
        # R$ 1.000,00 a 3% a.m. = R$ 30,00 de juros no mês; ÷ 30 = R$ 1,00 ao dia.
        assert custo_diario_juros([ParcelaEstimada(100000, None, 300, 100000)]) == 100

    def test_soma_as_ativas_com_taxa(self):
        itens = [
            ParcelaEstimada(100000, None, 300, 100000),  # R$ 1,00/dia
            ParcelaEstimada(200000, None, 150, 200000),  # R$ 1,00/dia
        ]
        assert custo_diario_juros(itens) == 200

    def test_ignora_divida_sem_taxa_em_vez_de_tratar_como_zero(self):
        # Tratar a sem taxa como 0% afirmaria que ela não cresce. Ela sai da
        # conta e é CONTADA em `dividas_sem_taxa`, que viaja no mesmo payload.
        itens = [
            ParcelaEstimada(100000, None, 300, 100000),
            ParcelaEstimada(9000000, None, None, 9000000),
        ]
        assert custo_diario_juros(itens) == 100
        assert dividas_sem_taxa(itens) == 1

    def test_sem_nenhuma_taxa_devolve_none(self):
        # None é "não há taxa para calcular". Zero aqui seria a afirmação falsa
        # de que a dívida não cresce — o mesmo erro do `valorCobrado * 1.1`,
        # invertido de sinal.
        assert custo_diario_juros([ParcelaEstimada(1000000, None, None, 1000000)]) is None

    def test_lista_vazia(self):
        assert custo_diario_juros([]) is None

    def test_taxa_zero_informada_devolve_zero_e_nao_none(self):
        # Taxa 0% INFORMADA é dado, não ausência: a dívida de fato não cresce.
        assert custo_diario_juros([ParcelaEstimada(100000, None, 0, 100000)]) == 0

    def test_arredonda_meio_para_cima_como_o_resto_do_dominio(self):
        # R$ 15,00 a 1% a.m. = R$ 0,15 no mês; ÷ 30 = meio centavo ao dia.
        assert custo_diario_juros([ParcelaEstimada(1500, None, 100, 1500)]) == 1

    def test_arredonda_a_soma_e_nao_divida_a_divida(self):
        # Cada uma cresce 0,4 centavo ao dia. Arredondar antes de somar daria
        # zero três vezes e apagaria 1,2 centavo — o erro que se acumula quando
        # a carteira é grande.
        itens = [ParcelaEstimada(1200, None, 100, 1200) for _ in range(3)]
        assert custo_diario_juros(itens) == 1


class TestDividasSemTaxa:
    def test_conta_as_sem_taxa(self):
        itens = [
            ParcelaEstimada(100000, None, 300, 100000),
            ParcelaEstimada(100000, None, None, 100000),
            ParcelaEstimada(100000, None, None, 100000),
        ]
        assert dividas_sem_taxa(itens) == 2

    def test_todas_com_taxa_devolve_zero(self):
        # Zero é o que autoriza a tela a dizer o número como TOTAL, e não como
        # piso. Se esta contagem mentir, a frase do card mente junto.
        assert dividas_sem_taxa([ParcelaEstimada(100000, None, 300, 100000)]) == 0

    def test_taxa_zero_nao_conta_como_sem_taxa(self):
        assert dividas_sem_taxa([ParcelaEstimada(100000, None, 0, 100000)]) == 0

    def test_lista_vazia(self):
        assert dividas_sem_taxa([]) == 0


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


class TestComportamentoDeRenda:
    """
    O tipo da fonte passa a mudar o domínio (M12, ADR 0021). Um teste por tipo,
    e o teste falha se o tipo voltar a ser rótulo inerte (T2-AC1) — é o critério
    que dá nome à feature.
    """

    def test_clt_tem_evento_previsivel_e_nao_reserva_imposto(self):
        from domain.renda import clt

        c = clt()
        # O líquido é declarado; 13º e férias existem e não entram na cascata.
        assert c.tem_eventos_previsiveis is True
        assert c.reserva_imposto is False
        assert c.variavel is False

    def test_pj_hora_reserva_imposto_e_e_variavel(self):
        from domain.renda import pj_hora

        c = pj_hora()
        assert c.reserva_imposto is True
        assert c.variavel is True
        assert c.usa_compromisso_percentual is True

    def test_autonomo_compromete_percentual_e_a_queda_e_o_mes_sem_trabalho(self):
        from domain.renda import autonomo

        c = autonomo()
        assert c.usa_compromisso_percentual is True
        assert c.tem_eventos_previsiveis is False
        assert c.queda_caracteristica == "mes_sem_trabalho"

    def test_beneficio_tem_dia_de_pagamento_proprio(self):
        from domain.renda import beneficio

        c = beneficio()
        assert c.usa_dia_pagamento is True
        assert c.variavel is False
        assert c.reserva_imposto is False

    def test_aluguel_e_variavel_e_a_queda_e_a_vacancia(self):
        from domain.renda import aluguel

        c = aluguel()
        assert c.variavel is True
        assert c.queda_caracteristica == "vacancia"

    def test_outro_e_generico(self):
        from domain.renda import outro

        c = outro()
        assert c.generico is True

    def test_os_seis_tipos_produzem_comportamentos_distintos(self):
        # Distintos por COMPORTAMENTO, não só pelo rótulo `tipo`: se dois tipos
        # tivessem a mesma assinatura de comportamento, um deles seria inerte.
        from domain.renda import aluguel, autonomo, beneficio, clt, outro, pj_hora

        def sem_rotulo(c):
            return (
                c.variavel,
                c.reserva_imposto,
                c.usa_compromisso_percentual,
                c.tem_eventos_previsiveis,
                c.usa_dia_pagamento,
                c.generico,
                c.queda_caracteristica,
            )

        todos = [clt(), pj_hora(), autonomo(), beneficio(), aluguel(), outro()]
        assert len({sem_rotulo(c) for c in todos}) == 6

    def test_dispatch_por_tipo_com_fallback_generico(self):
        from domain.renda import comportamento, pj_hora

        assert comportamento("pj_hora") == pj_hora()
        # Tipo desconhecido degrada para o genérico em vez de explodir.
        assert comportamento("um_tipo_que_nao_existe").generico is True

    def test_toda_funcao_de_tipo_declara_fonte_ou_dado_do_usuario(self):
        # T2-AC5: regra sem FONTE nem declaração de "dado do usuário" não existe.
        import domain.renda as renda_mod

        for nome in ("clt", "pj_hora", "autonomo", "beneficio", "aluguel", "outro"):
            doc = (getattr(renda_mod, nome).__doc__ or "").upper()
            assert "FONTE" in doc or "DADO DO USUÁRIO" in doc, nome
