# F-010 — Execution Plan

Produzido pelo Planner a partir do Feature Contract aceito em [`feature.md`](feature.md). Este
documento diz **como** a feature aceita é decomposta. Ele não altera requisito, não escolhe harness
ou modelo e não concede aprovação.

O formato abaixo é o `FEATURE EXECUTION PLAN` do
[contrato do Planner](../../engineering-os/agents/planner.md).

---

## FEATURE EXECUTION PLAN

```text
feature_id: F-010

goal: Pôr um piso sob o corte. Hoje `capacidade_maxima` é literalmente o cenário em que todo o
  não essencial foi cortado, e é dela que saem o teto do simulador, a sobra do painel e o aporte
  do card do chat — o produto vinha propondo planos calculados sobre a hipótese de que a pessoa
  para de viver. O respiro entra como linha da cascata subtraída ANTES desse corte, com valor
  declarado pelo usuário, e o marco vira evento persistido que não se desfaz.

assumptions:
  - A ADR 0019 é a decisão vigente e não será reaberta durante a execução: valor declarado pelo
    usuário, nenhum default nem faixa, marco por acúmulo, sem reconciliação automática com `gasto`.
  - `docs/api-contract.md`, seção 3.13 (linhas 1048-1182), é o contrato dos endpoints. Nenhuma
    tarefa inventa payload, unidade ou código de erro; divergência entre código e contrato é
    resolvida corrigindo o artefato desatualizado dentro do escopo da tarefa.
  - Baseline de validação MEDIDO em 19/08/2026 durante o planejamento, não copiado de documento:
    42 suítes / 472 testes Jest e 497 testes pytest, todos verdes. O número que
    `docs/engineering-os-adoption.md` trazia (441 Jest em 40 suítes) já estava defasado e foi
    corrigido no mesmo commit deste plano. Avisos de `act(...)` no Jest e 14 avisos no pytest são
    preexistentes, e o Jest não encerra sozinho depois de imprimir o resumo — handles abertos
    preexistentes, não sintoma de suíte travada.
  - A cadeia Alembic é linear e sua cabeça é `e07b3c5d91a8` (metas nomeadas). Só T1 escreve
    migração neste milestone.
  - Nenhuma tarefa roda contra Postgres nem contra aparelho; as duas validações continuam
    obrigatórias antes do release e permanecem gate humano.

risks:
  - Marco implementado como predicado sobre o estado atual se desfaz quando o usuário cadastra
    dívida nova. É o modo de falha mais provável desta feature e o mais cruel. T4 grava evento;
    T4-AC5 é o teste que prova.
  - Três consumidores mudam de número sem serem tocados — simulador, painel e card `plano_sugerido`
    do chat, todos via `leitura.capacidade_atual`. T8 cruza respiro declarado com o teto do
    simulador; é o gêmeo do teste que faltava no M7.2 quando o defeito passou por quatro gates.
  - `nao_fecha` passa a disparar para mais gente. É correto e é mudança de comportamento visível.
    Continua sendo fato aritmético, nunca diagnóstico de superendividamento.
  - Dupla contagem com `gasto` não essencial fica possível por decisão (ADR 0019, item 7). Se a
    tela de T5 não nomear o risco, o usuário vê a capacidade cair duas vezes e não entende por quê.
  - Copy moralizante contradiz a finalidade anti-desistência da feature. T8 quebra em cinco termos.
  - Regressão silenciosa em quem não declarou respiro: a cascata dele precisa ficar idêntica.
    T1-AC4 é o teste de regressão que trava isso.

tasks:
  - id: T1
    role: builder
    goal: O respiro entra na cascata do domínio antes de `capacidade_maxima`, e as quatro tabelas
      do milestone nascem numa migração só.
    scope: |
      `backend/domain/caixa.py` — `respiro`, `respiro_usado_no_mes` e `respiro_saldo_acumulado`
        (todos `int | None`) em `EntradaCaixa`; os mesmos mais `respiro_disponivel_no_mes` e
        `respiro_ativo` em `Caixa`; a subtração de `respiro` no cálculo de `capacidade_maxima`,
        entre `sobra_operacional` e os potes; `respiro_disponivel_no_mes` derivado como
        `max(0, respiro - usado)`; atualização do docstring da cascata (linhas 256-260) e um
        parágrafo novo declarando que o valor NÃO é regra financeira, é dado do usuário — é a
        distinção que autoriza o módulo a existir sem fonte legal.
      `backend/domain/caixa.py` — função pura `respiro_invade_o_piso(liquida, essenciais, respiro,
        minimo) -> bool | None`, com a FONTE do piso no docstring (Decreto 11.150/2022, art. 3º, na
        redação do Decreto 11.567/2023). Devolve `None` quando não há piso configurado, no mesmo
        espírito de `abaixo_do_piso`.
      `backend/orm.py` — `Respiro` (uma linha por tenant: `valor_mensal`, `ativo`,
        `saldo_acumulado` no molde de `provisao_anual.saldo_acumulado`, `ultimo_mes_apurado`),
        `RespiroUso` e `RespiroDestinacao` (lançamentos datados) e `Marco` (`tipo`, `atingido_em`,
        `celebrado_em`), todos com `tenant_id`. `Marco` segue o molde append-only de
        `CaixaSnapshot`, com a ressalva de que `celebrado_em` é o único UPDATE permitido.
      `backend/orm.py` — coluna `respiro` em `CaixaSnapshot` (aditiva, `nullable=True`).
      `backend/alembic/versions/` — uma migração forward-only encadeada em `e07b3c5d91a8`, no
        estilo de `e07b3c5d91a8_metas_nomeadas.py`: `upgrade()` com justificativa de schema no
        comentário, índice em `tenant_id`, e `downgrade()` espelhado.
      `backend/leitura.py` — `montar_entrada_caixa` lê `orm.Respiro` e os usos do mês corrente e
        preenche os três campos novos de `EntradaCaixa`. Sem respiro declarado, os três seguem
        `None` e a entrada fica idêntica à de hoje.
      `backend/tests/test_caixa.py` — testes da cascata com respiro.
    out_of_scope: |
      Nenhum endpoint HTTP, nenhum schema Pydantic, nenhuma rota. `PUT /v1/caixa/respiro` e o `422`
      são de T2 — aqui só nasce a regra pura que T2 vai chamar.
      Nenhuma detecção ou gravação de marco: T1 cria a TABELA `marco`, não a lógica.
      Nada em `src/`. Nada em `routers/`.
      Não alterar migração já aplicada, não tocar `routers/conta.py` (a varredura de
      `tabelas_do_tenant()` é derivada do metadata e absorve as quatro tabelas sozinha).
    expected_areas: backend/domain/caixa.py · backend/orm.py · backend/alembic/versions/ ·
      backend/leitura.py · backend/tests/test_caixa.py
    acceptance_criteria: |
      T1-AC1 `capacidade_maxima = liquida − essenciais − provisao − reserva − aposentadoria −
        respiro`, e `capacidade_hoje` e `aporte_maximo` herdam a queda sem alteração própria.
      T1-AC2 Teste que prova que cortar todo o não essencial NÃO zera o respiro: com
        `nao_essenciais` em zero, `capacidade_maxima` continua descontando a linha.
      T1-AC3 `respiro_disponivel_no_mes` tem piso em zero e nunca é persistido.
      T1-AC4 Teste de regressão: tenant sem respiro declarado produz `Caixa` com os mesmos valores
        de hoje, campo a campo. `respiro` é `None`, nunca `0` — zero declarado é escolha legítima e
        diferente de não ter escolhido.
      T1-AC5 `respiro_invade_o_piso` devolve `True` quando `liquida − essenciais − respiro` fica
        abaixo do mínimo existencial, `False` quando não fica, e `None` sem piso configurado.
      T1-AC6 As quatro tabelas têm `tenant_id`, e um teste prova que aparecem em
        `tabelas_do_tenant()` sem ninguém ter editado `routers/conta.py`.
      T1-AC7 `alembic upgrade head` e `downgrade` rodam contra banco limpo.
      T1-AC8 O docstring de `calcular_caixa` diz, com todas as letras, que o valor do respiro é
        dado do usuário e não regra financeira.
    depends_on: []
    validation: cd backend && venv/bin/pytest ; venv/bin/alembic upgrade head ;
      venv/bin/alembic downgrade -1 ; venv/bin/alembic upgrade head
    required_capabilities: READ, WRITE (backend/domain, backend/orm.py, backend/alembic,
      backend/leitura.py, backend/tests), VALIDATE (pytest, alembic)
    risk: Alto por alcance, baixo por superfície. A linha nova muda o número de três consumidores
      que ninguém vai tocar. T1-AC4 é o que impede a mudança de vazar para quem não pediu respiro.
    relative_effort: M

  - id: T2
    role: builder
    goal: Declarar, usar, desfazer e destinar respiro pela API, com o preço da escolha em meses e
      o `422` do piso legal.
    scope: |
      `backend/schemas.py` — `respiro`, `respiroAtivo`, `respiroUsadoNoMes`,
        `respiroDisponivelNoMes` e `respiroSaldoAcumulado` na classe `Caixa`; schemas de request e
        response de `PUT /v1/caixa/respiro`, `POST /v1/caixa/respiro/uso` e
        `POST /v1/caixa/respiro/destinacao`. camelCase escrito à mão por campo, como o arquivo
        inteiro já faz; dinheiro em centavos.
      `backend/domain/simulacao.py` — `custo_em_meses(dividas, aporte_com, aporte_sem, estrategia,
        mes_inicial) -> int | None`, no molde de `economia_vs_minimo` (linhas 219-236): a MESMA
        `simular` rodada duas vezes, diferença de `meses_ate_quitacao`. `None` quando qualquer das
        duas não quita ou não há dívida simulável.
      `backend/routers/caixa.py` — os cinco campos em `_caixa_schema`; `PUT /v1/caixa/respiro`
        (grava e devolve `custoEmMeses`); `POST /v1/caixa/respiro/uso` → 201;
        `DELETE /v1/caixa/respiro/uso/{id}` → 204; `POST /v1/caixa/respiro/destinacao` → 201.
        Snapshot de caixa registrado depois de cada mutação, como toda rota do módulo já faz.
      `backend/routers/caixa.py` — rolagem do saldo acumulado na virada do mês, na primeira leitura
        que perceber que o mês mudou, usando `ultimo_mes_apurado` para ser idempotente. Sem job,
        sem notificação, sem pergunta.
      `backend/tests/test_caixa_api.py` e `test_caixa_integracao.py` — cobertura dos quatro
        endpoints, do `422` e da rolagem.
    out_of_scope: |
      Marcos, `GET /v1/marcos` e celebração: T4.
      `saldoInicialDaRota` e `rotaPercorridaBps`: T3. Não tocar `backend/routers/resumo.py`.
      Qualquer tela. Qualquer arquivo em `src/`.
      Nenhum efeito da destinação sobre parcela, pagamento ou dívida — ver `planning_findings`,
      item 1: a destinação DEBITA o saldo e grava o lançamento, e nada mais.
      Não criar valor default nem faixa sugerida de respiro, em nenhum lugar do código ou da copy.
    expected_areas: backend/schemas.py · backend/domain/simulacao.py · backend/routers/caixa.py ·
      backend/tests/test_caixa_api.py · backend/tests/test_caixa_integracao.py
    acceptance_criteria: |
      T2-AC1 `GET /v1/caixa` devolve os cinco campos. `respiro` é `null` para quem nunca declarou;
        com respiro declarado e nada usado, `respiroUsadoNoMes` é `0` — e o zero ali é fato.
      T2-AC2 `PUT /v1/caixa/respiro` devolve o respiro gravado mais `custoEmMeses`, que é `null`
        quando não há dívida com dado suficiente para simular. A tela grava sem preço em vez de
        exibir palpite.
      T2-AC3 `422` quando `renda_liquida − essenciais − valorMensal < minimo_existencial`, e `422`
        para `valorMensal` negativo. A mensagem é pt-BR, não contém valor monetário (guardrail 5) e
        traz `campo`, no registro exato de `_validar_aporte`.
      T2-AC4 `ativo: false` preserva `saldo_acumulado`. Desativar não é apagar.
      T2-AC5 Uso que excede o disponível do mês é ACEITO e consome o acumulado; excedendo os dois,
        ainda é aceito e o disponível vai a zero. A resposta é o novo `respiroDisponivelNoMes` e
        nada mais — nenhum alerta, aviso, sinal ou campo de comparação.
      T2-AC6 `DELETE` do uso devolve o valor ao disponível do mês.
      T2-AC7 `POST /destinacao` recusa com `422` valor maior que o saldo acumulado.
      T2-AC8 Ler `GET /v1/caixa` duas vezes no mesmo mês não rola o saldo duas vezes.
      T2-AC9 O teto do simulador cai para quem declarou respiro, sem `routers/simulacoes.py` ter
        sido tocado.
    depends_on: [T1]
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/schemas.py, backend/domain/simulacao.py,
      backend/routers/caixa.py, backend/tests), VALIDATE (pytest)
    risk: Maior tarefa do milestone. A rolagem do mês é a parte sutil: idempotência sem job depende
      inteiramente de `ultimo_mes_apurado`.
    relative_effort: L

  - id: T3
    role: builder
    goal: A porcentagem da rota passa a ser calculada no servidor, sobre uma linha de base que não
      encolhe.
    scope: |
      `backend/domain/resumo.py` — função pura `rota_percorrida_bps(saldo_inicial, total_devido)
        -> int | None`, em basis points, com piso em zero e `None` sem histórico. O docstring
        declara a escolha de método: a base é o MAIOR saldo já registrado, e não o primeiro ponto
        da série.
      `backend/routers/resumo.py` — `saldo_inicial` como `MAX(saldo)` sobre TODA a `saldo_snapshot`
        do tenant, sem o recorte por `mes <= mes_alvo` e sem o `[-12:]` que a série de exibição usa.
      `backend/schemas.py` — `saldoInicialDaRota: int | None` e `rotaPercorridaBps: int | None` em
        `ResumoDividas`.
      `backend/tests/test_api.py`, classe `TestResumo` — cobertura dos dois campos.
    out_of_scope: |
      Marcos. T3 produz o número que T4 vai cruzar contra 2500, 5000 e 7500, e nada mais.
      `evolucaoSaldo` permanece exatamente como está, inclusive o recorte por mês e o `[-12:]`.
      Nada em `src/` — `CardSaldo.tsx` é T6.
      Nenhuma mudança em `_registrar_snapshot`.
    expected_areas: backend/domain/resumo.py · backend/routers/resumo.py · backend/schemas.py ·
      backend/tests/test_api.py
    acceptance_criteria: |
      T3-AC1 Os dois campos são `null` quando há um único ponto de histórico. "0% percorrido" no
        primeiro dia seria desanimador E falso.
      T3-AC2 `rotaPercorridaBps` nunca é negativo.
      T3-AC3 Teste que prova que o mês selecionado NÃO move a base: consultar o resumo de um mês
        anterior devolve o mesmo `saldoInicialDaRota` do mês corrente.
      T3-AC4 A conversão é em basis points inteiros, no padrão de `comprometimentoRenda`.
    depends_on: []
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/domain/resumo.py, backend/routers/resumo.py,
      backend/schemas.py, backend/tests/test_api.py), VALIDATE (pytest)
    risk: Baixo. Escreve num arquivo que T4 também vai escrever depois, e a ordem resolve.
    relative_effort: S

  - id: T4
    role: builder
    goal: Marco vira evento persistido — atingido uma vez e para sempre.
    scope: |
      `backend/domain/marcos.py` (novo) — função pura que, dado o estado, diz QUAIS tipos estão
        atingidos: `primeira_negociacao`, `primeira_quitacao`, `rota_25`, `rota_50`, `rota_75`.
        Pura, sem sessão de banco, testável isolada.
      `backend/routers/marcos.py` (novo) — `GET /v1/marcos` devolvendo os cinco tipos, com
        `atingidoEm` e `celebradoEm` nulos para quem não atingiu; `POST /v1/marcos/{tipo}/celebracao`
        → 204, gravando `celebradoEm`.
      `backend/main.py` — registro do router novo.
      `backend/routers/resumo.py` — gravação de `rota_25/50/75` quando `rotaPercorridaBps` cruza
        2500, 5000 e 7500, no mesmo ponto em que `_registrar_snapshot` já escreve durante o `GET`.
      `backend/routers/parcelas.py` — `primeira_negociacao` no INSERT de `renegociacao`;
        `primeira_quitacao` quando a última parcela pendente é paga.
      `backend/routers/dividas.py` — `primeira_quitacao` em `POST /{id}/quitacao`.
      `backend/tests/test_marcos_api.py` (novo) e `backend/tests/test_domain_marcos.py` (novo).
    out_of_scope: |
      Qualquer tela — `MarcoScreen` é T7.
      Alterar valor de respiro em função de marco. A ADR 0019 é explícita: o marco celebra e libera
      o acumulado; ele NÃO mexe no valor. Não existe tabela de escala.
      Notificação, push ou lembrete de marco.
      Refatorar a detecção de quitação já existente em `parcelas.py` ou `dividas.py`; só acrescentar
      a gravação do marco ao que já acontece ali.
    expected_areas: backend/domain/marcos.py · backend/routers/marcos.py · backend/main.py ·
      backend/routers/resumo.py · backend/routers/parcelas.py · backend/routers/dividas.py ·
      backend/tests/
    acceptance_criteria: |
      T4-AC1 `GET /v1/marcos` devolve os cinco tipos com o par `atingidoEm`/`celebradoEm`.
      T4-AC2 `atingidoEm` é gravado uma vez; um segundo disparo do mesmo gatilho não o reescreve.
      T4-AC3 `celebradoEm` só muda por `POST /v1/marcos/{tipo}/celebracao`.
      T4-AC4 Marco atingido durante o período somente leitura da assinatura NÃO se perde: grava
        `atingidoEm`, fica com `celebradoEm: null` e espera a tela. A trava de assinatura bloqueia a
        celebração, não a gravação do atingimento.
      T4-AC5 O teste que dá nome a esta tarefa: cadastrar uma dívida nova DEPOIS de um marco
        atingido não desfaz o marco, mesmo com `rotaPercorridaBps` andando para trás.
      T4-AC6 Nenhum marco é derivado por predicado sobre o estado atual em nenhum ponto de leitura.
    depends_on: [T1, T3]
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/domain/marcos.py, backend/routers/, backend/main.py,
      backend/tests), VALIDATE (pytest)
    risk: Alto. É a tarefa que toca mais routers, e o modo de falha nomeado pelo contrato mora
      inteiro aqui. T4-AC5 é o teste que o impede.
    relative_effort: L

  - id: T5
    role: builder
    goal: O respiro aparece no Caixa, com os dois estados — e o vazio é o que faz a feature existir
      para quem mais precisa dela.
    scope: |
      `src/api/types.ts` — os cinco campos de respiro na interface `Caixa`.
      `src/api/caixa.ts` — `putRespiro`, `registrarUsoDeRespiro`, `excluirUsoDeRespiro` e
        `destinarRespiro`, no estilo do arquivo.
      `src/hooks/useCaixa.ts` — mutações novas usando `useInvalidarCaixa`, que já revalida
        `['caixa']` e `['dividas']` de uma vez.
      `src/components/caixa/RespiroCard.tsx` (novo) — props
        `{ respiro, respiroUsadoNoMes, respiroDisponivelNoMes, respiroSaldoAcumulado }` mais
        `onRegistrarUso` e `onDeclarar`, todas vindas de `GET /v1/caixa` e nenhuma calculada aqui.
        Barra no molde inline de `MetaCard` (trilho de 8px em `colors.neutralSurface`,
        preenchimento em `colors.accent`, `radius.pill`) — NÃO usar `Meter`, que é medidor de
        limiar e aqui não existe limite a ultrapassar. Saldo acumulado é linha discreta em
        `caption`, nunca uma segunda barra.
      `app/(tabs)/caixa/respiro.tsx` (novo) — declaração do valor com `CurrencyInput`, exibindo o
        `custoEmMeses` devolvido pelo `PUT`, e o texto que NOMEIA o risco de dupla contagem com
        `gasto` não essencial, com o caminho de desativar o gasto (ADR 0019, item 7).
      `app/(tabs)/caixa/index.tsx` — o card na tela.
      `src/test/screens/caixa.test.tsx` — os quatro estados e os dois estados do card.
    out_of_scope: |
      `MarcoScreen` e qualquer rota de marco: T7.
      `CardSaldo.tsx`: T6.
      Calcular qualquer valor no cliente. A largura da barra em porcentagem é proporção VISUAL, não
      dinheiro exibido; `respiroDisponivelNoMes` vem pronto do servidor.
      Sugerir valor, faixa ou percentual de respiro em qualquer copy.
      Compartilhamento em formato story.
    expected_areas: src/api/types.ts · src/api/caixa.ts · src/hooks/useCaixa.ts ·
      src/components/caixa/RespiroCard.tsx · app/(tabs)/caixa/ · src/test/screens/caixa.test.tsx
    acceptance_criteria: |
      T5-AC1 Sem respiro declarado (`respiro === null`), o card CONVIDA a declarar e diz o que o
        valor vai custar em meses. Não existe default, então o convite é obrigação de tela.
      T5-AC2 Com respiro declarado, mostra o número, e a barra enche em `colors.accent`.
      T5-AC3 Registrar uso não produz alerta, tom negativo nem progresso vermelho.
      T5-AC4 A tela de declaração nomeia o risco de dupla contagem com gasto não essencial.
      T5-AC5 Os quatro estados de tela — carregando, erro, vazio e conteúdo — têm teste.
      T5-AC6 Controles novos têm alvo de toque de 48pt e `accessibilityLabel` quando não há texto
        visível.
      T5-AC7 Nenhum valor monetário é calculado no cliente.
    depends_on: [T2]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check
    required_capabilities: READ, WRITE (src/api, src/hooks, src/components/caixa, app/(tabs)/caixa,
      src/test), VALIDATE (npm scripts)
    risk: Médio. Divide `src/api/types.ts` com T6.
    relative_effort: M

  - id: T6
    role: builder
    goal: Tirar do `CardSaldo` a última conta derivada que o app ainda faz.
    scope: |
      `src/api/types.ts` — `saldoInicialDaRota` e `rotaPercorridaBps` em `ResumoDividas`.
      `src/components/rota/CardSaldo.tsx` — as linhas 22-26 saem; o componente passa a consumir os
        dois campos tipados. O comportamento de esconder a barra sem histórico é PRESERVADO, agora
        pelo `null` que vem do servidor em vez de pela comparação local.
      `src/components/rota/CardSaldo.test.tsx` (novo) — o primeiro teste dedicado deste componente.
    out_of_scope: |
      Qualquer mudança de layout, cor ou copy do card além da origem do número.
      Backend — T3 já entregou os campos.
      Respiro e marcos.
    expected_areas: src/api/types.ts · src/components/rota/CardSaldo.tsx ·
      src/components/rota/CardSaldo.test.tsx
    acceptance_criteria: |
      T6-AC1 Nenhum componente do app calcula a porcentagem da rota. Busca por
        `evolucaoSaldo[0]` em `src/` não devolve nada.
      T6-AC2 Com `rotaPercorridaBps` nulo, o card mostra só o número e a contagem de dívidas, como
        hoje.
      T6-AC3 A barra continua enchendo com o que já foi percorrido, nunca com o que falta.
      T6-AC4 O teste novo cobre os dois casos, com e sem histórico.
    depends_on: [T3]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check
    required_capabilities: READ, WRITE (src/api/types.ts, src/components/rota), VALIDATE (npm)
    risk: Baixo. Divide `src/api/types.ts` com T5.
    relative_effort: XS

  - id: T7
    role: builder
    goal: A celebração ganha tela cheia, e sair dela é o que a impede de reaparecer.
    scope: |
      `src/api/marcos.ts` (novo) e `src/hooks/useMarcos.ts` (novo) — `GET /v1/marcos` e a celebração.
      `src/api/types.ts` — o tipo `Marco`.
      `app/(marco)/_layout.tsx` e `app/(marco)/[tipo].tsx` (novos) — FORA do grupo `(tabs)`, no
        molde de `(onboarding)`: barra de abas embaixo de uma tela de celebração a transforma em
        modal decorativo. `gestureEnabled: false`, saída só pelos dois botões.
      `src/components/marco/MarcoScreen.tsx` (novo) — props `{ tipo, respiroSaldoAcumulado }` mais
        os dois `on*`. Conquista em Archivo Black (`display`), respiro desbloqueado com valor
        concreto, CTA de permissão ("Aproveita. Tá no plano.") e botão alternativo "guardar pro
        próximo marco". Glow verde na intensidade menor da tela de vitória.
      A sugestão contextual por tamanho do marco sai de uma TABELA DE COPY no cliente indexada pela
        faixa de valor, e é TEXTO — nunca um número. Se produzisse valor, seria o app dizendo
        quanto gastar em lazer, que é o coeficiente sem fonte que a ADR 0019 recusou.
      Disparo da tela a partir de marco com `atingidoEm` preenchido e `celebradoEm` nulo.
      `src/test/screens/marco.test.tsx` (novo).
    out_of_scope: |
      Compartilhamento em formato story — decisão pendente sobre o que pode aparecer na imagem,
      registrada nas *Open questions* do contrato. A tela NÃO compartilha.
      Qualquer escrita disparada sem confirmação explícita do usuário.
      Alterar o valor do respiro em função do marco.
      Backend.
    expected_areas: src/api/marcos.ts · src/hooks/useMarcos.ts · src/api/types.ts · app/(marco)/ ·
      src/components/marco/ · src/test/screens/marco.test.tsx
    acceptance_criteria: |
      T7-AC1 A tela vive fora de `(tabs)` e não exibe barra de abas.
      T7-AC2 `gestureEnabled: false`; as duas saídas gravam `celebradoEm` e a tela não reaparece na
        abertura seguinte do app.
      T7-AC3 A sugestão contextual é texto e nunca contém valor monetário sugerido.
      T7-AC4 Os quatro estados de tela têm teste.
      T7-AC5 Nenhuma escrita é disparada pelo Tino sem confirmação explícita.
      T7-AC6 Nada em vermelho: a tela usa `colors.accent` sobre `colors.neutralSurface`.
    depends_on: [T4, T5]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check
    required_capabilities: READ, WRITE (src/api, src/hooks, src/components/marco, app/(marco),
      src/test), VALIDATE (npm)
    risk: Médio. Rota nova fora do grupo de abas; `bundle:check` é quem pega import que nenhum teste
      importa.
    relative_effort: M

  - id: T8
    role: builder
    goal: Provar a copy, provar o efeito cruzado, e deixar a documentação dizendo a verdade.
    scope: |
      `src/test/screens/respiro-copy.test.tsx` (novo) — o gêmeo dos testes de copy do M4, M6 e M7.
        Quebra em `você já gastou`, `você mereceu`, `se você economizar`, `desvio` e `extrapolou`,
        varrendo `RespiroCard`, a tela de declaração e a `MarcoScreen`. Estilo do loop de
        `src/test/screens/caixa.test.tsx:106`.
      `backend/tests/test_caixa_integracao.py` — o teste cruzado que dá nome ao risco: respiro
        declarado × teto do simulador, provando que `POST /v1/dividas/simulacoes` recusa o aporte
        que passou a não caber. É o gêmeo do teste de M7.2 que ligou fonte de renda a painel
        preenchido e que faltava quando o defeito passou por quatro gates verdes.
      `roadmap.md` — checklist do M11 marcada conforme o entregue, e a "Mudança de comportamento a
        declarar" atualizada com o que de fato mudou.
      `docs/api-contract.md` — Bloco 13 marcado, e a seção 3.13 conferida contra o implementado.
      `docs/design-system.md` — `RespiroCard` e `MarcoScreen` saem de "Ainda só especificação" e
        sobem para a seção dos componentes que existem.
      `docs/inventario.md` e `docs/engineering-os-adoption.md` — baseline de validação novo.
      `docs/features/F-010-respiro/evidence.md` (novo) — os oito `BUILD REPORT`, baseline, validação
        integrada, commits e `PLAN_DEVIATION` registrados.
    out_of_scope: |
      Código de feature. T8 escreve teste e documento.
      Marcar como validado em device o que não foi visto em aparelho. Ver `docs/agent-guidelines.md`:
      nenhum gate prova que a tela está legível ou que cabe na tela.
    expected_areas: src/test/screens/ · backend/tests/test_caixa_integracao.py · roadmap.md ·
      docs/api-contract.md · docs/design-system.md · docs/inventario.md ·
      docs/engineering-os-adoption.md · docs/features/F-010-respiro/evidence.md
    acceptance_criteria: |
      T8-AC1 O teste de copy quebra nos cinco termos e passa no texto entregue.
      T8-AC2 O teste cruzado prova que o teto do simulador caiu para quem declarou respiro.
      T8-AC3 Os seis gates do front e o pytest passam, e o relato distingue o que foi executado do
        que foi pulado.
      T8-AC4 Nenhum documento canônico afirma validação em device que não aconteceu.
      T8-AC5 `evidence.md` preserva os oito Builder Reports com atribuição por tarefa; nenhum é
        fundido em resumo.
    depends_on: [T5, T6, T7]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check ; cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (src/test, backend/tests, docs/, roadmap.md), VALIDATE (todos
      os perfis)
    risk: Baixo tecnicamente, alto por ser o último portão. É onde o milestone deixa de mentir ou
      passa a mentir.
    relative_effort: M

parallel_groups:
  - onda_1: [T1, T3]      # nenhuma dependência; arquivos disjuntos
  - onda_2: [T2, T4, T6]  # T4 espera T1 e T3; T6 espera T3; T2 espera T1
  - onda_3: [T5]
  - onda_4: [T7]
  - onda_5: [T8]

critical_path: T1 → T2 → T5 → T7 → T8 (M, L, M, M, M)
  O caminho é o do respiro, não o dos marcos. T2 é a maior tarefa do milestone — quatro endpoints,
  o `422` do piso e a rolagem idempotente do saldo — e tudo que é tela de respiro depende dela.
  O ramo dos marcos (T3 → T4 → T7) é mais curto em esforço acumulado (S, L, M) e reencontra o
  caminho crítico em T7. T6 é XS e sai de graça na onda 2.

integration_strategy: |
  Fundação primeiro, fatias verticais depois. T1 e T3 estabelecem o que todo o resto lê — a linha
  da cascata e o número da rota — e as fatias sobem independentes a partir dali.

  A integração é contínua no `main`, uma tarefa por commit, e não big-bang no fim: `leitura.
  capacidade_atual` é o ponto único por onde a mudança alcança o simulador, o painel e o card do
  chat, então o efeito colateral aparece já no commit de T1, com a suíte inteira do backend como
  rede.

  Duas tarefas de onda paralela não devem editar o mesmo arquivo ao mesmo tempo — ver
  PARALLELISM_RISK abaixo. Se a execução for sequencial (um agente por vez), o risco desaparece e
  a ordem sugerida é T1, T3, T2, T4, T6, T5, T7, T8.

  T8 fecha o milestone com a documentação e os dois testes que provam o efeito cruzado. Nenhuma
  tarefa marca item de device.

human_gates:
  - SATISFEITO em 19/08/2026 — efeito de `POST /v1/caixa/respiro/destinacao`. Ver PF-1.
  - SATISFEITO em 19/08/2026 — coluna `respiro` em `caixa_snapshot`. Ver PF-2.
  - SATISFEITO em 19/08/2026 — aprovação deste plano. A feature está `READY_FOR_BUILD` e este
    plano está CONGELADO para execução: mudança em dependência ou em trabalho planejado a partir
    daqui é `PLAN_DEVIATION`, registrada na seção final.
  - Validação em device de `RespiroCard` e `MarcoScreen` — leitura, safe area, teclado e
    acessibilidade. Fecha o milestone; nenhum agente pode declará-la.
  - Os gates humanos de regra de produto e de arquitetura já estão satisfeitos pela ADR 0019 e
    pelo Bloco 13 do `api-contract.md`.

planning_findings:
  - id: PF-1
    severity: RESOLVIDO por decisão humana em 19/08/2026
    decision: a destinação **só debita `saldo_acumulado` e grava o lançamento em
      `respiro_destinacao`**. Não escreve em parcela, pagamento nem dívida, e nenhuma rota de
      escrita nova nasce fora das quatro do Bloco 13. O escopo de T2 fica como estava redigido, e
      T2-Scope passou a dizê-lo com todas as letras em vez de deixá-lo por omissão. O contrato NÃO
      muda: "manda saldo acumulado para aporte extra" descreve a intenção do usuário, e o aporte
      extra continua sendo parâmetro de simulação, não dado gravado.
    finding: `POST /v1/caixa/respiro/destinacao` não tinha efeito definido além de debitar o saldo.
      O contrato diz "manda saldo acumulado para aporte extra na dívida", mas não existe entidade
      "aporte extra" persistida no repositório — `aporte_extra_mensal` é parâmetro de simulação,
      não dado gravado. T2 fixa o escopo em debitar `saldo_acumulado` e gravar o lançamento em
      `respiro_destinacao`, sem tocar parcela, pagamento ou dívida. Se a intenção era registrar um
      pagamento real, o escopo de T2 muda e o contrato precisa dizer contra qual dívida.
  - id: PF-2
    severity: RESOLVIDO por decisão humana em 19/08/2026
    decision: a coluna **entra em T1, aditiva e `nullable`**, na mesma migração das quatro tabelas
      do milestone. Snapshot gravado antes do respiro fica `NULL` — que é a verdade, e não zero, do
      mesmo jeito que a cascata distingue "não declarou" de "declarou zero". Retroativamente não há
      o que reconstruir, e é por isso que a coluna não podia esperar um segundo milestone: cada mês
      fechado sem ela é uma foto que não explica a própria `capacidade_maxima`.
    finding: `CaixaSnapshot` não tinha coluna `respiro`. A foto congelada existe para responder, seis
      meses depois, "com base em qual renda eu propus aquele acordo?" (`orm.py:421-427`). Sem a
      coluna, um snapshot da era do respiro não explica a própria `capacidade_maxima`, e a lacuna
      só apareceria numa auditoria. A recomendação é incluir a coluna aditiva e `nullable` em T1.
      É acréscimo ao contrato, não item dele, e por isso precisa de decisão em vez de ser assumido.
  - id: PF-3
    severity: limitação declarada
    finding: a linha de base da rota pode encolher DENTRO do primeiro mês. `saldo_snapshot` tem PK
      composta `(tenant_id, mes)` e o mês corrente é atualizado a cada leitura
      (`routers/resumo.py:35-55`), então `MAX(saldo)` só é monotônico ENTRE meses. Cadastrar dívida
      nova no mesmo mês em que a rota começou reescreve a própria base. A mitigação já é a decisão
      da ADR 0019 — o marco é evento persistido e não se desfaz —, e a porcentagem exibida
      permanece um número honesto sobre o histórico conhecido. Fica declarado, não descoberto em
      produção.
  - id: PF-4
    severity: resolvido no plano
    finding: marco atingido precisa gravar durante um `GET`, inclusive no período somente leitura
      da assinatura, para não se perder. Há precedente no repositório: `_registrar_snapshot` já
      escreve dentro de `GET /v1/dividas/resumo`. T4-AC4 é o critério que trava isso.
  - id: PF-5
    severity: corrigido durante o planejamento
    finding: `docs/engineering-os-adoption.md` afirmava que F-010 estava em `SPEC_IN_PROGRESS` e
      "não é elegível para planejamento ou implementação", contradizendo a ADR 0019 e o próprio
      contrato. Corrigido junto com a migração de pasta — documentação desatualizada é fonte de
      alucinação, e esta especificamente proibia o trabalho pedido.
  - id: PF-9
    severity: corrigido durante o planejamento
    finding: a baseline do Jest estava defasada em dois documentos canônicos. `engineering-os-
      adoption.md`, a seção do M10 no `roadmap.md` e `docs/inventario.md` traziam 441 testes em 40
      suítes; a medição feita
      ao planejar, no mesmo 19/08/2026, deu 472 em 42. O número anterior fora anotado antes dos
      últimos commits do próprio M10. Os três documentos foram corrigidos. Uma baseline errada faz o
      Builder atribuir à própria mudança um teste que já existia — que é o oposto do que
      `BASELINE → CHANGE → FINAL` existe para permitir.
  - id: PF-10
    severity: informativo
    finding: o Jest imprime o resumo em ~11 segundos e depois NÃO ENCERRA o processo, por handles
      abertos preexistentes. Quem não souber disso conclui que a suíte travou e a mata antes de ler
      o resultado — foi o que quase aconteceu durante este planejamento. Registrado no baseline de
      cada Task Contract do front.
  - id: PF-6
    severity: coberto por T6
    finding: `src/components/rota/CardSaldo.tsx` não tem teste dedicado hoje. Foi por isso que uma
      conta derivada sobreviveu no cliente contra o guardrail 1.2 sem ninguém tropeçar nela. T6
      cria o primeiro.
  - id: PF-7
    severity: informativo
    finding: `custoEmMeses` não tem função pronta. `domain/simulacao.economia_vs_minimo`
      (linhas 219-236) já é o molde de "rodar `simular` duas vezes e comparar", mas devolve
      diferença de JUROS, não de meses. T2 escreve uma função fina ao lado, sem conta nova.
  - id: PF-8
    severity: informativo
    finding: as quatro tabelas novas entram sozinhas na exclusão de conta, porque
      `routers/conta.tabelas_do_tenant()` é derivada do metadata (`routers/conta.py:20-32`) e não
      uma lista escrita à mão. Nenhuma tarefa precisa editar `routers/conta.py` — mas T1-AC6 prova
      que a varredura de fato as alcança, em vez de assumir.

PARALLELISM_RISK:
  - arquivo: backend/schemas.py
    tarefas: [T2, T3, T4]
    natureza: classes diferentes no mesmo arquivo. T3 escreve em `ResumoDividas`; T2, na classe
      `Caixa` e nos schemas de respiro; T4, nos de marco. Não há sobreposição semântica, mas há
      conflito de merge se duas rodarem juntas na onda 2.
  - arquivo: src/api/types.ts
    tarefas: [T5, T6]
    natureza: T5 escreve na interface `Caixa`, T6 em `ResumoDividas`. Mesmo caso.
  - arquivo: backend/routers/resumo.py
    tarefas: [T3, T4]
    natureza: resolvido pela dependência — T4 depende de T3 e nunca roda antes dela.
```

