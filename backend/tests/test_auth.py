from datetime import timedelta

import orm
from auth import agora, hash_de_token
from config import get_settings
from correio.memoria import CAIXA
from tests.conftest import CONTA_EMAIL, CONTA_SENHA

OUTRA = {"email": "outra@exemplo.com", "senha": "senha-da-outra"}


def _registrar(client, **over):
    corpo = {"email": "nova@exemplo.com", "senha": "senha-bem-boa"}
    corpo.update(over)
    return client.post("/v1/auth/registro", json=corpo)


def _codigo_da_caixa() -> str:
    """O código é o único número de 6 dígitos do corpo."""
    import re

    achados = re.findall(r"\b\d{6}\b", CAIXA[-1].corpo)
    assert achados, CAIXA[-1].corpo
    return achados[0]


class TestRegistro:
    def test_cadastro_devolve_sessao_utilizavel(self, client):
        r = _registrar(client)
        assert r.status_code == 201

        sessao = r.json()["sessao"]
        cabecalho = {"Authorization": f"Bearer {sessao['acesso']}"}
        assert client.get("/v1/dividas", headers=cabecalho).status_code == 200

    def test_email_repetido_devolve_409(self, client):
        _registrar(client)
        r = _registrar(client)
        assert r.status_code == 409
        assert r.json()["campo"] == "email"

    def test_email_e_normalizado(self, client):
        _registrar(client, email="Pessoa@Exemplo.COM ")
        r = client.post(
            "/v1/auth/login", json={"email": "pessoa@exemplo.com", "senha": "senha-bem-boa"}
        )
        assert r.status_code == 200

    def test_senha_curta_e_recusada(self, client):
        assert _registrar(client, senha="1234567").status_code == 422

    def test_email_malformado_e_recusado(self, client):
        assert _registrar(client, email="nao-e-email").status_code == 422

    def test_a_senha_nunca_volta_na_resposta(self, client):
        assert "senha-bem-boa" not in _registrar(client).text


class TestAdocaoDoTenantDoBeta:
    """
    O motivo de a regra existir: sem ela, tudo que já está no banco fica
    alcançável por nenhum login e apagável por nenhuma exclusão de conta.
    """

    def test_o_primeiro_cadastro_enxerga_os_dados_que_ja_existiam(self, client, sessao):
        sessao.add(
            orm.Divida(
                tenant_id=get_settings().tenant_id,
                credor="Banco de Antes do M8",
                valor_cobrado=150000,
                data_origem=agora().date(),
                tipo="consumo",
            )
        )
        sessao.commit()

        acesso = _registrar(client).json()["sessao"]["acesso"]
        dividas = client.get("/v1/dividas", headers={"Authorization": f"Bearer {acesso}"}).json()

        assert [d["credor"] for d in dividas["dividas"]] == ["Banco de Antes do M8"]

    def test_o_segundo_cadastro_nao_enxerga_nada_do_primeiro(self, client, auth):
        client.post(
            "/v1/dividas",
            json={
                "credor": "Banco do Primeiro",
                "valorCobrado": 150000,
                "dataOrigem": "2021-06-01",
                "tipo": "consumo",
            },
            headers=auth,
        )

        acesso = client.post("/v1/auth/registro", json=OUTRA).json()["sessao"]["acesso"]
        r = client.get("/v1/dividas", headers={"Authorization": f"Bearer {acesso}"})

        assert r.json() == {"dividas": []}


class TestLogin:
    def test_credencial_certa_devolve_sessao(self, client, auth):
        r = client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA})
        assert r.status_code == 200
        assert r.json()["sessao"]["acesso"]

    def test_senha_errada_e_email_inexistente_sao_indistinguiveis(self, client, auth):
        errada = client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": "outra"})
        inexistente = client.post(
            "/v1/auth/login", json={"email": "ninguem@exemplo.com", "senha": "outra"}
        )

        assert errada.status_code == inexistente.status_code == 401
        # A frase idêntica é o requisito: duas frases fariam da rota um
        # verificador de cadastro (ADR 0012, item 4).
        assert errada.json() == inexistente.json()

    def test_bloqueia_depois_do_teto_de_falhas(self, client, auth):
        for _ in range(get_settings().login_max_falhas):
            client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": "errada"})

        # Bloqueada mesmo com a senha CERTA — senão a trava não travaria nada.
        r = client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA})
        assert r.status_code == 429

    def test_o_bloqueio_nao_diz_ate_quando(self, client, auth):
        for _ in range(get_settings().login_max_falhas):
            client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": "errada"})

        mensagem = client.post(
            "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA}
        ).json()["message"]
        assert ":" not in mensagem  # nenhum horário

    def test_login_certo_zera_as_falhas(self, client, auth):
        for _ in range(get_settings().login_max_falhas - 1):
            client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": "errada"})

        assert (
            client.post(
                "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA}
            ).status_code
            == 200
        )
        # Se o contador não tivesse zerado, esta erraria e já bloquearia.
        client.post("/v1/auth/login", json={"email": CONTA_EMAIL, "senha": "errada"})
        assert (
            client.post(
                "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA}
            ).status_code
            == 200
        )


