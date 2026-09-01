import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import orm
import schemas
from auth import (
    REFRESH_DIAS,
    SESSAO_INVALIDA,
    agora,
    como_utc,
    emitir_acesso,
    hash_de_senha,
    hash_de_token,
    hash_falso,
    novo_refresh,
    senha_confere,
    usuario_atual,
)
from config import Settings, get_settings
from correio import ErroDeCorreio, Mensagem, obter_correio
from db import get_db
from identidade import ErroDeIdentidade, Identidade, IdentidadeNaoConfigurada, obter_verificador

router = APIRouter(prefix="/v1/auth", tags=["Conta"])

# Uma frase para credencial inválida, seja o e-mail inexistente ou a senha
# errada. Duas frases transformariam a rota num verificador de cadastro — dado
# que interessa a quem monta lista para phishing de app financeiro (ADR 0012).
CREDENCIAL_INVALIDA = "E-mail ou senha não conferem."

CODIGO_MINUTOS = 30
CODIGO_MAX_TENTATIVAS = 5


def _normalizar(email: str) -> str:
    return email.strip().lower()


def _abrir_sessao(
    db: Session, settings: Settings, usuario: orm.Usuario
) -> schemas.RespostaSessao:
    """Emite o par e grava só o hash do refresh."""
    refresh = novo_refresh()
    db.add(
        orm.Sessao(
            tenant_id=usuario.tenant_id,
            usuario_id=usuario.id,
            refresh_hash=hash_de_token(refresh),
            expira_em=agora() + timedelta(days=REFRESH_DIAS),
        )
    )
    acesso, expira_em = emitir_acesso(settings, usuario.tenant_id, usuario.id)
    return schemas.RespostaSessao(
        sessao=schemas.Sessao(acesso=acesso, refresh=refresh, expiraEm=expira_em)
    )


def _revogar_todas(db: Session, usuario_id: str) -> None:
    for s in db.scalars(
        select(orm.Sessao).where(
            orm.Sessao.usuario_id == usuario_id, orm.Sessao.revogada_em.is_(None)
        )
    ).all():
        s.revogada_em = agora()


@router.post("/registro", response_model=schemas.RespostaSessao, status_code=201)
def registrar(
    entrada: schemas.NovaConta,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Cria a conta e já devolve sessão — cadastrar e depois pedir login seria
    fazer a pessoa digitar a senha que ela acabou de digitar.

    O PRIMEIRO cadastro num banco sem usuários adota o tenant do beta
    (ADR 0012, item 2). Sem isso, as dívidas, o caixa e os contratos que já
    existem ficariam alcançáveis por nenhum login e apagáveis por nenhuma
    exclusão de conta. A condição deixa de ser verdadeira no instante em que é
    usada, e não há caminho de volta.
    """
    email = _normalizar(entrada.email)

    primeiro = db.scalar(select(func.count()).select_from(orm.Usuario)) == 0
    usuario = orm.Usuario(
        tenant_id=settings.tenant_id if primeiro else orm.novo_id(),
        email=email,
        senha_hash=hash_de_senha(entrada.senha),
    )
    db.add(usuario)

    try:
        db.flush()
    except IntegrityError:
        # A unicidade é do banco, e não de um SELECT antes do INSERT: duas
        # requisições simultâneas passariam pelo SELECT sem achar nada.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Esse e-mail já tem conta. Entre com ele ou recupere a senha.",
                "campo": "email",
            },
        )

    resposta = _abrir_sessao(db, settings, usuario)
    db.commit()
    return resposta


@router.post("/login", response_model=schemas.RespostaSessao)
def entrar(
    entrada: schemas.Credenciais,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Senha errada e e-mail inexistente saem pela mesma porta, com a mesma frase.

    E com o mesmo TEMPO: sem usuário, a verificação roda contra `HASH_FALSO`.
    Sem isso a rota responde na hora para e-mail desconhecido e devagar para
    e-mail conhecido, e o relógio conta o que a mensagem não contou.
    """
    email = _normalizar(entrada.email)
    usuario = db.scalar(select(orm.Usuario).where(orm.Usuario.email == email))

    if usuario is not None and usuario.bloqueado_ate and como_utc(usuario.bloqueado_ate) > agora():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                # Sem o instante do desbloqueio: ele é dado de conta, e a rota
                # é pública. "Alguns minutos" resolve para quem é dono dela.
                "message": "Muitas tentativas. Aguarde alguns minutos e tente de novo."
            },
        )

    # `usuario.senha_hash` é NULO em conta só-social (ADR 0023), e cai no mesmo
    # hash falso do e-mail inexistente: quem entrou pela Apple e digita uma senha
    # aqui recebe o mesmo 401 e o mesmo TEMPO de quem errou a senha. Distinguir
    # contaria, para quem perguntasse, por onde cada conta entra — e a rota
    # voltaria a ser o verificador de cadastro que ela existe para não ser.
    guardado = usuario.senha_hash if usuario and usuario.senha_hash else hash_falso()
    confere = senha_confere(entrada.senha, guardado)

    if usuario is None or not confere:
        if usuario is not None:
            usuario.falhas_login += 1
            if usuario.falhas_login >= settings.login_max_falhas:
                usuario.bloqueado_ate = agora() + timedelta(
                    minutes=settings.login_bloqueio_minutos
                )
                usuario.falhas_login = 0
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": CREDENCIAL_INVALIDA},
        )

    usuario.falhas_login = 0
    usuario.bloqueado_ate = None
    resposta = _abrir_sessao(db, settings, usuario)
    db.commit()
    return resposta


