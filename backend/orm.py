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

    # Lembrete de fechamento do mês (M7.1). O DIA é preferência; a hora reusa
    # `hora_lembrete`, porque duas horas diferentes para o mesmo usuário seriam
    # duas coisas para ele configurar sem ganho nenhum.
    # `None` = desligado. Um booleano separado permitiria "ligado sem dia", que
    # é um estado que não significa nada.
    fechamento_dia_do_mes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # METAS DO CAIXA (M7). Todas NULLABLE de propósito: campo não preenchido tem
    # de sobreviver como ausente, nunca como zero. Zero é uma afirmação — "não
    # reservo imposto" — e ausente é outra: "não sei ainda".
    #
    # `imposto_bps` é informado pelo usuário, jamais estimado: alíquota varia por
    # enquadramento, anexo e faixa de receita, e chutar para menos faz a pessoa
    # gastar dinheiro que é do governo (ADR 0009).
    imposto_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reserva_meta_meses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reserva_saldo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # Quanto vai para a reserva POR MÊS. Coisa diferente de `reserva_saldo`
    # (o que já existe) e de `reserva_meta_meses` (aonde se quer chegar): é o
    # único dos três que entra na cascata da capacidade.
    reserva_aporte: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    aposentadoria_aporte: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # Sem ele, NENHUMA comparação dívida × investimento é exibida (ADR 0009):
    # projetar rendimento seria dar recomendação de investimento.
    rendimento_esperado_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
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


