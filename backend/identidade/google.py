from identidade.base import Identidade
from identidade.openid import como_booleano, conferir_id_token

"""
Google Sign-In.

TRÊS AUDIÊNCIAS POSSÍVEIS, e é por isso que a configuração é uma LISTA: o
Google emite um client id por plataforma (iOS, Android e web), e o `aud` do
token é o da plataforma que o gerou. Configurar só um faz o login funcionar num
aparelho e falhar no outro — e a biblioteca do app manda o `webClientId` como
audiência do `idToken` em ambos, então o da web quase nunca pode faltar.

DOIS EMISSORES VÁLIDOS, com e sem `https://`. É o próprio Google que emite das
duas formas, documentado; recusar uma delas seria recusar tokens legítimos.
"""

JWKS = "https://www.googleapis.com/oauth2/v3/certs"
EMISSORES = ("https://accounts.google.com", "accounts.google.com")


class IdentidadeGoogle:
    def __init__(self, client_ids: tuple[str, ...]) -> None:
        self._client_ids = client_ids

    def verificar(self, token: str) -> Identidade:
        claims = conferir_id_token(
            token,
            jwks_uri=JWKS,
            emissores=EMISSORES,
            audiencias=self._client_ids,
            provedor_para_o_usuario="o Google",
        )

        email = claims.get("email")
        return Identidade(
            provedor="google",
            sub=str(claims["sub"]),
            email=str(email).strip().lower() if email else None,
            email_verificado=como_booleano(claims.get("email_verified")),
        )
