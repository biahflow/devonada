from config import get_settings
from correio.base import Correio, ErroDeCorreio, Mensagem

__all__ = ["Correio", "ErroDeCorreio", "Mensagem", "obter_correio"]


def obter_correio() -> Correio:
    """
    Escolhe a implementação por `BUDDY_CORREIO`.

    Provedor desconhecido levanta `ErroDeCorreio` em vez de cair num default
    silencioso: um typo na variável de ambiente que faz o servidor "enviar" para
    lugar nenhum é pior que um erro na cara — o usuário esperaria um código que
    nunca chega, e ninguém saberia por quê.
    """
    settings = get_settings()

    if settings.correio == "memoria":
        from correio.memoria import CorreioMemoria

        return CorreioMemoria()

    if settings.correio == "smtp":
        from correio.smtp import CorreioSMTP

        return CorreioSMTP(
            host=settings.smtp_host,
            port=settings.smtp_port,
            usuario=settings.smtp_usuario,
            senha=settings.smtp_senha,
            remetente=settings.smtp_remetente,
        )

    raise ErroDeCorreio("O servidor está com o envio de e-mail mal configurado.")
