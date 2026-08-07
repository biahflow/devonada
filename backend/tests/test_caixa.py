import pytest

from domain.caixa import (
    EntradaCaixa,
    ProvisaoPendente,
    aporte_de_provisao,
    caixa_defasado,
    calcular_caixa,
    meses_ate_vencimento,
    meses_entre,
    provisao_mensal,
    renda_tipica,
)

"""
Tabela-verdade do motor de caixa. Sem banco: o motor é puro, e é aqui que todo
o risco financeiro do módulo é coberto.
"""


def _entrada(**kwargs) -> EntradaCaixa:
    """O caso base é deliberadamente simples; cada teste muda o que interessa."""
    padrao = dict(
        renda_bruta_tipica=1000000,  # R$ 10.000
        origem_renda="informada",
        imposto_bps=None,
        essenciais=400000,  # R$ 4.000
        nao_essenciais=0,
        provisoes=(),
        aporte_reserva=0,
        aporte_aposentadoria=0,
        comprometido_dividas=0,
        minimo_existencial=60000,
        mes_atual=8,
    )
    padrao.update(kwargs)
    return EntradaCaixa(**padrao)  # type: ignore[arg-type]


class TestRendaTipica:
    def test_sem_historico_usa_o_informado_e_diz_que_usou(self):
        valor, origem = renda_tipica(1000000, [])
        assert valor == 1000000
        assert origem == "informada"

    def test_com_menos_de_tres_recebimentos_ainda_usa_o_informado(self):
        # Dois pontos não descrevem variação — descrevem dois pontos.
        valor, origem = renda_tipica(1000000, [800000, 1200000])
        assert valor == 1000000
        assert origem == "informada"

    def test_com_historico_usa_o_PIOR_mes_e_nao_a_media(self):
        # Média seria 1.000.000. O plano tem de sobreviver ao mês de 700.000.
        valor, origem = renda_tipica(1200000, [700000, 1000000, 1300000])
        assert valor == 700000
        assert origem == "pior_mes_registrado"

    def test_a_janela_impede_que_um_mes_pessimo_antigo_ancore_para_sempre(self):
        # Sete meses: o 100000 do começo sai da janela de seis.
        valor, _ = renda_tipica(None, [100000, 900000, 950000, 900000, 980000, 990000, 970000])
        assert valor == 900000

    def test_sem_informado_e_sem_historico_devolve_zero(self):
        assert renda_tipica(None, []) == (0, "informada")


class TestMesesAteVencimento:
    def test_agosto_para_janeiro_sao_cinco_meses_e_nao_doze(self):
        # O erro que este número existe para impedir: dividir por 12 deixaria a
        # pessoa curta justamente em janeiro.
        assert meses_ate_vencimento(1, 8) == 5

    def test_vencimento_no_proprio_mes_conta_como_um(self):
        # A despesa é agora: o que falta sai de uma vez. Zero dividiria por
        # zero, e doze fingiria um ano de folga.
        assert meses_ate_vencimento(1, 1) == 1

    def test_mes_seguinte_conta_como_um(self):
        assert meses_ate_vencimento(9, 8) == 1

    def test_ciclo_completo_quando_acabou_de_passar(self):
        assert meses_ate_vencimento(7, 8) == 11


class TestAporteDeProvisao:
    def test_ipva_de_mil_e_oitocentos_em_agosto_reserva_por_cinco_meses(self):
        ipva = ProvisaoPendente("IPVA do carro", 180000, 0, 1)
        assert aporte_de_provisao(ipva, 8) == 36000  # R$ 360,00

    def test_desconta_o_que_ja_foi_guardado(self):
        ipva = ProvisaoPendente("IPVA do carro", 180000, 30000, 1)
        assert aporte_de_provisao(ipva, 8) == 30000  # faltam 150.000 em 5 meses

    def test_arredonda_para_cima_para_o_fundo_fechar(self):
        # 100.000 em 3 meses = 33.333,33. Para baixo o fundo fica um centavo
        # curto, e o fundo existe para não ficar curto.
        p = ProvisaoPendente("Seguro", 100000, 0, 11)
        assert aporte_de_provisao(p, 8) == 33334

    def test_ja_provisionado_devolve_zero_e_nunca_negativo(self):
        # Sobra de provisão não vira renda.
        p = ProvisaoPendente("IPVA", 180000, 200000, 1)
        assert aporte_de_provisao(p, 8) == 0

    def test_soma_carro_e_moto(self):
        provisoes = (
            ProvisaoPendente("IPVA do carro", 180000, 0, 1),
            ProvisaoPendente("IPVA da moto", 30000, 0, 1),
        )
        assert provisao_mensal(provisoes, 8) == 36000 + 6000


