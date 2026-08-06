import re

from domain.revisao import (
    Contrato,
    Tetos,
    cet_nao_informado,
    juros_acima_do_teto,
    multa_acima_do_teto,
    revisar,
    seguro_prestamista_embutido,
    tarifa_de_cadastro_repetida,
)

# Um consignado do INSS com tudo preenchido. Cada teste derruba uma peça e
# confere que o achado correspondente some — insumo ausente nunca vira suposição.
CONTRATO = Contrato(
    valor_cobrado=1_500_000,
    modalidade="consignado_inss",
    taxa_juros_mensal_bps=2_500,
    multa_moratoria_bps=500,
    tarifa_cadastro=50_000,
    seguro_prestamista=120_000,
    cet_anual_bps=18_000,
    trecho_multa="Multa por atraso: 5% sobre o valor da parcela",
    trecho_tarifa="Tarifa de cadastro: R$ 500,00",
    trecho_seguro="Seguro prestamista: R$ 1.200,00",
    trecho_taxa="Taxa de juros: 25,00% a.m.",
)

TETOS = Tetos(consignado_inss_bps=1_850, cartao_consignado_bps=2_460, vigentes_em="2025-03-25")


class TestMultaMoratoria:
    def test_excesso_e_somado_parcela_a_parcela(self):
        # Multa de 5%, teto de 2% (CDC 52 §1º) → 3% de excesso sobre cada
        # parcela atrasada. Duas de R$ 1.000,00 → 2 × R$ 30,00 = R$ 60,00.
        achado = multa_acima_do_teto(CONTRATO, [100_000, 100_000])
        assert achado is not None
        assert achado.valor_contestavel == 6_000

    def test_exatamente_no_teto_nao_e_achado(self):
        # 2% é o limite permitido, não a infração.
        no_teto = Contrato(valor_cobrado=1_500_000, multa_moratoria_bps=200)
        assert multa_acima_do_teto(no_teto, [100_000]) is None

    def test_abaixo_do_teto_nao_e_achado(self):
        abaixo = Contrato(valor_cobrado=1_500_000, multa_moratoria_bps=100)
        assert multa_acima_do_teto(abaixo, [100_000]) is None

    def test_sem_parcela_atrasada_o_achado_aparece_sem_valor(self):
        # A cláusula continua contestável; o dinheiro ainda não foi cobrado.
        achado = multa_acima_do_teto(CONTRATO, [])
        assert achado is not None
        assert achado.valor_contestavel is None

    def test_sem_multa_extraida_nao_ha_achado(self):
        sem_multa = Contrato(valor_cobrado=1_500_000)
        assert multa_acima_do_teto(sem_multa, [100_000]) is None

    def test_carrega_o_trecho_literal(self):
        achado = multa_acima_do_teto(CONTRATO, [100_000])
        assert achado is not None
        assert achado.evidencia == "Multa por atraso: 5% sobre o valor da parcela"


class TestJurosAcimaDoTeto:
    def test_acima_do_teto_do_consignado(self):
        achado = juros_acima_do_teto(CONTRATO, TETOS)
        assert achado is not None
        assert "25%" in achado.explicacao
        assert "18,5%" in achado.explicacao

    def test_nunca_produz_valor(self):
        # ADR 0008: quantificar exigiria reamortizar o contrato inteiro.
        achado = juros_acima_do_teto(CONTRATO, TETOS)
        assert achado is not None
        assert achado.valor_contestavel is None

    def test_teto_nao_configurado_nao_produz_achado(self):
        # O caso que a ADR 0008 protege: sem teto confirmado, nada é comparado.
        assert juros_acima_do_teto(CONTRATO, Tetos()) is None

    def test_modalidade_desconhecida_nao_recebe_teto_de_consignado(self):
        pessoal = Contrato(
            valor_cobrado=1_500_000, modalidade="pessoal", taxa_juros_mensal_bps=2_500
        )
        assert juros_acima_do_teto(pessoal, TETOS) is None

    def test_sem_modalidade_nao_ha_achado(self):
        sem_modalidade = Contrato(valor_cobrado=1_500_000, taxa_juros_mensal_bps=2_500)
        assert juros_acima_do_teto(sem_modalidade, TETOS) is None

    def test_cartao_consignado_usa_o_proprio_teto(self):
        cartao = Contrato(
            valor_cobrado=1_500_000,
            modalidade="cartao_consignado",
            taxa_juros_mensal_bps=2_000,
        )
        # 20,00% a.m. está acima do teto do empréstimo (18,50%) mas ABAIXO do
        # teto do cartão (24,60%). Usar o teto errado inventaria um achado.
        assert juros_acima_do_teto(cartao, TETOS) is None


class TestTarifaDeCadastro:
    def test_com_divida_anterior_do_mesmo_credor(self):
        achado = tarifa_de_cadastro_repetida(CONTRATO, True)
        assert achado is not None
        assert achado.valor_contestavel == 50_000

    def test_sem_relacionamento_anterior_nao_ha_achado(self):
        # Súmula 566: a tarifa é devida no início do relacionamento.
        assert tarifa_de_cadastro_repetida(CONTRATO, False) is None

    def test_sem_tarifa_extraida_nao_ha_achado(self):
        sem_tarifa = Contrato(valor_cobrado=1_500_000)
        assert tarifa_de_cadastro_repetida(sem_tarifa, True) is None


