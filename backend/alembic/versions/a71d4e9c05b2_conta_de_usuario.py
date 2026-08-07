"""conta de usuario

Revision ID: a71d4e9c05b2
Revises: c58e1f7b2d31
Create Date: 2026-08-07 16:20:00.000000

O acesso deixa de ser um token fixo em variável de ambiente (ADR 0006) e passa a
ser conta de verdade (ADR 0012).

NÃO HÁ MIGRAÇÃO DE DADO AQUI, e é de propósito. Não existe usuário para criar:
criar um exigiria inventar e-mail e senha, e senha inventada em migration é
credencial no repositório. Quem adota o tenant do beta é a rota de registro, no
primeiro cadastro feito num banco sem usuários — os dados que já existem
continuam onde estão e ganham dono quando alguém se cadastrar.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a71d4e9c05b2'
down_revision: Union[str, Sequence[str], None] = 'c58e1f7b2d31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'usuario',
        sa.Column('id', sa.String(length=36), nullable=False),
        # Coluna SEPARADA de `id`: hoje é um usuário por tenant, mas conta
        # compartilhada é dois usuários no mesmo tenant, e essa é a única forma
        # que não exige remigrar todas as tabelas depois.
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('senha_hash', sa.String(length=100), nullable=False),
        sa.Column('falhas_login', sa.Integer(), server_default='0', nullable=False),
        sa.Column('bloqueado_ate', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'criado_em', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    # A unicidade é do BANCO, não de um SELECT antes do INSERT na rota: duas
    # requisições simultâneas passariam pelo SELECT sem achar nada e criariam
    # duas contas com o mesmo e-mail.
    op.create_index(op.f('ix_usuario_email'), 'usuario', ['email'], unique=True)
    op.create_index(op.f('ix_usuario_tenant_id'), 'usuario', ['tenant_id'], unique=False)

    op.create_table(
        'sessao',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=False),
        sa.Column('usuario_id', sa.String(length=36), nullable=False),
        # O HASH do refresh, nunca o valor. Vazamento do banco não devolve
        # sessão utilizável — a mesma disciplina de `senha_hash`.
        sa.Column('refresh_hash', sa.String(length=64), nullable=False),
        sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revogada_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'criada_em', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column('ultimo_uso_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sessao_refresh_hash'), 'sessao', ['refresh_hash'], unique=True)
    op.create_index(op.f('ix_sessao_tenant_id'), 'sessao', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_sessao_usuario_id'), 'sessao', ['usuario_id'], unique=False)

    op.create_table(
        'codigo_recuperacao',
        sa.Column('id', sa.String(length=36), nullable=False),
        # Chaveada por USUÁRIO, e não por tenant: o código existe antes de haver
        # sessão. É por isso que a exclusão de conta a trata à parte, fora da
        # varredura por `tenant_id`.
        sa.Column('usuario_id', sa.String(length=36), nullable=False),
        sa.Column('codigo_hash', sa.String(length=64), nullable=False),
        sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tentativas', sa.Integer(), server_default='0', nullable=False),
        sa.Column('usado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'criado_em', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_codigo_recuperacao_usuario_id'), 'codigo_recuperacao', ['usuario_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # O downgrade APAGA as contas, e não há como não apagar: elas não existiam
    # antes desta revisão. Os dados financeiros ficam intactos — voltar uma
    # revisão devolve o banco ao acesso por token fixo, com tudo no lugar.
    op.drop_index(op.f('ix_codigo_recuperacao_usuario_id'), table_name='codigo_recuperacao')
    op.drop_table('codigo_recuperacao')

    op.drop_index(op.f('ix_sessao_usuario_id'), table_name='sessao')
    op.drop_index(op.f('ix_sessao_tenant_id'), table_name='sessao')
    op.drop_index(op.f('ix_sessao_refresh_hash'), table_name='sessao')
    op.drop_table('sessao')

    op.drop_index(op.f('ix_usuario_tenant_id'), table_name='usuario')
    op.drop_index(op.f('ix_usuario_email'), table_name='usuario')
    op.drop_table('usuario')
