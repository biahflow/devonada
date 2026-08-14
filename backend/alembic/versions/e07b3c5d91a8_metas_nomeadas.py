"""metas nomeadas

Revision ID: e07b3c5d91a8
Revises: d94a6b18c7f2
Create Date: 2026-08-10 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e07b3c5d91a8'
down_revision: Union[str, Sequence[str], None] = 'd94a6b18c7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ADITIVA, E SÓ ADITIVA. As seis colunas de meta do `perfil` (reserva_aporte,
    # aposentadoria_aporte e companhia) NÃO são migradas para cá, e não é
    # esquecimento: elas alimentam a cascata de `domain/caixa`, que decide o
    # fechamento do mês. Mover a reserva para uma linha desta tabela faria a
    # capacidade de todo mundo mudar em silêncio no primeiro deploy.
    #
    # Consequência conhecida: o produto passa a ter dois sentidos de "meta". O
    # custo é um parágrafo de documentação (ADR 0017) e os títulos de tela já
    # separam os dois — "Seus potes" e "Suas metas".
    #
    # Nenhuma coluna de valor calculado. `aporte_sugerido` e `status` são
    # derivados a cada resposta em `routers/metas.py`, porque dependem do mês em
    # que a pergunta é feita: gravá-los deixaria a tela mostrando o número de
    # quando a meta foi criada.
    op.create_table(
        'meta',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('emoji', sa.String(length=8), nullable=True),
        # Centavos, como toda coluna de dinheiro deste banco.
        sa.Column('valor_alvo', sa.BigInteger(), nullable=False),
        sa.Column('saldo', sa.BigInteger(), nullable=False),
        # NULLABLE de propósito: meta sem prazo é meta legítima, e sem prazo não
        # existe aporte sugerido nem status.
        sa.Column('data_alvo', sa.String(length=7), nullable=True),
        sa.Column('aporte_mensal', sa.BigInteger(), nullable=True),
        sa.Column('ativa', sa.Boolean(), nullable=False),
        sa.Column(
            'criada_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'atualizada_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_meta_tenant_id'), 'meta', ['tenant_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_meta_tenant_id'), table_name='meta')
    op.drop_table('meta')
