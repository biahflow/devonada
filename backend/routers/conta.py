from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import senha_confere, tenant_atual, usuario_atual
from db import get_db

router = APIRouter(prefix="/v1/conta", tags=["Conta"])

# Tabelas cuja chave do usuário NÃO é `tenant_id`. Elas não aparecem na varredura
# automática abaixo e precisam ser apagadas por outro caminho — `codigo_
# recuperacao` pertence ao usuário, não ao tenant, porque existe antes de haver
# sessão. O teste de exclusão conhece esta lista e falha se uma tabela nova ficar
# fora das duas.
TABELAS_POR_USUARIO = {"codigo_recuperacao"}


def tabelas_do_tenant() -> list:
    """
    Toda tabela com coluna `tenant_id`, derivada do metadata.

    DERIVADA, e não uma lista escrita à mão, de propósito: a lista à mão envelhece
    na primeira migration que alguém escrever sem lembrar desta rota, e o dado
    órfão só apareceria numa auditoria de loja. Aqui, tabela nova com `tenant_id`
    entra na exclusão no mesmo commit em que nasce, sem ninguém fazer nada.

    `sorted_tables` invertido: dependente antes de dependência, para o dia em que
    houver chave estrangeira declarada.
    """
    return [t for t in reversed(orm.Base.metadata.sorted_tables) if "tenant_id" in t.c]


@router.delete("", status_code=204)
def excluir(
    entrada: schemas.PedidoExclusaoDeConta,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
    usuario_id: str = Depends(usuario_atual),
):
    """
    Apaga a conta e tudo que é dela. Exigência da Apple, diretriz 5.1.1(v).

    EXCLUSÃO FÍSICA, e é o oposto da regra de `divida`. Lá o `excluido_em`
    protege o histórico financeiro do usuário; aqui é o próprio usuário pedindo
    que o histórico deixe de existir, e uma "exclusão" que só marca uma coluna
    não é o que ele pediu nem o que a loja exige.

    A senha vem de novo, além do Bearer: exclusão é irreversível, e um celular
    desbloqueado esquecido na mesa não pode apagar a vida financeira de alguém em
    dois toques. É também o que fecha a janela de 15 minutos do access token —
    token roubado sozinho não apaga conta.

    Tudo numa transação: exclusão pela metade deixaria a pessoa sem login e com
    os dados no banco, que é o pior dos dois mundos.
    """
    usuario = db.scalar(select(orm.Usuario).where(orm.Usuario.id == usuario_id))
    if usuario is None or not senha_confere(entrada.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "A senha não confere.", "campo": "senha"},
        )

    db.execute(delete(orm.CodigoRecuperacao).where(orm.CodigoRecuperacao.usuario_id == usuario_id))

    # `usuario` e `sessao` têm `tenant_id` e caem aqui junto com o resto — a
    # conta some no mesmo comando que os dados dela.
    for tabela in tabelas_do_tenant():
        db.execute(delete(tabela).where(tabela.c.tenant_id == tenant))

    db.commit()
    return Response(status_code=204)
