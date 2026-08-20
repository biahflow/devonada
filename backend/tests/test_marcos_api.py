from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

import orm
from config import get_settings
from domain.marcos import TIPOS
from routers.marcos import registrar_marcos

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


def _mes(deslocamento: int = 0) -> str:
    """`YYYY-MM` de hoje deslocado `deslocamento` meses (negativo = passado)."""
    ano, mes = HOJE.year, HOJE.month
    total = (ano * 12 + (mes - 1)) + deslocamento
    ano, mes = divmod(total, 12)
    return f"{ano}-{mes + 1:02d}"


def _semear_saldo_snapshot(sessao, mes: str, saldo: int) -> None:
    """
    Um mês PASSADO em `saldo_snapshot`, que a rota nunca escreve sozinha.

    É o que faz `rotaPercorridaBps` existir: sem mês anterior ele é `None`, e
    `None` não cruza limiar nenhum.
    """
    sessao.add(orm.SaldoSnapshot(tenant_id=get_settings().tenant_id, mes=mes, saldo=saldo))
    sessao.commit()


def _marcos(client, auth) -> dict[str, dict]:
    r = client.get("/v1/marcos", headers=auth)
    assert r.status_code == 200, r.text
    return {m["tipo"]: m for m in r.json()["marcos"]}


def _linhas(sessao, tipo: str) -> list[orm.Marco]:
    """As linhas cruas da tabela — é assim que se prova que não houve duplicata."""
    sessao.expire_all()
    return [
        m
        for m in sessao.query(orm.Marco)
        .filter(orm.Marco.tenant_id == get_settings().tenant_id, orm.Marco.tipo == tipo)
        .all()
    ]


def _rota_em(client, auth, sessao, saldo_base: int, divida: int) -> dict:
    """
    Deixa a rota percorrida acima de um limiar e devolve o resumo.

    `saldo_base` vira o mês anterior; `divida` é o que ainda se deve hoje.
    """
    _semear_saldo_snapshot(sessao, _mes(-1), saldo_base)
    assert (
        client.post("/v1/dividas", json=_nova(valorCobrado=divida), headers=auth).status_code == 201
    )
    r = client.get("/v1/dividas/resumo", headers=auth)
    assert r.status_code == 200, r.text
    return r.json()["resumo"]


class TestListagem:
    def test_tenant_novo_recebe_os_cinco_tipos_com_os_dois_campos_nulos(self, client, auth):
        # T4-AC1. Os cinco SEMPRE: a ausência é dita com nulo, não omitida. A
        # tela precisa saber que o marco existe e ainda não foi alcançado.
        marcos = client.get("/v1/marcos", headers=auth).json()["marcos"]
        assert [m["tipo"] for m in marcos] == list(TIPOS)
        assert all(m["atingidoEm"] is None and m["celebradoEm"] is None for m in marcos)

    def test_leituras_repetidas_devolvem_a_mesma_lista(self, client, auth):
        # A rota é lida a cada abertura do app. Ela não grava nada, e por isso
        # a segunda resposta é idêntica à primeira.
        primeira = client.get("/v1/marcos", headers=auth).json()
        segunda = client.get("/v1/marcos", headers=auth).json()
        assert primeira == segunda

    def test_marco_de_um_tenant_nao_aparece_para_outro(self, client, auth):
        # Guardrail de isolamento: conquista é dado do usuário como qualquer
        # outro, e a query filtra por tenant.
        client.post("/v1/dividas", json=_nova(), headers=auth)
        divida = client.get("/v1/dividas", headers=auth).json()["dividas"][0]
        client.post(
            f"/v1/dividas/{divida['id']}/quitacao",
            json={"dataQuitacao": HOJE.isoformat(), "valorPago": 150000},
            headers=auth,
        )
        assert _marcos(client, auth)["primeira_quitacao"]["atingidoEm"] is not None

        outra = client.post(
            "/v1/auth/registro", json={"email": "vizinha@exemplo.com", "senha": "senha-de-teste"}
        )
        assert outra.status_code == 201, outra.text
        vizinha = {"Authorization": f"Bearer {outra.json()['sessao']['acesso']}"}
        assert all(m["atingidoEm"] is None for m in _marcos(client, vizinha).values())


