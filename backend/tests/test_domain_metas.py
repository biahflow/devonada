from domain.metas import MetaPendente, aporte_sugerido, meses_ate, status

"""
A aritmética das metas nomeadas.

O que estes testes protegem não é a divisão — é a AUSÊNCIA. `domain/metas.py` não
tem fonte legal e diz isso no cabeçalho: ele só divide números que o usuário
informou. A linha que não pode ser cruzada é produzir sugestão ou status a partir
de dado que a pessoa não deu, e é isso que a maior parte dos testes daqui verifica.
"""


def uma_meta(**kwargs) -> MetaPendente:
    base = dict(valor_alvo=1_340_000, saldo=536_000, data_alvo="2027-08", aporte_mensal=67_000)
    base.update(kwargs)
    return MetaPendente(**base)  # type: ignore[arg-type]


class TestMesesAte:
    def test_conta_a_distancia_em_meses(self):
        assert meses_ate("2027-08", "2026-08") == 12
        assert meses_ate("2026-11", "2026-08") == 3

    # O PISO DE 1 EXISTE PARA DUAS COISAS: não dividir por zero, e não transformar
    # prazo vencido em aporte infinito. Quem passou da data vê o que falta, que é
    # a verdade da situação.
    def test_prazo_no_mes_atual_ou_no_passado_vira_um_mes(self):
        assert meses_ate("2026-08", "2026-08") == 1
        assert meses_ate("2025-01", "2026-08") == 1


class TestAporteSugerido:
    def test_divide_o_que_falta_pelos_meses_que_faltam(self):
        # Faltam R$ 8.040,00 em 12 meses = R$ 670,00/mês.
        assert aporte_sugerido(uma_meta(), "2026-08") == 67_000

    # ESTE É O TESTE MAIS IMPORTANTE DO MÓDULO. Sem prazo não existe divisor, e
    # inventar um ("dois anos, vai") produziria um número que a pessoa levaria a
    # sério — exatamente o que a ADR 0008 proíbe no resto do produto.
    def test_sem_prazo_nao_produz_numero(self):
        assert aporte_sugerido(uma_meta(data_alvo=None), "2026-08") is None

    def test_meta_atingida_devolve_zero_e_nunca_negativo(self):
        assert aporte_sugerido(uma_meta(saldo=1_340_000), "2026-08") == 0
        assert aporte_sugerido(uma_meta(saldo=2_000_000), "2026-08") == 0

    # Arredonda para CIMA, como aporte_de_provisao: o centavo a menos, vezes os
    # meses, faz a meta não fechar na data — e fechar na data é tudo que ela faz.
    def test_arredonda_para_cima(self):
        m = uma_meta(valor_alvo=1000, saldo=0, data_alvo="2026-11")  # 1000 / 3
        assert aporte_sugerido(m, "2026-08") == 334


class TestStatus:
    def test_aporte_que_cobre_a_sugestao_e_em_dia(self):
        assert status(uma_meta(aporte_mensal=67_000), "2026-08") == "em_dia"
        assert status(uma_meta(aporte_mensal=100_000), "2026-08") == "em_dia"

    def test_aporte_abaixo_da_sugestao_e_aporte_baixo(self):
        assert status(uma_meta(aporte_mensal=30_000), "2026-08") == "aporte_baixo"

    def test_saldo_no_alvo_e_atingida_mesmo_sem_prazo_e_sem_aporte(self):
        m = uma_meta(saldo=1_340_000, data_alvo=None, aporte_mensal=None)
        assert status(m, "2026-08") == "atingida"

    # AS DUAS AUSÊNCIAS DEVOLVEM None PELO MESMO MOTIVO DE FUNDO: o app não tem
    # base para dizer que a pessoa está atrasada, então não diz. Um `aporte_baixo`
    # aqui seria opinião disfarçada de cálculo — e apareceria como pill âmbar numa
    # tela cuja postura é anti-ansiedade.
    def test_sem_prazo_nao_ha_status(self):
        assert status(uma_meta(data_alvo=None), "2026-08") is None

    def test_sem_aporte_declarado_nao_ha_status(self):
        assert status(uma_meta(aporte_mensal=None), "2026-08") is None
