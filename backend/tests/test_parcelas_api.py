from datetime import date, datetime, timedelta, timezone

from sqlalchemy import event

import orm
from config import get_settings

HOJE = date.today()


def _nova(**over):
    base = {
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000,
        "dataOrigem": "2021-06-01",
        "tipo": "juros_abusivos",
    }
    base.update(over)
    return base


def _com_carne(client, auth, **over):
    corpo = _nova(totalParcelas=7, primeiroVencimento=str(HOJE + timedelta(days=10)), **over)
    return client.post("/v1/dividas", json=corpo, headers=auth).json()["divida"]


def _extracao(sessao, tenant_id=None, status="concluida"):
    """Cria uma `orm.Extracao` direto pela sessão de teste (padrão de F-019)."""
    e = orm.Extracao(tenant_id=tenant_id or get_settings().tenant_id, status=status)
    sessao.add(e)
    sessao.commit()
    return e


class TestGeracaoNoCadastro:
    def test_sem_parcelas_nao_gera_carne(self, client, auth):
        d = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"] == []

    def test_gera_o_carne_completo(self, client, auth):
        d = _com_carne(client, auth)
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert len(parcelas) == 7
        assert [p["numero"] for p in parcelas] == [1, 2, 3, 4, 5, 6, 7]

    def test_soma_das_parcelas_bate_com_a_divida(self, client, auth):
        d = _com_carne(client, auth)
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert sum(p["valor"] for p in parcelas) == 150000

    def test_so_numero_de_parcelas_e_rejeitado(self, client, auth):
        r = client.post("/v1/dividas", json=_nova(totalParcelas=7), headers=auth)
        assert r.status_code == 422
        assert r.json()["campo"] == "primeiroVencimento"

    def test_so_data_e_rejeitada(self, client, auth):
        r = client.post("/v1/dividas", json=_nova(primeiroVencimento="2026-09-10"), headers=auth)
        assert r.status_code == 422
        assert r.json()["campo"] == "totalParcelas"

    def test_parcelas_de_outra_divida_nao_vazam(self, client, auth):
        a = _com_carne(client, auth)
        b = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert len(client.get(f"/v1/dividas/{a['id']}/parcelas", headers=auth).json()["parcelas"]) == 7
        assert client.get(f"/v1/dividas/{b['id']}/parcelas", headers=auth).json()["parcelas"] == []


class TestPagamento:
    def test_marca_como_paga(self, client, auth):
        d = _com_carne(client, auth)
        p = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"][0]
        r = client.post(
            f"/v1/parcelas/{p['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
            headers=auth,
        )
        assert r.status_code == 200
        assert r.json()["parcela"]["situacao"] == "paga"

    def test_pagar_duas_vezes_devolve_409(self, client, auth):
        d = _com_carne(client, auth)
        p = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"][0]
        corpo = {"pagoEm": str(HOJE), "valorPago": p["valor"]}
        client.post(f"/v1/parcelas/{p['id']}/pagamento", json=corpo, headers=auth)
        r = client.post(f"/v1/parcelas/{p['id']}/pagamento", json=corpo, headers=auth)
        assert r.status_code == 409

    def test_parcela_inexistente_devolve_404(self, client, auth):
        r = client.post(
            "/v1/parcelas/00000000-0000-0000-0000-000000000999/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": 1000},
            headers=auth,
        )
        assert r.status_code == 404

    def test_pagar_a_ultima_quita_a_divida(self, client, auth):
        # O usuário não deveria precisar marcar duas coisas para dizer o mesmo.
        d = client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=2, primeiroVencimento=str(HOJE + timedelta(days=10))),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        for p in parcelas[:-1]:
            client.post(
                f"/v1/parcelas/{p['id']}/pagamento",
                json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
                headers=auth,
            )
        assert client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]["situacao"] == "ativa"

        ultima = parcelas[-1]
        client.post(
            f"/v1/parcelas/{ultima['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": ultima["valor"]},
            headers=auth,
        )
        assert (
            client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]["situacao"]
            == "quitada"
        )

    def test_parcela_vencida_aparece_como_atrasada(self, client, auth):
        d = client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=2, primeiroVencimento=str(HOJE - timedelta(days=40))),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert parcelas[0]["situacao"] == "atrasada"


