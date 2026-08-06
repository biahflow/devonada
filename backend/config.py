from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuração do backend. Tudo vem de variável de ambiente — nenhum segredo
    e nenhum número que muda com o tempo fica cravado no código.
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="BUDDY_", extra="ignore")

    database_url: str = "postgresql+psycopg://buddy:buddy@localhost:5433/buddy"

    # Auth de beta: um token, um tenant. Trocar por JWT depois não muda o cliente,
    # que já manda Authorization: Bearer e trata 401.
    api_token: str = ""
    tenant_id: str = "00000000-0000-0000-0000-000000000001"

    # Origens permitidas no CORS. O Expo em desenvolvimento não manda Origin,
    # mas manter restrito evita que a API responda a qualquer página web.
    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    # Salário mínimo vigente, em centavos. Base do mínimo existencial
    # (Decreto 11.150/2022). Muda todo ano — por isso não é constante no código.
    salario_minimo_centavos: int = 151800

    # Percentual do salário mínimo que compõe o mínimo existencial, em basis
    # points. 2500 = 25%, conforme o Decreto 11.150/2022, art. 3º.
    minimo_existencial_bps: int = 2500

    # Extração de contrato: qual implementação usar e com qual modelo.
    extrator: str = "anthropic"
    llm_model: str = "claude-opus-5"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
