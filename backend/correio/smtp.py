import smtplib
from email.message import EmailMessage

from correio.base import Correio, ErroDeCorreio, Mensagem


class CorreioSMTP(Correio):
    """
    Envio por SMTP com STARTTLS.

    A configuração incompleta falha AQUI, na construção, e não no meio do envio:
    "servidor sem e-mail configurado" é uma frase que o usuário consegue levar a
    quem cuida do servidor, e "connection refused" no meio de uma redefinição de
    senha não é.
    """

    def __init__(self, host: str, port: int, usuario: str, senha: str, remetente: str) -> None:
        if not host or not remetente:
            raise ErroDeCorreio(
                "O servidor está sem envio de e-mail configurado. Avise quem cuida dele."
            )
        self._host = host
        self._port = port
        self._usuario = usuario
        self._senha = senha
        self._remetente = remetente

    def enviar(self, mensagem: Mensagem) -> None:
        msg = EmailMessage()
        msg["From"] = self._remetente
        msg["To"] = mensagem.para
        msg["Subject"] = mensagem.assunto
        msg.set_content(mensagem.corpo)

        try:
            with smtplib.SMTP(self._host, self._port, timeout=10) as servidor:
                servidor.starttls()
                if self._usuario:
                    servidor.login(self._usuario, self._senha)
                servidor.send_message(msg)
        except (smtplib.SMTPException, OSError) as e:
            # NADA da exceção original vai para a mensagem: ela carrega host,
            # porta e às vezes o e-mail do destinatário, e o `message` é exibido
            # direto ao usuário (guardrail 5).
            raise ErroDeCorreio(
                "Não deu para enviar o e-mail agora. Tente de novo em instantes."
            ) from e