---

## Resultado da validação do plano

```text
PLAN_VALID
```

Conferido item a item contra a checklist de `agents/planner.md`:

| Verificação | Resultado |
|---|---|
| IDs únicos | T1–T8, sem repetição |
| Toda dependência aponta para tarefa existente | sim |
| Aciclicidade | sim — ondas 1 a 5, sem aresta de volta |
| Critério de aceite por tarefa | 8 tarefas, 49 critérios no plano; os Task Contracts os expandem para 56, acrescentando o critério explícito de portão verde em cada um |
| Validação por tarefa | comandos reais do projeto, nenhum inventado |
| Capacidades declaradas | sim, com o escopo de escrita nomeado em pastas |
| Requisitos da feature com dono | os 8 itens de `Scope` e os 11 `Acceptance Criteria` do `feature.md` estão cobertos; nenhum órfão, nenhum duplicado |
| Escopo de tarefa delimitado em arquivos | sim, com `out_of_scope` explícito em todas |
| Paralelismo seguro | 3 `PARALLELISM_RISK` registrados, nenhum bloqueante |
| Caminho crítico | T1 → T2 → T5 → T7 → T8, com a razão escrita |
| Estratégia de integração | contínua, uma tarefa por commit |

**Cobertura dos `Acceptance Criteria` do contrato**, para o mapeamento não ficar implícito:

