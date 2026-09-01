import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from identidade import ErroDeIdentidade, IdentidadeNaoConfigurada
from identidade.apple import EMISSOR as EMISSOR_APPLE, IdentidadeApple
from identidade.google import EMISSORES as EMISSORES_GOOGLE, IdentidadeGoogle
from identidade.memoria import IdentidadeMemoria
from identidade.openid import como_booleano, conferir_id_token

"""
A conferência do ID token, sem rede.

A CHAVE É GERADA AQUI e o JWKS é substituído por ela. Não é mock da nossa
lógica: o token é assinado de verdade, o `jwt.decode` roda de verdade, e o que
está sob teste é o que É NOSSO — audiência vazia recusando em vez de aceitar
qualquer uma, `aud` de outro app sendo rejeitado, os dois emissores do Google
valendo, e `email_verified` em string não virando `True`.

O que NÃO está sob teste é o PyJWT verificar assinatura. Ele verifica; um teste
sobre isso seria um teste da biblioteca.
"""

CHAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PRIVADA = CHAVE.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)


@pytest.fixture(autouse=True)
def jwks_local(monkeypatch):
    """Troca o cliente de JWKS pela chave pública desta suíte."""
    import identidade.openid as openid

    falso = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=CHAVE.public_key())
    )
    monkeypatch.setattr(openid, "_cliente", lambda uri: falso)


def montar(**over) -> str:
    corpo = {
        "iss": EMISSOR_APPLE,
        "aud": "br.com.devonada.app",
        "sub": "abc123",
        "exp": int(time.time()) + 600,
        "email": "pessoa@exemplo.com",
        "email_verified": "true",
    }
    corpo.update(over)
    return jwt.encode(corpo, PRIVADA, algorithm="RS256")


class TestAudiencia:
    def test_audiencia_vazia_e_falha_de_configuracao_e_nao_de_credencial(self):
        """
        Vazio NÃO pode significar "aceita qualquer uma". Assinatura válida só
        prova que o provedor emitiu o token para ALGUM app; é o `aud` que prova
        que foi para o nosso.
        """
        with pytest.raises(IdentidadeNaoConfigurada):
            IdentidadeApple(client_ids=()).verificar(montar())

    def test_token_de_outro_app_e_recusado(self):
        with pytest.raises(ErroDeIdentidade):
            IdentidadeApple(client_ids=("br.com.devonada.app",)).verificar(
                montar(aud="com.outro.app")
            )

    def test_qualquer_uma_das_audiencias_configuradas_serve(self):
        # Um client id por plataforma no Google, e o Services ID da web na
        # Apple: o `aud` é o da plataforma que gerou o token.
        verificador = IdentidadeApple(client_ids=("com.outro.app", "br.com.devonada.app"))
        assert verificador.verificar(montar()).sub == "abc123"


class TestEmissorEExpiracao:
    def test_emissor_errado_e_recusado(self):
        with pytest.raises(ErroDeIdentidade):
            IdentidadeApple(client_ids=("br.com.devonada.app",)).verificar(
                montar(iss="https://accounts.google.com")
            )

    def test_token_expirado_e_recusado(self):
        with pytest.raises(ErroDeIdentidade):
            IdentidadeApple(client_ids=("br.com.devonada.app",)).verificar(
                montar(exp=int(time.time()) - 1)
            )

    def test_o_google_emite_com_e_sem_https_e_as_duas_valem(self):
        # Recusar uma delas quebraria o login em parte dos aparelhos — o pior
        # tipo de defeito: o que só existe em alguns.
        verificador = IdentidadeGoogle(client_ids=("cliente-web",))
        for emissor in EMISSORES_GOOGLE:
            token = montar(iss=emissor, aud="cliente-web", email_verified=True)
            assert verificador.verificar(token).provedor == "google"

    def test_claim_obrigatoria_faltando_e_recusada(self):
        with pytest.raises(ErroDeIdentidade):
            conferir_id_token(
                jwt.encode({"iss": EMISSOR_APPLE, "aud": "x"}, PRIVADA, algorithm="RS256"),
                jwks_uri="irrelevante",
                emissores=(EMISSOR_APPLE,),
                audiencias=("x",),
                provedor_para_o_usuario="a Apple",
            )


class TestEmailVerificado:
    def test_a_string_false_da_apple_nao_vira_verdadeiro(self):
        """
        `bool("false")` é `True`. Sem a normalização, o campo que autoriza
        reconhecer uma conta existente pelo e-mail diria sempre sim — e só do
        lado da Apple, que é onde ninguém olharia.
        """
        identidade = IdentidadeApple(client_ids=("br.com.devonada.app",)).verificar(
            montar(email_verified="false")
        )
        assert identidade.email_verificado is False

    def test_a_string_true_da_apple_vira_verdadeiro(self):
        assert (
            IdentidadeApple(client_ids=("br.com.devonada.app",))
            .verificar(montar(email_verified="true"))
            .email_verificado
            is True
        )

    def test_o_booleano_do_google_atravessa_intacto(self):
        assert como_booleano(True) is True
        assert como_booleano(False) is False
        assert como_booleano(None) is False

    def test_o_e_mail_e_normalizado(self):
        identidade = IdentidadeApple(client_ids=("br.com.devonada.app",)).verificar(
            montar(email="  Pessoa@Exemplo.COM ")
        )
        assert identidade.email == "pessoa@exemplo.com"

    def test_sem_e_mail_o_campo_e_nulo_e_nao_string_vazia(self):
        identidade = IdentidadeApple(client_ids=("br.com.devonada.app",)).verificar(
            montar(email=None)
        )
        assert identidade.email is None


class TestAdaptadorDeMemoria:
    def test_o_token_descreve_a_si_mesmo(self):
        identidade = IdentidadeMemoria("apple", "a Apple").verificar(
            '{"sub": "x", "email": "a@b.com", "emailVerificado": false}'
        )
        assert (identidade.sub, identidade.email, identidade.email_verificado) == (
            "x",
            "a@b.com",
            False,
        )

    def test_token_sem_sub_e_recusado(self):
        with pytest.raises(ErroDeIdentidade):
            IdentidadeMemoria("apple", "a Apple").verificar('{"email": "a@b.com"}')

    def test_token_que_nao_e_json_e_recusado(self):
        with pytest.raises(ErroDeIdentidade):
            IdentidadeMemoria("google", "o Google").verificar("nao-e-json")


class TestEscolhaDoAdaptador:
    def test_provedor_desconhecido_nao_chega_a_lugar_nenhum(self):
        from identidade import obter_verificador

        with pytest.raises(ErroDeIdentidade):
            obter_verificador("facebook")

    def test_a_suite_usa_o_adaptador_de_memoria(self):
        # O conftest declara `DEVONADA_IDENTIDADE=memoria`. Este teste é o que
        # falha no dia em que alguém tirar a linha e a suíte passar a tentar
        # buscar JWKS de verdade.
        from identidade import obter_verificador

        assert isinstance(obter_verificador("apple"), IdentidadeMemoria)
