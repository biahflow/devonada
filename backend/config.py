from functools import lru_cache

from pydantic import Field
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

    # TETOS DE JUROS DO CONSIGNADO, em basis points ao mês. Definidos por
    # resolução do CNPS, que os revê periodicamente — por isso NÃO TÊM DEFAULT.
    # Zero significa "não configurado", e a regra de revisão devolve None em vez
    # de comparar com um teto chutado (ADR 0008). O achado que depende deles
    # simplesmente não é produzido.
    teto_juros_consignado_inss_bps: int = 0
    teto_juros_cartao_consignado_bps: int = 0

    # Data de vigência dos tetos acima, em ISO (AAAA-MM-DD). Viaja na resposta da
    # revisão e aparece na tela: se o teto estiver velho, o usuário vê a idade do
    # número que embasou o achado em vez de confiar nele às cegas.
    tetos_vigentes_em: str = ""

    # Provedor de LLM. Uma escolha para o servidor inteiro; as capacidades
    # (extração, assistente) não sabem qual é. Ver docs/adr/0007.
    llm_provider: str = "openai"

    # MODELO POR CAPACIDADE, não global: ler contrato exige visão, PDF e
    # evidência literal por campo; classificar a intenção de uma frase, não.
    # Um modelo só forçaria pagar o mais caro nas duas ou arriscar o mais fraco
    # na leitura de contrato.
    llm_model_extracao: str = "gpt-5"
    llm_model_assistente: str = "gpt-5-mini"

    # Qual implementação de cada capacidade usar. `llm` usa o provedor acima;
    # `determinista` responde sem modelo nenhum.
    extrator: str = "llm"
    assistente: str = "llm"

    # As chaves NÃO levam o prefixo BUDDY_ — são as variáveis que os próprios
    # SDKs usam. Elas passam por aqui de propósito: um SDK lê `os.environ`, e
    # `pydantic-settings` carrega o `.env` para dentro do objeto de settings,
    # não para o ambiente do processo. Sem esta ponte, a chave escrita no
    # `backend/.env` nunca chegava ao provedor — e o recurso respondia "não
    # configurado" com a chave preenchida na frente do desenvolvedor.
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", validation_alias="ANTHROPIC_API_KEY")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