| Critério do `feature.md` | Tarefa |
|---|---|
| Cascata subtrai respiro antes de `capacidade_maxima`; cortar o não essencial não o zera | T1 |
| `422` no padrão de `_validar_aporte` | T1 (regra pura) + T2 (HTTP) |
| Tenant sem respiro tem cascata idêntica | T1 |
| Marco permanece atingido depois de dívida nova | T4 |
| Porcentagem da rota vem do servidor em campo tipado | T3 + T6 |
| Gasto de respiro sem alerta, tom negativo ou progresso vermelho | T2 + T5 |
| Frontend só formata e exibe | T5, T6, T7 |
| Quatro estados em toda tela nova | T5, T7 |
| Copy de permissão; teste quebra nos cinco termos | T8 |
| 48pt e `accessibilityLabel` | T5, T7 |
| Nenhuma escrita disparada pelo Tino sem confirmação | T7 |

---

## `PLAN_DEVIATION`

O plano foi congelado para execução em 19/08/2026, com os três gates de planejamento satisfeitos:
PF-1, PF-2 e a aprovação. Mudança em dependência ou em trabalho planejado entra aqui com tarefa,
estado planejado, estado real, impacto e resolução — não se corrige o plano em silêncio.

### PD-1 — T1 editou `backend/routers/caixa.py`, que seu `Out of Scope` proibia