@router.post("/social", response_model=schemas.RespostaSessao)
def entrar_com_provedor(
    entrada: schemas.EntradaSocial,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Entrar pela Apple ou pelo Google (M13, ADR 0023).

    UMA ROTA SÓ PARA ENTRAR E PARA CADASTRAR, e por isso responde `200` nos dois
    casos. Do lado de quem toca no botão não existem dois atos: ela autoriza o
    app no provedor e está dentro. Uma rota de "cadastro social" separada
    obrigaria o app a adivinhar, antes de perguntar ao servidor, se aquela pessoa
    já tem conta — e a resposta certa para essa pergunta é 401 de quem não pode
    saber.

    A CONTA É IDENTIFICADA POR `sub`, não por e-mail. O e-mail é o caminho de
    RECONHECIMENTO quando o `sub` não é conhecido, e só quando o provedor afirma
    tê-lo verificado.

    A TRAVA DE FORÇA BRUTA NÃO SE APLICA AQUI. Ela existe contra quem chuta
    senha; quem chega com token assinado pelo provedor provou identidade por
    outro caminho, e manter a conta bloqueada puniria o dono dela por tentativas
    que não foram dele. Entrar por aqui ZERA o contador, como o login com senha
    certa faz.
    """
    try:
        identidade = obter_verificador(entrada.provedor).verificar(entrada.token)
    except IdentidadeNaoConfigurada as e:
        # 503 e não 401: a credencial pode estar perfeita: quem está incompleto
        # é o servidor. Ver `identidade/base.IdentidadeNaoConfigurada`.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(e)},
        ) from e
    except ErroDeIdentidade as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": str(e)},
        ) from e

    usuario = db.scalar(
        select(orm.Usuario).where(
            orm.Usuario.provedor == identidade.provedor,
            orm.Usuario.provedor_sub == identidade.sub,
        )
    )

    if usuario is None:
        usuario = _reconhecer_ou_criar(db, settings, identidade)

    usuario.falhas_login = 0
    usuario.bloqueado_ate = None
    resposta = _abrir_sessao(db, settings, usuario)
    db.commit()
    return resposta


def _reconhecer_ou_criar(db: Session, settings: Settings, identidade: Identidade) -> orm.Usuario:
    """
    Primeiro login deste `sub`: ou é gente nova, ou é gente conhecida por outro
    caminho.

    O E-MAIL PRECISA VIR VERIFICADO. Sem verificação, reconhecer uma conta pelo
    e-mail seria aceitar que qualquer pessoa escreva o e-mail do vizinho no
    cadastro do provedor e entre na conta dele. E sem e-mail nenhum não há como
    criar conta: `usuario.email` é a chave por onde o código de recuperação
    chega, e inventar um endereço para preencher a coluna seria gravar um dado
    que não existe.

    CONTA COM SENHA NÃO É RECONHECIDA AUTOMATICAMENTE. Este servidor não
    verifica e-mail no cadastro — nada impede alguém de registrar hoje uma conta
    com o e-mail de outra pessoa. Ligar o login social a ela por coincidência de
    e-mail entregaria ao dono da conta plantada tudo o que a vítima cadastrasse
    depois (o ataque conhecido como *pre-hijacking*). Quem cai aqui entra com a
    senha; a pessoa que de fato controla o e-mail chega lá pela recuperação.

    CONTA SÓ-SOCIAL É RELIGADA ao novo provedor. Ela só pôde nascer de um e-mail
    que um provedor já havia verificado, e agora outro verifica o mesmo — é a
    mesma pessoa trocando de botão. O custo é o declarado na ADR 0023: uma conta
    guarda um provedor, então o vínculo anterior é substituído.
    """
    if not identidade.email or not identidade.email_verificado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": (
                    "Não recebemos do provedor um e-mail confirmado, e ele é o que usamos "
                    "para recuperar seu acesso. Crie sua conta com e-mail e senha."
                )
            },
        )

    existente = db.scalar(select(orm.Usuario).where(orm.Usuario.email == identidade.email))

    if existente is not None:
        if existente.senha_hash is not None:
            # ESTE 409 NÃO É O VERIFICADOR DE CADASTRO que o login recusa ser.
            # Lá, qualquer pessoa digita qualquer e-mail e lê a resposta. Aqui é
            # preciso apresentar um token assinado pelo provedor para AQUELE
            # e-mail — quem consegue isso já é dono dele, e está descobrindo
            # sobre a própria conta.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": (
                        "Esse e-mail já tem conta com senha. Entre com e-mail e senha — "
                        "é a mesma conta."
                    ),
                    "campo": "email",
                },
            )

        existente.provedor = identidade.provedor
        existente.provedor_sub = identidade.sub
        db.flush()
        return existente

    primeiro = db.scalar(select(func.count()).select_from(orm.Usuario)) == 0
    usuario = orm.Usuario(
        # Mesma regra do cadastro por e-mail: o PRIMEIRO usuário de um banco
        # vazio adota o tenant do beta (ADR 0012, item 2), para o que já existe
        # não ficar órfão. Ela não podia morar só na outra rota — um banco novo
        # cujo primeiro acesso fosse pela Apple criaria tenant novo e deixaria
        # os dados do beta inalcançáveis.
        tenant_id=settings.tenant_id if primeiro else orm.novo_id(),
        email=identidade.email,
        # SEM SENHA, e não com um hash de valor inventado: ninguém digitou
        # senha nenhuma, e gravar uma faria toda pergunta futura sobre "esta
        # conta tem senha?" responder sim para quem nunca teve.
        senha_hash=None,
        provedor=identidade.provedor,
        provedor_sub=identidade.sub,
    )
    db.add(usuario)

    try:
        db.flush()
    except IntegrityError as e:
        # A unicidade é do banco, e não do SELECT acima: dois toques
        # simultâneos no botão passariam os dois pelo mesmo SELECT sem achar
        # nada, e a pessoa acabaria com duas contas, cada uma com metade da
        # vida financeira dela.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Essa conta já está sendo criada. Tente entrar de novo."},
        ) from e

    return usuario


@router.post("/refresh", response_model=schemas.RespostaSessao)
def renovar(
    entrada: schemas.PedidoRefresh,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Rotação a cada uso: o refresh enviado é revogado e outro nasce.

    É o que torna roubo DETECTÁVEL. O mesmo valor apresentado duas vezes
    significa que existem duas cópias, e a segunda leva 401 — o legítimo
    reentra com a senha, o ladrão também não continua.

    Esta rota é a única que o `src/api/client.ts` chama fora do interceptor de
    renovação, e não pode passar por ele: um 401 aqui dispararia uma renovação
    que chamaria esta rota de novo.
    """
    sessao = db.scalar(
        select(orm.Sessao).where(orm.Sessao.refresh_hash == hash_de_token(entrada.refresh))
    )

    if sessao is None or sessao.revogada_em is not None or como_utc(sessao.expira_em) <= agora():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": SESSAO_INVALIDA},
        )

    usuario = db.scalar(select(orm.Usuario).where(orm.Usuario.id == sessao.usuario_id))
    if usuario is None:
        # Conta excluída com refresh ainda em mãos.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": SESSAO_INVALIDA},
        )

    sessao.revogada_em = agora()
    sessao.ultimo_uso_em = agora()
    resposta = _abrir_sessao(db, settings, usuario)
    db.commit()
    return resposta


