"""lembrete de fechamento

Revision ID: c58e1f7b2d31
Revises: b3c17d2e9a04
Create Date: 2026-08-07 14:38:11.402117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c58e1f7b2d31'
down_revision: Union[str, Sequence[str], None] = 'b3c17d2e9a04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # NULLABLE de propósito: `None` é o lembrete desligado, que é o estado de
    # quem já usa o app hoje. Um default numérico ligaria a notificação para
    # todo mundo sem ninguém ter pedido.
    op.add_column(
        'perfil', sa.Column('fechamento_dia_do_mes', sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('perfil', 'fechamento_dia_do_mes')
