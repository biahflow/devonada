"""assinatura

Revision ID: d94a6b18c7f2
Revises: a71d4e9c05b2
Create Date: 2026-08-07 18:12:44.905331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd94a6b18c7f2'
down_revision: Union[str, Sequence[str], None] = 'a71d4e9c05b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SEM MIGRAÇÃO DE DADO, ao contrário da migration do M7. Não há coluna
    # anterior a converter: quem já existe passa a ter o teste contado de
    # `usuario.criado_em`, que já está gravado.
    #
    # CONSEQUÊNCIA QUE PRECISA ESTAR DITA, e é a única armadilha desta migration:
    # as contas do beta foram criadas há dias, então elas nascem do outro lado
    # do teste de 7 dias e caem em somente leitura no primeiro deploy. Se não
    # for o desejado, a saída limpa é semear uma linha de cortesia aqui — com
    # `expira_em` no futuro e `plataforma='cortesia'` — e NUNCA um caso especial
    # em `domain/assinatura.py`. O domínio não deve conhecer quem é do beta.
    op.create_table(
        'assinatura',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('plataforma', sa.String(length=10), nullable=False),
        sa.Column('produto_id', sa.String(length=120), nullable=False),
        sa.Column('transacao_original_id', sa.String(length=120), nullable=False),
        sa.Column('chave_consulta', sa.Text(), nullable=False),
        sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ambiente', sa.String(length=20), nullable=False),
        sa.Column('renovacao_automatica', sa.Boolean(), nullable=False),
        sa.Column(
            'criado_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'atualizado_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    # UMA LINHA POR TENANT, garantida pelo banco e não pela rota. Duas
    # requisições de compra simultâneas — o duplo toque no botão, que acontece —
    # passam pelo mesmo SELECT sem achar nada e inserem as duas.
    op.create_index('ix_assinatura_tenant_id', 'assinatura', ['tenant_id'], unique=True)

    # Idempotência da restauração, pela mesma razão: é o banco que garante que o
    # mesmo recibo reenviado não vira assinatura nova.
    op.create_index(
        'ix_assinatura_transacao_original_id',
        'assinatura',
        ['transacao_original_id'],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_assinatura_transacao_original_id', table_name='assinatura')
    op.drop_index('ix_assinatura_tenant_id', table_name='assinatura')
    op.drop_table('assinatura')