@router.post("/logout", status_code=204)
def sair(
    entrada: schemas.PedidoLogout,
    db: Session = Depends(get_db),
    usuario_id: str = Depends(usuario_atual),
):
    """Com `refresh`, encerra aquele aparelho. Sem ele, encerra todos."""
    if entrada.refresh is None:
        _revogar_todas(db, usuario_id)
    else:
        sessao = db.scalar(
            select(orm.Sessao).where(
                orm.Sessao.refresh_hash == hash_de_token(entrada.refresh),
                orm.Sessao.usuario_id == usuario_id,
            )
        )
        if sessao is not None:
            sessao.revogada_em = agora()

    db.commit()
    return Response(status_code=204)


@router.post("/senha/recuperacao", status_code=202)
def recuperar(entrada: schemas.PedidoRecuperacao, db: Session = Depends(get_db)):
    """
    202 SEMPRE, o e-mail existindo ou não.

    Responder 404 para e-mail desconhecido transformaria esta rota num
    verificador de cadastro, que é exatamente o que ela não pode ser.

    Falha de envio também não distingue: um 500 aqui só aconteceria para e-mail
    existente, e contaria a mesma coisa. O erro é engolido de propósito — o
    caminho de quem não recebe o código é pedir de novo.
    """
    usuario = db.scalar(select(orm.Usuario).where(orm.Usuario.email == _normalizar(entrada.email)))

    if usuario is not None:
        codigo = f"{secrets.randbelow(1_000_000):06d}"
        db.add(
            orm.CodigoRecuperacao(
                usuario_id=usuario.id,
                codigo_hash=hash_de_token(codigo),
                expira_em=agora() + timedelta(minutes=CODIGO_MINUTOS),
            )
        )
        db.commit()

        try:
            obter_correio().enviar(
                Mensagem(
                    para=usuario.email,
                    assunto="Seu código para redefinir a senha",
                    # O CÓDIGO E NADA MAIS. Nome, valor, dívida ou saldo num
                    # e-mail seria dado financeiro em texto plano num canal que
                    # não controlamos (guardrail 5).
                    corpo=(
                        f"Seu código é {codigo}.\n\n"
                        f"Ele vale por {CODIGO_MINUTOS} minutos e só pode ser usado uma vez.\n"
                        "Se não foi você que pediu, ignore este e-mail — nada muda."
                    ),
                )
            )
        except ErroDeCorreio:
            pass

    return Response(status_code=202)