class TestAjustaParcelasAoMudarValorCobrado:
    """
    Limitação 22: mudar `valorCobrado` numa dívida com carnê deixava as parcelas com
    o total antigo (limitação 22 do inventário). Cobre os dois caminhos que
    mudam o valor sem regenerar o cronograma: PATCH e a ligação de documento.
    """

    def test_patch_sobe_o_valor_redistribui_as_pendentes(self, client, auth):
        d = _com_carne(client, auth, valorCobrado=150000)
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        r = client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 210000}, headers=auth)
        assert r.status_code == 200
        assert r.json()["divida"]["valorCobrado"] == 210000

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert sum(p["valor"] for p in depois) == 210000
        assert [p["id"] for p in depois] == [p["id"] for p in antes]
        assert [p["numero"] for p in depois] == [p["numero"] for p in antes]
        assert [p["vencimento"] for p in depois] == [p["vencimento"] for p in antes]

    def test_patch_desce_o_valor_ainda_acima_do_ja_pago(self, client, auth):
        d = _com_carne(client, auth, valorCobrado=150000)

        r = client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 90000}, headers=auth)
        assert r.status_code == 200

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert sum(p["valor"] for p in depois) == 90000

    def test_com_parcela_paga_a_paga_fica_intacta_e_so_as_pendentes_mudam(self, client, auth):
        d = _com_carne(client, auth, valorCobrado=150000)
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        primeira = antes[0]

        pagamento = client.post(
            f"/v1/parcelas/{primeira['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": primeira["valor"]},
            headers=auth,
        ).json()["parcela"]

        r = client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 210000}, headers=auth)
        assert r.status_code == 200

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        paga = next(p for p in depois if p["id"] == primeira["id"])
        pendentes = [p for p in depois if p["id"] != primeira["id"]]

        # A paga é byte a byte igual — o ajuste não a toca.
        assert paga["valor"] == pagamento["valor"]
        assert paga["pagoEm"] == pagamento["pagoEm"]
        assert paga["valorPago"] == pagamento["valorPago"]

        # 6 pendentes somam o novo total menos o que já saiu do bolso da pessoa.
        assert sum(p["valor"] for p in pendentes) == 210000 - pagamento["valorPago"]
        assert sum(p["valor"] for p in depois) == 210000

    def test_valor_abaixo_do_ja_pago_devolve_409_e_nada_muda(self, client, auth):
        d = _com_carne(client, auth, valorCobrado=150000)
        antes_parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        primeira = antes_parcelas[0]

        client.post(
            f"/v1/parcelas/{primeira['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": primeira["valor"]},
            headers=auth,
        )
        antes_divida = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        antes_parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        r = client.patch(
            f"/v1/dividas/{d['id']}", json={"valorCobrado": primeira["valor"] - 1}, headers=auth
        )
        assert r.status_code == 409
        assert r.json()["message"] == (
            "O valor novo é menor do que já foi pago nesta dívida. Confira o valor — "
            "ou, se o acordo mudou, registre a renegociação."
        )

        depois_divida = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        depois_parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert depois_divida == antes_divida
        assert depois_parcelas == antes_parcelas

    def test_carne_inteiro_pago_patch_passa_sem_mudar_parcelas(self, client, auth):
        d = client.post(
            "/v1/dividas",
            json=_nova(
                valorCobrado=20000, totalParcelas=2, primeiroVencimento=str(HOJE + timedelta(days=10))
            ),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        for p in parcelas:
            client.post(
                f"/v1/parcelas/{p['id']}/pagamento",
                json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
                headers=auth,
            )
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        r = client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 30000}, headers=auth)
        assert r.status_code == 200

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert depois == antes

    def test_divida_sem_carne_patch_passa_sem_erro(self, client, auth):
        d = client.post("/v1/dividas", json=_nova(valorCobrado=100000), headers=auth).json()["divida"]

        r = client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 130000}, headers=auth)
        assert r.status_code == 200
        assert r.json()["divida"]["valorCobrado"] == 130000
        assert client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"] == []

    def test_patch_que_nao_mexe_no_valor_nao_toca_parcelas(self, client, auth):
        d = _com_carne(client, auth, valorCobrado=150000)
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        r = client.patch(f"/v1/dividas/{d['id']}", json={"credor": "Banco Novo"}, headers=auth)
        assert r.status_code == 200

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert depois == antes

    def test_ligar_documento_com_valor_cobrado_ajusta_igual_ao_patch(self, client, auth, sessao):
        d = _com_carne(client, auth, valorCobrado=150000)
        extracao = _extracao(sessao)

        r = client.post(
            f"/v1/dividas/{d['id']}/documento",
            json={"extracaoId": extracao.id, "campos": {"valorCobrado": 210000}},
            headers=auth,
        )
        assert r.status_code == 200
        assert r.json()["divida"]["valorCobrado"] == 210000

        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert sum(p["valor"] for p in parcelas) == 210000

    def test_parcela_cancelada_nao_entra_no_ja_pago_nem_e_alterada(self, client, auth, sessao):
        d = client.post(
            "/v1/dividas",
            json=_nova(
                valorCobrado=120000,
                totalParcelas=4,
                primeiroVencimento=str(HOJE + timedelta(days=10)),
            ),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        primeira = parcelas[0]

        # Paga a primeira e depois a cancela diretamente (combinação que não
        # existe em nenhum fluxo real do produto): é o jeito de provar que a
        # soma do "já pago" filtra `cancelada_em`, mesmo com `paga_em`
        # preenchido — não só que uma parcela nunca-paga é ignorada.
        client.post(
            f"/v1/parcelas/{primeira['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": primeira["valor"]},
            headers=auth,
        )
        linha = sessao.get(orm.Parcela, primeira["id"])
        linha.cancelada_em = datetime.now(timezone.utc)
        valor_antes = linha.valor
        sessao.commit()

        r = client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 90000}, headers=auth)
        assert r.status_code == 200

        sessao.refresh(linha)
        assert linha.valor == valor_antes

        restantes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        # A cancelada não aparece na listagem, e as 3 restantes somam o novo
        # total INTEIRO — a cancelada-e-paga não contou como "já pago".
        assert len(restantes) == 3
        assert sum(p["valor"] for p in restantes) == 90000


