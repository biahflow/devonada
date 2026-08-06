import pytest

from domain.simulacao import (
    TETO_MESES,
    DividaSimulavel,
    economia_vs_minimo,
    ordenar,
    simular,
)

MES = "2026-08"


def divida(
    id_: str,
    saldo: int,
    taxa: int | None = None,
    minima: int = 0,
    credor: str | None = None,
) -> DividaSimulavel:
    return DividaSimulavel(
        divida_id=id_,
        credor=credor or f"Credor {id_}",
        saldo=saldo,
        taxa_mensal_bps=taxa,
        parcela_minima=minima,
    )


class TestOrdenar:
    def test_avalanche_ataca_a_maior_taxa(self):
        fila = ordenar(
            [divida("a", 100000, 200), divida("b", 50000, 1500), divida("c", 900000, 800)],
            "avalanche",
        )
        assert [d.divida_id for d in fila] == ["b", "c", "a"]

    def test_bola_de_neve_ataca_o_menor_saldo(self):
        fila = ordenar(
            [divida("a", 100000, 200), divida("b", 50000, 1500), divida("c", 900000, 800)],
            "bola_de_neve",
        )
        assert [d.divida_id for d in fila] == ["b", "a", "c"]

    def test_sem_taxa_vai_para_o_fim_da_avalanche(self):
        # Taxa desconhecida não justifica prioridade: colocá-la na frente faria
        # o app sugerir atacar uma dívida sem nenhuma evidência de que ela é a
        # mais cara.
        fila = ordenar([divida("sem", 100000, None), divida("com", 100000, 100)], "avalanche")
        assert [d.divida_id for d in fila] == ["com", "sem"]

    def test_empate_de_taxa_resolve_pelo_menor_saldo(self):
        fila = ordenar([divida("grande", 500000, 300), divida("pequena", 10000, 300)], "avalanche")
        assert [d.divida_id for d in fila] == ["pequena", "grande"]

    def test_estrategia_desconhecida_estoura(self):
        with pytest.raises(ValueError):
            ordenar([divida("a", 1000)], "aleatoria")