class TestRefresh:
    def test_renova_e_o_acesso_novo_funciona(self, client):
        refresh = _registrar(client).json()["sessao"]["refresh"]

        r = client.post("/v1/auth/refresh", json={"refresh": refresh})
        assert r.status_code == 200

        novo = r.json()["sessao"]["acesso"]
        assert client.get("/v1/dividas", headers={"Authorization": f"Bearer {novo}"}).status_code == 200

    def test_o_refresh_usado_e_revogado_na_hora(self, client):
        refresh = _registrar(client).json()["sessao"]["refresh"]
        client.post("/v1/auth/refresh", json={"refresh": refresh})

        # Rotação: o mesmo valor duas vezes significa duas cópias, e a segunda
        # não passa. É o que torna roubo detectável.
        assert client.post("/v1/auth/refresh", json={"refresh": refresh}).status_code == 401

    def test_a_renovacao_devolve_um_refresh_diferente(self, client):
        refresh = _registrar(client).json()["sessao"]["refresh"]
        novo = client.post("/v1/auth/refresh", json={"refresh": refresh}).json()["sessao"]["refresh"]
        assert novo != refresh

    def test_refresh_desconhecido_devolve_401(self, client):
        assert client.post("/v1/auth/refresh", json={"refresh": "inventado"}).status_code == 401

    def test_refresh_expirado_devolve_401(self, client, sessao):
        refresh = _registrar(client).json()["sessao"]["refresh"]

        linha = sessao.query(orm.Sessao).filter_by(refresh_hash=hash_de_token(refresh)).one()
        linha.expira_em = agora() - timedelta(seconds=1)
        sessao.commit()

        assert client.post("/v1/auth/refresh", json={"refresh": refresh}).status_code == 401

    def test_o_refresh_nunca_e_gravado_em_texto(self, client, sessao):
        refresh = _registrar(client).json()["sessao"]["refresh"]
        assert sessao.query(orm.Sessao).filter_by(refresh_hash=refresh).one_or_none() is None
        assert sessao.query(orm.Sessao).filter_by(refresh_hash=hash_de_token(refresh)).one()


class TestLogout:
    def test_com_refresh_encerra_aquele_aparelho(self, client):
        sessao = _registrar(client).json()["sessao"]
        cabecalho = {"Authorization": f"Bearer {sessao['acesso']}"}

        assert (
            client.post("/v1/auth/logout", json={"refresh": sessao["refresh"]}, headers=cabecalho).status_code
            == 204
        )
        assert client.post("/v1/auth/refresh", json={"refresh": sessao["refresh"]}).status_code == 401

    def test_sem_refresh_encerra_todos(self, client):
        primeira = _registrar(client).json()["sessao"]
        segunda = client.post(
            "/v1/auth/login", json={"email": "nova@exemplo.com", "senha": "senha-bem-boa"}
        ).json()["sessao"]

        client.post(
            "/v1/auth/logout", json={}, headers={"Authorization": f"Bearer {primeira['acesso']}"}
        )

        assert client.post("/v1/auth/refresh", json={"refresh": primeira["refresh"]}).status_code == 401
        assert client.post("/v1/auth/refresh", json={"refresh": segunda["refresh"]}).status_code == 401

    def test_nao_encerra_a_sessao_de_outra_pessoa(self, client, auth):
        alheia = client.post("/v1/auth/registro", json=OUTRA).json()["sessao"]

        client.post("/v1/auth/logout", json={"refresh": alheia["refresh"]}, headers=auth)

        assert client.post("/v1/auth/refresh", json={"refresh": alheia["refresh"]}).status_code == 200

    def test_exige_autenticacao(self, client):
        assert client.post("/v1/auth/logout", json={}).status_code == 401