class TestRenegociacao:
    def test_preserva_as_parcelas_pagas_e_gera_novas(self, client, auth):
        d = _com_carne(client, auth)
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        client.post(
            f"/v1/parcelas/{antes[0]['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": antes[0]["valor"]},
            headers=auth,
        )

        r = client.post(
            f"/v1/dividas/{d['id']}/renegociacao",
            json={
                "novoValor": 90000,
                "novoTotalParcelas": 3,
                "primeiroVencimento": str(HOJE + timedelta(days=30)),
                "observacao": "Acordo por telefone",
            },
            headers=auth,
        )
        assert r.status_code == 200
        assert r.json()["divida"]["situacao"] == "renegociada"

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        # A paga continua; as pendentes viraram 3 novas.
        pagas = [p for p in depois if p["situacao"] == "paga"]
        novas = [p for p in depois if p["situacao"] != "paga"]
        assert len(pagas) == 1
        assert len(novas) == 3
        assert sum(p["valor"] for p in novas) == 90000

    def test_resposta_da_renegociacao_concorda_com_o_get_seguinte(self, client, auth):
        """
        A rota devolvia `parcelasPagas` da coluna que ninguém escreve (sempre
        `None`) enquanto o `GET` seguinte já devolvia o número derivado — a mesma
        dívida respondendo duas coisas com segundos de diferença. É o tipo de
        divergência que vira "apareceu 0 e depois 1" no relato de quem usa.
        """
        d = _com_carne(client, auth)
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        client.post(
            f"/v1/parcelas/{antes[0]['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": antes[0]["valor"]},
            headers=auth,
        )

        da_renegociacao = client.post(
            f"/v1/dividas/{d['id']}/renegociacao",
            json={
                "novoValor": 90000,
                "novoTotalParcelas": 3,
                "primeiroVencimento": str(HOJE + timedelta(days=30)),
                "observacao": "Acordo por telefone",
            },
            headers=auth,
        ).json()["divida"]

        do_get = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]

        assert da_renegociacao["parcelasPagas"] == do_get["parcelasPagas"] == 1
        assert da_renegociacao["proximoVencimento"] == do_get["proximoVencimento"]
        assert da_renegociacao["proximoVencimento"] == str(HOJE + timedelta(days=30))

    def test_atualiza_o_valor_da_divida(self, client, auth):
        d = _com_carne(client, auth)
        client.post(
            f"/v1/dividas/{d['id']}/renegociacao",
            json={
                "novoValor": 90000,
                "novoTotalParcelas": 3,
                "primeiroVencimento": str(HOJE + timedelta(days=30)),
            },
            headers=auth,
        )
        assert (
            client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]["valorCobrado"]
            == 90000
        )


