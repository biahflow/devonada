import uuid
from datetime import date, datetime, timezone

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def novo_id() -> str:
    return str(uuid.uuid4())


class Divida(Base):
    """
    Uma obrigação financeira do usuário.

    REGRA DE UNIDADE, válida em toda tabela deste arquivo:
    - dinheiro é BigInteger em CENTAVOS;
    - taxa e percentual são Integer em BASIS POINTS (250 = 2,50%).
    Nenhuma coluna Numeric, nenhuma Float. A regra dos centavos vale no banco,
    não só no app — é aqui que ela para de ser convenção e vira estrutura.
    """

    __tablename__ = "divida"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    # Vem do token, nunca do cliente. Filtrar por ele em TODA query é o que
    # impede o retrofit de isolamento quando houver mais de um usuário.
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    credor: Mapped[str] = mapped_column(String(200))
    valor_cobrado: Mapped[int] = mapped_column(BigInteger)
    data_origem: Mapped[date] = mapped_column(Date)
    tipo: Mapped[str] = mapped_column(String(20))

    taxa_juros_mensal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_parcelas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcelas_pagas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proximo_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)

    situacao: Mapped[str] = mapped_column(String(20), default="ativa")
    valor_pago: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    data_quitacao: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Vínculo com a extração que originou a dívida, quando veio de um contrato.
    extracao_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Exclusão lógica: histórico financeiro não se destrói.
    excluido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Parcela(Base):
    """
    Uma prestação de uma dívida.

    `cancelada_em` em vez de DELETE: renegociação cancela as pendentes e gera
    outras, mas as antigas ficam. Histórico de pagamento não se apaga — é o que
    o usuário usa para provar o que já pagou.
    """

    __tablename__ = "parcela"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    divida_id: Mapped[str] = mapped_column(String(36), index=True)

    numero: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    valor: Mapped[int] = mapped_column(BigInteger)
    vencimento: Mapped[date] = mapped_column(Date)

    paga_em: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_pago: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    cancelada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Renegociacao(Base):
    """Registro de um acordo. Guarda o antes e o depois, para o histórico."""

    __tablename__ = "renegociacao"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    divida_id: Mapped[str] = mapped_column(String(36), index=True)

    valor_anterior: Mapped[int] = mapped_column(BigInteger)
    novo_valor: Mapped[int] = mapped_column(BigInteger)
    novo_total_parcelas: Mapped[int] = mapped_column(Integer)
    nova_taxa_juros_mensal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primeiro_vencimento: Mapped[date] = mapped_column(Date)
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Perfil(Base):
    """Renda, dependentes e preferências de lembrete. Uma linha por tenant."""

    __tablename__ = "perfil"

    tenant_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    renda_mensal: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    dependentes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Preferência de lembrete. A HORA é aplicada no aparelho, não aqui: o
    # servidor não sabe o fuso do dispositivo, e agendar notificação local é
    # inerentemente local. Guardamos a preferência; quem compõe o instante é o app.
    # server_default além do default: sem ele, a migration que adiciona a coluna
    # NOT NULL falha numa tabela que já tem linhas.
    hora_lembrete: Mapped[str] = mapped_column(String(5), default="09:00", server_default="09:00")
    dias_antecedencia_lembrete: Mapped[int] = mapped_column(
        Integer, default=3, server_default="3"
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SaldoSnapshot(Base):
    """
    Foto do total devido no fim de cada mês.

    Existe porque `evolucaoSaldo` precisa de histórico e não dá para inventar
    retroativamente. Uma linha por tenant por mês, escrita na primeira consulta
    do resumo naquele mês. O gráfico nasce vazio e ganha um ponto por mês de uso
    — dado real, não estimado.
    """

    __tablename__ = "saldo_snapshot"

    tenant_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    mes: Mapped[str] = mapped_column(String(7), primary_key=True)  # YYYY-MM
    saldo: Mapped[int] = mapped_column(BigInteger)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MensagemChat(Base):
    """
    Uma mensagem da conversa. Existe para o histórico sobreviver ao fechamento
    do app — antes disso, `useChat` guardava tudo em memória.

    `cards_json` guarda o PEDIDO de card (tipo e id), nunca os valores. Os
    números são remontados do banco a cada leitura: uma parcela paga ontem não
    pode reaparecer hoje com o saldo de ontem.
    """

    __tablename__ = "mensagem_chat"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    papel: Mapped[str] = mapped_column(String(20))  # user | assistant
    conteudo: Mapped[str] = mapped_column(Text)
    cards_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # O instante vem do PYTHON, não do banco, e esta é a única tabela assim.
    # `func.now()` vira CURRENT_TIMESTAMP no SQLite, que tem precisão de
    # SEGUNDO: pergunta e resposta gravadas no mesmo segundo empatavam, e a
    # ordem da conversa passava a depender do desempate por UUID — ou seja,
    # aleatória. Numa lista de dívidas isso seria feio; num diálogo, torna a
    # conversa incompreensível. O server_default fica como rede para linha
    # inserida fora do app.
    criada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class Extracao(Base):
    """
    Leitura de um contrato. O ARQUIVO NÃO É GUARDADO (ADR 0005) — persistem os
    campos extraídos e os trechos curtos que os comprovam, em JSON.
    """

    __tablename__ = "extracao"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    status: Mapped[str] = mapped_column(String(20), default="processando")
    erro: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON serializado dos campos e alertas. Text em vez de JSONB porque o
    # formato é do contrato de API e não é consultado por dentro.
    campos_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    alertas_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    nome_arquivo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    arquivo_descartado: Mapped[bool] = mapped_column(Boolean, default=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
