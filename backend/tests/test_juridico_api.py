from juridico import FONTES

"""
O corpus e as trilhas atravessando a API (M14).

O QUE ESTA SUÍTE PROTEGE: que a tela consiga resolver TODO id que recebe. Um
achado citando id que `GET /v1/juridico/fontes` não devolve produziria o pior
resultado possível deste M14 — o disclosure "como calculamos" abrindo vazio,
exatamente na tela em que o produto está prestando contas de um número.
"""


NOVA_DIVIDA = {
    "credor": "Banco X",
    "valorCobrado": 500_000,
    "dataOrigem": "2023-01-10",
    "tipo": "consumo",
}


def _ids_servidos(client, auth) -> set[str]:
    r = client.get("/v1/juridico/fontes", headers=auth)
    assert r.status_code == 200, r.text
    return {f["id"] for f in r.json()["fontes"]}


class TestRotaDeFontes:
    def test_devolve_o_corpus_inteiro_numa_requisicao(self, client, auth):
        # Inteiro e de uma vez: ele é pequeno e estático, e buscar uma norma por
        # vez faria cada disclosure aberto custar uma ida à rede.
        assert _ids_servidos(client, auth) == set(FONTES)

    def test_toda_fonte_chega_com_ementa_vigencia_e_link(self, client, auth):
        for f in client.get("/v1/juridico/fontes", headers=auth).json()["fontes"]:
            assert f["ementa"]
            assert f["vigencia"]
            assert f["url"].startswith("https://")
            # `texto` é o dispositivo LITERAL e pode ser nulo — nulo significa
            # "leia na fonte", nunca "não existe".
            assert "texto" in f

    def test_exige_sessao(self, client):
        # Não há nada de pessoal aqui, e ainda assim: abrir a única rota de
        # leitura fora da trava para economizar um header é como a exceção
        # seguinte é justificada.
        assert client.get("/v1/juridico/fontes").status_code == 401

    def test_a_ordem_e_estavel(self, client, auth):
        primeira = [f["id"] for f in client.get("/v1/juridico/fontes", headers=auth).json()["fontes"]]
        segunda = [f["id"] for f in client.get("/v1/juridico/fontes", headers=auth).json()["fontes"]]
        assert primeira == segunda


class TestTrilhaNaRevisao:
    def _criar(self, client, auth) -> str:
        r = client.post("/v1/dividas", json=NOVA_DIVIDA, headers=auth)
        assert r.status_code == 201, r.text
        return r.json()["divida"]["id"]

    def test_a_trilha_vem_mesmo_sem_achado_nenhum(self, client, auth):
        """
        É JUSTAMENTE AQUI que explicar importa mais: dívida cadastrada à mão não
        tem contrato lido, então não há `valorJusto` — e a pessoa merece saber
        que o número seria uma subtração de achados, não uma estimativa que
        deixamos de fazer.
        """
        divida_id = self._criar(client, auth)
        revisao = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"]

        assert revisao["valorJusto"] is None
        assert revisao["trilha"]["chave"] == "valorJusto"
        assert revisao["trilha"]["limitacoes"]

    def test_a_trilha_nao_carrega_valor(self, client, auth):
        # Ela explica a conta; os números vivem ao lado, uma vez só.
        divida_id = self._criar(client, auth)
        trilha = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "trilha"
        ]
        assert "R$" not in str(trilha)
        assert "500000" not in str(trilha)

    def test_todo_id_da_trilha_e_resolvivel(self, client, auth):
        divida_id = self._criar(client, auth)
        trilha = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "trilha"
        ]
        assert set(trilha["fonteIds"]) <= _ids_servidos(client, auth)

    def test_o_achado_manda_id_e_citacao_legivel(self, client, auth):
        """
        Os dois JUNTOS, e não é redundância: `fonte` é o que app já instalado
        exibe; `fonteIds` é como a tela nova abre a norma. Tirar o primeiro
        quebraria quem não atualizou.
        """
        divida_id = self._criar(client, auth)
        revisao = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"]
        for achado in revisao["achados"]:
            assert achado["fonte"]
            assert achado["fonteIds"]
            assert set(achado["fonteIds"]) <= _ids_servidos(client, auth)


class TestTrilhaNoCaixa:
    def test_as_duas_trilhas_vem_sempre(self, client, auth):
        # Inclusive com `naoFecha` falso: esconder a explicação quando a
        # resposta é boa faria "como calculamos" aparecer só junto de má
        # notícia, e a prestação de contas viraria sinal de alarme.
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        chaves = {t["chave"] for t in caixa["trilhas"]}
        assert chaves == {"capacidadeHoje", "naoFecha"}

    def test_todo_id_das_trilhas_e_resolvivel(self, client, auth):
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        servidos = _ids_servidos(client, auth)
        for t in caixa["trilhas"]:
            assert set(t["fonteIds"]) <= servidos, t["chave"]

    def test_a_trilha_do_nao_fecha_nomeia_a_repactuacao_sem_diagnosticar(self, client, auth):
        # O enquadramento do M7 preservado: a lei é nomeada pela FONTE, e o
        # texto fala de subtração. Nenhuma frase diz o que a pessoa é.
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        trilha = next(t for t in caixa["trilhas"] if t["chave"] == "naoFecha")

        assert "cdc-104a" in trilha["fonteIds"]
        assert "cdc-104c" in trilha["fonteIds"]
        assert "superendivid" not in str(trilha).lower()


class TestNaoFechaNaRota:
    def test_ausente_sem_caixa_preenchido(self, client, auth):
        """
        `None`, e não `False`: sem caixa a conta não tem os dois lados, e
        `False` diria "conferimos e as parcelas cabem". Mesma disciplina de
        `abaixoDoPiso`.
        """
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["naoFecha"] is None

    def test_o_painel_diz_o_mesmo_que_o_caixa(self, client, auth):
        # Duas telas lendo a mesma capacidade. Divergirem aqui significaria a
        # Rota dizendo que cabe e o Caixa dizendo que não.
        client.put("/v1/perfil", json={"rendaMensal": 200_000}, headers=auth)
        client.post(
            "/v1/caixa/gastos",
            json={"nome": "Aluguel", "valor": 150_000, "essencial": True},
            headers=auth,
        )
        client.post(
            "/v1/dividas",
            json={**NOVA_DIVIDA, "taxaJurosMensal": 500, "totalParcelas": 10},
            headers=auth,
        )

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["naoFecha"] == caixa["naoFecha"]

    def test_o_campo_nunca_se_chama_superendividado(self, client, auth):
        # O gêmeo do teste do caixa, agora na Rota.
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert "superendividado" not in str(resumo).lower()
        assert "naoFecha" in resumo
