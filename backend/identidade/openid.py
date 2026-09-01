from functools import lru_cache

import jwt

from identidade.base import ErroDeIdentidade, IdentidadeNaoConfigurada

"""
A conferência de um ID token OpenID Connect, compartilhada pelos dois provedores.

UM CÓDIGO SÓ, DE PROPÓSITO. Apple e Google emitem o mesmo artefato — JWT RS256
assinado por uma chave publicada num JWKS — e as três checagens que importam são
idênticas: assinatura, `iss` e `aud`. Escrever isso duas vezes é como a segunda
cópia envelhece: alguém conserta a validação de audiência de um provedor e
esquece a do outro, e o buraco fica no que ninguém olhou.

A CHECAGEM DE `aud` É A QUE IMPORTA. Assinatura válida só prova que o provedor
emitiu o token — para ALGUM app. Sem conferir a audiência, um token legítimo
emitido para outro aplicativo do mesmo provedor entra aqui como se fosse nosso,
e quem controla aquele outro app entra na conta de quem quiser. É por isso que
audiência vazia levanta erro de configuração em vez de "aceita qualquer uma".

O JWKS É CACHEADO pelo `PyJWKClient`, que só busca a chave quando encontra um
`kid` que não conhece. A rotação de chave do provedor resolve sozinha; o custo
de rede é uma requisição por rotação, não por login.
"""

# Frase única para toda recusa de token, seja assinatura inválida, expirado,
# audiência errada ou emissor errado. Distinguir não ajudaria o usuário — o
# caminho dele é o mesmo nos quatro — e ajudaria quem está tentando forjar.
RECUSADO = "Não deu para confirmar sua entrada com {provedor}. Tente de novo."

# Sem cache, cada login construiria um cliente novo e buscaria o JWKS de novo.
# Por URI porque são dois provedores, e um cache global os misturaria.
@lru_cache
def _cliente(jwks_uri: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_uri, cache_keys=True, timeout=10)


def conferir_id_token(
    token: str,
    *,
    jwks_uri: str,
    emissores: tuple[str, ...],
    audiencias: tuple[str, ...],
    provedor_para_o_usuario: str,
) -> dict:
    """
    Devolve as claims de um ID token que passou nas três checagens.

    `emissores` é TUPLA porque o Google emite com `accounts.google.com` e com
    `https://accounts.google.com`, e as duas formas são válidas. Recusar uma
    delas quebraria o login em metade dos aparelhos, que é o pior tipo de
    defeito: o que só existe em alguns.
    """
    recusado = ErroDeIdentidade(RECUSADO.format(provedor=provedor_para_o_usuario))

    if not audiencias:
        # Falha de CONFIGURAÇÃO, não de credencial. Sobe como erro de identidade
        # porque é o que a rota sabe tratar, mas com outra frase de propósito:
        # dizer "não deu para confirmar sua entrada" quando o problema é a nossa
        # configuração vazia joga a culpa no usuário e esconde de nós o que está
        # errado.
        raise IdentidadeNaoConfigurada(
            f"Entrar com {provedor_para_o_usuario} ainda não está configurado neste servidor."
        )

    try:
        chave = _cliente(jwks_uri).get_signing_key_from_jwt(token)
    except Exception as e:
        # `PyJWKClientError`, erro de rede e token ilegível caem todos aqui: o
        # `kid` só é lido depois de o token ser decodificado, então um token
        # inventado falha nesta linha e não na de baixo.
        raise recusado from e

    try:
        claims = jwt.decode(
            token,
            chave.key,
            algorithms=["RS256"],
            audience=list(audiencias),
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as e:
        raise recusado from e

    # `iss` conferido aqui, e não pelo parâmetro do PyJWT, porque ele aceita um
    # emissor só e o Google usa dois.
    if claims.get("iss") not in emissores:
        raise recusado

    if not claims.get("sub"):
        raise recusado

    return claims


def como_booleano(valor: object) -> bool:
    """
    `email_verified` chega como booleano do Google e como STRING da Apple.

    Sem esta normalização, `bool("false")` é `True` — e o campo que autoriza
    reconhecer uma conta existente pelo e-mail passaria a dizer sempre sim,
    silenciosamente, só do lado da Apple.
    """
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().lower() == "true"
