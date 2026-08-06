import secrets

from fastapi import Depends, HTTPException, Request, status

from config import Settings, get_settings


def tenant_atual(request: Request, settings: Settings = Depends(get_settings)) -> str:
    """
    Resolve o tenant a partir do Bearer token.

    O cliente NUNCA envia tenant_id — ele vem daqui (guardrail 6). Com um
    usuário só o tenant é fixo, mas toda query filtra por ele: é o que faz a
    troca por JWT multiusuário depois ser um trabalho de auth, não uma
    refatoração de isolamento em cada rota.

    Comparação em tempo constante: comparar token com `==` vaza o prefixo
    correto pelo tempo de resposta.
    """
    if not settings.api_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "O servidor está sem token configurado. Avise quem cuida dele."},
        )

    header = request.headers.get("Authorization", "")
    prefixo = "Bearer "
    if not header.startswith(prefixo):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Sua sessão expirou. Entre de novo para continuar."},
        )

    enviado = header[len(prefixo) :].strip()
    if not secrets.compare_digest(enviado, settings.api_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Sua sessão expirou. Entre de novo para continuar."},
        )

    return settings.tenant_id
