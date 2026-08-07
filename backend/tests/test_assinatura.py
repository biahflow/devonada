from datetime import datetime, timedelta, timezone

from domain.assinatura import AssinaturaConhecida, situacao

"""
O motor puro da situação de assinatura.

Sem banco, sem rede, sem relógio: `agora` é parâmetro, e é isso que permite
testar a virada do prazo sem congelar o tempo da suíte.
"""

AGORA = datetime(2026, 8, 7, 12, 0, tzinfo=timezone.utc)
TESTE_DIAS = 7


def paga(dias: int, renovacao: bool = True) -> AssinaturaConhecida:
    return AssinaturaConhecida(
        expira_em=AGORA + timedelta(days=dias), renovacao_automatica=renovacao
    )


class TestPeriodoDeTeste:
    def test_conta_nova_esta_em_teste(self):
        s = situacao(AGORA, None, AGORA, TESTE_DIAS)
        assert s.status == "em_teste"
        assert s.pode_escrever
        assert s.dias_restantes == 7

    def test_o_ultimo_dia_do_teste_ainda_escreve(self):
        criado = AGORA - timedelta(days=6, hours=23)
        s = situacao(criado, None, AGORA, TESTE_DIAS)
        assert s.status == "em_teste"
        assert s.pode_escrever

    def test_passado_o_prazo_a_escrita_para(self):
        criado = AGORA - timedelta(days=7, seconds=1)
        s = situacao(criado, None, AGORA, TESTE_DIAS)
        assert s.status == "expirada"
        assert not s.pode_escrever
        assert s.dias_restantes == 0

    def test_dias_restantes_arredonda_para_cima(self):
        """
        Faltando 30 horas, a tela diz 2 dias e não 1.

        Truncar subestimaria o prazo de quem está em aperto financeiro, que é o
        erro que este produto menos pode cometer — e ele apareceria justamente
        na véspera, quando a pessoa está decidindo se assina.
        """
        criado = AGORA - timedelta(days=7) + timedelta(hours=30)
        assert situacao(criado, None, AGORA, TESTE_DIAS).dias_restantes == 2


class TestAssinaturaPaga:
    def test_compra_valida_deixa_o_status_ativo(self):
        s = situacao(AGORA - timedelta(days=30), paga(30), AGORA, TESTE_DIAS)
        assert s.status == "ativa"
        assert s.pode_escrever

    def test_quem_assina_durante_o_teste_aparece_como_ativo(self):
        """
        Dizer "em teste" a quem já pagou é dizer que ele vai ser cobrado de novo
        em breve. O status olha a compra, não a data final.
        """
        s = situacao(AGORA, paga(30), AGORA, TESTE_DIAS)
        assert s.status == "ativa"

    def test_o_teste_nao_e_somado_ao_periodo_pago(self):
        """Vale a data mais distante, não a soma — sete dias de brinde não existem."""
        s = situacao(AGORA, paga(30), AGORA, TESTE_DIAS)
        assert s.expira_em == AGORA + timedelta(days=30)

    def test_teste_mais_longo_que_a_compra_prevalece(self):
        """
        Quem assina um plano curto no primeiro dia não perde o resto do teste.
        A data mais distante ganha, e aqui ela é a do teste.
        """
        s = situacao(AGORA, paga(2), AGORA, TESTE_DIAS)
        assert s.expira_em == AGORA + timedelta(days=7)
        assert s.pode_escrever

    def test_cancelada_mas_paga_continua_escrevendo(self):
        """
        Cancelar desliga a RENOVAÇÃO; o período já pago continua valendo.
        Confundir os dois cobraria de novo alguém que já pagou até o dia 30.
        """
        s = situacao(AGORA - timedelta(days=30), paga(10, renovacao=False), AGORA, TESTE_DIAS)
        assert s.status == "ativa"
        assert s.pode_escrever

    def test_assinatura_vencida_com_teste_vencido_bloqueia(self):
        s = situacao(AGORA - timedelta(days=90), paga(-1), AGORA, TESTE_DIAS)
        assert s.status == "expirada"
        assert not s.pode_escrever

    def test_assinatura_vencida_dentro_do_teste_ainda_escreve(self):
        """
        O teste é o PISO, não a assinatura. Alguém que assinou e deixou vencer
        no terceiro dia de uso ainda tem os quatro dias restantes.
        """
        s = situacao(AGORA - timedelta(days=3), paga(-1), AGORA, TESTE_DIAS)
        assert s.status == "em_teste"
        assert s.pode_escrever


class TestFusoHorario:
    def test_data_ingenua_e_tratada_como_utc(self):
        """
        O SQLite devolve data sem fuso e o Postgres devolve com. Sem a
        normalização, a primeira comparação levantaria TypeError no meio de uma
        decisão de cobrança — e só no dialeto que ninguém rodou.
        """
        ingenua = datetime(2026, 8, 7, 12, 0)
        s = situacao(ingenua, None, AGORA, TESTE_DIAS)
        assert s.status == "em_teste"