class TestAtingimentoPelaRota:
    def test_cruzar_25_por_cento_grava_o_marco(self, client, auth, sessao):
        resumo = _rota_em(client, auth, sessao, saldo_base=100000, divida=70000)
        assert resumo["rotaPercorridaBps"] == 3000

        marcos = _marcos(client, auth)
        assert marcos["rota_25"]["atingidoEm"] == HOJE.isoformat()
        assert marcos["rota_50"]["atingidoEm"] is None
        assert marcos["rota_75"]["atingidoEm"] is None

    def test_abaixo_do_limiar_nao_grava_nada(self, client, auth, sessao):
        resumo = _rota_em(client, auth, sessao, saldo_base=100000, divida=80000)
        assert resumo["rotaPercorridaBps"] == 2000
        assert all(m["atingidoEm"] is None for m in _marcos(client, auth).values())

    def test_sem_historico_nao_grava_marco(self, client, auth):
        # `rotaPercorridaBps` é `None` para quem não tem mês anterior, e `None`
        # não cruza limiar nenhum — nem o de 25% lido como zero.
        client.post("/v1/dividas", json=_nova(valorCobrado=70000), headers=auth)
        assert client.get("/v1/dividas/resumo", headers=auth).json()["resumo"][
            "rotaPercorridaBps"
        ] is None
        assert all(m["atingidoEm"] is None for m in _marcos(client, auth).values())

    def test_salto_grande_grava_os_limiares_intermediarios(self, client, auth, sessao):
        # Quem quita 80% de uma vez passou por 25%, 50% e 75% no mesmo instante.
        # Engolir os dois primeiros seria perder conquista por ter andado rápido.
        resumo = _rota_em(client, auth, sessao, saldo_base=100000, divida=20000)
        assert resumo["rotaPercorridaBps"] == 8000
        marcos = _marcos(client, auth)
        assert all(marcos[t]["atingidoEm"] == HOJE.isoformat() for t in ("rota_25", "rota_50", "rota_75"))

    def test_tres_leituras_seguidas_gravam_uma_linha_so(self, client, auth, sessao):
        # T4-AC2, e a lição que T3 deixou: critério que exercita o endpoint UMA
        # VEZ não prova estabilidade. O marco é gravado DURANTE um GET, e o app
        # abre a tela várias vezes por dia — sem idempotência isso viraria uma
        # conquista por leitura, num banco que não tem UNIQUE em (tenant, tipo).
        _rota_em(client, auth, sessao, saldo_base=100000, divida=70000)
        antes = _linhas(sessao, "rota_25")
        assert len(antes) == 1
        id_original, data_original = antes[0].id, antes[0].atingido_em

        for _ in range(3):
            assert client.get("/v1/dividas/resumo", headers=auth).status_code == 200

        depois = _linhas(sessao, "rota_25")
        assert len(depois) == 1
        assert depois[0].id == id_original
        assert depois[0].atingido_em == data_original