- **Tarefa:** T1.
- **Planejado:** o `Scope` manda a coluna `respiro` do `CaixaSnapshot` ser gravada "no ponto onde
  `CaixaSnapshot` é gravado", e T1-AC9 exige prova por teste. O `Out of Scope` proibia
  `backend/routers/` em bloco.
- **Real:** esse ponto não existe em `leitura.py` — é `routers/caixa.py::registrar_snapshot`. O
  contrato se contradizia: cumprir o `Scope` e o AC9 exigia atravessar o `Out of Scope`.
- **Impacto:** três linhas — `respiro=c.respiro` mais o comentário que explica o `None`. Nenhum
  endpoint, schema ou rota. `git diff --stat -- backend/routers/conta.py` continua vazio (T1-AC6).
- **Resolução:** ratificado. A contradição é do contrato, não da execução, e o executor tomou a
  leitura mínima e reportou em vez de ampliar em silêncio. **Lição para os contratos seguintes:**
  `Out of Scope` por pasta inteira colide com `Scope` escrito por comportamento — quando o
  comportamento exige um ponto de escrita, o contrato precisa nomear o arquivo.

### PD-3 — uma segunda migração no milestone, fora de T1

- **Tarefa:** T4 (correção pós-revisão).
- **Planejado:** "Só T1 escreve migração neste milestone" (`assumptions` deste plano).
- **Real:** a revisão de T4 encontrou uma corrida real — `registrar_marcos` garantia uma linha por
  `(tenant_id, tipo)` com SELECT seguido de INSERT, e o boot do app dispara várias leituras
  concorrentes do resumo, que é onde o marco de rota nasce. Fechar na raiz exige `UNIQUE`, e
  portanto migração. Aprovado pelo dono do repositório em 20/08/2026; migração `116f2181bdda`.
