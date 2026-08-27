"""resultado negociacao

Revision ID: a1c2e3f40b5d
Revises: 75331c212261
Create Date: 2026-08-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2e3f40b5d'
# Encadeada na cabeça VIGENTE da cadeia (M12), e não em `116f2181bdda`: a F-011
# rodou em paralelo e já acrescentou migrações ao milestone. Confirmado por
# `alembic heads` no início da tarefa (PLAN_DEVIATION de 20/08/2026). Duas
# migrações nascidas do mesmo pai partiriam a cadeia em dois ramos.
down_revision: Union[str, Sequence[str], None] = '75331c212261'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # O RESULTADO da negociação vira dado — inclusive quando não houve acordo
    # (M12, ADR 0021, item 6). Aditiva e append-only, no molde de `renegociacao`:
    # tabela nova, sem dado migrado. `Renegociacao` continua sendo só o acordo.
    op.create_table(
        "resultado_negociacao",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("divida_id", sa.String(length=36), nullable=False),
        sa.Column("canal", sa.String(length=20), nullable=False),
        sa.Column("desfecho", sa.String(length=20), nullable=False),
        sa.Column("valor_proposto", sa.BigInteger(), nullable=True),
        sa.Column("valor_obtido", sa.BigInteger(), nullable=True),
        sa.Column("renegociacao_id", sa.String(length=36), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column(
            "registrado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Índice em `tenant_id`, como toda tabela por tenant deste banco: a leitura
    # do benchmark (`GET /v1/negociacoes`) filtra sempre por ele.
    op.create_index(
        op.f("ix_resultado_negociacao_tenant_id"),
        "resultado_negociacao",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resultado_negociacao_divida_id"),
        "resultado_negociacao",
        ["divida_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_resultado_negociacao_divida_id"), table_name="resultado_negociacao"
    )
    op.drop_index(
        op.f("ix_resultado_negociacao_tenant_id"), table_name="resultado_negociacao"
    )
    op.drop_table("resultado_negociacao")