class TestAtingimentoPorEvento:
    def test_quitar_a_divida_grava_primeira_quitacao(self, client, auth):
        client.post("/v1/dividas", json=_nova(), headers=auth)
        divida = client.get("/v1/dividas", headers=auth).json()["dividas"][0]
        r = client.post(
            f"/v1/dividas/{divida['id']}/quitacao",
            json={"dataQuitacao": HOJE.isoformat(), "valorPago": 150000},
            headers=auth,
        )
        assert r.status_code == 200, r.text
        assert _marcos(client, auth)["primeira_quitacao"]["atingidoEm"] == HOJE.isoformat()

    def test_pagar_a_ultima_parcela_grava_primeira_quitacao(self, client, auth):
        # O OUTRO caminho de quitação. A detecção em dois lugares é preexistente
        # e não é alvo desta tarefa; o que ela não pode produzir é conquista
        # duplicada.
        client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=HOJE.isoformat()),
            headers=auth,
        )
        divida = client.get("/v1/dividas", headers=auth).json()["dividas"][0]
        parcela = client.get(f"/v1/dividas/{divida['id']}/parcelas", headers=auth).json()[
            "parcelas"
        ][0]
        r = client.post(
            f"/v1/parcelas/{parcela['id']}/pagamento",
            json={"pagoEm": HOJE.isoformat(), "valorPago": 150000},
            headers=auth,
        )
        assert r.status_code == 200, r.text
        assert _marcos(client, auth)["primeira_quitacao"]["atingidoEm"] == HOJE.isoformat()

    def test_os_dois_caminhos_de_quitacao_gravam_um_marco_so(self, client, auth, sessao):
        # T4-AC2 no caso mais perigoso: a segunda dívida quitada, por outro
        # caminho de código, não produz uma segunda "primeira quitação".
        client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=HOJE.isoformat()),
            headers=auth,
        )
        primeira = client.get("/v1/dividas", headers=auth).json()["dividas"][0]
        parcela = client.get(f"/v1/dividas/{primeira['id']}/parcelas", headers=auth).json()[
            "parcelas"
        ][0]
        client.post(
            f"/v1/parcelas/{parcela['id']}/pagamento",
            json={"pagoEm": HOJE.isoformat(), "valorPago": 150000},
            headers=auth,
        )
        id_original = _linhas(sessao, "primeira_quitacao")[0].id

        client.post("/v1/dividas", json=_nova(credor="Outro Banco"), headers=auth)
        segunda = next(
            d
            for d in client.get("/v1/dividas", headers=auth).json()["dividas"]
            if d["credor"] == "Outro Banco"
        )
        client.post(
            f"/v1/dividas/{segunda['id']}/quitacao",
            json={"dataQuitacao": HOJE.isoformat(), "valorPago": 150000},
            headers=auth,
        )

        linhas = _linhas(sessao, "primeira_quitacao")
        assert len(linhas) == 1
        assert linhas[0].id == id_original

    def test_renegociar_grava_primeira_negociacao_uma_unica_vez(self, client, auth, sessao):
        client.post("/v1/dividas", json=_nova(), headers=auth)
        divida = client.get("/v1/dividas", headers=auth).json()["dividas"][0]
        acordo = {
            "novoValor": 100000,
            "novoTotalParcelas": 10,
            "primeiroVencimento": HOJE.isoformat(),
        }
        assert (
            client.post(
                f"/v1/dividas/{divida['id']}/renegociacao", json=acordo, headers=auth
            ).status_code
            == 200
        )
        primeira = _linhas(sessao, "primeira_negociacao")
        assert len(primeira) == 1

        client.post(f"/v1/dividas/{divida['id']}/renegociacao", json=acordo, headers=auth)
        segunda = _linhas(sessao, "primeira_negociacao")
        assert len(segunda) == 1
        assert segunda[0].id == primeira[0].id
        assert segunda[0].atingido_em == primeira[0].atingido_em


class TestCelebracao:
    def _atingir_rota_25(self, client, auth, sessao) -> None:
        _rota_em(client, auth, sessao, saldo_base=100000, divida=70000)

    def test_marco_atingido_nasce_esperando_a_tela(self, client, auth, sessao):
        # T4-AC3, primeira metade: atingir não celebra.
        self._atingir_rota_25(client, auth, sessao)
        marco = _marcos(client, auth)["rota_25"]
        assert marco["atingidoEm"] is not None
        assert marco["celebradoEm"] is None

    def test_celebracao_preenche_a_data(self, client, auth, sessao):
        # T4-AC3, segunda metade: só o POST move `celebradoEm`.
        self._atingir_rota_25(client, auth, sessao)
        r = client.post("/v1/marcos/rota_25/celebracao", headers=auth)
        assert r.status_code == 204, r.text

        marco = _marcos(client, auth)["rota_25"]
        assert marco["celebradoEm"] == HOJE.isoformat()
        # E não move o atingimento: são dois instantes diferentes.
        assert marco["atingidoEm"] == HOJE.isoformat()

    def test_celebrar_de_novo_nao_move_a_data(self, client, auth, sessao):
        self._atingir_rota_25(client, auth, sessao)
        client.post("/v1/marcos/rota_25/celebracao", headers=auth)
        linha = _linhas(sessao, "rota_25")[0]
        primeira_celebracao = linha.celebrado_em

        assert client.post("/v1/marcos/rota_25/celebracao", headers=auth).status_code == 204
        assert _linhas(sessao, "rota_25")[0].celebrado_em == primeira_celebracao

    def test_ler_o_resumo_depois_nao_desfaz_a_celebracao(self, client, auth, sessao):
        # A tela não pode reaparecer porque alguém abriu o painel de novo.
        self._atingir_rota_25(client, auth, sessao)
        client.post("/v1/marcos/rota_25/celebracao", headers=auth)
        for _ in range(3):
            client.get("/v1/dividas/resumo", headers=auth)
        assert _marcos(client, auth)["rota_25"]["celebradoEm"] == HOJE.isoformat()

    def test_celebrar_tipo_inexistente_devolve_404(self, client, auth):
        r = client.post("/v1/marcos/rota_90/celebracao", headers=auth)
        assert r.status_code == 404
        assert "message" in r.json()

    def test_celebrar_marco_nao_atingido_devolve_404(self, client, auth):
        r = client.post("/v1/marcos/rota_25/celebracao", headers=auth)
        assert r.status_code == 404
        assert _marcos(client, auth)["rota_25"]["celebradoEm"] is None