- **Impacto:** maior do que parecia. O `UNIQUE` sozinho teria trocado um defeito cosmético (linha
  órfã, escondida pela agregação de `listar`) por um grave: `registrar_marcos` não commita, e em
  três dos quatro pontos de disparo o marco é gravado na mesma transação da mutação que o
  produziu — um `IntegrityError` de corrida abortaria a quitação da dívida que o gerou. Por isso a
  inserção passou a rodar dentro de um `SAVEPOINT`. Round-trip verificado contra o Postgres local.
- **Resolução:** ratificado. A premissa "só T1 escreve migração" existia para evitar migrações
  concorrentes entre tarefas paralelas; com execução sequencial e uma correção de defeito
  encontrada em revisão, ela deixou de proteger alguma coisa. **Lição:** premissa de plano escrita
  contra um risco (paralelismo) não deve ser lida como proibição quando o risco não existe na
  execução real.

### PD-2 — `EntradaCaixa` ganhou um quarto campo, `respiro_ativo`

- **Tarefa:** T1.
- **Planejado:** três campos de respiro na entrada, cinco na saída.
- **Real:** quatro na entrada. `Caixa.respiro_ativo` é um dos cinco de saída e **não é derivável**
  dos três de entrada — só inventável.
- **Impacto:** com o campo, a decisão do `api-contract.md` 3.13 ("`ativo: false` preserva o saldo
  acumulado") vira código verificável: respiro desativado sai da cascata sem apagar valor nem
  saldo, com teste dos dois lados.
- **Resolução:** ratificado. Era erro de contagem do plano, não ampliação de escopo.
