import os
import sys
from collections.abc import Iterator
from pathlib import Path

# O backend não é um pacote instalável; os módulos são importados pela raiz.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TOKEN = "token-de-teste"
os.environ["BUDDY_API_TOKEN"] = TOKEN
os.environ["BUDDY_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

# A suíte NÃO herda a configuração de LLM da máquina de quem roda. Sem estas
# linhas, `backend/.env` decide qual provedor e qual implementação os testes
# exercitam — e um `.env` desatualizado quebra a suíte por um motivo que não
# tem nada a ver com o código sob teste. (Foi o que aconteceu.)
os.environ["BUDDY_LLM_PROVIDER"] = "openai"
os.environ["BUDDY_EXTRATOR"] = "llm"
os.environ["BUDDY_ASSISTENTE"] = "determinista"

# NENHUM TESTE TOCA A REDE. Variável de ambiente vence o `.env` no
# pydantic-settings, então zerar as chaves aqui garante que uma chave real na
# máquina do desenvolvedor não transforme a suíte em chamada paga — e não faça
# um teste passar pelo motivo errado, que foi o que aconteceu: o teste de
# "sem chave configurada" passava porque a API real respondia com erro.
os.environ["OPENAI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import db as db_module  # noqa: E402
from main import app  # noqa: E402
from orm import Base  # noqa: E402

"""
A suíte roda em SQLite por padrão — rápido e sem infraestrutura.

Para rodar contra o MESMO banco da produção, aponte a variável:

    BUDDY_TEST_DATABASE_URL=postgresql+psycopg://buddy:buddy@localhost:5433/buddy_test pytest

SQLite não pega divergência de dialeto: constraint que só o Postgres aplica,
precisão de BigInteger, comportamento de índice. Rodar contra Postgres antes de
release é o que fecha essa lacuna — e por isso a troca é uma variável de
ambiente, não uma edição de código.
"""

URL_TESTE = os.environ.get("BUDDY_TEST_DATABASE_URL")


@pytest.fixture
def engine():
    if URL_TESTE:
        eng = create_engine(URL_TESTE, poolclass=StaticPool)
    else:
        eng = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

    # Base limpa a cada teste: resíduo de um teste anterior transformaria
    # asserção de contagem em falso positivo.
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    try:
        yield eng
        Base.metadata.drop_all(eng)
    finally:
        # `dispose()` OBRIGATÓRIO, e o `finally` é o que garante que ele roda
        # mesmo quando o teste falha. Um engine por teste que nunca devolve a
        # conexão esgota o `max_connections` do Postgres — em SQLite em memória
        # isso passava despercebido, e a suíte só quebrou quando cresceu o
        # bastante para estourar o limite ("sorry, too many clients already").
        eng.dispose()


@pytest.fixture
def sessao(engine) -> Iterator[Session]:
    Local = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    s = Local()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def client(engine, sessao) -> Iterator[TestClient]:
    Local = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def get_db_teste():
        s = Local()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[db_module.get_db] = get_db_teste
    # O processamento em background abre a própria sessão — aponta para a de teste.
    db_module.SessionLocal = Local

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {TOKEN}"}