class TestPeriodoSomenteLeitura:
    def test_marco_atingido_com_assinatura_vencida_nao_se_perde(
        self, client, auth, sessao, assinatura_vencida
    ):
        # T4-AC4. A trava de escrita é derivada do MÉTODO, e o atingimento
        # acontece dentro de um GET — de propósito. Perder um marco porque a
        # assinatura venceu puniria a pessoa pelo que ela já tinha, que é o
        # oposto do que a trava existe para fazer (docstring de assinatura.py).
        _semear_saldo_snapshot(sessao, _mes(-1), 100000)
        assert (
            client.post(
                "/v1/dividas", json=_nova(valorCobrado=70000), headers=auth
            ).status_code
            == 201
        )
        assinatura_vencida()
        assert client.post("/v1/dividas", json=_nova(), headers=auth).status_code == 402

        resumo = client.get("/v1/dividas/resumo", headers=auth)
        assert resumo.status_code == 200
        assert resumo.json()["resumo"]["rotaPercorridaBps"] == 3000

        marco = _marcos(client, auth)["rota_25"]
        assert marco["atingidoEm"] == HOJE.isoformat()
        assert marco["celebradoEm"] is None

    def test_a_trava_bloqueia_a_celebracao_e_o_marco_continua_esperando(
        self, client, auth, sessao, assinatura_vencida
    ):
        # A outra metade da AC4: a celebração É escrita e passa pela trava como
        # qualquer outra. O marco fica com `celebradoEm` nulo e espera a
        # assinatura voltar.
        _semear_saldo_snapshot(sessao, _mes(-1), 100000)
        client.post("/v1/dividas", json=_nova(valorCobrado=70000), headers=auth)
        assinatura_vencida()
        client.get("/v1/dividas/resumo", headers=auth)

        assert client.post("/v1/marcos/rota_25/celebracao", headers=auth).status_code == 402
        marco = _marcos(client, auth)["rota_25"]
        assert marco["atingidoEm"] == HOJE.isoformat()
        assert marco["celebradoEm"] is None


class TestMarcoNaoSeDesfaz:
    def test_divida_nova_nao_desfaz_o_marco(self, client, auth, sessao):
        """
        T4-AC5 — o teste que dá nome à tarefa.

        A porcentagem da rota anda para trás quando a pessoa cadastra uma dívida
        nova. Se o marco fosse predicado sobre o estado atual, ela perderia uma
        conquista por ter sido honesta sobre a própria situação — o modo de
        falha mais cruel desta feature (ADR 0019, item 4; guardrail 4.1).
        """
        resumo = _rota_em(client, auth, sessao, saldo_base=100000, divida=70000)
        assert resumo["rotaPercorridaBps"] == 3000
        atingido_em = _marcos(client, auth)["rota_25"]["atingidoEm"]
        assert atingido_em is not None

        assert (
            client.post(
                "/v1/dividas",
                json=_nova(credor="Dívida que ela acabou de lembrar", valorCobrado=50000),
                headers=auth,
            ).status_code
            == 201
        )

        depois = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert depois["rotaPercorridaBps"] == 0, "a rota precisa ter andado para trás"

        marco = _marcos(client, auth)["rota_25"]
        assert marco["atingidoEm"] == atingido_em
        assert len(_linhas(sessao, "rota_25")) == 1

    def test_quitacao_permanece_depois_de_divida_nova(self, client, auth):
        # O mesmo princípio no gatilho de evento: cadastrar dívida não devolve o
        # usuário ao estado de "nunca quitou nada".
        client.post("/v1/dividas", json=_nova(), headers=auth)
        divida = client.get("/v1/dividas", headers=auth).json()["dividas"][0]
        client.post(
            f"/v1/dividas/{divida['id']}/quitacao",
            json={"dataQuitacao": HOJE.isoformat(), "valorPago": 150000},
            headers=auth,
        )
        atingido_em = _marcos(client, auth)["primeira_quitacao"]["atingidoEm"]

        client.post("/v1/dividas", json=_nova(credor="Banco Novo"), headers=auth)
        assert _marcos(client, auth)["primeira_quitacao"]["atingidoEm"] == atingido_em


