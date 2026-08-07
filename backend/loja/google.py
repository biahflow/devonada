import json
import time
from datetime import datetime, timezone

import httpx
import jwt

from loja.base import Compra, ErroDeLoja

"""
Google Play Developer API — `purchases.subscriptionsv2.get`.

Sem SDK do Google de propósito. O fluxo inteiro é um JWT assinado com a chave da
service account trocado por um access token, e depois um GET — duas chamadas
`httpx` contra as ~40 dependências transitivas que `google-api-python-client`
traz. A camada existe justamente para isolar isso; encher o `requirements.txt`
para economizar trinta linhas aqui é o negócio errado.
"""

TOKEN_URL = "https://oauth2.googleapis.com/token"
BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3"
ESCOPO = "https://www.googleapis.com/auth/androidpublisher"

# `subscriptionState` da subscriptionsv2.
_ATIVOS = {
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    "SUBSCRIPTION_STATE_CANCELED",  # cancelada mas paga até o fim do período
}

_ERRO_GENERICO = (
    "Não deu para conferir sua compra com o Google Play. Tente de novo em alguns minutos."
)


class LojaGoogle:
    def __init__(self, service_account_json: str, package_name: str, timeout: float = 10.0) -> None:
        if not (service_account_json and package_name):
            raise ErroDeLoja(
                "As compras ainda não estão configuradas neste servidor. Fale com o suporte."
            )
        try:
            self._conta = json.loads(service_account_json)
        except ValueError as e:
            raise ErroDeLoja(
                "As compras ainda não estão configuradas neste servidor. Fale com o suporte."
            ) from e
        self._package = package_name
        self._timeout = timeout

    def _access_token(self) -> str:
        """
        Fluxo *JWT bearer* da conta de serviço: assinamos uma asserção com a
        chave privada e o Google devolve um access token de uma hora.

        NÃO GUARDAMOS O TOKEN EM CACHE. Uma assinatura RS256 custa
        milissegundos e acontece uma vez por conferência — que acontece uma vez
        por abertura de app, não por requisição. Cache aqui seria estado
        compartilhado entre workers para economizar o que não dói.
        """
        agora = int(time.time())
        asercao = jwt.encode(
            {
                "iss": self._conta.get("client_email"),
                "scope": ESCOPO,
                "aud": TOKEN_URL,
                "iat": agora,
                "exp": agora + 3600,
            },
            self._conta.get("private_key", ""),
            algorithm="RS256",
        )

        try:
            r = httpx.post(
                TOKEN_URL,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": asercao,
                },
                timeout=self._timeout,
            )
            r.raise_for_status()
            return str(r.json()["access_token"])
        except (httpx.HTTPError, KeyError, ValueError) as e:
            raise ErroDeLoja(_ERRO_GENERICO) from e

    def conferir(self, recibo: str) -> Compra:
        """
        `recibo` é o `purchaseToken` que o Play Billing entregou ao app.

        Mesmo desenho do adaptador da Apple: o valor vindo do aparelho é uma
        CHAVE DE BUSCA, e quem afirma até quando a assinatura vale é o Google,
        consultado daqui com credencial que só o servidor tem. Um app modificado
        não tem como fabricar um token que o Google reconheça.
        """
        try:
            r = httpx.get(
                f"{BASE}/applications/{self._package}/purchases/subscriptionsv2/tokens/{recibo}",
                headers={"Authorization": f"Bearer {self._access_token()}"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as e:
            raise ErroDeLoja(_ERRO_GENERICO) from e

        if r.status_code in (400, 404, 410):
            raise ErroDeLoja(
                "O Google Play não reconheceu essa compra. Se você acabou de assinar, "
                "aguarde um minuto e toque em restaurar."
            )
        if r.status_code != 200:
            raise ErroDeLoja(_ERRO_GENERICO)

        try:
            dados = r.json()
        except ValueError as e:
            raise ErroDeLoja(_ERRO_GENERICO) from e

        return self._para_compra(recibo, dados)

    def _para_compra(self, token: str, dados: dict) -> Compra:
        itens = dados.get("lineItems") or []
        if not itens:
            raise ErroDeLoja(_ERRO_GENERICO)

        # A linha de maior validade, pelo mesmo motivo do adaptador da Apple:
        # na dúvida entre tirar acesso de quem pagou e dar um dia a mais, o erro
        # barato é o segundo.
        melhor = max(itens, key=lambda i: str(i.get("expiryTime") or ""))
        expira = self._para_data(melhor.get("expiryTime"))
        if expira is None:
            raise ErroDeLoja(_ERRO_GENERICO)

        estado = str(dados.get("subscriptionState", ""))
        if estado not in _ATIVOS:
            # Expirada, pendente, pausada ou em espera. Vence agora em vez de
            # levantar erro: não é falha de conferência, é resposta legítima —
            # o Google está dizendo que esta assinatura não vale.
            expira = datetime.now(timezone.utc)

        return Compra(
            transacao_original_id=str(dados.get("latestOrderId") or token),
            # O TOKEN, e não o `latestOrderId`. A API do Google consulta por
            # `purchaseToken`, e o `orderId` — que é o análogo do id da Apple e
            # o que grava a unicidade — não serve para consultar nada. É por
            # isso que `chave_consulta` existe como campo separado.
            chave_consulta=token,
            produto_id=str(melhor.get("productId", "")),
            expira_em=expira,
            ambiente="sandbox" if dados.get("testPurchase") else "production",
            renovacao_automatica=bool(melhor.get("autoRenewingPlan", {}).get("autoRenewEnabled")),
            cancelada_em=self._para_data(
                (dados.get("canceledStateContext") or {}).get("canceledTime")
            ),
        )

    def _para_data(self, valor: object) -> datetime | None:
        """O Google manda RFC 3339 com Z; `fromisoformat` só aceita o offset."""
        if not isinstance(valor, str) or not valor:
            return None
        try:
            return datetime.fromisoformat(valor.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            return None
