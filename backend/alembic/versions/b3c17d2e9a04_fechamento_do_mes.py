"""fechamento do mes

Revision ID: b3c17d2e9a04
Revises: 39ab0b1d843c
Create Date: 2026-08-07 14:10:22.118904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c17d2e9a04'
down_revision: Union[str, Sequence[str], None] = '39ab0b1d843c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'fechamento_mes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('mes', sa.String(length=7), nullable=False),
        sa.Column(
            'confirmado_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_fechamento_mes_tenant_id'), 'fechamento_mes', ['tenant_id'], unique=False
    )
    # Um fechamento por tenant por mês. A rota já faz upsert, mas a garantia
    # precisa estar no banco: sem ela, duas requisições simultâneas gravariam
    # duas linhas e a leitura do "último fechamento" viraria loteria.
    op.create_unique_constraint(
        'uq_fechamento_mes_tenant_mes', 'fechamento_mes', ['tenant_id', 'mes']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_fechamento_mes_tenant_mes', 'fechamento_mes', type_='unique')
    op.drop_index(op.f('ix_fechamento_mes_tenant_id'), table_name='fechamento_mes')
    op.drop_table('fechamento_mes')