class TestParcelasPagasEProximoVencimentoDerivados:
    """
    Fecha as limitações 24 e 25 do inventário: `divida.parcelas_pagas` nunca
    era escrito pela rota de pagamento e `divida.proximo_vencimento` não
    avançava quando uma parcela era paga. `parcelasPagas` e
    `proximoVencimento` passam a ser derivados da lista real de `orm.Parcela`
    em vez de lidos das colunas resquício.
    """

    def test_parcelas_pagas_reflete_pagamentos_parciais_no_get_e_na_lista(self, client, auth):
        d = _com_carne(client, auth)  # 7 parcelas
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        for p in parcelas[:3]:
            client.post(
                f"/v1/parcelas/{p['id']}/pagamento",
                json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
                headers=auth,
            )

        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert obtido["parcelasPagas"] == 3

        listado = next(
            x for x in client.get("/v1/dividas", headers=auth).json()["dividas"] if x["id"] == d["id"]
        )
        assert listado["parcelasPagas"] == 3

    def test_parcelas_pagas_zero_quando_nenhuma_paga(self, client, auth):
        d = _com_carne(client, auth)
        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert obtido["parcelasPagas"] == 0

    def test_divida_sem_carne_parcelas_pagas_e_proximo_vencimento_continuam_none(self, client, auth):
        d = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert d["parcelasPagas"] is None
        assert d["proximoVencimento"] is None

        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert obtido["parcelasPagas"] is None
        assert obtido["proximoVencimento"] is None

    def test_proximo_vencimento_avanca_quando_a_primeira_e_paga(self, client, auth):
        d = _com_carne(client, auth)
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        antes = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert antes["proximoVencimento"] == parcelas[0]["vencimento"]

        client.post(
            f"/v1/parcelas/{parcelas[0]['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": parcelas[0]["valor"]},
            headers=auth,
        )

        depois = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert depois["proximoVencimento"] == parcelas[1]["vencimento"]

    def test_carne_inteiro_pago_proximo_vencimento_e_none(self, client, auth):
        d = client.post(
            "/v1/dividas",
            json=_nova(
                valorCobrado=20000, totalParcelas=2, primeiroVencimento=str(HOJE + timedelta(days=10))
            ),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        for p in parcelas:
            client.post(
                f"/v1/parcelas/{p['id']}/pagamento",
                json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
                headers=auth,
            )

        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert obtido["proximoVencimento"] is None

    def test_regressao_limitacao_24_carne_inteiro_pago_nao_mostra_zero(self, client, auth):
        """
        Regressão nomeada da limitação 24: a tela de detalhe mostrava
        "0 de N pagas" mesmo com o carnê inteiro quitado, porque
        `parcelas_pagas` nunca era escrito. `parcelasPagas` tem de bater com
        `totalParcelas`, não com zero.
        """
        d = client.post(
            "/v1/dividas",
            json=_nova(
                valorCobrado=30000, totalParcelas=3, primeiroVencimento=str(HOJE + timedelta(days=10))
            ),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        for p in parcelas:
            client.post(
                f"/v1/parcelas/{p['id']}/pagamento",
                json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
                headers=auth,
            )

        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert obtido["totalParcelas"] == 3
        assert obtido["parcelasPagas"] == 3
        assert obtido["parcelasPagas"] != 0

    def test_parcela_cancelada_nao_conta_em_nada(self, client, auth, sessao):
        d = client.post(
            "/v1/dividas",
            json=_nova(
                valorCobrado=120000,
                totalParcelas=4,
                primeiroVencimento=str(HOJE + timedelta(days=10)),
            ),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        primeira = parcelas[0]

        client.post(
            f"/v1/parcelas/{primeira['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": primeira["valor"]},
            headers=auth,
        )
        linha = sessao.get(orm.Parcela, primeira["id"])
        linha.cancelada_em = datetime.now(timezone.utc)
        sessao.commit()

        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        # A cancelada-e-paga não conta como paga...
        assert obtido["parcelasPagas"] == 0
        # ...nem interfere no próximo vencimento, que segue vindo das 3
        # pendentes restantes.
        pendentes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert len(pendentes) == 3
        assert obtido["proximoVencimento"] == min(p["vencimento"] for p in pendentes)

    def test_parcela_de_outro_tenant_nao_entra_na_conta(self, client, auth, sessao):
        d = _com_carne(client, auth)

        # Semeia uma parcela de outro tenant com o MESMO divida_id — cenário
        # que não ocorre no produto real, mas é o jeito direto de provar que
        # quem impede a fuga é o filtro por tenant_id na query do agregado, e
        # não a ausência de dado com o id certo.
        sessao.add(
            orm.Parcela(
                tenant_id="outro-tenant-que-nao-existe",
                divida_id=d["id"],
                numero=1,
                total=1,
                valor=100,
                vencimento=HOJE,
                paga_em=HOJE,
            )
        )
        sessao.commit()

        obtido = client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]
        assert obtido["parcelasPagas"] == 0


class TestListagemNaoDisparaQueryDeParcelaPorDivida:
    """
    Trava o N+1 que o desenho de `_agregados_de_parcelas` existe para evitar:
    `GET /v1/dividas` tem de continuar buscando as parcelas de TODAS as
    dívidas da página numa query só, não uma por dívida.
    """

    def test_contagem_de_queries_de_parcela_nao_cresce_com_o_numero_de_dividas(
        self, client, auth, engine
    ):
        for _ in range(3):
            _com_carne(client, auth)

        statements: list[str] = []

        def registrar(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(engine, "before_cursor_execute", registrar)
        try:
            r = client.get("/v1/dividas", headers=auth)
        finally:
            event.remove(engine, "before_cursor_execute", registrar)

        assert r.status_code == 200
        assert len(r.json()["dividas"]) == 3

        # "from parcela", não só "parcela": a própria tabela `divida` tem a
        # coluna `parcelas_pagas`, e um filtro que buscasse só a substring
        # "parcela" contaria essa SELECT de `divida` como se fosse do carnê.
        queries_de_parcela = [s for s in statements if "from parcela" in s.lower()]
        assert len(queries_de_parcela) == 1, (
            "esperava 1 query de parcela para 3 dívidas com carnê (agregado numa "
            f"query só); achou {len(queries_de_parcela)}: {queries_de_parcela}"
        )


class TestLembretes:
    def test_sem_parcelas_nao_ha_lembrete(self, client, auth):
        assert client.get("/v1/lembretes", headers=auth).json()["lembretes"] == []

    def test_parcela_dentro_da_janela_gera_lembrete(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(credor="Nubank", totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=2))),
            headers=auth,
        )
        lembretes = client.get("/v1/lembretes", headers=auth).json()["lembretes"]
        assert len(lembretes) == 1
        # Discrição por padrão (guardrail 4): o texto é genérico e NÃO delata o
        # credor nem o vencimento. O identificador viaja fora do texto.
        assert lembretes[0]["titulo"] == "Você tem um passo hoje"
        assert "Nubank" not in lembretes[0]["titulo"]
        assert lembretes[0]["dividaId"]
        assert lembretes[0]["parcelaId"]

    def test_parcela_fora_da_janela_nao_gera(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=60))),
            headers=auth,
        )
        assert client.get("/v1/lembretes", headers=auth).json()["lembretes"] == []

    def test_parcela_paga_nao_gera_lembrete(self, client, auth):
        d = client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=2))),
            headers=auth,
        ).json()["divida"]
        p = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"][0]
        client.post(
            f"/v1/parcelas/{p['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
            headers=auth,
        )
        assert client.get("/v1/lembretes", headers=auth).json()["lembretes"] == []

    def test_texto_nao_delata_valor_nem_vencimento(self, client, auth):
        # Antes esta rota mandava "Parcela 3 de 12 — R$ 450,00" / "vence amanhã".
        # Discrição por padrão (guardrail 4): valor e vencimento saem do texto.
        client.post(
            "/v1/dividas",
            json=_nova(valorCobrado=45000, totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=1))),
            headers=auth,
        )
        lembrete = client.get("/v1/lembretes", headers=auth).json()["lembretes"][0]
        texto = lembrete["titulo"] + lembrete["corpo"]
        assert "R$ 450,00" not in texto
        assert "450" not in texto
        assert "vence" not in texto
        assert "amanhã" not in texto

    def test_tom_neutro_sem_linguagem_de_cobranca(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=1))),
            headers=auth,
        )
        lembrete = client.get("/v1/lembretes", headers=auth).json()["lembretes"][0]
        texto = (lembrete["titulo"] + lembrete["corpo"]).lower()
        for proibido in ("atenção", "urgente", "atraso", "!", "pendência", "regularize"):
            assert proibido not in texto

    def test_notificacao_nao_delata_credor_valor_nem_divida(self, client, auth):
        # Teste-gêmeo de discrição (guardrail 4, seção 4). Planta credor e valor
        # REAIS e prova que nenhum dos dois — nem a palavra "dívida" — aparece no
        # texto visível da notificação. A tela de bloqueio é pública; delatar o
        # credor de quem está ao lado é o modo de falha que esta regra proíbe.
        # O identificador continua no payload de dados, para o deep link do card.
        client.post(
            "/v1/dividas",
            json=_nova(
                credor="Nubank",
                valorCobrado=45000,
                totalParcelas=12,
                primeiroVencimento=str(HOJE + timedelta(days=1)),
            ),
            headers=auth,
        )
        lembrete = client.get("/v1/lembretes", headers=auth).json()["lembretes"][0]
        texto = (lembrete["titulo"] + " " + lembrete["corpo"]).lower()
        for delator in ("nubank", "dívida", "divida", "r$", "450", "parcela", "vence", "vencimento"):
            assert delator not in texto, f"notificação delatou {delator!r}: {texto!r}"
        # O identificador sobrevive fora do texto, para o deep link não quebrar.
        assert lembrete["dividaId"]
        assert lembrete["parcelaId"]

    def test_devolve_a_hora_configurada(self, client, auth):
        client.put("/v1/perfil", json={"horaLembrete": "20:30"}, headers=auth)
        assert client.get("/v1/lembretes", headers=auth).json()["horaLembrete"] == "20:30"


class TestResumoComParcelas:
    def test_proximos_vencimentos_deixa_de_ser_vazio(self, client, auth):
        _com_carne(client, auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert len(resumo["proximosVencimentos"]) > 0
        assert resumo["proximosVencimentos"][0]["credor"] == "Banco Teste S/A"

    def test_comprometimento_usa_parcelas_reais(self, client, auth):
        client.put("/v1/perfil", json={"rendaMensal": 500000}, headers=auth)
        primeiro = HOJE.replace(day=1)
        client.post(
            "/v1/dividas",
            json=_nova(valorCobrado=100000, totalParcelas=10, primeiroVencimento=str(primeiro)),
            headers=auth,
        )
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        # Uma parcela de R$ 100,00 sobre renda de R$ 5.000,00 = 2%.
        assert resumo["comprometimentoRenda"] == 200
