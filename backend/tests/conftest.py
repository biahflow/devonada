import json
import os
import sys
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

# O backend não é um pacote instalável; os módulos são importados pela raiz.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["DEVONADA_JWT_SECRET"] = "segredo-de-teste-que-nao-existe-em-lugar-nenhum"
os.environ["DEVONADA_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

# E-MAIL TAMBÉM NÃO TOCA A REDE. O correio de memória guarda numa lista, e é
# por ele que o teste de recuperação de senha lê o código — a alternativa seria
# um mock por teste, que provaria menos e quebraria mais.
os.environ["DEVONADA_CORREIO"] = "memoria"

# Custo de bcrypt no teste: 4 rodadas em vez de 12. A suíte cria usuário em
# quase todo teste, e 12 rodadas custam ~250 ms cada — a suíte inteira passaria
# de 3 s para minutos. O custo de produção continua no código, não aqui.
os.environ["DEVONADA_BCRYPT_ROUNDS"] = "4"

# A suíte NÃO herda a configuração de LLM da máquina de quem roda. Sem estas
# linhas, `backend/.env` decide qual provedor e qual implementação os testes
# exercitam — e um `.env` desatualizado quebra a suíte por um motivo que não
# tem nada a ver com o código sob teste. (Foi o que aconteceu.)
os.environ["DEVONADA_LLM_PROVIDER"] = "openai"
os.environ["DEVONADA_EXTRATOR"] = "llm"
os.environ["DEVONADA_ASSISTENTE"] = "determinista"

# A LOJA TAMBÉM NÃO TOCA A REDE. O adaptador de memória confere um recibo que
# descreve a si mesmo, então dá para exercitar teste vencido, compra, renovação
# e cancelamento sem conta de desenvolvedor em loja nenhuma — e sem mock, que
# provaria menos e quebraria mais.
#
# NENHUMA FIXTURE PRECISA DAR ASSINATURA. Toda conta da suíte nasce pela rota de
# registro, e uma conta recém-criada está dentro do teste de 7 dias. Foi por
# isso que a trava de escrita entrou sem mexer em um único dos 420 testes que já
# existiam. Quem quer o outro lado usa a fixture `assinatura_vencida`.
os.environ["DEVONADA_LOJA"] = "memoria"

# O LOGIN SOCIAL TAMBÉM NÃO TOCA A REDE. O adaptador de memória confere um token
# que descreve a si mesmo, então dá para exercitar primeiro login, login
# repetido, reconhecimento de conta e recusa sem conta na Apple Developer nem
# projeto no Google Cloud — e sem mock, que provaria menos e quebraria mais.
#
# NENHUM TESTE ANTERIOR MUDA POR CAUSA DISTO. A fixture `auth` continua criando
# a conta pela rota de e-mail e senha; quem quer o outro lado usa `social`.
os.environ["DEVONADA_IDENTIDADE"] = "memoria"

# NENHUM TESTE TOCA A REDE. Variável de ambiente vence o `.env` no
# pydantic-settings, então zerar as chaves aqui garante que uma chave real na
# máquina do desenvolvedor não transforme a suíte em chamada paga — e não faça
# um teste passar pelo motivo errado, que foi o que aconteceu: o teste de
# "sem chave configurada" passava porque a API real respondia com erro.
os.environ["OPENAI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import db as db_module  # noqa: E402
from main import app  # noqa: E402
from orm import Base  # noqa: E402

"""
A suíte roda em SQLite por padrão — rápido e sem infraestrutura.

Para rodar contra o MESMO banco da produção, aponte a variável:

    DEVONADA_TEST_DATABASE_URL=postgresql+psycopg://devonada:devonada@localhost:5433/devonada_test pytest

SQLite não pega divergência de dialeto: constraint que só o Postgres aplica,
precisão de BigInteger, comportamento de índice. Rodar contra Postgres antes de
release é o que fecha essa lacuna — e por isso a troca é uma variável de
ambiente, não uma edição de código.
"""

URL_TESTE = os.environ.get("DEVONADA_TEST_DATABASE_URL")

# A conta que a fixture `auth` cria. Ela é a PRIMEIRA do banco em todo teste, e
# por isso adota `DEVONADA_TENANT_ID` — o mesmo tenant que os testes anteriores ao
# M8 já assumiam sem saber.
CONTA_EMAIL = "teste@exemplo.com"
CONTA_SENHA = "senha-de-teste"


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
def auth(client) -> dict[str, str]:
    """
    Uma conta de verdade, criada pela rota de verdade.

    A suíte inteira autentica por aqui — os 370 testes que existiam antes do M8
    não conhecem o mecanismo, e por isso a troca do token fixo (ADR 0006) por
    conta de usuário (ADR 0012) custou esta fixture e nada mais.

    Cadastrar pela ROTA, e não semeando a tabela, é o que garante que o tenant
    usado pelos testes é o mesmo que o registro produz. Semear teria deixado
    passar o caminho de adoção do tenant do beta.
    """
    r = client.post("/v1/auth/registro", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['sessao']['acesso']}"}


@pytest.fixture
def token_social():
    """
    Um token do adaptador de identidade de memória: um JSON que descreve a si
    mesmo, no mesmo espírito do recibo da loja de memória.

    Assinar um token de verdade exigiria a chave privada da Apple — que não
    existe nesta máquina e não deve existir. O que a suíte precisa provar é o
    que a ROTA faz com uma identidade conferida, e isso o adaptador entrega
    inteiro. Que a conferência real recusa token forjado é responsabilidade do
    PyJWT, e o teste que a exercitasse estaria testando a biblioteca.
    """

    def montar(sub: str, email: str | None = None, email_verificado: bool = True) -> str:
        return json.dumps(
            {"sub": sub, "email": email, "emailVerificado": email_verificado}
        )

    return montar


@pytest.fixture(autouse=True)
def caixa_de_email_limpa():
    """
    Mensagem de um teste vazando para o seguinte transformaria asserção de
    conteúdo em falso positivo — o mesmo motivo de a base ser recriada por teste.
    """
    from correio.memoria import limpar

    limpar()
    yield
    limpar()


@pytest.fixture
def renda_legada(sessao):
    """
    Semeia `perfil.renda_mensal` direto na tabela: a linha de antes do M7.

    Desde que a renda passou a morar em `fonte_renda`, `PUT /v1/perfil` cria uma
    fonte — e o caminho do piso legal deixou de ser alcançável pela API. Ele
    continua no código para a linha antiga que nunca ganhou fonte, e semear a
    coluna é o único jeito honesto de exercitá-lo. Um teste que chamasse
    `PUT /v1/perfil` e dissesse estar testando o piso passaria pelo motivo
    errado.
    """
    import orm as orm_module
    from config import get_settings

    def semear(valor: int) -> None:
        sessao.add(
            orm_module.Perfil(tenant_id=get_settings().tenant_id, renda_mensal=valor)
        )
        sessao.commit()

    return semear


@pytest.fixture
def assinatura_vencida(sessao):
    """
    Envelhece a conta para além do teste, deixando-a em somente leitura.

    ENVELHECER A CONTA, e não semear uma assinatura expirada, porque são estados
    diferentes: assinatura vencida com teste em curso ainda escreve — o teste é
    o piso, não a assinatura. Semear a linha expirada testaria um cenário que
    não bloqueia nada, e o teste passaria acreditando ter provado a trava.

    `criado_em` é `server_default`, então a rota de registro sempre grava
    "agora"; mexer nele por fora é o único jeito de alcançar o outro lado dos 7
    dias sem congelar o relógio da suíte inteira.
    """
    import orm as orm_module

    def envelhecer(dias: int = 30) -> None:
        from config import get_settings

        usuario = sessao.scalars(
            select(orm_module.Usuario).where(
                orm_module.Usuario.tenant_id == get_settings().tenant_id
            )
        ).first()
        assert usuario is not None, "chame a fixture `auth` antes desta"
        usuario.criado_em = datetime.now(timezone.utc) - timedelta(days=dias)
        sessao.commit()

    return envelhecer


def recibo_de_memoria(
    transacao: str = "txn-1",
    dias: int = 30,
    produto: str = "devonada.assinatura.mensal",
    renovacao: bool = True,
) -> str:
    """
    O recibo que `loja/memoria.py` sabe conferir: um JSON que descreve a compra.

    Helper e não fixture porque quase todo teste de compra precisa de dois
    recibos diferentes na mesma função — o da compra e o da renovação.
    """
    return json.dumps(
        {
            "transacaoOriginalId": transacao,
            "produtoId": produto,
            "expiraEm": (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat(),
            "ambiente": "sandbox",
            "renovacaoAutomatica": renovacao,
        }
    )
