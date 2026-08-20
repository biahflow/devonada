"""marco unique tenant tipo

Revision ID: 116f2181bdda
Revises: f3a92c47b8d1
Create Date: 2026-08-20 07:59:31.290087

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '116f2181bdda'
down_revision: Union[str, Sequence[str], None] = 'f3a92c47b8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # A idempotência de `registrar_marcos` (backend/routers/marcos.py) morava
    # só em código: SELECT dos tipos já gravados, depois INSERT do que falta.
    # Isso cobre o caminho sequencial, mas não a corrida — duas requisições do
    # mesmo tenant podem passar juntas pelo SELECT e inserir a mesma linha
    # duas vezes (o app abre e várias telas chamam `GET /v1/dividas/resumo` ao
    # mesmo tempo, que é onde o marco de rota nasce). A garantia passa a ser
    # do banco: uma corrida agora levanta `IntegrityError` em vez de gravar
    # linha órfã, e o router trata esse erro dentro de um SAVEPOINT como
    # "esse marco já existe".
    op.create_unique_constraint("uq_marco_tenant_tipo", "marco", ["tenant_id", "tipo"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_marco_tenant_tipo", "marco", type_="unique")