class TestCascata:
    def test_caso_base_sem_imposto_nem_potes(self):
        c = calcular_caixa(_entrada())
        assert c.imposto_reservado == 0
        assert c.renda_liquida == 1000000
        assert c.capacidade_hoje == 600000
        assert c.capacidade_maxima == 600000

    def test_imposto_sai_do_bruto_e_sai_primeiro(self):
        # 6% de R$ 10.000 = R$ 600. O que é do governo nunca foi renda.
        c = calcular_caixa(_entrada(imposto_bps=600))
        assert c.imposto_reservado == 60000
        assert c.renda_liquida == 940000
        assert c.capacidade_hoje == 540000

    def test_sem_imposto_informado_nada_e_reservado(self):
        # ADR 0009: estimar alíquota de enquadramento seria inventar regra.
        c = calcular_caixa(_entrada(imposto_bps=None))
        assert c.imposto_reservado == 0

    def test_as_duas_capacidades_diferem_pelo_nao_essencial(self):
        c = calcular_caixa(_entrada(nao_essenciais=90000))
        assert c.capacidade_hoje == 510000
        assert c.capacidade_maxima == 600000
        # A diferença é a alavanca do usuário, e o app não puxa por ele.
        assert c.capacidade_maxima - c.capacidade_hoje == 90000

    def test_potes_do_usuario_saem_das_duas_capacidades(self):
        c = calcular_caixa(_entrada(aporte_reserva=50000, aporte_aposentadoria=30000))
        assert c.capacidade_hoje == 520000
        assert c.capacidade_maxima == 520000

    def test_provisao_derruba_a_capacidade(self):
        c = calcular_caixa(_entrada(provisoes=(ProvisaoPendente("IPVA", 180000, 0, 1),)))
        assert c.provisao_mensal == 36000
        assert c.capacidade_hoje == 564000

    def test_capacidade_negativa_e_devolvida_como_negativa(self):
        # O negativo É a informação. Zerar aqui esconderia o único número que
        # importa para quem está nessa situação.
        c = calcular_caixa(_entrada(renda_bruta_tipica=300000, essenciais=400000))
        assert c.capacidade_hoje == -100000

    def test_a_soma_dos_potes_fecha_com_a_renda_ao_centavo(self):
        entrada = _entrada(
            renda_bruta_tipica=1000000,
            imposto_bps=600,
            essenciais=400000,
            nao_essenciais=90000,
            provisoes=(ProvisaoPendente("IPVA", 180000, 0, 1),),
            aporte_reserva=50000,
            aporte_aposentadoria=30000,
        )
        c = calcular_caixa(entrada)
        soma = (
            c.imposto_reservado
            + c.essenciais
            + c.nao_essenciais
            + c.provisao_mensal
            + c.aporte_reserva
            + c.aporte_aposentadoria
            + c.capacidade_hoje
        )
        assert soma == c.renda_bruta_tipica


class TestAporteMaximo:
    def test_desconta_o_que_ja_esta_comprometido_com_divida(self):
        # As parcelas atuais não entram na cascata (seriam contadas duas vezes);
        # entram aqui, no teto do aporte EXTRA.
        c = calcular_caixa(_entrada(comprometido_dividas=180000))
        assert c.capacidade_hoje == 600000
        assert c.aporte_maximo == 420000

    def test_negativo_quando_as_parcelas_atuais_ja_nao_cabem(self):
        c = calcular_caixa(_entrada(comprometido_dividas=700000))
        assert c.aporte_maximo == -100000


class TestSinais:
    def test_abaixo_do_piso_quando_a_sobra_nao_cobre_o_minimo_existencial(self):
        # R$ 6.500 de renda com R$ 6.450 de essenciais: sobram R$ 50, e o piso
        # legal é R$ 600.
        c = calcular_caixa(_entrada(renda_bruta_tipica=650000, essenciais=645000))
        assert c.abaixo_do_piso is True

    def test_acima_do_piso_no_caso_base(self):
        assert calcular_caixa(_entrada()).abaixo_do_piso is False

    def test_sem_piso_configurado_o_sinal_e_ausente_e_nao_falso(self):
        # `False` diria "conferimos e está tudo bem", que é afirmação diferente
        # de "não sabemos".
        c = calcular_caixa(_entrada(minimo_existencial=None))
        assert c.abaixo_do_piso is None
        assert c.minimo_existencial is None

    def test_nao_fecha_quando_as_parcelas_passam_da_capacidade_maxima(self):
        c = calcular_caixa(_entrada(nao_essenciais=90000, comprometido_dividas=650000))
        assert c.nao_fecha is True

    def test_na_fronteira_exata_ainda_fecha(self):
        c = calcular_caixa(_entrada(comprometido_dividas=600000))
        assert c.nao_fecha is False

    def test_cortar_o_nao_essencial_e_o_que_separa_fechar_de_nao_fechar(self):
        # R$ 5.500 de parcelas contra R$ 5.100 de capacidade hoje e R$ 6.000 de
        # capacidade máxima: não cabe sem mexer em nada, mas cabe cortando o não
        # essencial. Por isso `nao_fecha` compara com a capacidade MÁXIMA — dizer
        # "não fecha" a quem ainda tem o que cortar seria alarme falso.
        c = calcular_caixa(_entrada(nao_essenciais=90000, comprometido_dividas=550000))
        assert c.aporte_maximo == -40000
        assert c.nao_fecha is False