@router.post("/senha/redefinicao", response_model=schemas.RespostaSessao)
def redefinir(
    entrada: schemas.PedidoRedefinicao,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Troca a senha e DERRUBA TODAS AS SESSÕES.

    Quem redefine a senha em geral está redefinindo porque perdeu o aparelho.
    Uma troca que deixa o aparelho perdido logado não protege de nada.

    Aqui os erros são distintos entre si — código errado, expirado e já usado
    dizem coisas diferentes. A distinção ajuda e não vaza: quem chegou nesta
    rota já provou ter acesso ao e-mail.
    """
    generico = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"message": "Esse código não confere. Confira ou peça outro.", "campo": "codigo"},
    )

    usuario = db.scalar(select(orm.Usuario).where(orm.Usuario.email == _normalizar(entrada.email)))
    if usuario is None:
        raise generico

    codigo = db.scalar(
        select(orm.CodigoRecuperacao)
        .where(orm.CodigoRecuperacao.usuario_id == usuario.id)
        .order_by(orm.CodigoRecuperacao.criado_em.desc())
    )
    if codigo is None:
        raise generico

    if codigo.usado_em is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Esse código já foi usado. Peça um novo.", "campo": "codigo"},
        )

    if como_utc(codigo.expira_em) <= agora() or codigo.tentativas >= CODIGO_MAX_TENTATIVAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Esse código expirou. Peça um novo.", "campo": "codigo"},
        )

    if not secrets.compare_digest(codigo.codigo_hash, hash_de_token(entrada.codigo)):
        # A tentativa errada é CONTADA. Seis dígitos são um milhão de
        # combinações, e um milhão de requisições é uma tarde.
        codigo.tentativas += 1
        db.commit()
        raise generico

    codigo.usado_em = agora()
    usuario.senha_hash = hash_de_senha(entrada.senha)
    usuario.falhas_login = 0
    usuario.bloqueado_ate = None
    _revogar_todas(db, usuario.id)

    resposta = _abrir_sessao(db, settings, usuario)
    db.commit()
    return resposta
