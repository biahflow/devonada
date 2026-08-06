from datetime import date, timedelta

import pytest

from domain.parcelas import gerar_cronograma, situacao_da_parcela, somar_meses

HOJE = date.today()


class TestSomarMeses:
    def test_avanca_preservando_o_dia(self):
        assert somar_meses(date(2026, 1, 10), 1) == date(2026, 2, 10)

    def test_dia_31_em_mes_de_30_cai_no_ultimo_dia(self):
        # Não pode pular para 1º de maio.
        assert somar_meses(date(2026, 3, 31), 1) == date(2026, 4, 30)

    def test_dia_31_em_fevereiro_nao_bissexto(self):
        assert somar_meses(date(2026, 1, 31), 1) == date(2026, 2, 28)

    def test_dia_31_em_fevereiro_bissexto(self):
        assert somar_meses(date(2024, 1, 31), 1) == date(2024, 2, 29)

    def test_atravessa_a_virada_de_ano(self):
        assert somar_meses(date(2026, 11, 15), 3) == date(2027, 2, 15)

    def test_zero_meses_devolve_a_propria_data(self):
        assert somar_meses(date(2026, 5, 20), 0) == date(2026, 5, 20)


class TestGerarCronograma:
    def test_divisao_exata(self):
        p = gerar_cronograma(120000, 12, date(2026, 9, 10))
        assert len(p) == 12
        assert all(x.valor == 10000 for x in p)

    def test_soma_bate_exatamente_quando_nao_divide(self):
        # R$ 1.500,00 em 7 — o caso que produz centavo fantasma se cada parcela
        # for arredondada isoladamente.
        p = gerar_cronograma(150000, 7, date(2026, 9, 10))
        assert sum(x.valor for x in p) == 150000

    def test_sobra_vai_na_ultima_parcela(self):
        p = gerar_cronograma(150000, 7, date(2026, 9, 10))
        assert [x.valor for x in p[:6]] == [21428] * 6
        assert p[-1].valor == 21432

    @pytest.mark.parametrize(
        "valor,n", [(100, 3), (1, 1), (999999, 13), (150000, 7), (100000, 6), (7, 7)]
    )
    def test_soma_sempre_bate(self, valor, n):
        assert sum(x.valor for x in gerar_cronograma(valor, n, date(2026, 9, 10))) == valor

    def test_numeracao_comeca_em_um(self):
        p = gerar_cronograma(120000, 3, date(2026, 9, 10))
        assert [x.numero for x in p] == [1, 2, 3]
        assert all(x.total == 3 for x in p)

    def test_vencimentos_mensais_a_partir_do_primeiro(self):
        p = gerar_cronograma(120000, 3, date(2026, 9, 10))
        assert [x.vencimento for x in p] == [
            date(2026, 9, 10),
            date(2026, 10, 10),
            date(2026, 11, 10),
        ]

    def test_primeiro_vencimento_dia_31(self):
        p = gerar_cronograma(120000, 3, date(2026, 1, 31))
        assert [x.vencimento for x in p] == [
            date(2026, 1, 31),
            date(2026, 2, 28),
            date(2026, 3, 31),
        ]

    def test_parcela_unica(self):
        p = gerar_cronograma(150000, 1, date(2026, 9, 10))
        assert len(p) == 1 and p[0].valor == 150000

    def test_zero_parcelas_e_erro(self):
        with pytest.raises(ValueError):
            gerar_cronograma(150000, 0, date(2026, 9, 10))

    def test_acima_do_teto_e_erro(self):
        with pytest.raises(ValueError):
            gerar_cronograma(150000, 481, date(2026, 9, 10))


class TestSituacaoDaParcela:
    def test_vencimento_futuro_e_pendente(self):
        assert situacao_da_parcela(HOJE + timedelta(days=5), None, HOJE) == "pendente"

    def test_vence_hoje_ainda_e_pendente(self):
        assert situacao_da_parcela(HOJE, None, HOJE) == "pendente"

    def test_vencimento_passado_e_atrasada(self):
        assert situacao_da_parcela(HOJE - timedelta(days=1), None, HOJE) == "atrasada"

    def test_paga_nunca_vira_atrasada(self):
        # Quem quitou já resolveu; insistir no alarme seria castigo.
        assert (
            situacao_da_parcela(HOJE - timedelta(days=90), HOJE - timedelta(days=80), HOJE)
            == "paga"
        )

    def test_paga_no_futuro_tambem_e_paga(self):
        assert situacao_da_parcela(HOJE + timedelta(days=10), HOJE, HOJE) == "paga"
