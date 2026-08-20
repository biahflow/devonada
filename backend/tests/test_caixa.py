import pytest

from domain.caixa import (
    EntradaCaixa,
    ProvisaoPendente,
    aporte_de_provisao,
    caixa_defasado,
    calcular_caixa,
    meses_ate_vencimento,
    meses_entre,
    percentual_invade_o_piso,
    provisao_mensal,
    renda_tipica,
    respiro_invade_o_piso,
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


class TestRespiroNaCascata:
    """
    A linha que sobrevive ao aperto (M11, ADR 0019).

    O respiro entra ANTES de `capacidade_maxima`, que é o cenário em que todo o
    não essencial foi cortado. É a posição, e não o valor, que faz a feature
    existir: depois do corte ele seria a sobra que some quando aperta.
    """

    def test_a_capacidade_maxima_cai_exatamente_pelo_valor_declarado(self):
        sem = calcular_caixa(_entrada())
        com = calcular_caixa(_entrada(respiro=15000, respiro_ativo=True))
        assert sem.capacidade_maxima == 600000
        assert com.capacidade_maxima == 585000
        assert sem.capacidade_maxima - com.capacidade_maxima == 15000

    def test_cortar_todo_o_nao_essencial_NAO_zera_o_respiro(self):
        # O critério que dá nome à feature. `capacidade_maxima` é a hipótese de
        # austeridade total, e o respiro continua descontado dentro dela.
        c = calcular_caixa(_entrada(nao_essenciais=0, respiro=15000, respiro_ativo=True))
        assert c.capacidade_maxima == 585000
        assert c.capacidade_hoje == 585000
        assert c.respiro == 15000

    def test_capacidade_hoje_e_aporte_maximo_herdam_a_queda_sem_desconto_proprio(self):
        # O respiro é subtraído UMA vez, no topo. As duas linhas de baixo só
        # herdam — se aparecesse de novo aqui, seria contado duas vezes.
        c = calcular_caixa(
            _entrada(nao_essenciais=90000, comprometido_dividas=100000, respiro=15000)
        )
        assert c.capacidade_maxima == 585000
        assert c.capacidade_hoje == 495000
        assert c.aporte_maximo == 395000

    def test_o_respiro_pode_fazer_a_conta_deixar_de_fechar(self):
        # Consequência declarada da ADR 0019: com a capacidade máxima menor,
        # `nao_fecha` dispara para mais gente. Está correto — o plano de fato
        # não fecha se a pessoa precisa viver —, e continua sendo fato
        # aritmético, nunca diagnóstico de superendividamento.
        sem = calcular_caixa(_entrada(comprometido_dividas=595000))
        com = calcular_caixa(_entrada(comprometido_dividas=595000, respiro=15000))
        assert sem.nao_fecha is False
        assert com.nao_fecha is True

    def test_disponivel_no_mes_e_o_declarado_menos_o_usado(self):
        c = calcular_caixa(_entrada(respiro=15000, respiro_usado_no_mes=8000))
        assert c.respiro_disponivel_no_mes == 7000

    def test_disponivel_tem_piso_em_zero_e_nunca_fica_negativo(self):
        # Disponível negativo viraria dívida de lazer na tela — o oposto do que
        # a linha existe para fazer (guardrail 4.1).
        c = calcular_caixa(_entrada(respiro=15000, respiro_usado_no_mes=23000))
        assert c.respiro_disponivel_no_mes == 0

    def test_declarado_e_nada_usado_da_disponivel_igual_ao_declarado(self):
        c = calcular_caixa(_entrada(respiro=15000, respiro_usado_no_mes=0))
        assert c.respiro_disponivel_no_mes == 15000

    def test_o_uso_do_mes_nao_mexe_na_capacidade(self):
        # A fatia sai da cascata quando é DECLARADA. Descontar de novo o que foi
        # gasto dentro dela seria contar o sorvete duas vezes.
        sem_uso = calcular_caixa(_entrada(respiro=15000, respiro_usado_no_mes=0))
        com_uso = calcular_caixa(_entrada(respiro=15000, respiro_usado_no_mes=15000))
        assert sem_uso.capacidade_maxima == com_uso.capacidade_maxima == 585000

    def test_zero_declarado_e_escolha_legitima_e_entra_como_zero(self):
        c = calcular_caixa(_entrada(respiro=0, respiro_ativo=True, respiro_usado_no_mes=0))
        assert c.respiro == 0
        assert c.respiro_disponivel_no_mes == 0
        assert c.capacidade_maxima == 600000

    def test_respiro_desativado_sai_da_cascata_sem_apagar_valor_nem_saldo(self):
        # `ativo: false` PRESERVA o saldo acumulado: desativar não é apagar.
        c = calcular_caixa(
            _entrada(
                respiro=15000,
                respiro_ativo=False,
                respiro_usado_no_mes=0,
                respiro_saldo_acumulado=22000,
            )
        )
        assert c.capacidade_maxima == 600000
        assert c.respiro == 15000
        assert c.respiro_ativo is False
        assert c.respiro_saldo_acumulado == 22000

    def test_o_saldo_acumulado_atravessa_sem_entrar_em_conta_nenhuma(self):
        # Ele é do usuário e espera um marco ou um botão. Somá-lo à capacidade
        # transformaria respiro guardado em aporte automático — exatamente a
        # escolha que a ADR 0019 devolve à pessoa.
        c = calcular_caixa(_entrada(respiro=15000, respiro_saldo_acumulado=22000))
        assert c.respiro_saldo_acumulado == 22000
        assert c.capacidade_maxima == 585000


class TestRegressaoSemRespiro:
    """
    Quem nunca declarou respiro tem a cascata idêntica à de antes do M11.

    É o teste que impede a linha nova de vazar para quem não pediu — e o que
    protege os três consumidores que mudam de número sem serem tocados
    (simulador, painel e card do chat, todos via `leitura.capacidade_atual`).
    """

    def test_os_cinco_campos_sao_ausentes_e_nunca_zero(self):
        c = calcular_caixa(_entrada())
        # `None`, NUNCA `0`: zero declarado é escolha legítima, e é diferente de
        # não ter escolhido. Um default aqui seria o coeficiente sem fonte da
        # ADR 0009 entrando pela porta dos fundos.
        assert c.respiro is None
        assert c.respiro_ativo is None
        assert c.respiro_usado_no_mes is None
        assert c.respiro_disponivel_no_mes is None
        assert c.respiro_saldo_acumulado is None

    def test_a_cascata_inteira_campo_a_campo_com_os_valores_de_antes(self):
        c = calcular_caixa(
            _entrada(
                imposto_bps=600,
                nao_essenciais=90000,
                aporte_reserva=50000,
                aporte_aposentadoria=30000,
                comprometido_dividas=100000,
                provisoes=(ProvisaoPendente("IPVA", 180000, 0, 1),),
            )
        )
        assert c.renda_bruta_tipica == 1000000
        assert c.imposto_reservado == 60000
        assert c.renda_liquida == 940000
        assert c.essenciais == 400000
        assert c.nao_essenciais == 90000
        assert c.provisao_mensal == 36000
        assert c.aporte_reserva == 50000
        assert c.aporte_aposentadoria == 30000
        assert c.comprometido_dividas == 100000
        assert c.capacidade_maxima == 424000
        assert c.capacidade_hoje == 334000
        assert c.aporte_maximo == 234000
        assert c.minimo_existencial == 60000
        assert c.abaixo_do_piso is False
        assert c.nao_fecha is False
        assert c.preenchimento == "nivel_1"

    def test_o_caso_real_PJ_do_M7_continua_dando_o_mesmo_numero(self):
        # A mesma entrada de `TestCasoRealPJ`, sem respiro: se a linha nova
        # tivesse default, este número teria mudado em silêncio.
        c = calcular_caixa(
            _entrada(
                renda_bruta_tipica=700000,
                imposto_bps=600,
                essenciais=450000,
                nao_essenciais=60000,
            )
        )
        assert c.capacidade_maxima == 208000
        assert c.capacidade_hoje == 148000


class TestRespiroContraOPisoLegal:
    def test_devolve_true_quando_o_respiro_empurra_abaixo_do_piso(self):
        # R$ 6.500 de líquida, R$ 6.000 de essenciais e R$ 150 de respiro deixam
        # R$ 350 — abaixo do piso legal de R$ 600.
        assert respiro_invade_o_piso(650000, 600000, 15000, 60000) is True

    def test_devolve_false_quando_ainda_cabe_acima_do_piso(self):
        assert respiro_invade_o_piso(1000000, 400000, 15000, 60000) is False

    def test_na_fronteira_exata_o_piso_nao_e_invadido(self):
        # Igual ao piso ainda é o piso preservado; um centavo abaixo, não.
        assert respiro_invade_o_piso(660000, 600000, 0, 60000) is False
        assert respiro_invade_o_piso(660000, 600000, 1, 60000) is True

    def test_sem_piso_configurado_devolve_None_e_nao_False(self):
        # Mesmo espírito de `abaixo_do_piso`: `False` diria "conferimos e está
        # tudo bem", que é afirmação diferente de "não sabemos".
        assert respiro_invade_o_piso(1000000, 400000, 15000, None) is None

    def test_respiro_zero_nao_invade_um_piso_que_a_renda_ja_nao_cobria(self):
        # A função responde sobre o RESPIRO. Quando nem sem ele a pessoa alcança
        # o piso, ela devolve `True` — e é o caso em que declarar qualquer valor
        # é recusado, que é o que a lei manda.
        assert respiro_invade_o_piso(650000, 645000, 0, 60000) is True


class TestCompromissoPercentual:
    """
    A sétima linha da cascata (M12, ADR 0021, decisão 4).

    O VALOR NÃO É REGRA FINANCEIRA — é o percentual que a pessoa declarou. O que
    se prova aqui é a BASE sobre a qual ele incide e a POSIÇÃO em que ele entra:
    as duas coisas que, erradas, mudam o número de todo mundo que declarar.
    """

    def test_a_base_e_a_renda_LIQUIDA_e_nunca_a_bruta(self):
        # Bruta de R$ 10.000 com 6% de imposto: a líquida é R$ 9.400, e 10% dela
        # são R$ 940 — não os R$ 1.000 que a bruta daria. Decidido na Nota de
        # desempate de 20/08/2026 da ADR 0021: compromisso é percentual do que
        # ENTRA, e sobre a bruta o app comprometeria dinheiro que a pessoa nunca
        # vê.
        c = calcular_caixa(_entrada(imposto_bps=600, compromisso_percentual_bps=1000))

        assert c.renda_liquida == 940000
        assert c.compromisso_percentual == 94000
        assert c.capacidade_maxima == 446000
        # O que a base errada teria produzido. Explícito porque a diferença é
        # pequena o bastante para passar despercebida numa revisão.
        assert c.capacidade_maxima != 440000

    def test_entra_antes_de_capacidade_maxima_e_as_duas_de_baixo_herdam(self):
        c = calcular_caixa(
            _entrada(
                compromisso_percentual_bps=1000,
                nao_essenciais=90000,
                comprometido_dividas=100000,
            )
        )

        # Sem imposto a líquida é a bruta: 10% de R$ 10.000 são R$ 1.000.
        assert c.compromisso_percentual == 100000
        assert c.capacidade_maxima == 500000
        # `capacidade_hoje` e `aporte_maximo` caem junto, sem regra própria.
        assert c.capacidade_hoje == 410000
        assert c.aporte_maximo == 310000

    def test_soma_aos_potes_e_ao_respiro_em_vez_de_substituir_algum(self):
        # A posição é a MESMA dos três, e é isso que a protege do corte do não
        # essencial: `capacidade_maxima` é o cenário em que tudo o que dá foi
        # cortado, e o compromisso continua de pé nele.
        c = calcular_caixa(
            _entrada(
                compromisso_percentual_bps=1000,
                aporte_reserva=50000,
                aporte_aposentadoria=30000,
                respiro=15000,
            )
        )
        assert c.capacidade_maxima == 405000

    def test_zero_declarado_e_escolha_legitima_e_nao_e_ausencia(self):
        c = calcular_caixa(_entrada(compromisso_percentual_bps=0))

        assert c.compromisso_percentual_bps == 0
        assert c.compromisso_percentual == 0
        # O número é o de quem não declarou — mas o campo diz que houve escolha,
        # e a tela precisa poder dizer qual dos dois estados é.
        assert c.capacidade_maxima == 600000

    def test_quem_nao_declarou_tem_os_dois_campos_ausentes_e_nunca_zero(self):
        c = calcular_caixa(_entrada())

        assert c.compromisso_percentual_bps is None
        assert c.compromisso_percentual is None
        assert c.capacidade_maxima == 600000

    def test_o_compromisso_pode_fazer_o_mes_deixar_de_fechar(self):
        # A ação a distância da ADR 0021, exercitada de propósito: a mesma
        # dívida cabia sem o compromisso e não cabe com ele. `nao_fecha`
        # continua sendo fato aritmético, e nunca diagnóstico.
        sem = calcular_caixa(_entrada(comprometido_dividas=550000))
        com = calcular_caixa(
            _entrada(comprometido_dividas=550000, compromisso_percentual_bps=1000)
        )

        assert sem.nao_fecha is False
        assert com.nao_fecha is True


class TestImpostoPorFonte:
    """
    A alíquota apurada fonte a fonte chegando à cascata (ADR 0021, decisão 1).

    Quem soma é `leitura.montar_entrada_caixa`; o que se prova aqui é a
    PRECEDÊNCIA — e que ausência e zero continuam sendo coisas diferentes.
    """

    def test_o_somatorio_por_fonte_tem_precedencia_sobre_a_aliquota_global(self):
        c = calcular_caixa(_entrada(imposto_bps=600, imposto_por_fonte=45000))

        assert c.imposto_reservado == 45000
        assert c.renda_liquida == 955000
        assert c.capacidade_maxima == 555000

    def test_somatorio_zero_e_resposta_e_nao_cai_no_imposto_global(self):
        # Todas as fontes declararam 0%: reservar 6% aqui seria o app inventando
        # imposto que a pessoa disse não dever.
        c = calcular_caixa(_entrada(imposto_bps=600, imposto_por_fonte=0))

        assert c.imposto_reservado == 0
        assert c.renda_liquida == 1000000

    def test_sem_nenhuma_fonte_declarando_a_conta_e_a_de_sempre(self):
        c = calcular_caixa(_entrada(imposto_bps=600, imposto_por_fonte=None))

        assert c.imposto_reservado == 60000
        assert c.renda_liquida == 940000


class TestRegressaoSemCompromissoNemAliquotaPorFonte:
    """
    Quem não declarou nada do M12 tem a cascata idêntica à de antes dele.

    Gêmeo de `TestRegressaoSemRespiro`, e pelo mesmo motivo: são quatro
    consumidores que mudam de número sem serem tocados — o simulador, a
    `margemDisponivel` do painel, o card `plano_sugerido` do chat e a oferta que
    o script de negociação faz ao credor (`routers/revisao.py`, Nota de correção
    da ADR 0021).
    """

    def test_os_dois_campos_novos_sao_ausentes_e_nunca_zero(self):
        c = calcular_caixa(_entrada())
        # `None`, NUNCA `0`: zero declarado é escolha legítima, e é diferente de
        # não ter escolhido.
        assert c.compromisso_percentual_bps is None
        assert c.compromisso_percentual is None

    def test_a_cascata_inteira_campo_a_campo_com_os_valores_de_antes(self):
        c = calcular_caixa(
            _entrada(
                imposto_bps=600,
                nao_essenciais=90000,
                aporte_reserva=50000,
                aporte_aposentadoria=30000,
                comprometido_dividas=100000,
                provisoes=(ProvisaoPendente("IPVA", 180000, 0, 1),),
            )
        )
        assert c.renda_bruta_tipica == 1000000
        assert c.imposto_reservado == 60000
        assert c.renda_liquida == 940000
        assert c.essenciais == 400000
        assert c.nao_essenciais == 90000
        assert c.provisao_mensal == 36000
        assert c.aporte_reserva == 50000
        assert c.aporte_aposentadoria == 30000
        assert c.comprometido_dividas == 100000
        assert c.capacidade_maxima == 424000
        assert c.capacidade_hoje == 334000
        assert c.aporte_maximo == 234000
        assert c.compromisso_percentual_bps is None
        assert c.compromisso_percentual is None
        assert c.minimo_existencial == 60000
        assert c.abaixo_do_piso is False
        assert c.nao_fecha is False
        assert c.preenchimento == "nivel_1"


class TestPercentualContraOPisoLegal:
    def test_devolve_true_quando_o_compromisso_empurra_abaixo_do_piso(self):
        # R$ 6.500 de líquida, R$ 6.000 de essenciais e R$ 150 de compromisso
        # deixam R$ 350 — abaixo do piso legal de R$ 600.
        assert percentual_invade_o_piso(650000, 600000, 15000, 60000) is True

    def test_devolve_false_quando_ainda_cabe_acima_do_piso(self):
        assert percentual_invade_o_piso(1000000, 400000, 15000, 60000) is False

    def test_na_fronteira_exata_o_piso_nao_e_invadido(self):
        assert percentual_invade_o_piso(660000, 600000, 0, 60000) is False
        assert percentual_invade_o_piso(660000, 600000, 1, 60000) is True

    def test_sem_piso_configurado_devolve_None_e_nao_False(self):
        # Mesmo espírito de `abaixo_do_piso` e de `respiro_invade_o_piso`: um
        # `False` diria "conferimos e está tudo bem", que é afirmação diferente
        # de "não sabemos".
        assert percentual_invade_o_piso(1000000, 400000, 15000, None) is None

    def test_compromisso_zero_nao_invade_um_piso_que_a_renda_ja_nao_cobria(self):
        assert percentual_invade_o_piso(650000, 645000, 0, 60000) is True


# --- O caminho que preenche a entrada (M12, T1) ------------------------------
#
# O motor acima é puro e continua sem banco. As três classes abaixo tocam o
# banco de propósito, e é a única coisa que elas fazem: a apuração por fonte e o
# percentual do perfil nascem em `leitura.montar_entrada_caixa`, e a aritmética
# testada acima não prova que o dado chega até ela. Sem isto, uma alíquota
# gravada e nunca lida passaria a suíte inteira verde.


def _fonte_persistida(sessao, tenant, **kwargs):
    import orm

    padrao = dict(
        tenant_id=tenant,
        nome="Contrato PJ",
        tipo="pj_hora",
        valor_tipico_informado=600000,
        ativo=True,
    )
    padrao.update(kwargs)
    fonte = orm.FonteRenda(**padrao)
    sessao.add(fonte)
    sessao.commit()
    return fonte


def _perfil_persistido(sessao, tenant, **kwargs):
    import orm

    perfil = orm.Perfil(tenant_id=tenant, **kwargs)
    sessao.add(perfil)
    sessao.commit()
    return perfil


class TestAliquotaPorFonteNaLeitura:
    """
    A alíquota de cada fonte chegando à entrada da cascata (ADR 0021, decisão 1).

    O caso que motivou a decisão é o CLT com contrato PJ ao lado: uma alíquota só
    para as duas rendas é um número que não descreve nenhuma delas.
    """

    def test_soma_fonte_a_fonte_e_a_que_nao_declarou_usa_o_perfil(self, sessao):
        from config import get_settings
        from leitura import montar_entrada_caixa

        tenant = "tenant-da-aliquota"
        _perfil_persistido(sessao, tenant, imposto_bps=1000)
        _fonte_persistida(sessao, tenant, valor_tipico_informado=600000, imposto_bps=600)
        _fonte_persistida(
            sessao, tenant, nome="Aluguel", tipo="aluguel", valor_tipico_informado=400000
        )

        entrada = montar_entrada_caixa(sessao, tenant, get_settings())

        # 6% de R$ 6.000 = R$ 360; a fonte sem alíquota cai nos 10% do perfil
        # sobre R$ 4.000 = R$ 400.
        assert entrada.renda_bruta_tipica == 1000000
        assert entrada.imposto_por_fonte == 76000

    def test_sem_nenhuma_fonte_declarando_o_campo_e_ausente_e_nunca_zero(self, sessao):
        from config import get_settings
        from leitura import montar_entrada_caixa

        tenant = "tenant-sem-aliquota-na-fonte"
        _perfil_persistido(sessao, tenant, imposto_bps=600)
        _fonte_persistida(sessao, tenant, valor_tipico_informado=1000000)

        entrada = montar_entrada_caixa(sessao, tenant, get_settings())

        # `None` é o que faz a cascata manter a multiplicação sobre a renda
        # somada — bit a bit o número de hoje. Um `0` aqui apagaria o imposto de
        # quem nunca pediu nada.
        assert entrada.imposto_por_fonte is None
        assert calcular_caixa(entrada).imposto_reservado == 60000

    def test_zero_na_fonte_e_declaracao_e_nao_cai_no_perfil(self, sessao):
        from config import get_settings
        from leitura import montar_entrada_caixa

        tenant = "tenant-com-fonte-isenta"
        _perfil_persistido(sessao, tenant, imposto_bps=1000)
        _fonte_persistida(sessao, tenant, valor_tipico_informado=600000, imposto_bps=0)
        _fonte_persistida(
            sessao, tenant, nome="Aluguel", tipo="aluguel", valor_tipico_informado=400000
        )

        entrada = montar_entrada_caixa(sessao, tenant, get_settings())

        # Só os R$ 400 da fonte que não declarou. A isenta reserva zero, que é o
        # que ela declarou.
        assert entrada.imposto_por_fonte == 40000

    def test_o_percentual_do_perfil_chega_a_entrada(self, sessao):
        from config import get_settings
        from leitura import montar_entrada_caixa

        tenant = "tenant-com-compromisso"
        _perfil_persistido(sessao, tenant, compromisso_percentual_bps=1000)
        _fonte_persistida(sessao, tenant, valor_tipico_informado=1000000)

        entrada = montar_entrada_caixa(sessao, tenant, get_settings())
        assert entrada.compromisso_percentual_bps == 1000

    def test_sem_perfil_os_dois_campos_novos_seguem_ausentes(self, sessao):
        from config import get_settings
        from leitura import montar_entrada_caixa

        tenant = "tenant-sem-perfil"
        _fonte_persistida(sessao, tenant, valor_tipico_informado=1000000)

        entrada = montar_entrada_caixa(sessao, tenant, get_settings())
        assert entrada.compromisso_percentual_bps is None
        assert entrada.imposto_por_fonte is None


class TestEventoPrevisivelEntraSozinhoNaExclusao:
    """
    A tabela nova nasce dentro da exclusão de conta sem uma linha a mais.

    É a aposta do `tenant_id` cobrando de novo (PF-7 do plano): a varredura de
    `routers/conta.tabelas_do_tenant()` é derivada de `Base.metadata`, e
    `routers/conta.py` NÃO foi editado neste commit. Se um dia alguém precisar
    acrescentar uma linha àquela rota para uma tabela nova, a varredura derivada
    parou de funcionar — e é aqui que isso aparece, não numa auditoria de loja
    meses depois.
    """

    def test_a_tabela_aparece_na_varredura_por_tenant(self):
        from routers.conta import tabelas_do_tenant

        assert "evento_previsivel" in {t.name for t in tabelas_do_tenant()}
