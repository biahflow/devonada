import time
import uuid
from datetime import datetime, timezone

import httpx
import jwt

from loja.base import Compra, ErroDeLoja

"""
App Store Server API.

CAMINHO DE PRODUÇÃO PRIMEIRO, SANDBOX DEPOIS. As duas são bases separadas e uma
transação de sandbox não existe na de produção — quem consulta só a de produção
recusa a compra do revisor da Apple, que testa em sandbox contra um binário de
produção. Essa é a reprovação clássica de app com assinatura, e ela custa um
ciclo de revisão inteiro.
"""

PRODUCAO = "https://api.storekit.itunes.apple.com"
SANDBOX = "https://api.storekit-sandbox.itunes.apple.com"

# Status de `lastTransactions`, conforme a App Store Server API.
# 1 ativa · 2 expirada · 3 em nova tentativa de cobrança · 4 período de graça · 5 revogada
_ATIVOS = {1, 3, 4}

_ERRO_GENERICO = "Não deu para conferir sua compra com a App Store. Tente de novo em alguns minutos."


class LojaApple:
    def __init__(
        self, key_id: str, issuer_id: str, bundle_id: str, key_p8: str, timeout: float = 10.0
    ) -> None:
        if not (key_id and issuer_id and bundle_id and key_p8):
            # Falha de CONFIGURAÇÃO, não de compra. Ela sobe como erro de loja
            # porque é o que a rota sabe tratar, mas a frase é outra de
            # propósito: dizer "recibo inválido" a quem acabou de pagar, quando
            # o problema é a nossa chave faltando, joga a culpa no usuário e
            # esconde de nós o que está errado.
            raise ErroDeLoja(
                "As compras ainda não estão configuradas neste servidor. Fale com o suporte."
            )
        self._key_id = key_id
        self._issuer_id = issuer_id
        self._bundle_id = bundle_id
        self._key_p8 = key_p8.replace("\\n", "\n")
        self._timeout = timeout

    def _token(self) -> str:
        """
        O JWT que autentica NOSSO servidor na API da Apple, assinado com a
        chave `.p8` da App Store Connect.

        Vida curta de propósito: a Apple aceita até 60 minutos, e usamos 20. Um
        token deste vale para a conta inteira de desenvolvedor, então ele é o
        segredo mais caro do servidor depois do `jwt_secret` — quanto menos
        tempo uma cópia vazada serve, melhor.
        """
        agora = int(time.time())
        return jwt.encode(
            {
                "iss": self._issuer_id,
                "iat": agora,
                "exp": agora + 20 * 60,
                "aud": "appstoreconnect-v1",
                "bid": self._bundle_id,
                "nonce": str(uuid.uuid4()),
            },
            self._key_p8,
            algorithm="ES256",
            headers={"kid": self._key_id, "typ": "JWT"},
        )

    def conferir(self, recibo: str) -> Compra:
        """
        `recibo` é o JWS que o StoreKit entregou ao app.

        O CONTEÚDO DELE NÃO É FONTE DA VERDADE, e é isso que torna o desenho
        seguro sem verificar a cadeia de certificados da Apple aqui: usamos o
        JWS do cliente APENAS para extrair o `originalTransactionId`, que é uma
        chave de busca, e então perguntamos à Apple, por TLS autenticado com a
        nossa chave, o que ela diz sobre essa assinatura. Quem responde
        "está ativa até tal dia" é a Apple, nunca o aparelho.

        Um app modificado pode forjar o JWS. O que ele ganha com isso é apontar
        para o id de outra pessoa — e a resposta da Apple sobre aquele id é a
        mesma com ou sem fraude, então a única coisa que ele consegue é pagar a
        assinatura de um estranho para si. O que ele NÃO consegue é inventar uma
        assinatura que não existe, que é o ataque que importa.

        Ele aceita TAMBÉM o `originalTransactionId` cru, e não é conveniência:
        é o valor que gravamos em `chave_consulta` para reconferir depois. O
        recibo do StoreKit e o id da transação são duas formas de dizer a mesma
        coisa para esta API, que consulta pela segunda.
        """
        transacao_id = self._id_do_recibo(recibo)

        resposta = self._buscar(PRODUCAO, transacao_id)
        if resposta is None:
            # 404 em produção quase sempre significa sandbox, não fraude.
            resposta = self._buscar(SANDBOX, transacao_id)
        if resposta is None:
            raise ErroDeLoja(
                "A App Store não reconheceu essa compra. Se você acabou de assinar, "
                "aguarde um minuto e toque em restaurar."
            )

        return self._para_compra(resposta)

    def _id_do_recibo(self, recibo: str) -> str:
        try:
            # `verify_signature=False` porque o valor extraído é chave de busca,
            # não afirmação em que confiamos. Ver o docstring de `conferir`.
            carga = jwt.decode(recibo, options={"verify_signature": False})
        except jwt.PyJWTError:
            # NÃO É UM JWS. É o `originalTransactionId` cru, que é o que
            # `chave_consulta` guarda para a reconferência. Um id da Apple é
            # numérico e nunca se parece com um JWS, então não há ambiguidade a
            # resolver aqui — se não decodifica, é o id.
            if recibo.strip():
                return recibo.strip()
            raise ErroDeLoja(_ERRO_GENERICO) from None

        transacao_id = carga.get("originalTransactionId") or carga.get("transactionId")
        if not transacao_id:
            raise ErroDeLoja(_ERRO_GENERICO)
        return str(transacao_id)

    def _buscar(self, base: str, transacao_id: str) -> dict | None:
        try:
            r = httpx.get(
                f"{base}/inApps/v1/subscriptions/{transacao_id}",
                headers={"Authorization": f"Bearer {self._token()}"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as e:
            raise ErroDeLoja(_ERRO_GENERICO) from e

        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise ErroDeLoja(_ERRO_GENERICO)

        try:
            return r.json()
        except ValueError as e:
            raise ErroDeLoja(_ERRO_GENERICO) from e

    def _para_compra(self, resposta: dict) -> Compra:
        grupos = resposta.get("data") or []
        transacoes = [t for g in grupos for t in (g.get("lastTransactions") or [])]
        if not transacoes:
            raise ErroDeLoja(
                "A App Store não reconheceu essa compra. Se você acabou de assinar, "
                "aguarde um minuto e toque em restaurar."
            )

        # A MAIS DISTANTE, e não a primeira da lista: uma conta pode ter mais de
        # uma transação no grupo (troca de plano, upgrade), e a ordem não é
        # contratual. Escolher a de maior validade é o que não tira acesso de
        # quem pagou — o critério certo quando a dúvida é entre cobrar duas
        # vezes e liberar um dia a mais.
        melhor = max(transacoes, key=lambda t: self._expira_em(t) or datetime.min.replace(
            tzinfo=timezone.utc
        ))

        expira = self._expira_em(melhor)
        if expira is None:
            raise ErroDeLoja(_ERRO_GENERICO)

        info = self._carga(melhor.get("signedTransactionInfo"))
        renovacao = self._carga(melhor.get("signedRenewalInfo"))

        revogada = info.get("revocationDate")
        original = str(info.get("originalTransactionId", ""))
        return Compra(
            transacao_original_id=original,
            # A Apple consulta pelo próprio id, então guardar o JWS inteiro para
            # reconferir seria guardar 2 KB para usar 12 bytes.
            chave_consulta=original,
            produto_id=str(info.get("productId", "")),
            expira_em=expira,
            ambiente=str(info.get("environment", "Production")).lower(),
            # Status 5 é revogada (reembolso, estorno). Ela não renova e não
            # vale, e é o único caso em que `expira_em` no futuro não significa
            # acesso — por isso `expira_em` é zerado para agora logo abaixo.
            renovacao_automatica=(
                melhor.get("status") in _ATIVOS and renovacao.get("autoRenewStatus") == 1
            ),
            cancelada_em=self._ms_para_data(revogada) if revogada else None,
        )

    def _expira_em(self, transacao: dict) -> datetime | None:
        info = self._carga(transacao.get("signedTransactionInfo"))

        # REVOGADA vence agora, independentemente da data de expiração. Quem
        # pediu reembolso e recebeu não continua com acesso até o fim do mês —
        # a Apple já devolveu o dinheiro.
        if transacao.get("status") == 5 or info.get("revocationDate"):
            return datetime.now(timezone.utc)

        return self._ms_para_data(info.get("expiresDate"))

    def _carga(self, jws: str | None) -> dict:
        if not jws:
            return {}
        try:
            return jwt.decode(jws, options={"verify_signature": False})
        except jwt.PyJWTError:
            return {}

    def _ms_para_data(self, ms: object) -> datetime | None:
        """A Apple manda tudo em milissegundos desde a época, em UTC."""
        if not isinstance(ms, (int, float)):
            return None
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
