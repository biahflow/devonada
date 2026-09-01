from dataclasses import dataclass
from typing import Protocol, runtime_checkable

"""
Camada de identidade social.

Este pacote é a ÚNICA parte do backend que confere um token de Sign in with
Apple ou de Google Sign-In. Quem entra por provedor — hoje só
`routers/auth.py` e a reconfirmação de `routers/conta.py` — usa `Verificador` e
não sabe o que está do outro lado.

Mesmo desenho da camada de LLM (ADR 0007), do correio e da loja (ADR 0013), e
pelos mesmos dois motivos: a suíte precisa exercitar o caminho inteiro sem tocar
a rede, e trocar de provedor não pode significar editar a rota que abre sessão.

POR QUE A CONFERÊNCIA É NO SERVIDOR, E NÃO NO APP: o cliente é a parte que o
usuário controla. Um app modificado que diga "a Apple confirmou que sou o
fulano" é trivial de construir, e a única resposta possível é não perguntar a
ele. O token vem do aparelho porque é lá que o provedor o entrega, mas quem
decide se ele vale é a chave pública do provedor, conferida daqui.

O QUE ESTA CAMADA NUNCA RECEBE: dado financeiro do usuário. Ela vê um token
assinado e devolve um identificador e um e-mail — nunca renda, dívida, saldo ou
credor (guardrail 5). O provedor não precisa, e o que não é enviado não vaza.

O QUE ELA NUNCA DEVOLVE: nome, foto, telefone ou qualquer outro dado do perfil.
Os dois provedores oferecem mais do que isto; pedir o que nenhuma tela usa é
coletar por coletar, e minimização é regra (guardrail 5).
"""

PROVEDORES = ("apple", "google")


@dataclass(frozen=True)
class Identidade:
    """
    O que o provedor afirma sobre quem está entrando, normalizado entre os dois.

    `sub` é a CHAVE ESTÁVEL, e é ele — não o e-mail — que identifica a pessoa no
    nosso banco. O e-mail muda: quem usa "Ocultar meu e-mail" da Apple pode
    desligar o encaminhamento, e conta de Google corporativa troca de domínio. O
    `sub` é o mesmo enquanto a pessoa não revogar o acesso ao app.

    `email_verificado` NÃO é adorno. É ele que autoriza reconhecer uma conta que
    já existe: ligar um login social a uma conta pelo e-mail sem o provedor
    afirmar que o e-mail é dele seria aceitar que qualquer um digite o e-mail do
    vizinho no cadastro do provedor e entre na conta dele.

    `email` pode vir `None`. A Apple só entrega o e-mail quando a pessoa autoriza
    o escopo, e quem revoga depois volta sem ele.
    """

    provedor: str
    sub: str
    email: str | None
    email_verificado: bool


class ErroDeIdentidade(Exception):
    """
    Falha de conferência que o USUÁRIO precisa entender.

    A mensagem chega à tela: pt-BR, para leigo, sem nome de claim, de algoritmo
    nem de código de status do provedor.

    ATENÇÃO AO TOM: quem vê esta mensagem acabou de tocar num botão que
    prometia ser o caminho fácil. "Token inválido" não diz nada a essa pessoa, e
    "credencial recusada" soa como acusação. A frase diz o que houve e o que
    fazer.
    """


class IdentidadeNaoConfigurada(ErroDeIdentidade):
    """
    O servidor não tem a audiência do provedor configurada.

    SEPARADA DE `ErroDeIdentidade` porque a resposta HTTP é outra: token
    recusado é `401` e culpa da credencial; audiência vazia é `503` e culpa
    nossa. Responder `401` aqui mandaria o usuário tentar de novo para sempre
    contra um servidor que nunca vai aceitar, e esconderia de nós que a
    configuração está faltando.
    """


@runtime_checkable
class Verificador(Protocol):
    def verificar(self, token: str) -> Identidade: ...
