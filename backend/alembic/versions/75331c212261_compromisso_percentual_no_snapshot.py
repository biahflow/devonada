"""compromisso percentual no snapshot

Revision ID: 75331c212261
Revises: 482c266f5c6a
Create Date: 2026-08-20 16:37:15.644318

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75331c212261'
down_revision: Union[str, Sequence[str], None] = '482c266f5c6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ADITIVA E NULLABLE, sem backfill — gêmea de `caixa_snapshot.respiro`
    # (M11) e pelo mesmo motivo: a partir da 482c266f5c6a o compromisso
    # percentual entra na cascata e derruba a `capacidade_maxima`, e a foto
    # tem de conter a linha que a derrubou. Sem esta coluna, o histórico
    # mostraria uma capacidade menor sem explicá-la.
    #
    # Centavos, como toda coluna de dinheiro deste banco: o percentual incide
    # sobre a renda líquida DAQUELE mês, e guardar só a alíquota obrigaria a
    # refazer a conta com uma renda que já mudou.
    #
    # `NULL` em toda foto já gravada é a verdade — elas nasceram antes de o
    # compromisso existir. Um `0` de backfill afirmaria "declarou zero", que é
    # escolha e não ausência.
    op.add_column(
        'caixa_snapshot',
        sa.Column('compromisso_percentual', sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('caixa_snapshot', 'compromisso_percentual')
