import json

import orm
from sqlalchemy import select

"""
Login social (M13, ADR 0023).

O QUE ESTA SUÍTE PROVA, e o que ela deliberadamente não prova.

PROVA: o que a rota faz com uma identidade já conferida — primeiro login cria
conta sem senha, login repetido devolve a MESMA conta, e-mail verificado
reconhece conta só-social, conta com senha é recusada com 409, conta social não
entra por senha, e a exclusão de conta funciona pelo provedor e só pelo dono.

NÃO PROVA que a Apple recusa um token forjado: isso é o `jwt.decode` do PyJWT,
com a chave pública do provedor, e um teste sobre ele seria um teste da
biblioteca. O que fica do nosso lado — audiência vazia recusa em vez de aceitar
qualquer uma, `email_verified` em string não vira `True` — está em
`test_identidade.py`, que roda sem rede.
"""


def _social(client, provedor: str, token: str):
    return client.post("/v1/auth/social", json={"provedor": provedor, "token": token})


def _cabecalho(resposta) -> dict[str, str]:
    return {"Authorization": f"Bearer {resposta.json()['sessao']['acesso']}"}


class TestPrimeiroLogin:
    def test_cria_conta_e_devolve_sessao_utilizavel(self, client, token_social):
        r = _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        assert r.status_code == 200

        # A sessão vale de verdade — não basta o corpo ter o formato certo.
        assert client.get("/v1/dividas", headers=_cabecalho(r)).status_code == 200

    def test_a_conta_nasce_sem_senha(self, client, sessao, token_social):
        _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))

        usuario = sessao.scalar(select(orm.Usuario))
        assert usuario is not None
        # NULO, e não um hash de valor inventado: é isto que faz a exclusão de
        # conta pedir o provedor em vez de uma senha que ninguém escolheu.
        assert usuario.senha_hash is None
        assert usuario.provedor == "apple"
        assert usuario.provedor_sub == "apple-123"

    def test_adota_o_tenant_do_beta_quando_e_a_primeira_conta_do_banco(
        self, client, sessao, token_social
    ):
        # O gêmeo do teste do registro por e-mail. Sem esta regra aqui, um banco
        # novo cujo primeiro acesso fosse pela Apple criaria tenant novo e
        # deixaria os dados do beta alcançáveis por ninguém.
        from config import get_settings

        _social(client, "google", token_social("google-1", "pessoa@exemplo.com"))
        usuario = sessao.scalar(select(orm.Usuario))
        assert usuario.tenant_id == get_settings().tenant_id

    def test_o_e_mail_e_normalizado(self, client, sessao, token_social):
        _social(client, "apple", token_social("apple-123", "  Pessoa@Exemplo.COM "))
        assert sessao.scalar(select(orm.Usuario)).email == "pessoa@exemplo.com"


class TestLoginRepetido:
    def test_o_mesmo_sub_volta_para_a_mesma_conta(self, client, sessao, token_social):
        _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        r = _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))

        assert r.status_code == 200
        assert sessao.scalar(select(orm.Usuario).where(orm.Usuario.email.isnot(None))) is not None
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 1

    def test_o_sub_manda_mais_que_o_e_mail(self, client, sessao, token_social):
        """
        O e-mail muda: quem oculta o e-mail na Apple pode desligar o
        encaminhamento, e conta corporativa troca de domínio. Se a conta fosse
        identificada por e-mail, essa pessoa perderia tudo o que cadastrou.
        """
        _social(client, "apple", token_social("apple-123", "antigo@exemplo.com"))
        r = _social(client, "apple", token_social("apple-123", "novo@exemplo.com"))

        assert r.status_code == 200
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 1

    def test_subs_diferentes_sao_contas_diferentes(self, client, sessao, token_social):
        _social(client, "apple", token_social("apple-1", "uma@exemplo.com"))
        _social(client, "apple", token_social("apple-2", "outra@exemplo.com"))
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 2

    def test_o_mesmo_sub_em_provedores_diferentes_nao_se_confunde(
        self, client, sessao, token_social
    ):
        # `sub` é único DENTRO do provedor. Nada garante que a Apple e o Google
        # não emitam a mesma string, e casá-las seria entregar uma conta à outra.
        _social(client, "apple", token_social("mesmo-sub", "uma@exemplo.com"))
        _social(client, "google", token_social("mesmo-sub", "outra@exemplo.com"))
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 2