class TestRecuperacaoDeSenha:
    def test_email_cadastrado_recebe_codigo(self, client, auth):
        r = client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        assert r.status_code == 202
        assert len(CAIXA) == 1
        assert CAIXA[0].para == CONTA_EMAIL

    def test_email_inexistente_responde_igual_e_nao_envia_nada(self, client, auth):
        cadastrado = client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        CAIXA.clear()
        inexistente = client.post(
            "/v1/auth/senha/recuperacao", json={"email": "ninguem@exemplo.com"}
        )

        # Responder diferente transformaria a rota num verificador de cadastro.
        assert cadastrado.status_code == inexistente.status_code == 202
        assert inexistente.content == cadastrado.content
        assert CAIXA == []

    def test_o_email_leva_o_codigo_e_nada_mais(self, client, auth):
        """
        Guardrail 5: e-mail atravessa servidores que não controlamos e fica
        guardado em caixas que não controlamos. Nada financeiro entra nele.
        """
        client.post(
            "/v1/dividas",
            json={
                "credor": "Banco Sigiloso S/A",
                "valorCobrado": 987654,
                "dataOrigem": "2021-06-01",
                "tipo": "consumo",
            },
            headers=auth,
        )
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        corpo = CAIXA[0].corpo

        assert "Sigiloso" not in corpo
        assert "987654" not in corpo and "9.876,54" not in corpo
        assert len(_codigo_da_caixa()) == 6

    def test_redefinir_com_o_codigo_certo_funciona(self, client, auth):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})

        r = client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": CONTA_EMAIL, "codigo": _codigo_da_caixa(), "senha": "outra-senha-boa"},
        )
        assert r.status_code == 200

        assert (
            client.post(
                "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": "outra-senha-boa"}
            ).status_code
            == 200
        )

    def test_a_senha_antiga_para_de_funcionar(self, client, auth):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": CONTA_EMAIL, "codigo": _codigo_da_caixa(), "senha": "outra-senha-boa"},
        )

        assert (
            client.post(
                "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA}
            ).status_code
            == 401
        )

    def test_redefinir_derruba_as_sessoes_abertas(self, client):
        sessao = _registrar(client).json()["sessao"]
        client.post("/v1/auth/senha/recuperacao", json={"email": "nova@exemplo.com"})

        client.post(
            "/v1/auth/senha/redefinicao",
            json={
                "email": "nova@exemplo.com",
                "codigo": _codigo_da_caixa(),
                "senha": "outra-senha-boa",
            },
        )

        # Quem redefine em geral perdeu o aparelho. Uma troca que deixa o
        # aparelho perdido logado não protege de nada.
        assert client.post("/v1/auth/refresh", json={"refresh": sessao["refresh"]}).status_code == 401

    def test_codigo_errado_e_recusado(self, client, auth):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        certo = _codigo_da_caixa()
        errado = "000000" if certo != "000000" else "111111"

        r = client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": CONTA_EMAIL, "codigo": errado, "senha": "outra-senha-boa"},
        )
        assert r.status_code == 400

    def test_codigo_nao_e_reutilizavel(self, client, auth):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        codigo = _codigo_da_caixa()
        corpo = {"email": CONTA_EMAIL, "codigo": codigo, "senha": "outra-senha-boa"}

        assert client.post("/v1/auth/senha/redefinicao", json=corpo).status_code == 200
        assert client.post("/v1/auth/senha/redefinicao", json=corpo).status_code == 400

    def test_codigo_expirado_e_recusado(self, client, auth, sessao):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        codigo = _codigo_da_caixa()

        linha = sessao.query(orm.CodigoRecuperacao).one()
        linha.expira_em = agora() - timedelta(seconds=1)
        sessao.commit()

        r = client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": CONTA_EMAIL, "codigo": codigo, "senha": "outra-senha-boa"},
        )
        assert r.status_code == 400
        assert "expirou" in r.json()["message"]

    def test_tentativas_erradas_queimam_o_codigo(self, client, auth):
        """Seis dígitos são um milhão de combinações, e um milhão de requisições é uma tarde."""
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        certo = _codigo_da_caixa()
        errado = "000000" if certo != "000000" else "111111"

        for _ in range(5):
            client.post(
                "/v1/auth/senha/redefinicao",
                json={"email": CONTA_EMAIL, "codigo": errado, "senha": "outra-senha-boa"},
            )

        r = client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": CONTA_EMAIL, "codigo": certo, "senha": "outra-senha-boa"},
        )
        assert r.status_code == 400

    def test_o_codigo_nunca_e_gravado_em_texto(self, client, auth, sessao):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        codigo = _codigo_da_caixa()
        assert sessao.query(orm.CodigoRecuperacao).one().codigo_hash != codigo

    def test_senha_nova_curta_e_recusada(self, client, auth):
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        r = client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": CONTA_EMAIL, "codigo": _codigo_da_caixa(), "senha": "curta"},
        )
        assert r.status_code == 422


class TestSegredoDeSessao:
    def test_token_assinado_com_outra_chave_nao_passa(self, client):
        import jwt

        forjado = jwt.encode(
            {"sub": get_settings().tenant_id, "uid": "qualquer", "exp": agora() + timedelta(hours=1)},
            "chave-que-nao-e-a-do-servidor",
            algorithm="HS256",
        )
        r = client.get("/v1/dividas", headers={"Authorization": f"Bearer {forjado}"})
        assert r.status_code == 401

    def test_token_expirado_nao_passa(self, client):
        import jwt

        vencido = jwt.encode(
            {
                "sub": get_settings().tenant_id,
                "uid": "qualquer",
                "exp": agora() - timedelta(seconds=1),
            },
            get_settings().jwt_secret,
            algorithm="HS256",
        )
        r = client.get("/v1/dividas", headers={"Authorization": f"Bearer {vencido}"})
        assert r.status_code == 401

    def test_o_acesso_nao_carrega_dado_pessoal(self, client):
        import base64

        acesso = _registrar(client).json()["sessao"]["acesso"]
        corpo = acesso.split(".")[1]
        corpo += "=" * (-len(corpo) % 4)
        claims = base64.urlsafe_b64decode(corpo).decode()

        # Um token é a coisa mais copiada de um app, e o corpo do JWT é legível
        # por qualquer pessoa (guardrail 5).
        assert "nova@exemplo.com" not in claims
        assert set(__import__("json").loads(claims)) == {"sub", "uid", "exp"}
