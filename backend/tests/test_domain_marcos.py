from typing import get_args

import schemas
from domain.marcos import LIMIARES_DA_ROTA, TIPOS, marcos_atingidos


class TestTipos:
    def test_sao_cinco_e_nesta_ordem(self):
        # Os cinco estão nomeados no contrato (api-contract 3.13) e no verbete
        # `marco` de domain.md. Decidir um sexto não é decisão de código.
        assert TIPOS == (
            "primeira_negociacao",
            "primeira_quitacao",
            "rota_25",
            "rota_50",
            "rota_75",
        )

    def test_o_dominio_e_o_contrato_nomeiam_os_mesmos_tipos(self):
        # `schemas.TipoDeMarco` é espelho de `TIPOS`, no mesmo desenho de
        # `StatusMeta`. Sem esta guarda, um tipo novo entraria no domínio e
        # ficaria de fora da resposta da API sem nenhum gate reclamar.
        assert set(get_args(schemas.TipoDeMarco)) == set(TIPOS)

    def test_os_limiares_da_rota_sao_os_quartos_em_basis_points(self):
        assert LIMIARES_DA_ROTA == ((2500, "rota_25"), (5000, "rota_50"), (7500, "rota_75"))


class TestSemGatilho:
    def test_estado_vazio_nao_atinge_nada(self):
        assert marcos_atingidos() == ()

    def test_rota_ausente_nao_cruza_limiar_nenhum(self):
        # AUSÊNCIA NÃO É ZERO. Quem ainda não tem mês anterior de histórico não
        # percorreu 0% da rota — ele acabou de chegar, e `rotaPercorridaBps` vem
        # `None`. Tratar isso como zero trocaria "não sei" por "sei que é zero"
        # no ponto exato em que o evento é decidido.
        assert marcos_atingidos(rota_percorrida_bps=None) == ()

    def test_rota_em_zero_tambem_nao_atinge(self):
        assert marcos_atingidos(rota_percorrida_bps=0) == ()


class TestRota:
    def test_um_ponto_abaixo_do_limiar_nao_atinge(self):
        assert marcos_atingidos(rota_percorrida_bps=2499) == ()

    def test_o_limiar_e_inclusivo(self):
        # 2500 bps É 25% da rota, e 25% é o marco.
        assert marcos_atingidos(rota_percorrida_bps=2500) == ("rota_25",)

    def test_metade_da_rota_traz_os_dois_limiares_ja_cruzados(self):
        # Quem quita metade da dívida de uma vez passou por 25% e por 50% no
        # mesmo instante. Devolver só o maior engoliria a primeira conquista.
        assert marcos_atingidos(rota_percorrida_bps=5000) == ("rota_25", "rota_50")

    def test_tres_quartos_trazem_os_tres(self):
        assert marcos_atingidos(rota_percorrida_bps=7500) == ("rota_25", "rota_50", "rota_75")

    def test_rota_completa_traz_os_tres_e_nada_mais(self):
        # 100% da rota não inventa marco de quitação: quitar TODAS as dívidas é
        # outro evento, detectado onde ele acontece.
        assert marcos_atingidos(rota_percorrida_bps=10000) == ("rota_25", "rota_50", "rota_75")


class TestGatilhosDeEvento:
    def test_renegociacao_atinge_apenas_a_primeira_negociacao(self):
        assert marcos_atingidos(houve_renegociacao=True) == ("primeira_negociacao",)

    def test_quitacao_atinge_apenas_a_primeira_quitacao(self):
        assert marcos_atingidos(houve_quitacao=True) == ("primeira_quitacao",)

    def test_gatilhos_simultaneos_saem_na_ordem_de_tipos(self):
        assert marcos_atingidos(
            houve_renegociacao=True,
            houve_quitacao=True,
            rota_percorrida_bps=5000,
        ) == ("primeira_negociacao", "primeira_quitacao", "rota_25", "rota_50")


class TestPureza:
    def test_a_mesma_entrada_devolve_o_mesmo_resultado(self):
        # Função pura, sem sessão de banco e sem relógio: é o que permite que o
        # marco seja decidido aqui e GRAVADO lá, em vez de recalculado a cada
        # leitura.
        primeira = marcos_atingidos(houve_quitacao=True, rota_percorrida_bps=7600)
        segunda = marcos_atingidos(houve_quitacao=True, rota_percorrida_bps=7600)
        assert primeira == segunda
