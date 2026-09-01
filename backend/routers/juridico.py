from fastapi import APIRouter, Depends

import schemas
from auth import tenant_atual
from juridico.fontes import FONTES
from juridico.trilhas import Trilha

router = APIRouter(prefix="/v1/juridico", tags=["Jurídico"])

"""
O corpus jurídico, servido inteiro numa requisição.

INTEIRO E DE UMA VEZ porque ele é pequeno, estático e lido por quase toda tela
que mostra número. Paginar quinze normas seria trabalho para caber num
`for` que já cabe; buscar uma por vez faria cada disclosure aberto custar uma
ida à rede, e o app deixaria de conseguir mostrar a fonte offline logo depois de
já ter mostrado o número que ela sustenta.

NÃO EXIGE SESSÃO? Exige. Não há nada de pessoal aqui — é texto de lei —, mas
abrir uma rota pública para economizar um header criaria a única rota de leitura
do produto fora da trava, e "essa é pública" é como a exceção seguinte é
justificada. A trava de assinatura, essa sim, não se aplica: é `GET`, e leitura
nunca é bloqueada (guardrail 9.1).
"""


@router.get("/fontes", response_model=schemas.RespostaFontes)
def listar_fontes(_: str = Depends(tenant_atual)):
    """
    As normas que o produto cita, com ementa, vigência e link.

    O `_` na assinatura é o Bearer sendo EXIGIDO sem que a rota use o tenant:
    o corpus é o mesmo para todo mundo, e é justamente por isso que a trava
    precisa estar escrita aqui — sem ela, nada no código diria que a decisão
    de não abrir a rota foi tomada.

    A ORDEM É ESTÁVEL — a de declaração no registro, que agrupa por norma e vai
    do mais citado ao mais novo. A tela não reordena; quem lê duas vezes vê a
    mesma lista.
    """
    return schemas.RespostaFontes(
        fontes=[
            schemas.FonteJuridica(
                id=f.id,
                norma=f.norma,
                dispositivo=f.dispositivo,
                ementa=f.ementa,
                vigencia=f.vigencia,
                url=f.url,
                texto=f.texto,
            )
            for f in FONTES.values()
        ]
    )


def para_schema(trilha: Trilha) -> schemas.Trilha:
    """
    A trilha do domínio virando contrato.

    MORA AQUI, e não em cada rota que anexa uma trilha, porque são duas hoje
    (revisão e caixa) e a segunda cópia é como as duas divergem — uma passando
    a mandar `limitacoes` e a outra esquecendo, num campo cuja ausência muda o
    que o usuário entende do número.

    Não vive em `juridico/`: aquele pacote é dado curado e não conhece o
    contrato da API. A dependência aponta para cá, nunca para lá.
    """
    return schemas.Trilha(
        chave=trilha.chave,
        titulo=trilha.titulo,
        formula=trilha.formula,
        passos=list(trilha.passos),
        fonteIds=list(trilha.fontes),
        limitacoes=list(trilha.limitacoes),
    )
