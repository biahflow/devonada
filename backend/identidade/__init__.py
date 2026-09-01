from config import get_settings
from identidade.base import (
    PROVEDORES,
    ErroDeIdentidade,
    Identidade,
    IdentidadeNaoConfigurada,
    Verificador,
)

__all__ = [
    "ErroDeIdentidade",
    "Identidade",
    "IdentidadeNaoConfigurada",
    "PROVEDORES",
    "Verificador",
    "obter_verificador",
]


def _lista(bruto: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in bruto.split(",") if item.strip())


def obter_verificador(provedor: str) -> Verificador:
    """
    Escolhe o adaptador por `DEVONADA_IDENTIDADE` e pelo provedor de quem entrou.

    O PROVEDOR É PARÂMETRO e o modo é configuração, como em `loja/`: quem tocou
    no botão da Apple tem token da Apple, e não existe servidor que atenda os
    dois botões conferindo com um provedor só.

    O import da implementação é preguiçoso, como em `llm/` e `loja/`: quem roda a
    suíte com `DEVONADA_IDENTIDADE=memoria` não carrega `jwt.PyJWKClient` nem
    abre conexão para JWKS nenhum por causa disto.
    """
    settings = get_settings()

    if provedor not in PROVEDORES:
        raise ErroDeIdentidade("Esse jeito de entrar não existe por aqui.")

    if settings.identidade == "memoria":
        from identidade.memoria import IdentidadeMemoria

        return IdentidadeMemoria(provedor, "a Apple" if provedor == "apple" else "o Google")

    if provedor == "apple":
        from identidade.apple import IdentidadeApple

        return IdentidadeApple(_lista(settings.apple_client_ids))

    from identidade.google import IdentidadeGoogle

    return IdentidadeGoogle(_lista(settings.google_client_ids))
