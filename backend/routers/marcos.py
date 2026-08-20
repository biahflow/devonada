from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import orm
import schemas
from auth import tenant_atual
from db import get_db
from domain.marcos import TIPOS

router = APIRouter(prefix="/v1/marcos", tags=["Marcos"])

"""
Marcos: eventos gravados, nunca recalculados.

ESTE ARQUIVO NÃO CALCULA MARCO NENHUM. `GET /v1/marcos` lê linha de tabela, e é
essa a coisa mais importante do módulo (ADR 0019, item 4). Um predicado sobre o
estado atual se desfaria: a porcentagem da rota anda para trás quando o usuário
cadastra uma dívida nova, e a pessoa perderia uma conquista por ter sido honesta
sobre a própria situação. Quem decide QUANDO o gatilho ocorreu é `domain/marcos`,
chamado pelos routers onde o evento acontece; aqui só se grava e se lê.

Se algum dia aparecer uma conta dentro de `listar`, o marco virou predicado e a
promessa da feature morreu junto.
"""


def _nao_encontrado() -> HTTPException:
    """
    404, e não 409 nem 403.

    Tipo inexistente e marco ainda não atingido são a mesma resposta de
    propósito: nos dois casos não há recurso para celebrar, e devolver códigos
    diferentes contaria ao cliente qual dos dois é — sem que ele possa fazer
    nada de diferente com a informação.
    """
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"message": "Não encontramos esse marco."},
    )


def registrar_marcos(db: Session, tenant: str, tipos: Sequence[str]) -> tuple[str, ...]:
    """
    Grava os marcos que ainda não existem, e devolve os que nasceram agora.

    IDEMPOTENTE POR `(tenant_id, tipo)`, com dois níveis de garantia. O SELECT
    abaixo é o caminho normal e barato: cobre o caso sequencial e os três
    caminhos que chegam ao mesmo tipo (a quitação é detectada em
    `parcelas.pagar` e `dividas.quitar`, e a rota é reavaliada em toda leitura
    do resumo). A rede é `uq_marco_tenant_tipo` (banco) — duas requisições do
    mesmo tenant que passem juntas pelo SELECT já não conseguem gravar a mesma
    linha duas vezes: a segunda inserção esbarra na UNIQUE.

    CADA INSERÇÃO VAI DENTRO DO PRÓPRIO SAVEPOINT (`db.begin_nested()`), e por
    um motivo que não é estético: esta função NÃO COMMITA. Quem chama fecha a
    transação, e em três dos quatro pontos de disparo (`parcelas.pagar`,
    `parcelas.renegociar`, `dividas.quitar`) a gravação do marco é parte da
    MESMA mutação que o disparou. Sem savepoint, um `IntegrityError` de corrida
    subiria até o commit do chamador e abortaria a transação inteira — a
    quitação da dívida cairia junto com a corrida que ela mesma produziu, o
    que trocaria um defeito cosmético por um grave. O savepoint contém o dano:
    reverte só a inserção que colidiu, e a transação externa segue intacta.
    `IntegrityError` dentro do savepoint é tratado como "esse marco já
    existe" — que é a verdade.

    Savepoint, não `ON CONFLICT DO NOTHING`: a suíte roda em SQLite e o alvo é
    Postgres, e `begin_nested()` é portável nos dois sem ramo por dialeto.
    """
    if not tipos:
        return ()

    ja_gravados = set(
        db.scalars(
            select(orm.Marco.tipo).where(
                orm.Marco.tenant_id == tenant, orm.Marco.tipo.in_(tuple(tipos))
            )
        ).all()
    )

    candidatos = tuple(dict.fromkeys(t for t in tipos if t not in ja_gravados))
    novos = []
    for tipo in candidatos:
        try:
            with db.begin_nested():
                db.add(orm.Marco(tenant_id=tenant, tipo=tipo))
                db.flush()
        except IntegrityError:
            # Corrida: outra requisição gravou este (tenant, tipo) entre o
            # SELECT acima e este INSERT. O savepoint já desfez a inserção
            # colidida; a transação externa não sofre nada.
            continue
        novos.append(tipo)
    return tuple(novos)


@router.get("", response_model=schemas.ListaMarcos)
def listar(db: Session = Depends(get_db), tenant: str = Depends(tenant_atual)):
    """
    Os cinco tipos, com o par `atingidoEm`/`celebradoEm`.

    OS CINCO SEMPRE, inclusive para quem não atingiu nenhum: a ausência é dita
    com nulo, e não omitida. A tela precisa saber que o marco existe e não foi
    alcançado — isso é rota, não erro.

    LEITURA PURA. Nenhuma conta, nenhum limiar, nenhuma comparação com o estado
    atual: o que veio da tabela é a resposta.

    A AGREGAÇÃO POR TIPO é defesa em profundidade, não a garantia primária.
    Desde `uq_marco_tenant_tipo` (M11.1) o banco impõe uma linha por
    `(tenant_id, tipo)`, e `registrar_marcos` trata a corrida com savepoint —
    então na prática nunca há duas linhas para agregar. `MIN(atingido_em)`
    mantém a data da conquista original e `MIN(celebrado_em)` — que em SQL
    ignora nulos — mantém a primeira celebração; o contrato fica igual com uma
    linha ou, num cenário que a UNIQUE já não deveria permitir, com duas.
    """
    gravados = {
        tipo: (atingido_em, celebrado_em)
        for tipo, atingido_em, celebrado_em in db.execute(
            select(
                orm.Marco.tipo,
                func.min(orm.Marco.atingido_em),
                func.min(orm.Marco.celebrado_em),
            )
            .where(orm.Marco.tenant_id == tenant)
            .group_by(orm.Marco.tipo)
        ).all()
    }

    return schemas.ListaMarcos(
        marcos=[
            schemas.Marco(
                tipo=tipo,  # type: ignore[arg-type]
                atingidoEm=gravados.get(tipo, (None, None))[0],
                celebradoEm=gravados.get(tipo, (None, None))[1],
            )
            for tipo in TIPOS
        ]
    )


@router.post("/{tipo}/celebracao", status_code=status.HTTP_204_NO_CONTENT)
def celebrar(
    tipo: str,
    db: Session = Depends(get_db),
    tenant: str = Depends(tenant_atual),
):
    """
    Grava `celebradoEm` — a tela apareceu.

    É ESCRITA, e por isso passa pela trava de assinatura como qualquer outra. O
    ATINGIMENTO não passa, e essa assimetria é a decisão: a trava bloqueia a
    celebração de quem não está em dia, nunca a conquista. O marco atingido no
    período somente leitura fica com `celebradoEm` nulo e espera a tela voltar,
    em vez de evaporar (`docs/api-contract.md`, 3.13).

    CELEBRAR DE NOVO NÃO MOVE A DATA. O que a coluna guarda é quando a tela
    apareceu pela primeira vez; reescrever transformaria um clique repetido em
    reescrita silenciosa de histórico, no mesmo espírito append-only da tabela.
    Continua devolvendo 204: para o cliente, o estado desejado já é o atual.
    """
    if tipo not in TIPOS:
        raise _nao_encontrado()

    linhas = db.scalars(
        select(orm.Marco).where(orm.Marco.tenant_id == tenant, orm.Marco.tipo == tipo)
    ).all()
    if not linhas:
        raise _nao_encontrado()

    hoje = date.today()
    for linha in linhas:
        if linha.celebrado_em is None:
            linha.celebrado_em = hoje
    db.commit()
