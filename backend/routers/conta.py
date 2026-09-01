from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import orm
import schemas
from auth import senha_confere, tenant_atual, usuario_atual
from db import get_db
from identidade import ErroDeIdentidade, IdentidadeNaoConfigurada, obter_verificador

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

    A CREDENCIAL VEM DE NOVO, além do Bearer: exclusão é irreversível, e um
    celular desbloqueado esquecido na mesa não pode apagar a vida financeira de
    alguém em dois toques. É também o que fecha a janela de 15 minutos do access
    token — token roubado sozinho não apaga conta.

    QUAL credencial depende de qual conta (ADR 0023). Quem tem senha reconfirma
    com a senha. Quem entrou pela Apple ou pelo Google nunca escolheu uma, e
    exigir senha dessa pessoa a deixaria sem como excluir a conta — o que reprova
    na mesma diretriz 5.1.1(v) que esta rota existe para cumprir. Ela reapresenta
    o provedor, e a intenção fica provada pelo mesmo gesto: um toque com
    biometria ou senha do sistema.

    Tudo numa transação: exclusão pela metade deixaria a pessoa sem login e com
    os dados no banco, que é o pior dos dois mundos.
    """
    usuario = db.scalar(select(orm.Usuario).where(orm.Usuario.id == usuario_id))
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "A senha não confere.", "campo": "senha"},
        )

    _reconfirmar(entrada, usuario)

    db.execute(delete(orm.CodigoRecuperacao).where(orm.CodigoRecuperacao.usuario_id == usuario_id))

    # `usuario` e `sessao` têm `tenant_id` e caem aqui junto com o resto — a
    # conta some no mesmo comando que os dados dela.
    for tabela in tabelas_do_tenant():
        db.execute(delete(tabela).where(tabela.c.tenant_id == tenant))

    db.commit()
    return Response(status_code=204)


def _reconfirmar(entrada: schemas.PedidoExclusaoDeConta, usuario: orm.Usuario) -> None:
    """
    Prova que quem está com o aparelho é o dono da conta. Não devolve nada:
    passar é seguir, falhar é `401`.

    QUALQUER CREDENCIAL QUE A CONTA COMPROVADAMENTE TEM SERVE — a senha, se ela
    tem senha; o provedor, se ela tem provedor. Não é afrouxamento: as duas
    exigem um ato deliberado além do Bearer, e reapresentar o provedor custa
    biometria ou senha do sistema. O que a rota recusa é reconfirmar com
    credencial que aquela conta NÃO tem.

    ACEITAR SÓ UMA DELAS CRIA BECO SEM SAÍDA, e ele é alcançável pelo caminho
    normal: quem entra pela Apple e depois ganha senha pela recuperação por
    e-mail passa a ter as duas. Se só a senha valesse, a tela — que sabe que
    esta sessão veio da Apple — ofereceria o botão do provedor e o servidor
    responderia "a senha não confere", sem senha nenhuma na tela. Se só o
    provedor valesse, quem tem conta com senha e nenhum provedor não excluiria
    nada.

    O `sub` DO TOKEN TEM QUE SER O MESMO gravado na conta. Sem essa comparação,
    qualquer pessoa com o aparelho desbloqueado entraria na própria Apple ID e
    apagaria a conta de outra: o token seria válido, só que de outra pessoa.
    """
    if (
        entrada.senha
        and usuario.senha_hash is not None
        and senha_confere(entrada.senha, usuario.senha_hash)
    ):
        return

    if entrada.provedor and entrada.token and usuario.provedor is not None:
        _conferir_provedor(entrada.provedor, entrada.token, usuario)
        return

    # A frase diz o que a conta aceita, e nada sobre a outra: quem tem senha ouve
    # sobre senha, quem entra por provedor ouve sobre o provedor.
    if usuario.senha_hash is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "A senha não confere.", "campo": "senha"},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "message": "Confirme pelo mesmo jeito que você entra para excluir a conta.",
            "campo": "provedor",
        },
    )


def _conferir_provedor(provedor: str, token: str, usuario: orm.Usuario) -> None:
    """Levanta `401` se o token não for da conta que está aberta."""
    try:
        identidade = obter_verificador(provedor).verificar(token)
    except IdentidadeNaoConfigurada as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(e)},
        ) from e
    except ErroDeIdentidade as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": str(e)},
        ) from e

    if identidade.provedor != usuario.provedor or identidade.sub != usuario.provedor_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Essa não é a conta que está aberta aqui.",
                "campo": "provedor",
            },
        )
