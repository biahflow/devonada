"""renda tipada e evento previsivel

Revision ID: 482c266f5c6a
Revises: 116f2181bdda
Create Date: 2026-08-20 16:14:27.242350

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '482c266f5c6a'
down_revision: Union[str, Sequence[str], None] = '116f2181bdda'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # TODAS AS COLUNAS NASCEM NULLABLE, E NENHUM DADO MIGRA (ADR 0021). É o que
    # separa este milestone dos anteriores: `fonte_renda.tipo` já vem preenchido
    # de produção, e dar efeito a ele muda retroativamente o plano de quem já usa
    # o app. Um `0` de backfill em qualquer coluna abaixo afirmaria uma escolha
    # que ninguém fez — e `NULL` é a verdade: nunca declarou.

    # O POTE PERCENTUAL (decisão 4), em basis points, ao lado de `reserva_aporte`
    # e `aposentadoria_aporte`. Nenhum dos dois é convertido em "valor OU
    # percentual": isso mexeria em coluna com dado em produção e daria dois
    # estados a cada pote, dobrando UX e teste pela mesma entrega.
    op.add_column(
        'perfil', sa.Column('compromisso_percentual_bps', sa.Integer(), nullable=True)
    )

    # A ALÍQUOTA DESCE PARA A FONTE (decisão 1). `NULL` aplica o
    # `perfil.imposto_bps` de hoje, exatamente como hoje — o fallback é o que
    # permite a mudança ser aditiva. Mover de vez (apagar a coluna global e
    # copiar o valor para cada fonte) foi recusado: é migração de valor em
    # produção, custo que esta feature não precisa pagar.
    op.add_column('fonte_renda', sa.Column('imposto_bps', sa.Integer(), nullable=True))

    # Quando o dinheiro cai, de 1 a 31. `NULL` é "não informou", que é o estado
    # de todas as linhas existentes.
    op.add_column('fonte_renda', sa.Column('dia_pagamento', sa.Integer(), nullable=True))

    # 13º E FÉRIAS SÃO ENTIDADE PRÓPRIA (decisão 2), e não recebimento. Reusar
    # `recebimento` era a saída barata: ele é único por fonte e por mês, e o 13º
    # lançado em dezembro consumiria uma vaga da janela de seis da renda típica,
    # deixando no histórico um dezembro que não se repete. Corromper o dado que
    # dimensiona o plano para economizar uma tabela é troca ruim.
    #
    # `tenant_id` indexado, como em toda tabela deste banco — e é ele que faz a
    # tabela entrar sozinha na exclusão de conta, porque a varredura de
    # `routers/conta.tabelas_do_tenant()` é derivada de `Base.metadata`.
    op.create_table(
        'evento_previsivel',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        # OPCIONAL: quem tem dois contratos sabe de qual fonte o 13º vem; quem
        # tem um só não precisa dizer.
        sa.Column('fonte_id', sa.String(length=36), nullable=True),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        # 1 a 12, como `provisao_anual.mes_vencimento`: o evento se repete todo
        # ano, e gravar `AAAA-MM` obrigaria a recadastrar dezembro em janeiro.
        sa.Column('mes_previsto', sa.Integer(), nullable=False),
        # Centavos, como toda coluna de dinheiro deste banco. DECLARADO pelo
        # usuário: nenhum coeficiente projeta 13º a partir da renda (ADR 0009).
        sa.Column('valor', sa.BigInteger(), nullable=False),
        sa.Column(
            'criado_em',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_evento_previsivel_tenant_id'),
        'evento_previsivel',
        ['tenant_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_evento_previsivel_tenant_id'), table_name='evento_previsivel')
    op.drop_table('evento_previsivel')
    op.drop_column('fonte_renda', 'dia_pagamento')
    op.drop_column('fonte_renda', 'imposto_bps')
    op.drop_column('perfil', 'compromisso_percentual_bps')
