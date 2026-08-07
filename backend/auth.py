import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status

from config import Settings, get_settings

# Duração do access token. Curta de propósito (ADR 0012): ele não consulta o
# banco, então é a janela em que uma sessão revogada continua valendo. Quinze
# minutos é o preço de não pagar uma consulta por requisição.
ACESSO_MINUTOS = 15

# Duração do refresh. Trinta dias é quanto o app pode ficar sem ser aberto sem
# obrigar a redigitar senha.
REFRESH_DIAS = 30

ALGORITMO = "HS256"

SESSAO_INVALIDA = "Sua sessão expirou. Entre de novo para continuar."


def agora() -> datetime:
    return datetime.now(timezone.utc)


def como_utc(quando: datetime) -> datetime:
    """
    Datetime do banco, comparável com `agora()`.

    SQLite não guarda fuso e devolve `datetime` ingênuo; Postgres com
    `timezone=True` devolve com fuso. Comparar um com o outro levanta
    `TypeError`, e sem esta função a expiração de sessão funcionaria num banco e
    quebraria no outro — exatamente a classe de divergência que o `conftest`
    avisa que SQLite não pega. Aqui ela é pega porque o erro é de tipo, não de
    resultado; a próxima pode não ser.

    O que vem sem fuso É UTC: toda escrita passa por `agora()`.
    """
    return quando if quando.tzinfo else quando.replace(tzinfo=timezone.utc)


def hash_de_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)).decode()


@lru_cache
def hash_falso() -> str:
    """
    Hash de uma senha que ninguém tem.

    Serve para o login rodar a verificação mesmo quando o e-mail não existe: sem
    isso, a rota responde na hora para e-mail desconhecido e devagar para e-mail
    conhecido, e o TEMPO responde a pergunta que a mensagem se recusou a
    responder.

    Preguiçoso e memoizado: calcular no import custaria 250 ms em todo processo
    que só quisesse importar este módulo, e leria a configuração antes de quem
    a define.
    """
    return hash_de_senha("nao-e-a-senha-de-ninguem")


def senha_confere(senha: str, hash_guardado: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode(), hash_guardado.encode())
    except ValueError:
        # Hash corrompido no banco não é motivo para 500 no login.
        return False


def hash_de_token(valor: str) -> str:
    """
    SHA-256 puro, e não bcrypt.

    O token tem 32 bytes de entropia — não é adivinhável por dicionário, que é o
    problema que o custo do bcrypt resolve. E a verificação roda em toda
    renovação: bcrypt aqui seria pagar 100 ms para proteger contra um ataque que
    não se aplica.
    """
    return hashlib.sha256(valor.encode()).hexdigest()


def novo_refresh() -> str:
    return secrets.token_urlsafe(32)


def _segredo(settings: Settings) -> str:
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "O servidor está sem chave de sessão. Avise quem cuida dele."},
        )
    return settings.jwt_secret


def emitir_acesso(settings: Settings, tenant_id: str, usuario_id: str) -> tuple[str, datetime]:
    """
    O JWT carrega tenant e usuário, e nada mais.

    Nome, e-mail ou qualquer dado do usuário dentro do token seria dado pessoal
    trafegando em base64 legível a cada requisição (guardrail 5) — e um token é
    a coisa mais copiada de um app.
    """
    expira_em = agora() + timedelta(minutes=ACESSO_MINUTOS)
    token = jwt.encode(
        {"sub": tenant_id, "uid": usuario_id, "exp": expira_em},
        _segredo(settings),
        algorithm=ALGORITMO,
    )
    return token, expira_em


def _decodificar(request: Request, settings: Settings) -> dict:
    header = request.headers.get("Authorization", "")
    prefixo = "Bearer "
    if not header.startswith(prefixo):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": SESSAO_INVALIDA},
        )

    try:
        return jwt.decode(
            header[len(prefixo) :].strip(),
            _segredo(settings),
            algorithms=[ALGORITMO],
        )
    except jwt.PyJWTError:
        # Token expirado, assinatura errada, corpo ilegível: a saída do usuário é
        # a mesma nos três, e distinguir só ajudaria quem está tentando forjar.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": SESSAO_INVALIDA},
        )


def tenant_atual(request: Request, settings: Settings = Depends(get_settings)) -> str:
    """
    Resolve o tenant a partir do access token.

    O cliente NUNCA envia tenant_id — ele vem daqui (guardrail 6). Toda query
    filtra por ele desde o Bloco 0, e é por isso que trocar o token fixo do beta
    (ADR 0006) por conta de verdade (ADR 0012) foi trabalho de auth, e não uma
    refatoração de isolamento em cada rota.
    """
    return _decodificar(request, settings)["sub"]


def usuario_atual(request: Request, settings: Settings = Depends(get_settings)) -> str:
    """
    O id do usuário, para as rotas que agem sobre a CONTA e não sobre os dados.

    Separado de `tenant_atual` porque são perguntas diferentes: "de quem é este
    dado" e "quem está pedindo". Hoje há um usuário por tenant e as duas
    respostas andam juntas; no dia da conta compartilhada, deixam de andar.
    """
    return _decodificar(request, settings)["uid"]