class TestSeguroPrestamista:
    def test_premio_vira_valor_contestavel(self):
        achado = seguro_prestamista_embutido(CONTRATO)
        assert achado is not None
        assert achado.valor_contestavel == 120_000

    def test_devolve_a_pergunta_de_fato_ao_usuario(self):
        # A presença do seguro não prova venda casada — só o usuário sabe se
        # teve escolha, e o achado precisa perguntar em vez de afirmar.
        achado = seguro_prestamista_embutido(CONTRATO)
        assert achado is not None
        assert "?" in achado.como_conferir

    def test_sem_seguro_nao_ha_achado(self):
        assert seguro_prestamista_embutido(Contrato(valor_cobrado=1_500_000)) is None


class TestCet:
    def test_ausente_em_contrato_lido_vira_achado(self):
        lido_sem_cet = Contrato(valor_cobrado=1_500_000, modalidade="consignado_inss")
        achado = cet_nao_informado(lido_sem_cet)
        assert achado is not None
        assert achado.valor_contestavel is None

    def test_presente_nao_vira_achado(self):
        assert cet_nao_informado(CONTRATO) is None

    def test_divida_sem_contrato_lido_nao_gera_o_achado(self):
        # Senão ele apareceria para todo mundo e não significaria nada.
        assert cet_nao_informado(Contrato(valor_cobrado=1_500_000)) is None


class TestRevisar:
    def test_valor_justo_e_a_subtracao_dos_achados_com_valor(self):
        # Multa: 3% × R$ 1.000,00 = R$ 30,00. Tarifa: R$ 500,00.
        # Seguro: R$ 1.200,00. Total contestável: R$ 1.730,00.
        # R$ 15.000,00 − R$ 1.730,00 = R$ 13.270,00.
        r = revisar(CONTRATO, TETOS, [100_000], credor_ja_tinha_divida_anterior=True)
        assert r.valor_justo == 1_327_000

    def test_juros_acima_do_teto_nao_entra_na_soma(self):
        com = revisar(CONTRATO, TETOS, [100_000], credor_ja_tinha_divida_anterior=True)
        sem = revisar(CONTRATO, Tetos(), [100_000], credor_ja_tinha_divida_anterior=True)
        assert com.valor_justo == sem.valor_justo
        assert len(com.achados) == len(sem.achados) + 1

    def test_sem_achado_com_valor_o_numero_nao_sai(self):
        # Nunca igual ao valor cobrado: isso diria "conferimos e está tudo
        # certo", afirmação que não temos como fazer.
        so_alerta = Contrato(
            valor_cobrado=1_500_000, modalidade="consignado_inss", taxa_juros_mensal_bps=2_500
        )
        r = revisar(so_alerta, TETOS, [])
        assert r.valor_justo is None
        assert r.achados

    def test_divida_sem_contrato_lido_nao_tem_achado_nenhum(self):
        r = revisar(Contrato(valor_cobrado=1_500_000), TETOS, [])
        assert r.achados == []
        assert r.valor_justo is None

    def test_soma_maior_que_o_cobrado_nao_vira_zero_nem_negativo(self):
        # Encargo lido errado na extração não pode produzir "esta dívida deveria
        # custar nada".
        absurdo = Contrato(
            valor_cobrado=100_000, seguro_prestamista=500_000, trecho_seguro="Seguro: R$ 5.000,00"
        )
        r = revisar(absurdo, TETOS, [])
        assert r.valor_justo is None
        assert r.achados  # o achado continua visível, com seu valor

    def test_vigencia_so_acompanha_achado_que_dependeu_de_teto(self):
        com_teto = revisar(CONTRATO, TETOS, [100_000])
        assert com_teto.base_legal_vigente_em == "2025-03-25"

        so_multa = Contrato(
            valor_cobrado=1_500_000, multa_moratoria_bps=500, trecho_multa="Multa: 5%"
        )
        # A multa do CDC não envelhece — exibir vigência ao lado dela sugeriria
        # que todos os achados envelhecem juntos.
        assert revisar(so_multa, TETOS, [100_000]).base_legal_vigente_em is None


class TestCopy:
    """
    Guardrail 3: achado é convite a investigar, nunca sentença.

    Este teste é o gêmeo do que quebra em "recomendada" no simulador. Ele existe
    para falhar quando alguém — pessoa ou modelo — escrever uma afirmação de
    ilegalidade numa tela que o usuário leva para uma negociação real.
    """

    PROIBIDO = re.compile(
        r"ilegal|abusiv|nul[ao]\b|é seu direito|você tem direito|com certeza|garantid[ao]",
        re.IGNORECASE,
    )

    def test_nenhum_achado_afirma_ilegalidade(self):
        r = revisar(CONTRATO, TETOS, [100_000], credor_ja_tinha_divida_anterior=True)
        assert r.achados
        for achado in r.achados:
            for texto in (achado.titulo, achado.explicacao, achado.como_conferir):
                assert not self.PROIBIDO.search(texto), f"{achado.id}: {texto}"

    def test_todo_achado_cita_a_fonte(self):
        r = revisar(CONTRATO, TETOS, [100_000], credor_ja_tinha_divida_anterior=True)
        assert r.achados
        for achado in r.achados:
            assert achado.fonte.strip()
            assert achado.como_conferir.strip()