class FonteRenda(Base):
    """
    De onde vem o dinheiro. N por tenant, porque uma renda só é a exceção e não
    a regra: PJ com dois contratos, CLT com aluguel, aposentado com um bico.

    `valor_tipico_informado` é o que o usuário DIZ que ganha. O que ele de fato
    recebeu vive em `Recebimento`, e é de lá que sai a renda que o plano usa
    quando há histórico — ver `domain/caixa.renda_tipica`.
    """

    __tablename__ = "fonte_renda"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    nome: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(20))
    valor_tipico_informado: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    variavel: Mapped[bool] = mapped_column(Boolean, default=False)

    # Registro permanente, não lançamento mensal: a fonte vale até ser
    # desativada. É o que dispensa redigitar tudo todo mês.
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Recebimento(Base):
    """
    O que de fato caiu, por fonte e por mês.

    Existe porque renda variável não se descreve com um número: é daqui que sai
    o pior mês, que é a renda que o plano precisa aguentar. Um por fonte por
    mês — reenviar o mesmo mês sobrescreve o valor, em vez de duplicar.
    """

    __tablename__ = "recebimento"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    fonte_id: Mapped[str] = mapped_column(String(36), index=True)

    mes: Mapped[str] = mapped_column(String(7))  # AAAA-MM
    valor: Mapped[int] = mapped_column(BigInteger)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Gasto(Base):
    """
    Um gasto mensal. REGISTRO PERMANENTE, não lançamento datado: guarda o valor
    mensal e vale até ser alterado ou desativado.

    `essencial` é classificação do USUÁRIO, não do app: o que é cortável na vida
    de alguém não é decisão nossa. Ele separa `capacidade_hoje` de
    `capacidade_maxima` em `domain/caixa.py`.
    """

    __tablename__ = "gasto"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    descricao: Mapped[str] = mapped_column(String(120))
    categoria: Mapped[str] = mapped_column(String(20))
    essencial: Mapped[bool] = mapped_column(Boolean, default=True)
    fixo: Mapped[bool] = mapped_column(Boolean, default=True)
    valor_mensal: Mapped[int] = mapped_column(BigInteger)

    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProvisaoAnual(Base):
    """
    Despesa anual conhecida — IPVA, seguro, licenciamento.

    `saldo_acumulado` é quanto já foi guardado. O aporte do mês sai de
    `domain/caixa.aporte_de_provisao`, que divide o que falta pelos meses que
    faltam até o vencimento: quem começa em agosto com IPVA em janeiro tem
    cinco depósitos, não doze.
    """

    __tablename__ = "provisao_anual"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    descricao: Mapped[str] = mapped_column(String(120))
    valor_anual: Mapped[int] = mapped_column(BigInteger)
    mes_vencimento: Mapped[int] = mapped_column(Integer)  # 1 a 12
    saldo_acumulado: Mapped[int] = mapped_column(BigInteger, default=0)

    ativa: Mapped[bool] = mapped_column(Boolean, default=True)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Meta(Base):
    """
    Uma meta nomeada do usuário — reserva de emergência, viagem, trocar de carro.

    NÃO CONFUNDIR COM AS "METAS DO CAIXA" de `Perfil` (`reserva_aporte`,
    `aposentadoria_aporte` e companhia). Aquelas são seis colunas fixas que
    alimentam a CASCATA do fechamento do mês: elas decidem quanto sai do mês
    antes de sobrar capacidade. Estas são uma coleção livre, que a pessoa cria e
    apaga, e que não entra em cálculo nenhum de capacidade.

    Por que aditiva, e não substituta: mover a reserva do `Perfil` para cá
    quebraria `domain/caixa`, que lê aquelas colunas para propor o fechamento. O
    custo de conviver com dois sentidos de "meta" é um parágrafo de documentação;
    o de unificar seria recalcular a cascata. Ver ADR 0017.

    `data_alvo` é `AAAA-MM` em String(7), a mesma escolha de `FechamentoMes.mes`:
    mês é a unidade que o usuário informa, e `Date` obrigaria a inventar um dia.

    `aporte_mensal` é o que a pessoa DECLARA separar. O que ela precisaria
    separar é `domain/metas.aporte_sugerido`, derivado e nunca persistido — valor
    calculado que dorme em coluna é valor que envelhece errado.
    """

    __tablename__ = "meta"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    nome: Mapped[str] = mapped_column(String(120))
    # Um emoji cabe em 8: alguns são pares de surrogates mais seletor de variação.
    emoji: Mapped[str | None] = mapped_column(String(8), nullable=True)

    valor_alvo: Mapped[int] = mapped_column(BigInteger)
    saldo: Mapped[int] = mapped_column(BigInteger, default=0)

    # NULLABLE de propósito, os dois. Meta sem prazo é meta legítima ("quero
    # trocar de carro, um dia"), e sem prazo não existe aporte sugerido — o que a
    # tela faz então é não mostrar pill, em vez de mostrar um palpite.
    data_alvo: Mapped[str | None] = mapped_column(String(7), nullable=True)
    aporte_mensal: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    ativa: Mapped[bool] = mapped_column(Boolean, default=True)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FechamentoMes(Base):
    """
    O mês que o usuário confirmou.

    Existe porque nenhuma outra tabela responde "quando ele conferiu isso pela
    última vez". `Recebimento` só existe para quem tem renda variável, e
    `CaixaSnapshot` é gravado a cada mutação — os dois marcam atividade, não
    conferência.

    A distinção importa: a capacidade alimenta o aporte do simulador, e o
    simulador alimenta o que a pessoa leva a uma negociação. Saber que o número
    tem três meses é o que permite dizer isso na tela em vez de apresentá-lo
    como se fosse de hoje.

    Um por tenant por mês — refechar o mesmo mês atualiza `confirmado_em` em vez
    de duplicar, do mesmo jeito que reenviar um recebimento sobrescreve.
    """

    __tablename__ = "fechamento_mes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    mes: Mapped[str] = mapped_column(String(7))  # AAAA-MM

    confirmado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CaixaSnapshot(Base):
    """
    A cascata congelada no instante em que foi calculada. APPEND-ONLY: nenhuma
    rota faz UPDATE aqui.

    Existe para responder, seis meses depois, "com base em qual renda eu propus
    aquele acordo?". Um acordo de dívida nasce de uma foto financeira, e sem a
    foto guardada a decisão fica sem contexto — que é o mesmo motivo de
    `Renegociacao` guardar o antes e o depois.
    """

    __tablename__ = "caixa_snapshot"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    renda_bruta_tipica: Mapped[int] = mapped_column(BigInteger)
    origem_renda: Mapped[str] = mapped_column(String(30))
    imposto_reservado: Mapped[int] = mapped_column(BigInteger)
    renda_liquida: Mapped[int] = mapped_column(BigInteger)
    essenciais: Mapped[int] = mapped_column(BigInteger)
    nao_essenciais: Mapped[int] = mapped_column(BigInteger)
    provisao_mensal: Mapped[int] = mapped_column(BigInteger)
    aporte_reserva: Mapped[int] = mapped_column(BigInteger)
    aporte_aposentadoria: Mapped[int] = mapped_column(BigInteger)
    comprometido_dividas: Mapped[int] = mapped_column(BigInteger)
    capacidade_hoje: Mapped[int] = mapped_column(BigInteger)
    capacidade_maxima: Mapped[int] = mapped_column(BigInteger)
    aporte_maximo: Mapped[int] = mapped_column(BigInteger)
    minimo_existencial: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    nao_fecha: Mapped[bool] = mapped_column(Boolean, default=False)

    # ADITIVA e NULLABLE (M11). A foto precisa explicar a própria
    # `capacidade_maxima` seis meses depois, e sem esta coluna faltaria a linha
    # que a derrubou. `NULL` em snapshot anterior ao respiro é a verdade; `0`
    # afirmaria respiro declarado como zero, que é escolha e não ausência.
    respiro: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    calculado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Respiro(Base):
    """
    A fatia que a pessoa reservou para viver enquanto paga (M11, ADR 0019).

    UMA LINHA POR TENANT. Não é uma coleção como `meta` ou `gasto`: é uma linha
    da cascata, no mesmo nível do aluguel, e duas linhas dariam dois valores para
    a mesma pergunta.

    O VALOR NÃO É REGRA FINANCEIRA — é dado do usuário, e a ausência de linha
    significa "nunca declarou", nunca "declarou zero". Não existe default: um
    percentual de fábrica seria o coeficiente sem fonte que a ADR 0009 proíbe.

    `ativo=False` NÃO APAGA: preserva `valor_mensal` e `saldo_acumulado`, e só
    tira a linha da cascata. Desativar é diferente de nunca ter declarado, e a
    tela precisa dizer qual dos dois é.

    `saldo_acumulado` segue o molde de `provisao_anual.saldo_acumulado`: respiro
    não usado acumula em silêncio, sem notificação e sem pergunta no fechamento
    (guardrail 4.1). `ultimo_mes_apurado` é `NULL` até a primeira apuração — e é
    ele que torna a rolagem da virada do mês idempotente, sem job e sem cron.

    A COLUNA GUARDA O QUE VEIO DOS MESES FECHADOS, e é INVARIANTE DURANTE O MÊS:
    registrar ou desfazer um uso não escreve nela. O que o uso do mês corrente
    passa da fatia é descontado na LEITURA (`domain/caixa.calcular_caixa`) e
    liquidado na virada, junto com o não usado. Gravar esse desconto a cada uso
    tornaria o `DELETE` do uso irreversível: quem digitasse R$ 300 no lugar de
    R$ 30 perderia saldo real ao corrigir, num produto cuja promessa é que
    respiro não usado acumula.
    """

    __tablename__ = "respiro"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    valor_mensal: Mapped[int] = mapped_column(BigInteger)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    saldo_acumulado: Mapped[int] = mapped_column(BigInteger, default=0)
    ultimo_mes_apurado: Mapped[str | None] = mapped_column(String(7), nullable=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RespiroUso(Base):
    """
    Um gasto de respiro — o sorvete, o cinema, as unhas.

    LANÇAMENTO, NÃO SALDO. O disponível do mês é derivado a cada leitura em
    `domain/caixa.py`; gravá-lo aqui daria um número que envelhece entre um uso
    e o seguinte.

    `descricao` é opcional e livre porque ninguém deve prestação de contas do
    próprio lazer: o registro existe para a pessoa saber quanto ainda há, e
    nunca para produzir alerta, comparação ou tom negativo (guardrail 4.1).

    `data` é `Date`, e não timestamp: a apuração é mensal, e a hora do sorvete
    não é dado que este produto precise guardar.
    """

    __tablename__ = "respiro_uso"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    valor: Mapped[int] = mapped_column(BigInteger)
    descricao: Mapped[str | None] = mapped_column(String(120), nullable=True)
    data: Mapped[date] = mapped_column(Date, default=date.today)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RespiroDestinacao(Base):
    """
    Saldo acumulado de respiro que o usuário mandou virar aporte extra.

    SEMPRE POR AÇÃO EXPLÍCITA. Nunca automático, nunca sugerido em push: a
    escolha do destino é do usuário (ADR 0019, item 5), e o app que decidisse
    por ele transformaria o respiro em prestação de contas mensal.

    Tabela separada de `respiro_uso` porque as duas respondem perguntas
    diferentes — uma é o que a pessoa viveu, a outra é o que ela adiantou na
    dívida. Somá-las numa coluna `tipo` faria o relatório de uma contaminar o da
    outra.
    """

    __tablename__ = "respiro_destinacao"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    valor: Mapped[int] = mapped_column(BigInteger)
    data: Mapped[date] = mapped_column(Date, default=date.today)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Marco(Base):
    """
    Uma conquista atingida — e ela não se desfaz (M11, ADR 0019, item 4).

    EVENTO PERSISTIDO, NUNCA PREDICADO RECALCULADO, e é a distinção mais
    importante desta tabela. A porcentagem da rota anda para trás quando o
    usuário cadastra uma dívida nova; um marco derivado do estado atual se
    desfaria, e a pessoa perderia uma conquista por ter sido honesta sobre a
    própria situação.

    Molde append-only de `CaixaSnapshot`, com UMA ressalva: `celebrado_em` é o
    único UPDATE permitido aqui. Os dois campos são separados para a tela não
    reaparecer a cada abertura do app, e para que um marco atingido durante o
    período somente leitura não se perca — ele espera com `celebrado_em` nulo.

    `tipo` é `primeira_negociacao` | `primeira_quitacao` | `rota_25` | `rota_50`
    | `rota_75`. Linha ausente é marco não atingido; a rota devolve os cinco
    tipos com nulos, e não é este arquivo que decide quando o gatilho ocorre.
    """

    __tablename__ = "marco"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    tipo: Mapped[str] = mapped_column(String(30))
    atingido_em: Mapped[date] = mapped_column(Date, default=date.today)
    celebrado_em: Mapped[date | None] = mapped_column(Date, nullable=True)


class Usuario(Base):
    """
    Quem entra no app (M8, ADR 0012).

    `tenant_id` é COLUNA SEPARADA de `id`, e não um apelido dele. Hoje há um
    usuário por tenant, mas conta compartilhada — casal olhando o mesmo caixa —
    é dois usuários apontando para o mesmo tenant, e essa é a única forma que
    não exige remigrar todas as tabelas depois. Custa uma coluna agora.
    """

    __tablename__ = "usuario"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)

    # Guardado normalizado (aparas + minúsculas). A unicidade é do banco, não da
    # rota: duas requisições simultâneas passam pelo mesmo `SELECT` sem achar
    # nada e criam duas contas com o mesmo e-mail.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(100))

    # Trava de força bruta. Produto financeiro sem ela é convite: senha de 8
    # caracteres cai em horas contra uma rota que responde sempre.
    falhas_login: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bloqueado_ate: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Assinatura(Base):
    """
    A última compra que a loja confirmou para este tenant (M9, ADR 0013).

    UMA LINHA POR TENANT, sobrescrita a cada conferência — não é um extrato de
    cobranças. A renovação mensal produz transação nova todo mês, e guardar cada
    uma faria a tabela crescer para sempre para responder a pergunta que o
    produto realmente faz, que é uma só: **até quando esta pessoa pode
    escrever?** Quem quiser o histórico de faturamento pede ao painel da loja,
    que é quem cobra.

    `tenant_id` é o que faz esta tabela entrar na exclusão de conta SEM UMA
    LINHA A MAIS: a varredura de `routers/conta.tabelas_do_tenant()` é derivada
    de `Base.metadata`, e o teste que falha quando uma tabela fica de fora já
    cobre esta. Foi exatamente para isto que aquela varredura não foi escrita à
    mão.
    """

    __tablename__ = "assinatura"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True, unique=True)

    plataforma: Mapped[str] = mapped_column(String(10))
    produto_id: Mapped[str] = mapped_column(String(120))

    # A CHAVE ESTÁVEL da loja: não muda quando a assinatura renova. É por ela, e
    # não pelo id da transação da vez, que a restauração é idempotente — o
    # mesmo recibo reenviado encontra a linha que já existe em vez de criar uma
    # assinatura nova a cada toque no botão.
    transacao_original_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)

    # O que mandar de volta à loja para reconferir. NÃO É O MESMO que a coluna
    # acima: a Apple consulta pelo `originalTransactionId`, o Google pelo
    # `purchaseToken` — e o `orderId` do Google, que é o que grava a unicidade,
    # não serve para consultar nada. Guardar só um dos dois faria a renovação
    # ser detectada no iPhone e não no Android.
    #
    # Text e não String(n): token do Google não tem tamanho contratado.
    chave_consulta: Mapped[str] = mapped_column(Text)

    # SEMPRE ABSOLUTO E SEMPRE EM UTC. Nunca "faltam N dias": o relógio do
    # aparelho é do usuário, e quem controla o relógio controlaria a assinatura.
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # `sandbox` ou `production`. Guardado porque uma compra de sandbox liberando
    # o app em produção é o buraco que a revisão da loja não vê e que qualquer
    # pessoa com Xcode encontra.
    ambiente: Mapped[str] = mapped_column(String(20), default="production")

    # Desligada NÃO significa expirada: cancelar desliga a renovação, e o
    # período já pago continua valendo até `expira_em`.
    renovacao_automatica: Mapped[bool] = mapped_column(Boolean, default=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Sessao(Base):
    """
    Um refresh token vivo (ADR 0012).

    O VALOR NUNCA É GRAVADO — só o SHA-256 dele. Vazamento do banco não devolve
    sessão utilizável, que é a mesma disciplina de `senha_hash` uma coluna acima.
    SHA-256 puro e não bcrypt de propósito: o token tem 32 bytes de entropia, não
    é adivinhável por dicionário, e a verificação acontece em toda renovação.

    A rotação é o que torna roubo DETECTÁVEL: usar um refresh o revoga e cria
    outro, então o mesmo valor apresentado duas vezes significa cópia.
    """

    __tablename__ = "sessao"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    usuario_id: Mapped[str] = mapped_column(String(36), index=True)

    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revogada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ultimo_uso_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class CodigoRecuperacao(Base):
    """
    Código de 6 dígitos para redefinir a senha (ADR 0012).

    Hash, não o código: quem lê o banco não redefine a senha de ninguém.

    `tentativas` existe porque 6 dígitos são um milhão de possibilidades, e um
    milhão de requisições é uma tarde. Sem teto, o código curto seria a porta
    mais larga do produto — o mesmo raciocínio de `falhas_login`, e o motivo de
    a validade ser 30 minutos e não 24 horas.
    """

    __tablename__ = "codigo_recuperacao"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=novo_id)
    usuario_id: Mapped[str] = mapped_column(String(36), index=True)

    codigo_hash: Mapped[str] = mapped_column(String(64))
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    tentativas: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