class TestUniqueConstraint:
    """
    M11.1 (ADR 0019) — a idempotência de `(tenant_id, tipo)` deixa de morar só
    em código e passa a ser imposta pelo banco (`uq_marco_tenant_tipo`).
    """

    def test_a_constraint_existe_e_morde(self, sessao):
        # Duas linhas com o MESMO (tenant_id, tipo), inseridas direto na
        # sessão — sem passar por `registrar_marcos` — precisam ser recusadas
        # pelo banco, não apenas evitadas por disciplina de aplicação.
        tenant = get_settings().tenant_id
        sessao.add(orm.Marco(tenant_id=tenant, tipo="rota_25"))
        sessao.commit()

        sessao.add(orm.Marco(tenant_id=tenant, tipo="rota_25"))
        with pytest.raises(IntegrityError):
            sessao.commit()


class TestSavepointNaCorrida:
    """
    M11.1 — o teste que importa. Prova que `registrar_marcos` contém a colisão
    dentro do SAVEPOINT: uma corrida não pode derrubar a transação do
    chamador, porque em três dos quatro pontos de disparo a gravação do marco
    é parte da MESMA mutação que a produziu (ex.: `dividas.quitar`).

    Como a suíte não tem duas requisições de verdade rodando ao mesmo tempo,
    a corrida é simulada como a tarefa autoriza: a linha concorrente é gravada
    por uma SEGUNDA sessão bem entre o SELECT e o INSERT de
    `registrar_marcos`, usando o hook de `Session.scalars` para interceptar
    exatamente esse instante. O ponto não é reproduzir paralelismo real — é
    exercitar o savepoint.
    """

    def test_a_corrida_nao_derruba_a_outra_escrita_da_mesma_transacao(self, sessao, engine):
        tenant = get_settings().tenant_id
        Local = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        concorrente = Local()

        # A OUTRA escrita da mesma transação do chamador — no mundo real, é a
        # quitação da dívida, o pagamento da parcela ou a renegociação que
        # disparou o marco. Fica pendente, sem commit, exatamente como nos
        # três routers que chamam `registrar_marcos` sem fechar a transação.
        sessao.add(orm.Marco(tenant_id=tenant, tipo="primeira_negociacao"))

        scalars_original = sessao.scalars

        def scalars_com_corrida(*args, **kwargs):
            # Roda o SELECT de verdade primeiro — ele ainda não vê a linha
            # concorrente, porque ela nasce só agora.
            resultado = scalars_original(*args, **kwargs)
            concorrente.add(orm.Marco(tenant_id=tenant, tipo="rota_25"))
            concorrente.commit()
            return resultado

        try:
            with patch.object(sessao, "scalars", side_effect=scalars_com_corrida):
                novos = registrar_marcos(sessao, tenant, ["rota_25"])

            # (a) não estoura: a colisão foi tratada como "já existe".
            assert novos == ()

            # (b) a outra escrita da mesma transação é commitada — a corrida
            # no marco não derrubou a mutação que a produziu.
            sessao.commit()
        finally:
            concorrente.close()

        assert (
            sessao.query(orm.Marco)
            .filter_by(tenant_id=tenant, tipo="primeira_negociacao")
            .count()
            == 1
        )

        # (c) continua havendo uma linha só do marco que colidiu — a da
        # concorrente, sem duplicata.
        linhas_rota_25 = (
            sessao.query(orm.Marco).filter_by(tenant_id=tenant, tipo="rota_25").all()
        )
        assert len(linhas_rota_25) == 1

    def test_registrar_marcos_segue_idempotente_sem_corrida(self, sessao):
        # Sanidade: sem colisão, o comportamento pré-existente continua —
        # devolve o tipo como "novo" e grava uma linha só.
        tenant = get_settings().tenant_id
        novos = registrar_marcos(sessao, tenant, ["rota_50"])
        sessao.commit()

        assert novos == ("rota_50",)
        assert (
            sessao.scalars(
                select(orm.Marco.tipo).where(
                    orm.Marco.tenant_id == tenant, orm.Marco.tipo == "rota_50"
                )
            ).all()
            == ["rota_50"]
        )
