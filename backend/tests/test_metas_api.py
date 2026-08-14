from datetime import date

"""
Endpoints de `/v1/metas`. A aritmética já é coberta por test_domain_metas.py;
aqui o que se prova é persistência, isolamento por tenant, a tradução para o
contrato e — o principal — que os derivados chegam calculados pelo SERVIDOR.
"""


def _daqui_a_meses(n: int) -> str:
    hoje = date.today()
    total = (hoje.year * 12 + hoje.month - 1) + n
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def _meta(client, auth, **kwargs):
    corpo = {
        "nome": "Reserva de emergência",
        "emoji": "🛟",
        "valorAlvo": 1_340_000,
        "saldo": 536_000,
        "dataAlvo": _daqui_a_meses(12),
        "aporteMensal": 67_000,
    }
    corpo.update(kwargs)
    return client.post("/v1/metas", json=corpo, headers=auth)


class TestCrud:
    def test_lista_vazia_em_conta_nova(self, client, auth):
        assert client.get("/v1/metas", headers=auth).json()["metas"] == []

    def test_cria_e_devolve_a_meta_com_id(self, client, auth):
        r = _meta(client, auth)
        assert r.status_code == 201
        m = r.json()["meta"]
        assert m["id"]
        assert m["nome"] == "Reserva de emergência"
        assert m["emoji"] == "🛟"
        # Centavos inteiros, como toda coluna de dinheiro do produto.
        assert m["valorAlvo"] == 1_340_000
        assert m["saldo"] == 536_000

    def test_lista_na_ordem_de_criacao(self, client, auth):
        _meta(client, auth, nome="Primeira")
        _meta(client, auth, nome="Segunda")
        nomes = [m["nome"] for m in client.get("/v1/metas", headers=auth).json()["metas"]]
        assert nomes == ["Primeira", "Segunda"]

    def test_edita_so_o_que_foi_enviado(self, client, auth):
        meta_id = _meta(client, auth).json()["meta"]["id"]
        r = client.patch(f"/v1/metas/{meta_id}", json={"saldo": 700_000}, headers=auth)
        assert r.status_code == 200
        m = r.json()["meta"]
        assert m["saldo"] == 700_000
        assert m["nome"] == "Reserva de emergência"

    # `null` GRAVA AUSÊNCIA, e é como a pessoa remove o prazo de uma meta. Sem
    # essa distinção entre "campo ausente" e "campo nulo" não haveria desfazer.
    def test_nulo_apaga_o_prazo_e_o_status_desaparece_com_ele(self, client, auth):
        meta_id = _meta(client, auth).json()["meta"]["id"]
        m = client.patch(f"/v1/metas/{meta_id}", json={"dataAlvo": None}, headers=auth).json()["meta"]
        assert m["dataAlvo"] is None
        assert m["aporteSugerido"] is None
        assert m["status"] is None

    def test_exclui_de_verdade(self, client, auth):
        meta_id = _meta(client, auth).json()["meta"]["id"]
        assert client.delete(f"/v1/metas/{meta_id}", headers=auth).status_code == 204
        assert client.get("/v1/metas", headers=auth).json()["metas"] == []

    def test_id_que_nao_existe_e_404(self, client, auth):
        assert client.get("/v1/metas", headers=auth).status_code == 200
        assert client.patch("/v1/metas/nao-existe", json={"saldo": 1}, headers=auth).status_code == 404
        assert client.delete("/v1/metas/nao-existe", headers=auth).status_code == 404


class TestDerivados:
    """
    O QUE A TELA NÃO PODE CALCULAR. `aporteSugerido` e `status` são valores
    monetários e de julgamento derivados: eles vêm do servidor ou não existem
    (ADR 0003). Se um dia estes testes forem apagados porque "o app calcula", a
    regra de ouro do produto foi com eles.
    """

    def test_aporte_sugerido_vem_calculado(self, client, auth):
        m = _meta(client, auth).json()["meta"]
        # Faltam R$ 8.040,00 em 12 meses.
        assert m["aporteSugerido"] == 67_000

    def test_aporte_que_cobre_a_sugestao_vira_em_dia(self, client, auth):
        m = _meta(client, auth, aporteMensal=80_000).json()["meta"]
        assert m["status"] == "em_dia"

    def test_aporte_curto_vira_aporte_baixo(self, client, auth):
        m = _meta(client, auth, aporteMensal=10_000).json()["meta"]
        assert m["status"] == "aporte_baixo"

    def test_saldo_no_alvo_vira_atingida(self, client, auth):
        m = _meta(client, auth, saldo=1_340_000).json()["meta"]
        assert m["status"] == "atingida"
        assert m["aporteSugerido"] == 0

    # Meta sem prazo é meta legítima — "quero trocar de carro, um dia". Sem prazo
    # a tela não mostra pill, em vez de mostrar palpite.
    def test_meta_sem_prazo_nao_ganha_sugestao_nem_status(self, client, auth):
        m = _meta(client, auth, dataAlvo=None, aporteMensal=None).json()["meta"]
        assert m["aporteSugerido"] is None
        assert m["status"] is None

    def test_meta_com_prazo_mas_sem_aporte_declarado_tem_sugestao_e_nao_tem_status(
        self, client, auth
    ):
        m = _meta(client, auth, aporteMensal=None).json()["meta"]
        assert m["aporteSugerido"] == 67_000
        assert m["status"] is None


class TestIsolamento:
    def test_meta_de_um_tenant_nao_aparece_no_outro(self, client, auth):
        meta_id = _meta(client, auth).json()["meta"]["id"]

        # Pela ROTA, como a fixture `auth` faz: semear a tabela deixaria passar
        # divergência entre o tenant que o registro produz e o que o teste usa.
        outro = client.post(
            "/v1/auth/registro",
            json={"email": "outra@exemplo.com", "senha": "senha-bem-boa-2"},
        )
        assert outro.status_code == 201, outro.text
        cabecalho = {"Authorization": f"Bearer {outro.json()['sessao']['acesso']}"}

        assert client.get("/v1/metas", headers=cabecalho).json()["metas"] == []
        # 404 e não 403: um 403 confirmaria que o id existe em outro tenant.
        assert client.patch(f"/v1/metas/{meta_id}", json={"saldo": 1}, headers=cabecalho).status_code == 404
        assert client.delete(f"/v1/metas/{meta_id}", headers=cabecalho).status_code == 404


class TestValidacao:
    def test_alvo_precisa_ser_positivo(self, client, auth):
        assert _meta(client, auth, valorAlvo=0).status_code == 422

    def test_prazo_fora_do_formato_de_mes_e_recusado(self, client, auth):
        assert _meta(client, auth, dataAlvo="2027-13").status_code == 422
        assert _meta(client, auth, dataAlvo="agosto").status_code == 422

    def test_exige_autenticacao(self, client):
        assert client.get("/v1/metas").status_code in (401, 403)
