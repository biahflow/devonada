from config import get_settings
from loja.base import Compra, ErroDeLoja, Loja

__all__ = ["Compra", "ErroDeLoja", "Loja", "PLATAFORMAS", "obter_loja"]

PLATAFORMAS = ("ios", "android")


def obter_loja(plataforma: str) -> Loja:
    """
    Escolhe o adaptador por `BUDDY_LOJA` e pela plataforma de quem comprou.

    A PLATAFORMA É PARÂMETRO e o provedor é configuração, ao contrário da camada
    de LLM, onde o provedor é a escolha. O motivo é que aqui não há escolha a
    fazer: quem comprou no iPhone comprou na App Store, e não existe servidor
    que atenda um app das duas lojas falando com uma só.

    O import da implementação é preguiçoso, como em `llm/`: quem roda a suíte
    com `BUDDY_LOJA=memoria` não carrega `httpx` nem `jwt` por causa disto.
    """
    settings = get_settings()

    if settings.loja == "memoria":
        from loja.memoria import LojaMemoria

        return LojaMemoria()

    if plataforma == "ios":
        from loja.apple import LojaApple

        return LojaApple(
            key_id=settings.apple_key_id,
            issuer_id=settings.apple_issuer_id,
            bundle_id=settings.apple_bundle_id,
            key_p8=settings.apple_key_p8,
        )

    if plataforma == "android":
        from loja.google import LojaGoogle

        return LojaGoogle(
            service_account_json=settings.google_service_account_json,
            package_name=settings.google_package_name,
        )

    raise ErroDeLoja("Plataforma de compra desconhecida.")