class TestSimular:
    def test_sem_juros_o_prazo_e_a_divisao_do_saldo_pelo_orcamento(self):
        r = simular([divida("a", 120000, None, minima=10000)], 0, "avalanche", MES)
        assert r is not None
        assert r.meses_ate_quitacao == 12
        assert r.total_juros_pagos == 0
        assert r.total_pago == 120000

    def test_data_liberdade_e_o_mes_da_ultima_parcela(self):
        r = simular([divida("a", 30000, None, minima=10000)], 0, "avalanche", "2026-11")
        assert r is not None
        # Novembro, dezembro, janeiro — a virada de ano tem de andar certo.
        assert r.data_liberdade == "2027-01"

    def test_aporte_extra_encurta_o_prazo(self):
        sem = simular([divida("a", 120000, None, minima=10000)], 0, "avalanche", MES)
        com = simular([divida("a", 120000, None, minima=10000)], 10000, "avalanche", MES)
        assert sem is not None and com is not None
        assert com.meses_ate_quitacao == 6
        assert com.meses_ate_quitacao < sem.meses_ate_quitacao

    def test_juros_compostos_incidem_antes_do_pagamento(self):
        # R$ 1.000,00 a 10% a.m., pagando R$ 1.100,00: o mês cobra R$ 100,00 de
        # juros e o pagamento zera. Se os juros incidissem depois, o total pago
        # seria R$ 1.000,00 — e o usuário levaria esse número ao credor.
        r = simular([divida("a", 100000, 1000, minima=110000)], 0, "avalanche", MES)
        assert r is not None
        assert r.meses_ate_quitacao == 1
        assert r.total_juros_pagos == 10000
        assert r.total_pago == 110000

    def test_total_pago_fecha_com_principal_mais_juros(self):
        dividas = [divida("a", 250000, 350, minima=30000), divida("b", 80000, 900, minima=15000)]
        r = simular(dividas, 20000, "avalanche", MES)
        assert r is not None
        assert r.total_pago == 250000 + 80000 + r.total_juros_pagos

    def test_divida_sem_taxa_nao_acumula_juros(self):
        r = simular([divida("a", 100000, None, minima=5000)], 0, "avalanche", MES)
        assert r is not None
        assert r.total_juros_pagos == 0
        assert r.total_pago == 100000

    def test_minimo_liberado_rola_para_a_proxima(self):
        # Duas dívidas sem juros, R$ 100,00 de mínimo cada. A primeira quita em
        # 2 meses; a partir daí a segunda recebe R$ 200,00 por mês. Sem rolagem
        # seriam 10 meses; com rolagem, 6.
        r = simular(
            [divida("curta", 20000, None, minima=10000), divida("longa", 100000, None, minima=10000)],
            0,
            "bola_de_neve",
            MES,
        )
        assert r is not None
        assert r.meses_ate_quitacao == 6

    def test_ordem_de_pagamento_registra_posicao_e_mes(self):
        r = simular(
            [divida("curta", 20000, None, minima=10000), divida("longa", 100000, None, minima=10000)],
            0,
            "bola_de_neve",
            MES,
        )
        assert r is not None
        assert [(q.divida_id, q.posicao) for q in r.ordem_pagamento] == [("curta", 1), ("longa", 2)]
        # No primeiro mês o orçamento inteiro (R$ 200,00) passa pela fila e já
        # zera a curta — a sobra não espera o mês seguinte.
        assert r.ordem_pagamento[0].quitada_em == "2026-08"
        assert r.ordem_pagamento[1].quitada_em == "2027-01"

    def test_evolucao_tem_um_ponto_por_mes_e_termina_em_zero(self):
        r = simular([divida("a", 60000, None, minima=10000)], 0, "avalanche", MES)
        assert r is not None
        assert len(r.evolucao_saldo) == r.meses_ate_quitacao
        assert r.evolucao_saldo[0].mes == MES
        assert r.evolucao_saldo[-1].saldo == 0

    def test_avalanche_paga_menos_juros_que_bola_de_neve(self):
        # A garantia matemática que sustenta a copy da tela. Não elege vencedora
        # para o usuário — só confirma que o número que ele vê é o certo.
        dividas = [
            divida("cara_e_grande", 300000, 1200, minima=20000),
            divida("barata_e_pequena", 50000, 150, minima=10000),
        ]
        a = simular(dividas, 30000, "avalanche", MES)
        b = simular(dividas, 30000, "bola_de_neve", MES)
        assert a is not None and b is not None
        assert a.total_juros_pagos < b.total_juros_pagos

    def test_plano_que_nao_quita_devolve_none(self):
        # Pagamento menor que os juros do mês: o saldo cresce para sempre. Um
        # prazo devolvido aqui seria ficção.
        assert simular([divida("a", 1000000, 1000, minima=1000)], 0, "avalanche", MES) is None

    def test_lista_vazia_quita_em_zero_mes(self):
        r = simular([], 50000, "avalanche", MES)
        assert r is not None
        assert r.meses_ate_quitacao == 0
        assert r.data_liberdade == MES

    def test_teto_de_meses_e_o_limite_do_laco(self):
        # Amortiza, mas devagar demais para caber no teto.
        assert simular([divida("a", 100000000, None, minima=1000)], 0, "avalanche", MES) is None
        assert TETO_MESES == 600


class TestEconomiaVsMinimo:
    def test_diferenca_de_juros_entre_o_plano_e_o_minimo(self):
        dividas = [divida("a", 200000, 500, minima=20000)]
        so_minimo = simular(dividas, 0, "avalanche", MES)
        com_aporte = simular(dividas, 30000, "avalanche", MES)
        assert so_minimo is not None and com_aporte is not None

        economia = economia_vs_minimo(dividas, 30000, "avalanche", MES)
        assert economia == so_minimo.total_juros_pagos - com_aporte.total_juros_pagos
        assert economia > 0

    def test_none_quando_o_cenario_minimo_nao_quita(self):
        # Sem aporte a dívida nunca fecha; com aporte, fecha. Não há economia a
        # afirmar — o app exibe "ainda não calculado".
        dividas = [divida("a", 100000, 1000, minima=1000)]
        assert simular(dividas, 0, "avalanche", MES) is None
        assert simular(dividas, 200000, "avalanche", MES) is not None
        assert economia_vs_minimo(dividas, 200000, "avalanche", MES) is None
