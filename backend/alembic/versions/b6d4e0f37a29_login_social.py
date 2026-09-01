"""login social (apple e google)

Revision ID: b6d4e0f37a29
Revises: c7e2b8a4d016
Create Date: 2026-09-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6d4e0f37a29'
# Encadeada na cabeça VIGENTE, confirmada por `alembic heads` no início da
# tarefa (M13, login social). Uma migração nascida de outro pai partiria a
# cadeia em dois ramos.
down_revision: Union[str, Sequence[str], None] = 'c7e2b8a4d016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SENHA PASSA A ACEITAR NULO (ADR 0023). Quem entra pela Apple ou pelo
    # Google nunca escolhe senha, e gravar um hash de valor inventado faria toda
    # pergunta futura sobre "esta conta tem senha?" responder sim para quem
    # nunca teve — inclusive a que decide como a pessoa reconfirma a exclusão.
    #
    # ADITIVA E SEGURA: afrouxar `NOT NULL` não toca em nenhuma linha existente,
    # e toda conta já criada continua com o hash que tinha.
    op.alter_column("usuario", "senha_hash", existing_type=sa.String(length=100), nullable=True)

    # `provedor_sub` é o identificador ESTÁVEL da pessoa no provedor, e é ele —
    # não o e-mail — que identifica a conta num login social. Nulos nos dois em
    # toda conta que já existe: elas entram por e-mail e senha.
    op.add_column("usuario", sa.Column("provedor", sa.String(length=10), nullable=True))
    op.add_column("usuario", sa.Column("provedor_sub", sa.String(length=255), nullable=True))

    # A unicidade é do BANCO, e não de um SELECT antes do INSERT: dois toques
    # simultâneos no botão passariam os dois pelo mesmo SELECT sem achar nada, e
    # a pessoa acabaria com duas contas, cada uma com metade da vida financeira
    # dela.
    #
    # NULO NÃO COLIDE COM NULO no Postgres, então as contas por e-mail e senha —
    # todas com o par `(NULL, NULL)` — convivem sob esta constraint sem
    # nenhuma exceção declarada.
    op.create_unique_constraint(
        "uq_usuario_provedor_sub", "usuario", ["provedor", "provedor_sub"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_usuario_provedor_sub", "usuario", type_="unique")
    op.drop_column("usuario", "provedor_sub")
    op.drop_column("usuario", "provedor")
    # VOLTAR O NOT NULL FALHA se existir conta só-social no banco, e isso é o
    # comportamento certo: o downgrade não pode inventar senha para quem nunca
    # teve. Quem precisar descer decide antes o que fazer com essas contas.
    op.alter_column("usuario", "senha_hash", existing_type=sa.String(length=100), nullable=False)