class TestPreenchimento:
    def test_vazio_sem_renda_e_sem_essenciais(self):
        c = calcular_caixa(_entrada(renda_bruta_tipica=0, essenciais=0))
        assert c.preenchimento == "vazio"

    def test_nivel_0_com_os_dois_campos_do_atalho(self):
        assert calcular_caixa(_entrada()).preenchimento == "nivel_0"

    def test_nivel_1_quando_o_usuario_detalhou(self):
        c = calcular_caixa(_entrada(provisoes=(ProvisaoPendente("IPVA", 180000, 0, 1),)))
        assert c.preenchimento == "nivel_1"


class TestCasoRealPJ:
    """
    O caso do dono do produto, que é o teste de aceitação do M7: PJ por hora com
    meses desiguais, carro e moto com IPVA e seguro em janeiro, reserva a
    construir e aposentadoria.
    """

    @pytest.fixture
    def caixa(self):
        valor, origem = renda_tipica(1200000, [1150000, 980000, 1310000, 1050000])
        return calcular_caixa(
            EntradaCaixa(
                renda_bruta_tipica=valor,
                origem_renda=origem,
                imposto_bps=600,
                essenciais=520000,
                nao_essenciais=80000,
                provisoes=(
                    ProvisaoPendente("IPVA do carro", 180000, 0, 1),
                    ProvisaoPendente("Seguro do carro", 240000, 0, 1),
                    ProvisaoPendente("IPVA da moto", 30000, 0, 1),
                    ProvisaoPendente("Seguro da moto", 90000, 0, 1),
                ),
                aporte_reserva=100000,
                aporte_aposentadoria=50000,
                comprometido_dividas=150000,
                minimo_existencial=60000,
                mes_atual=8,
            )
        )

    def test_a_renda_do_plano_e_o_pior_mes(self, caixa):
        assert caixa.renda_bruta_tipica == 980000
        assert caixa.origem_renda == "pior_mes_registrado"

    def test_janeiro_inteiro_cabe_em_cinco_parcelas(self, caixa):
        # 180.000 + 240.000 + 30.000 + 90.000 = 540.000 em 5 meses.
        assert caixa.provisao_mensal == 108000

    def test_a_cascata_inteira_com_os_numeros_do_caso(self, caixa):
        # 980.000 − 58.800 de imposto = 921.200 líquidos.
        # − 520.000 de essenciais − 108.000 de provisão = 293.200 de sobra.
        # − 100.000 de reserva − 50.000 de aposentadoria = 143.200 no máximo.
        # − 80.000 de não essencial = 63.200 hoje.
        assert caixa.renda_liquida == 921200
        assert caixa.capacidade_maxima == 143200
        assert caixa.capacidade_hoje == 63200

    def test_com_estes_numeros_a_conta_NAO_fecha(self, caixa):
        # R$ 1.500 de parcelas contra R$ 1.432 de capacidade máxima. Não fecha
        # nem cortando todo o não essencial — e é exatamente este diagnóstico
        # que o produto existe para dar, porque nenhum app de finanças pessoais
        # cruza dívida com caixa para chegar nele.
        #
        # O que ele NÃO diz: que o usuário está superendividado. Isso depende de
        # boa-fé e de dívida de consumo (CDC art. 54-A, § 1º), que software não
        # apura. Ele diz que os números informados não fecham, e convida a
        # investigar a repactuação.
        assert caixa.nao_fecha is True
        assert caixa.aporte_maximo == -86800

    def test_o_piso_legal_continua_preservado_mesmo_com_a_conta_nao_fechando(self, caixa):
        # Sobram R$ 4.012 depois dos essenciais, muito acima dos R$ 600 do
        # decreto. "Não fecha" e "abaixo do piso" são sinais diferentes.
        assert caixa.abaixo_do_piso is False


class TestMesesEntre:
    def test_conta_a_distancia_atravessando_o_ano(self):
        assert meses_entre("2025-11", "2026-02") == 3

    def test_mesmo_mes_e_zero(self):
        assert meses_entre("2026-03", "2026-03") == 0

    def test_mes_futuro_nao_devolve_negativo(self):
        # Dado inconsistente não vira número negativo viajando para a tela.
        assert meses_entre("2026-05", "2026-03") == 0


class TestCaixaDefasado:
    def test_nunca_fechado_nao_e_defasado_e_nem_em_dia(self):
        # None, não False: "ainda não fechou" e "está em dia" são coisas
        # diferentes, e a tela precisa poder dizer a primeira.
        assert caixa_defasado(None) is None

    def test_um_mes_atras_e_o_estado_normal_entre_fechamentos(self):
        # Quem fecha março o faz durante abril. Avisar aqui treinaria o usuário
        # a ignorar o aviso.
        assert caixa_defasado(1) is False

    def test_dois_meses_significa_um_fechamento_pulado(self):
        assert caixa_defasado(2) is True

    def test_fechado_no_proprio_mes_esta_em_dia(self):
        assert caixa_defasado(0) is False
