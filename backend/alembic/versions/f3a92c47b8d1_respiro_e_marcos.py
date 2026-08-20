"""respiro e marcos

Revision ID: f3a92c47b8d1
Revises: e07b3c5d91a8
Create Date: 2026-08-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a92c47b8d1'
down_revision: Union[str, Sequence[str], None] = 'e07b3c5d91a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # UMA LINHA POR TENANT, e não uma coleção. O respiro é linha da cascata, no
    # mesmo nível do aluguel (ADR 0019); duas linhas dariam dois valores para a
    # mesma pergunta. Não há unique constraint porque não há outra tabela deste
    # banco com uma — a garantia mora na rota, como em `perfil`.
    #
    # NENHUMA COLUNA DE VALOR DEFAULT. Ausência de linha significa "nunca
    # declarou", e é o que preserva a cascata de quem não pediu respiro: um
    # percentual de fábrica seria o coeficiente sem fonte que a ADR 0009 proíbe.
    op.create_table(
        'respiro',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        # Centavos, como toda coluna de dinheiro deste banco.
        sa.Column('valor_mensal', sa.BigInteger(), nullable=False),
        # `false` PRESERVA valor e saldo: desativar não é apagar.
        sa.Column('ativo', sa.Boolean(), nullable=False),
        sa.Column('saldo_acumulado', sa.BigInteger(), nullable=False),
        # NULLABLE de propósito: até a primeira virada de mês não houve apuração
        # nenhuma, e gravar um mês aqui afirmaria uma rolagem que não aconteceu.
        sa.Column('ultimo_mes_apurado', sa.String(length=7), nullable=True),
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
    op.create_index(op.f('ix_respiro_tenant_id'), 'respiro', ['tenant_id'], unique=False)

    # LANÇAMENTOS, NÃO SALDO. O disponível do mês é derivado a cada leitura em
    # `domain/caixa.py`; uma coluna de disponível envelheceria entre um uso e o
    # seguinte. `data` é Date e não timestamp — a apuração é mensal, e a hora do
    # sorvete não é dado que este produto precise guardar.
    op.create_table(
        'respiro_uso',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('valor', sa.BigInteger(), nullable=False),
        # Opcional e livre: ninguém deve prestação de contas do próprio lazer.
        sa.Column('descricao', sa.String(length=120), nullable=True),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column(
            'criado_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_respiro_uso_tenant_id'), 'respiro_uso', ['tenant_id'], unique=False
    )

    # Tabela separada de `respiro_uso`, e não uma coluna `tipo` na mesma: uma
    # responde o que a pessoa viveu, a outra o que ela adiantou na dívida.
    # Juntá-las faria o relatório de uma contaminar o da outra.
    op.create_table(
        'respiro_destinacao',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('valor', sa.BigInteger(), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column(
            'criada_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_respiro_destinacao_tenant_id'),
        'respiro_destinacao',
        ['tenant_id'],
        unique=False,
    )

    # MARCO É EVENTO PERSISTIDO, e é por isso que existe tabela em vez de query.
    # A porcentagem da rota anda para trás quando o usuário cadastra uma dívida
    # nova; um marco recalculado sobre o estado atual se DESFARIA, e a pessoa
    # perderia uma conquista por ter sido honesta sobre a própria situação.
    #
    # Linha ausente é marco não atingido — a rota devolve os cinco tipos com
    # nulos. `celebrado_em` é NULLABLE e é o único UPDATE permitido nesta
    # tabela: atingir e comemorar são momentos diferentes, e um marco atingido
    # durante o período somente leitura espera aqui em vez de se perder.
    op.create_table(
        'marco',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('tipo', sa.String(length=30), nullable=False),
        sa.Column('atingido_em', sa.Date(), nullable=False),
        sa.Column('celebrado_em', sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_marco_tenant_id'), 'marco', ['tenant_id'], unique=False)

    # ADITIVA E NULLABLE. A foto existe para explicar, seis meses depois, com
    # base em qual cascata aquele acordo foi proposto — e sem esta coluna
    # faltaria justamente a linha que derrubou a `capacidade_maxima`.
    #
    # `NULL` nos snapshots anteriores é a verdade: eles foram calculados quando
    # o respiro não existia. Um `0` de backfill afirmaria que o usuário declarou
    # zero, que é escolha legítima e diferente de não ter escolhido.
    op.add_column(
        'caixa_snapshot', sa.Column('respiro', sa.BigInteger(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('caixa_snapshot', 'respiro')
    op.drop_index(op.f('ix_marco_tenant_id'), table_name='marco')
    op.drop_table('marco')
    op.drop_index(op.f('ix_respiro_destinacao_tenant_id'), table_name='respiro_destinacao')
    op.drop_table('respiro_destinacao')
    op.drop_index(op.f('ix_respiro_uso_tenant_id'), table_name='respiro_uso')
    op.drop_table('respiro_uso')
    op.drop_index(op.f('ix_respiro_tenant_id'), table_name='respiro')
    op.drop_table('respiro')