class TestReconhecimentoPeloEmail:
    def test_conta_com_senha_nao_e_ligada_automaticamente(self, client, token_social):
        """
        O ataque que este 409 fecha (*pre-hijacking*): este servidor não verifica
        e-mail no cadastro, então alguém pode registrar hoje uma conta com o
        e-mail de outra pessoa. Ligar o login social a ela por coincidência de
        e-mail entregaria ao dono da conta plantada tudo o que a vítima
        cadastrasse depois.
        """
        client.post(
            "/v1/auth/registro", json={"email": "pessoa@exemplo.com", "senha": "senha-bem-boa"}
        )
        r = _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))

        assert r.status_code == 409
        assert r.json()["campo"] == "email"

    def test_conta_so_social_e_religada_ao_novo_provedor(self, client, sessao, token_social):
        """
        Custo declarado da ADR 0023: uma conta guarda UM provedor. Entrar pelo
        outro com o mesmo e-mail verificado religa em vez de duplicar — o que
        importa é a pessoa não acabar com a vida financeira partida em duas.
        """
        _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        r = _social(client, "google", token_social("google-9", "pessoa@exemplo.com"))

        assert r.status_code == 200
        contas = sessao.scalars(select(orm.Usuario)).all()
        assert len(contas) == 1
        assert contas[0].provedor == "google"
        assert contas[0].provedor_sub == "google-9"

    def test_e_mail_nao_verificado_nao_cria_nem_reconhece(self, client, sessao, token_social):
        r = _social(
            client,
            "google",
            token_social("google-1", "pessoa@exemplo.com", email_verificado=False),
        )
        assert r.status_code == 401
        assert sessao.scalars(select(orm.Usuario)).all() == []

    def test_sem_e_mail_nenhum_a_conta_nao_nasce(self, client, sessao, token_social):
        # `usuario.email` é por onde o código de recuperação chega. Inventar um
        # endereço para preencher a coluna seria gravar um dado que não existe.
        r = _social(client, "apple", token_social("apple-123", None))
        assert r.status_code == 401
        assert sessao.scalars(select(orm.Usuario)).all() == []


class TestRecusa:
    def test_token_ilegivel_devolve_401(self, client):
        assert _social(client, "apple", "nao-e-um-token").status_code == 401

    def test_provedor_desconhecido_devolve_422(self, client, token_social):
        # Recusado pelo schema, antes de qualquer conferência: `provedor` é uma
        # união fechada, e não texto livre.
        r = _social(client, "facebook", token_social("x", "a@b.com"))
        assert r.status_code == 422

    def test_a_senha_nao_entra_em_conta_social(self, client, token_social):
        """
        E com a MESMA frase do e-mail inexistente. Uma resposta diferente aqui
        contaria, para quem perguntasse, por onde cada conta entra — e a rota de
        login voltaria a ser o verificador de cadastro que ela existe para não
        ser.
        """
        _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        r = client.post(
            "/v1/auth/login", json={"email": "pessoa@exemplo.com", "senha": "chute-qualquer"}
        )
        assert r.status_code == 401
        assert r.json()["message"] == "E-mail ou senha não conferem."

    def test_o_token_nunca_volta_na_resposta(self, client, token_social):
        token = token_social("apple-123", "pessoa@exemplo.com")
        assert token not in _social(client, "apple", token).text


class TestSenhaDepoisDoSocial:
    def test_a_recuperacao_por_e_mail_da_senha_a_quem_entrou_pela_apple(
        self, client, sessao, token_social
    ):
        """
        Caminho de recuperação de quem não tem senha: o código chega na caixa que
        o provedor confirmou ser dela. A partir daí os dois botões e a senha
        entram na MESMA conta — e a exclusão volta a pedir senha.
        """
        import re

        from correio.memoria import CAIXA

        _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        client.post("/v1/auth/senha/recuperacao", json={"email": "pessoa@exemplo.com"})
        codigo = re.findall(r"\b\d{6}\b", CAIXA[-1].corpo)[0]

        r = client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": "pessoa@exemplo.com", "codigo": codigo, "senha": "agora-tem-senha"},
        )
        assert r.status_code == 200

        entrou = client.post(
            "/v1/auth/login", json={"email": "pessoa@exemplo.com", "senha": "agora-tem-senha"}
        )
        assert entrou.status_code == 200

        # E o vínculo social continua de pé: a mesma conta, pelos dois caminhos.
        usuario = sessao.scalar(select(orm.Usuario))
        assert usuario.provedor == "apple"
        assert usuario.senha_hash is not None


