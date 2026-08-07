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

    # Chave de assinatura do access token (ADR 0012). SEM DEFAULT de propósito:
    # um default publicado no repositório é uma chave que qualquer pessoa usa
    # para forjar sessão. Vazia ⇒ toda rota autenticada responde 500 com frase
    # útil, que é ruidoso e é o ponto — falha silenciosa aqui seria falha aberta.
    jwt_secret: str = ""

    # O tenant do beta. Sobrou de quando o acesso era um token fixo, e hoje tem
    # UM uso só: o primeiro cadastro num banco sem usuários o adota, para as
    # dívidas e o caixa já cadastrados não ficarem órfãos (ADR 0012, item 2).
    tenant_id: str = "00000000-0000-0000-0000-000000000001"

    # Envio de e-mail, no mesmo padrão de provedor plugável do LLM (ADR 0007):
    # `smtp` fala com o mundo, `memoria` guarda numa lista e é o que a suíte usa.
    # A escolha é do servidor; quem chama não sabe qual está ativo.
    correio: str = "smtp"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_usuario: str = ""
    smtp_senha: str = ""
    smtp_remetente: str = ""

    # Trava de força bruta no login. Depois de `login_max_falhas` tentativas
    # erradas seguidas, a conta fica bloqueada por `login_bloqueio_minutos`.
    login_max_falhas: int = 5
    login_bloqueio_minutos: int = 15

    # Custo do bcrypt. DOZE é o valor de produção e o default; a suíte baixa para
    # 4 porque cria usuário em quase todo teste e 12 rodadas custam ~250 ms cada.
    # Ficar em config em vez de cravado no código é o que permite baixar no teste
    # sem que alguém fique tentado a baixar no código e esquecer lá.
    bcrypt_rounds: int = 12

    # Origens permitidas no CORS. O Expo em desenvolvimento não manda Origin,
    # mas manter restrito evita que a API responda a qualquer página web.
    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    # MÍNIMO EXISTENCIAL, em centavos. Valor FIXO, não derivado do salário
    # mínimo: Decreto 11.150/2022, art. 3º, com a redação dada pelo Decreto
    # 11.567, de 19/06/2023 — R$ 600,00. A redação anterior (25% do salário
    # mínimo) foi substituída, e o § 2º que a congelava, revogado.
    # Compete ao Conselho Monetário Nacional atualizar o valor (art. 3º, § 3º),
    # por isso ele vive aqui e não no código.
    minimo_existencial_centavos: int = 60000

    # Data da redação que fixou o valor acima, em ISO. Viaja na resposta do
    # resumo e aparece na tela: piso velho fica visível ao usuário, em vez de
    # ser confiado às cegas. Mesma disciplina dos tetos do consignado.
    minimo_existencial_vigente_em: str = "2023-06-19"

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
