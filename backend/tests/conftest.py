import os
import sys
from collections.abc import Iterator
from pathlib import Path

# O backend não é um pacote instalável; os módulos são importados pela raiz.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TOKEN = "token-de-teste"
os.environ["BUDDY_API_TOKEN"] = TOKEN
os.environ["BUDDY_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import db as db_module  # noqa: E402
from main import app  # noqa: E402
from orm import Base  # noqa: E402

"""
DIVERGÊNCIA CONHECIDA: os testes rodam em SQLite; produção é Postgres.

O ORM usa só tipos portáveis (String, BigInteger, Integer, Date, DateTime,
Boolean, Text), então o comportamento é equivalente para o que estes testes
verificam — regras de dinheiro, auth e isolamento por tenant. O que SQLite NÃO
pega é divergência de dialeto: constraint que só o Postgres aplica, precisão de
BigInteger, comportamento de índice.

Está registrado em docs/backend.md. Rodar a suíte contra Postgres antes de
qualquer release é o passo que fecha essa lacuna.
"""


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


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