class TestExclusaoDeContaSocial:
    """
    Diretriz 5.1.1(v) da Apple: app que oferece login social e não deixa excluir
    a conta reprova. Quem entra pela Apple nunca escolheu senha — exigir uma
    deixaria essa pessoa presa.
    """

    def _entrar(self, client, token_social, sub="apple-123", email="pessoa@exemplo.com"):
        r = _social(client, "apple", token_social(sub, email))
        return _cabecalho(r)

    def test_exclui_reapresentando_o_provedor(self, client, sessao, token_social):
        cabecalho = self._entrar(client, token_social)

        r = client.request(
            "DELETE",
            "/v1/conta",
            headers=cabecalho,
            json={"provedor": "apple", "token": token_social("apple-123", "pessoa@exemplo.com")},
        )
        assert r.status_code == 204
        assert sessao.scalars(select(orm.Usuario)).all() == []

    def test_sem_reconfirmacao_nenhuma_nao_exclui(self, client, sessao, token_social):
        cabecalho = self._entrar(client, token_social)
        r = client.request("DELETE", "/v1/conta", headers=cabecalho, json={})

        assert r.status_code == 401
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 1

    def test_token_de_outra_pessoa_nao_exclui(self, client, sessao, token_social):
        """
        O buraco que a comparação de `sub` fecha: com o aparelho desbloqueado na
        mão, alguém entraria na PRÓPRIA Apple ID e apagaria a conta de outra. O
        token seria válido — só que de outra pessoa.
        """
        cabecalho = self._entrar(client, token_social)

        r = client.request(
            "DELETE",
            "/v1/conta",
            headers=cabecalho,
            json={"provedor": "apple", "token": token_social("apple-999", "outra@exemplo.com")},
        )
        assert r.status_code == 401
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 1

    def test_conta_sem_provedor_nao_exclui_por_token_social(self, client, sessao, token_social):
        # Conta nascida de e-mail e senha não tem provedor nenhum, então um token
        # social — mesmo válido — não é credencial DELA.
        r = client.post(
            "/v1/auth/registro", json={"email": "pessoa@exemplo.com", "senha": "senha-bem-boa"}
        )
        cabecalho = _cabecalho(r)

        recusado = client.request(
            "DELETE",
            "/v1/conta",
            headers=cabecalho,
            json={"provedor": "apple", "token": token_social("apple-123", "pessoa@exemplo.com")},
        )
        assert recusado.status_code == 401
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 1

        aceito = client.request(
            "DELETE", "/v1/conta", headers=cabecalho, json={"senha": "senha-bem-boa"}
        )
        assert aceito.status_code == 204

    def test_quem_tem_as_duas_credenciais_exclui_por_qualquer_uma(self, client, token_social):
        """
        O beco sem saída que isto fecha, e ele é alcançável pelo caminho normal:
        quem entra pela Apple e depois ganha senha pela recuperação por e-mail
        passa a ter as duas. Se só a senha valesse, a tela — que sabe que a
        sessão veio da Apple — ofereceria o botão do provedor e o servidor
        responderia "a senha não confere", sem senha nenhuma na tela.
        """
        import re

        from correio.memoria import CAIXA

        entrada = _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        cabecalho = _cabecalho(entrada)

        client.post("/v1/auth/senha/recuperacao", json={"email": "pessoa@exemplo.com"})
        codigo = re.findall(r"\b\d{6}\b", CAIXA[-1].corpo)[0]
        client.post(
            "/v1/auth/senha/redefinicao",
            json={"email": "pessoa@exemplo.com", "codigo": codigo, "senha": "agora-tem-senha"},
        )

        # A conta agora tem senha E provedor. O token continua servindo.
        r = client.request(
            "DELETE",
            "/v1/conta",
            headers=cabecalho,
            json={"provedor": "apple", "token": token_social("apple-123", "pessoa@exemplo.com")},
        )
        assert r.status_code == 204

    def test_senha_errada_nao_exclui_nem_com_provedor_no_corpo(
        self, client, sessao, token_social
    ):
        # A credencial errada não vira certa por vir acompanhada: o token é de
        # OUTRO `sub`, e a senha não confere. As duas falham, e a conta fica.
        _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))
        entrada = _social(client, "apple", token_social("apple-123", "pessoa@exemplo.com"))

        r = client.request(
            "DELETE",
            "/v1/conta",
            headers=_cabecalho(entrada),
            json={
                "senha": "chute",
                "provedor": "apple",
                "token": token_social("apple-999", "outra@exemplo.com"),
            },
        )
        assert r.status_code == 401
        assert len(sessao.scalars(select(orm.Usuario)).all()) == 1
