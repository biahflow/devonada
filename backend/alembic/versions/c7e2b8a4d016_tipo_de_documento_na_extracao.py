"""tipo de documento na extracao

Revision ID: c7e2b8a4d016
Revises: a1c2e3f40b5d
Create Date: 2026-08-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2b8a4d016'
# Encadeada na cabeça VIGENTE, confirmada por `alembic heads` no início da tarefa
# (M13). Uma migração nascida de outro pai partiria a cadeia em dois ramos.
down_revision: Union[str, Sequence[str], None] = 'a1c2e3f40b5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # A extração passa a rotear prompt e schema por TIPO de documento (M13:
    # contrato, boleto, carta, print). Aditiva: `server_default='contrato'` faz
    # toda leitura já gravada se ler como contrato — que é o que ela era, quando
    # `contrato` era o único tipo. NOT NULL porque, com o default, nenhuma linha
    # fica sem valor.
    op.add_column(
        "extracao",
        sa.Column(
            "tipo",
            sa.String(length=20),
            nullable=False,
            server_default="contrato",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("extracao", "tipo")
