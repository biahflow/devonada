# F-011 — Execution Plan

Produzido pelo Planner a partir do Feature Contract aceito em [`feature.md`](feature.md). Este
documento diz **como** a feature aceita é decomposta. Ele não altera requisito, não escolhe harness
ou modelo e não concede aprovação.

O formato abaixo é o `FEATURE EXECUTION PLAN` de
`/Users/danielcampos/workspace/engineeringOS/agents/planner.md`.

---

## FEATURE EXECUTION PLAN

```text
feature_id: F-011

goal: Dar efeito de domínio ao campo mais antigo e mais inerte do modelo. `fonte_renda.tipo` é
  coluna desde o M7, validada em seis valores, gravada e devolvida pelo CRUD — e
  `grep -rn "pj_hora\|autonomo" backend/domain/ backend/leitura.py` volta vazio. O usuário já
  escolheu, o banco já guardou, e o plano trata CLT e autônomo exatamente igual. Ao lado disso,
  quem tem renda variável passa a comprometer PERCENTUAL do que entra, em vez de um valor fixo
  que o mês fraco derruba.

assumptions:
  - A ADR 0021 é a decisão vigente e não será reaberta durante a execução: alíquota por fonte com
    o `Perfil` como fallback, 13º e férias como entidade própria fora da cascata, `renda_tipica`
    inalterada, e compromisso percentual como pote novo e aditivo. Quem não declarar não tem, e a
    cascata dele fica idêntica à de hoje.
  - Baseline de validação MEDIDA em 20/08/2026 durante o planejamento, não copiada de documento:
    45 suítes / 539 testes Jest e 620 pytest com 23 avisos, todos verdes. A tabela de
    `docs/engineering-os-adoption.md` bate campo a campo com a medição — ao contrário do que
    aconteceu no planejamento do F-010 (PF-9 daquele plano), a baseline documentada está atual.
  - A cadeia Alembic é linear e sua cabeça é `116f2181bdda` (marco `UNIQUE`), confirmada por
    `alembic heads` e por reconstrução da cadeia `down_revision`. **Só T1 escreve migração neste
    plano** — e essa premissa existe contra migrações concorrentes entre tarefas paralelas, não
    como proibição quando o risco não existe na execução real (lição do PD-3 do F-010).
  - Avisos preexistentes do pytest (`HTTP_422_UNPROCESSABLE_ENTITY` depreciado, Starlette/httpx,
    `InsecureKeyLength`) e do Jest (`act(...)`, handles abertos) não são desta feature. O Jest
    imprime o resumo em ~5s e NÃO encerra o processo: quem não souber disso mata a suíte antes de
    ler o resultado.
  - Nenhuma tarefa roda contra Postgres nem contra aparelho; as duas validações continuam
    obrigatórias antes do release e permanecem gate humano.
  - F-011 e F-012 não têm interseção de ARQUIVOS e podem ser executadas em paralelo, mas têm
    interseção de EFEITO — ver PF-1. Se rodarem no mesmo worktree, `backend/schemas.py` e
    `src/api/types.ts` são pontos de conflito de merge.

risks:
  - Ação a distância, terceira vez no repositório. Compromisso percentual declarado derruba
    `capacidade_maxima` e, com ela, QUATRO consumidores que ninguém vai tocar — o simulador, a
    `margemDisponivel` do painel, o card `plano_sugerido` do chat e a oferta do script de
    negociação (PF-1). É o defeito que passou por quatro gates verdes no M7.2. T6 escreve o teste
    cruzado que o torna visível; sem ele, a feature repete o defeito.
  - O campo já tem dado em PRODUÇÃO. Diferente do respiro, que nasceu vazio, `fonte_renda.tipo`
    está preenchido por gente que escolheu sem que a escolha tivesse consequência. Dar efeito a
    ele muda o plano de quem já usa o app, retroativamente e em silêncio. T6-AC2 é o teste de
    regressão que garante que só muda quem declarou algo novo.
  - `nao_fecha` (`comprometido_dividas > capacidade_maxima`) passa a disparar mais, como no M11.
    Está correto e é aritmética; continua não sendo diagnóstico de superendividamento, e o teste
    de copy que quebra na palavra continua valendo.
  - Migração nova sobre um schema cuja suíte NÃO valida migrações: `backend/tests/conftest.py`
    monta o schema com `Base.metadata.create_all`, não pelo Alembic, então uma migração divergente
    do ORM passa a suíte inteira verde. O M11 fechou isso com conferência manual. T1 herda o
    buraco e repete a conferência.
  - UX de seis tipos é o item que mais pode inchar, e o que menos tem desenho pronto:
    `docs/design-system.md` não tem verbete de renda tipada, e `IncomeSetup` só existe em
    `docs/concepcao/`, que é fonte histórica e não canônica. Mitigado pela decisão de 20/08/2026:
    um formulário que se adapta, não seis fluxos dedicados.
  - Sobre qual base o percentual incide — bruta ou líquida — a ADR 0021 diz "renda típica" e não
    desempata. Ver PF-4: é gate humano ABERTO e bloqueia o congelamento deste plano.

tasks:
  - id: T1
    role: builder
    goal: A sétima linha entra na cascata antes de `capacidade_maxima`, a alíquota desce para a
      fonte, e as colunas e tabelas do milestone nascem numa migração só.
    scope: |
      `backend/domain/caixa.py` — `compromisso_percentual_bps: int | None` e
        `imposto_por_fonte: int | None` em `EntradaCaixa` (hoje 80-106, cinco campos acrescentados
        pelo M11); `compromisso_percentual_bps` e `compromisso_percentual` (o valor em centavos,
        derivado) em `Caixa` (hoje 109-137). Campo novo é aditivo, com default `None` — as duas
        dataclasses são congeladas.
      `backend/domain/caixa.py:337-357` — a cascata. Duas mudanças cirúrgicas:
        (a) linha 338, o imposto passa a usar `entrada.imposto_por_fonte` quando ele não é `None`,
            e só cai em `aplicar_percentual(bruta, entrada.imposto_bps)` quando é. Sem nenhuma
            fonte com alíquota declarada, o número é idêntico ao de hoje, campo a campo.
        (b) linhas 352-357, `capacidade_maxima` passa a subtrair também o compromisso percentual,
            na MESMA posição de `aporte_reserva`, `aporte_aposentadoria` e `respiro_na_cascata`.
            `capacidade_hoje` e `aporte_maximo` herdam a queda sem alteração própria.
      `backend/domain/caixa.py` — função pura
        `percentual_invade_o_piso(liquida, essenciais, compromisso, minimo) -> bool | None`, no
        molde EXATO de `respiro_invade_o_piso` (254-275): `None` quando não há piso configurado,
        e a FONTE do piso no docstring — Decreto 11.150/2022, art. 3º, na redação do Decreto
        11.567/2023. O docstring do módulo declara que o percentual em si é **dado do usuário e
        não regra financeira**, como já faz para o respiro.
      `backend/orm.py` — `compromisso_percentual_bps: int | None` em `Perfil` (hoje 115-161, ao
        lado de `reserva_aporte:154` e `aposentadoria_aporte:155`); `imposto_bps: int | None` e
        `dia_pagamento: int | None` em `FonteRenda` (hoje 242-269); tabela `EventoPrevisivel`
        (`tenant_id`, `fonte_id` opcional, `tipo`, `mes_previsto`, `valor`, `criado_em`).
      `backend/alembic/versions/` — UMA migração forward-only encadeada em `116f2181bdda`, no
        estilo de `116f2181bdda_marco_unique_tenant_tipo.py`: comentário em prosa explicando o
        PORQUÊ antes de cada `op.*`, índice em `tenant_id`, `downgrade()` espelhado.
      `backend/leitura.py:104-207` — `montar_entrada_caixa` calcula `imposto_por_fonte` no laço
        que já percorre as fontes (128-137): para cada fonte, `f.imposto_bps` quando declarado,
        senão `perfil.imposto_bps`. Devolve `None` quando NENHUMA fonte declarou — que é o sinal
        de "use a conta antiga". Lê `perfil.compromisso_percentual_bps` para a entrada.
      `backend/tests/test_caixa.py` — cascata com percentual, e a regressão dos dois lados.
    out_of_scope: |
      Nenhum endpoint HTTP, nenhum schema Pydantic, nenhuma rota. O `422` e o CRUD são de T3 —
      aqui só nasce a regra pura que T3 vai chamar.
      Nenhum efeito do `tipo` da fonte: ausência tipada de alíquota, mês âncora e comportamento
      por tipo são T2. T1 cria a COLUNA `imposto_bps`, não a regra do `pj_hora`.
      Nada em `src/`. Nada em `backend/routers/` — a exceção do PD-1 do F-010 não se aplica aqui,
      porque nada nesta tarefa exige ponto de escrita em router.
      Não alterar `renda_tipica` (140-163). A ADR 0021, item 3, é explícita: `min()` sobre janela
      de seis, mínimo de três amostras, e um mês zerado continua zerando.
      Não alterar a posição do respiro nem o piso do mínimo existencial.
      Não editar `backend/routers/conta.py`: `tabelas_do_tenant()` é derivada do metadata
      (`conta.py:20-32`) e absorve a tabela nova sozinha.
    expected_areas: backend/domain/caixa.py · backend/orm.py · backend/alembic/versions/ ·
      backend/leitura.py · backend/tests/test_caixa.py
    acceptance_criteria: |
      T1-AC1 `capacidade_maxima = liquida − essenciais − provisao − reserva − aposentadoria −
        respiro − compromisso_percentual`, nessa ordem, e `capacidade_hoje` e `aporte_maximo`
        herdam a queda sem alteração própria.
      T1-AC2 Teste de regressão campo a campo, no molde de `TestRegressaoSemRespiro`
        (`test_caixa.py:433-495`): tenant sem compromisso percentual e sem alíquota por fonte
        produz `Caixa` com os mesmos valores de hoje. `compromisso_percentual_bps` é `None`, nunca
        `0` — zero declarado é escolha legítima e diferente de não ter escolhido.
      T1-AC3 `test_o_caso_real_PJ_do_M7_continua_dando_o_mesmo_numero`
        (`test_caixa.py:487-495`) continua verde sem ser editado.
      T1-AC4 Com alíquota declarada em uma fonte e não em outra, `imposto_reservado` é o somatório
        por fonte, e a fonte sem alíquota usa o `Perfil.imposto_bps` como fallback. Sem nenhuma
        fonte declarando, o número é bit a bit o de hoje.
      T1-AC5 `percentual_invade_o_piso` devolve `True` quando `liquida − essenciais − compromisso`
        fica abaixo do mínimo existencial, `False` quando não fica, e `None` sem piso configurado.
      T1-AC6 A tabela `evento_previsivel` tem `tenant_id`, e um teste prova que ela aparece em
        `tabelas_do_tenant()` sem ninguém ter editado `routers/conta.py`.
      T1-AC7 `alembic upgrade head`, `downgrade -1` e `upgrade head` rodam contra banco limpo, e o
        DDL rendido é conferido contra `CreateTable(Base.metadata)` — a conferência manual que o
        M11 teve de fazer, porque `conftest.py` não valida migração.
      T1-AC8 O docstring da cascata diz, com todas as letras, que o percentual é dado do usuário e
        não regra financeira; `percentual_invade_o_piso` cita a FONTE do piso.
      T1-AC9 `cd backend && venv/bin/pytest` passa inteiro.
    depends_on: []
    validation: cd backend && venv/bin/pytest ; venv/bin/alembic upgrade head ;
      venv/bin/alembic downgrade -1 ; venv/bin/alembic upgrade head
    required_capabilities: READ, WRITE (backend/domain/caixa.py, backend/orm.py,
      backend/alembic/versions, backend/leitura.py, backend/tests/test_caixa.py),
      VALIDATE (pytest, alembic)
    risk: Alto por alcance, baixo por superfície — o mesmo perfil de T1 do F-010. A linha nova muda
      o número de quatro consumidores que ninguém vai tocar, e T1-AC2 é o que impede a mudança de
      vazar para quem não pediu nada.
    relative_effort: M

  - id: T2
    role: builder
    goal: O tipo da fonte passa a mudar o que o domínio faz — e a renda típica passa a dizer qual
      mês a ancorou.
    scope: |
      `backend/domain/caixa.py:140-163` — `renda_tipica` passa a devolver TRÊS valores:
        `(valor, origem, mes_ancora)`. `mes_ancora` é o `AAAA-MM` do recebimento que produziu o
        `min()`, e `None` quando a origem é `informada`. A regra do `min()` NÃO muda — só passa a
        contar de onde o número veio.
      `backend/leitura.py:128-137` — a query passa a selecionar `(mes, valor)` em vez de só
        `valor`, para que o mês âncora exista. Hoje ela descarta o mês, e é por isso que a tela não
        tem como dizer "seu plano está dimensionado por março". A soma por fonte e a propagação de
        `origem` continuam como estão.
      `backend/domain/caixa.py` — ausência tipada de alíquota: `imposto_nao_declarado: bool` em
        `Caixa`, `True` quando existe fonte `pj_hora` ativa sem `imposto_bps` própria e sem
        `Perfil.imposto_bps`. Nada é reservado e o campo diz isso — a tela exibe "não está
        reservando", nunca `0` como se fosse reserva (ADR 0009, `domain.md:148`).
      `backend/domain/renda.py` (novo) — funções puras por tipo, cada uma com FONTE no docstring ou
        a declaração explícita de que o valor é dado do usuário:
          `clt` — líquido mensal fixo; os eventos previsíveis existem e NÃO entram na cascata.
          `pj_hora` — taxa × horas menos o imposto informado; sem alíquota, nada é reservado.
          `autonomo` — renda típica, e compromisso percentual em vez de valor fixo.
          `beneficio` — valor fixo com `dia_pagamento` próprio, que não é o dia 5 de ninguém.
          `aluguel` — variável, e a vacância é um recebimento zero como qualquer outro.
          `outro` — comportamento genérico de hoje, e o módulo declara que é genérico.
      `backend/tests/test_caixa.py` e `backend/tests/test_domain.py` — um teste POR TIPO, que falha
        se o tipo voltar a ser rótulo inerte.
    out_of_scope: |
      Nenhuma rota, nenhum schema Pydantic — T3.
      Não alterar a definição de renda típica: `min()` sobre janela de seis, mínimo de três
      amostras. A ADR 0021, item 3, recusou explicitamente ignorar zeros na janela, e o contrato
      declara a alteração fora de escopo.
      Não projetar reajuste de benefício, não estimar alíquota, não estimar vacância, não calcular
      FGTS. Os quatro estão nomeados no `Out of Scope` do contrato.
      Nada em `src/`. Nenhuma migração — T1 já criou as colunas.
      Não mexer na posição do respiro nem do compromisso percentual na cascata.
    expected_areas: backend/domain/caixa.py · backend/domain/renda.py · backend/leitura.py ·
      backend/tests/test_caixa.py · backend/tests/test_domain.py
    acceptance_criteria: |
      T2-AC1 Uma fonte de cada um dos SEIS tipos produz comportamento de domínio distinto e
        verificável, com um teste por tipo. É o critério que dá nome à feature.
      T2-AC2 Fonte `pj_hora` sem alíquota própria e sem `Perfil.imposto_bps` produz
        `imposto_reservado == 0` E `imposto_nao_declarado is True`. O par é o que separa "não
        reservou porque não sabe" de "reservou zero".
      T2-AC3 `renda_tipica` devolve o mês âncora quando a origem é `pior_mes_registrado`, e `None`
        quando é `informada`.
      T2-AC4 `TestRendaTipica` (`test_caixa.py:41-67`) continua provando a mesma regra depois da
        mudança de aridade — o valor e a origem não mudam para nenhuma entrada existente.
      T2-AC5 Toda função nova em `backend/domain/` declara FONTE no docstring OU declara
        explicitamente que o valor é dado do usuário. Regra sem uma das duas coisas não existe.
      T2-AC6 Um mês zerado continua zerando a renda típica **daquela fonte** e não das outras — a
        apuração por fonte de `leitura.py:128-137` fica intacta.
      T2-AC7 `cd backend && venv/bin/pytest` passa inteiro.
    depends_on: [T1]
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/domain, backend/leitura.py, backend/tests),
      VALIDATE (pytest)
    risk: Médio. Mudar a aridade de `renda_tipica` toca uma função pura com teste próprio e um
      chamador; o risco real é alguém "aproveitar" para mexer no `min()`, que o contrato proíbe.
    relative_effort: M

  - id: T3
    role: builder
    goal: Declarar compromisso percentual, alíquota por fonte, dia de pagamento e evento previsível
      pela API — com o `422` do piso legal no registro exato do que já existe.
    scope: |
      `backend/schemas.py` — `compromissoPercentualBps` em `MetasCaixa` (hoje 690-704), que é onde
        os potes já moram; `compromissoPercentualBps`, `compromissoPercentual`,
        `impostoNaoDeclarado` e `mesAncoraRenda` na classe `Caixa` (hoje 527-578); `impostoBps` e
        `diaPagamento` em `NovaFonteRenda` (585-590), `FonteRendaPatch` (593-598) e `FonteRenda`
        (601-602); schemas de request e response de evento previsível. camelCase escrito à mão por
        campo, como o arquivo inteiro já faz; dinheiro em centavos, percentual em bps.
      `backend/routers/caixa.py` — os campos novos em `_caixa_schema` e em `_fonte_schema:348-356`;
        `impostoBps` e `diaPagamento` no mapeamento campo→coluna de `editar_fonte:411-418`;
        `PUT /v1/caixa/metas` (hoje 703-747) passa a aceitar `compromissoPercentualBps` e a recusar
        com `422` quando `percentual_invade_o_piso` for `True`, no registro EXATO de
        `caixa.py:982-997` — pt-BR, **sem valor monetário no corpo** (guardrail 5), com `campo`, e
        a guarda `caixa.preenchimento != "vazio"`; `422` também para bps negativo ou acima de
        10000.
      `backend/routers/caixa.py` — CRUD de evento previsível (`GET`, `POST`, `PATCH`, `DELETE`) no
        estilo do CRUD de fontes (370-444), com `_buscar_*` devolvendo 404 e snapshot registrado
        depois de cada mutação, como toda rota do módulo já faz.
      `backend/tests/test_caixa_api.py` — cobertura dos campos novos, do CRUD e do `422`.
    out_of_scope: |
      Qualquer tela. Qualquer arquivo em `src/`.
      Nenhuma migração — T1 já entregou as colunas e a tabela.
      Não criar rota nova para o compromisso percentual: ele entra em `PUT /v1/caixa/metas`, ao
      lado dos potes que já vivem lá. Uma rota por pote seria assimetria sem ganho.
      Não fazer o evento previsível entrar na cascata nem na janela do `min()`. A ADR 0021, item 2,
      é explícita: ele é munição de negociação à vista, não renda mensal.
      Não estimar valor de 13º nem de férias a partir da renda. O valor é declarado pelo usuário.
      Não tocar `backend/routers/simulacoes.py`, `resumo.py`, `chat.py` nem `revisao.py` — os
      quatro mudam de número sozinhos, e provar isso é T6.
    expected_areas: backend/schemas.py · backend/routers/caixa.py ·
      backend/tests/test_caixa_api.py
    acceptance_criteria: |
      T3-AC1 `GET /v1/caixa` devolve `compromissoPercentualBps` (`null` para quem nunca declarou),
        `compromissoPercentual` em centavos, `impostoNaoDeclarado` e `mesAncoraRenda`.
      T3-AC2 `PUT /v1/caixa/metas` grava o percentual e devolve `422` quando ele faz a capacidade
        invadir o mínimo existencial. A mensagem é pt-BR, **não contém valor monetário**, e traz
        `campo` — conferido contra `caixa.py:982-997`, não escrito de memória.
      T3-AC3 `422` para bps negativo e para bps acima de 10000.
      T3-AC4 `POST`/`PATCH` de fonte aceitam `impostoBps` e `diaPagamento`; ausentes, a fonte
        continua exatamente como é hoje, e o `Perfil.imposto_bps` continua sendo o fallback.
      T3-AC5 O CRUD de evento previsível grava, lê, edita e exclui, e `GET /v1/caixa` NÃO muda
        nenhum número por causa dele.
      T3-AC6 Recurso de outro tenant devolve **404, nunca 403**, como o resto do módulo.
      T3-AC7 O teto do simulador cai para quem declarou percentual, sem
        `backend/routers/simulacoes.py` ter sido tocado.
      T3-AC8 `cd backend && venv/bin/pytest` passa inteiro.
    depends_on: [T1]
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/schemas.py, backend/routers/caixa.py,
      backend/tests/test_caixa_api.py), VALIDATE (pytest)
    risk: Maior tarefa do backend. `routers/caixa.py` tem 1153 linhas e é arquivo grande vivo; o
      `422` é o ponto em que copiar o registro de mensagem importa mais que inventar um novo.
    relative_effort: L

  - id: T4
    role: builder
    goal: A tela de fonte de renda passa a perguntar o que o tipo exige — um formulário só, que se
      adapta.
    scope: |
      `src/api/types.ts` — `impostoBps` e `diaPagamento` em `FonteRenda`; o tipo `EventoPrevisivel`.
      `src/api/caixa.ts` — as chamadas do CRUD de evento previsível, no estilo do arquivo.
      `src/hooks/useCaixa.ts` — as mutações novas usando o invalidador que já existe.
      A tela de fonte de renda — **um formulário que se adapta ao tipo escolhido** (decisão de
        20/08/2026), não seis fluxos dedicados:
          `clt` — líquido mensal, mais os eventos previsíveis (13º e férias) com mês e valor
            declarados pelo usuário.
          `pj_hora` — taxa, horas e alíquota. Sem alíquota, a tela diz **"não está reservando
            imposto"**, lendo `impostoNaoDeclarado` do servidor — nunca exibindo `R$ 0,00`.
          `autonomo` — renda típica em evidência, e o caminho para o compromisso percentual.
          `beneficio` — valor fixo e dia de pagamento próprio.
          `aluguel` — variável, e a vacância nomeada como um mês de recebimento zero.
          `outro` — genérico, e a tela **diz** que é genérico.
      `src/test/screens/` — os quatro estados de tela e um caso por tipo.
    out_of_scope: |
      Compromisso percentual no Caixa e a exibição do mês âncora: T5.
      Seis fluxos dedicados com tela e copy próprias. Ficaram para pós-MVP por decisão de
      20/08/2026, a serem decididos com dado de uso real em vez de no papel.
      Calcular qualquer valor no cliente. Taxa × horas, imposto e renda típica chegam prontos do
      servidor (guardrail 1.2). O cliente não multiplica nem aplica percentual.
      Inventar verbete de design system. O verbete novo é escrito em T6, a partir do que T4 de
      fato entregou — documentar antes de existir é como o `ScriptCard` ficou dois milestones em
      "Ainda só especificação".
      Backend.
    expected_areas: src/api/types.ts · src/api/caixa.ts · src/hooks/useCaixa.ts ·
      app/(tabs)/caixa/ · src/components/caixa/ · src/test/screens/
    acceptance_criteria: |
      T4-AC1 Escolher cada um dos seis tipos muda os campos apresentados, e há teste por tipo.
      T4-AC2 Fonte `pj_hora` sem alíquota exibe **"não está reservando imposto"**, lido de
        `impostoNaoDeclarado`. Um teste falha se `R$ 0,00` aparecer no lugar.
      T4-AC3 Os quatro estados de tela — carregando, erro, vazio e conteúdo — têm teste.
      T4-AC4 Controles novos têm alvo de toque de 48pt e `accessibilityLabel` quando não há texto
        visível.
      T4-AC5 Nenhum valor monetário é calculado no cliente. Busca por multiplicação ou aplicação de
        percentual sobre valor em `src/` não devolve nada novo.
      T4-AC6 Os seis gates do front passam: `typecheck`, `lint`, `test`, `bundle:check`,
        `palette:check`, `digits:check`.
    depends_on: [T3]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check
    required_capabilities: READ, WRITE (src/api, src/hooks, src/components/caixa, app/(tabs)/caixa,
      src/test), VALIDATE (npm scripts)
    risk: Maior tarefa do front, e a que mais pode inchar. Divide `src/api/types.ts` com T5.
    relative_effort: L

  - id: T5
    role: builder
    goal: O compromisso percentual aparece no Caixa, e a renda típica passa a dizer qual mês a
      ancorou.
    scope: |
      `src/api/types.ts` — `compromissoPercentualBps`, `compromissoPercentual`,
        `impostoNaoDeclarado` e `mesAncoraRenda` na interface `Caixa`.
      `src/api/caixa.ts` e `src/hooks/useCaixa.ts` — o percentual no `PUT /v1/caixa/metas` que já
        existe.
      Um card e uma declaração de compromisso percentual no Caixa, com **dois estados**, no molde
        do que o `RespiroCard` fez no M11: sem percentual declarado, o card CONVIDA sem sugerir
        valor, faixa ou percentual — a ADR 0009 proíbe coeficiente de alocação sem fonte, e a 0021
        reafirma "quem não declarar não tem".
      A leitura do mês âncora onde a renda típica é exibida: *"seu plano está dimensionado pelo seu
        pior mês, que foi março"*. Ver a capacidade despencar sem explicação é o app quebrando na
        cara de quem teve um mês ruim (ADR 0021, item 3).
      `src/test/screens/caixa.test.tsx` — os quatro estados e os dois estados do card.
    out_of_scope: |
      A tela de fonte de renda por tipo: T4.
      Sugerir valor, faixa ou percentual de compromisso em qualquer copy, em qualquer lugar.
      Aplicar o percentual no cliente. `compromissoPercentual` chega em centavos, pronto.
      Backend.
    expected_areas: src/api/types.ts · src/api/caixa.ts · src/hooks/useCaixa.ts ·
      src/components/caixa/ · app/(tabs)/caixa/ · src/test/screens/caixa.test.tsx
    acceptance_criteria: |
      T5-AC1 Sem percentual declarado, o card convida a declarar e **não sugere número**.
      T5-AC2 Com percentual declarado, a tela mostra o bps e o valor em centavos que o servidor
        mandou — o cliente não multiplica.
      T5-AC3 A origem da renda típica e o mês âncora aparecem quando a origem é
        `pior_mes_registrado`, e a linha some quando é `informada`.
      T5-AC4 Os quatro estados de tela têm teste.
      T5-AC5 48pt e `accessibilityLabel` nos controles novos.
      T5-AC6 Os seis gates do front passam.
    depends_on: [T3]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check
    required_capabilities: READ, WRITE (src/api, src/hooks, src/components/caixa, app/(tabs)/caixa,
      src/test), VALIDATE (npm scripts)
    risk: Médio. Divide `src/api/types.ts` com T4.
    relative_effort: M

  - id: T6
    role: builder
    goal: Provar o efeito cruzado nos QUATRO consumidores, provar que quem não declarou não mudou,
      e deixar a documentação dizendo a verdade.
    scope: |
      `backend/tests/test_caixa_integracao.py` — `TestCompromissoNosQuatroConsumidores`, gêmeo de
        `TestRespiroNosTresConsumidores` (280-409) e com um teste a mais: além do teto do
        simulador, da `margemDisponivel` do painel e do card `plano_sugerido` do chat, a **oferta
        do script de negociação** (`revisao._capacidade_para_oferta`, PF-1). Os quatro mudam de
        número sem que nenhum dos quatro arquivos seja tocado, e ação a distância não aparece em
        diff.
      `backend/tests/test_caixa_integracao.py` — o gêmeo de
        `test_quem_nao_declarou_respiro_tem_os_tres_numeros_de_antes` (394-409), agora com quatro.
      `src/test/screens/` — teste de copy da renda tipada, no molde de `respiro-copy.test.tsx`
        (36 casos, prova por injeção): quebra em copy que sugira valor, faixa ou percentual de
        compromisso, e em tom de prestação de contas sobre mês fraco.
      `docs/api-contract.md` — seção **3.14** com os endpoints do F-011 e **Bloco 14** na fila da
        seção 4. Contrato e código no mesmo commit.
      `docs/design-system.md` — verbete de **renda tipada** e do card de compromisso percentual,
        escritos a partir do que T4 e T5 entregaram. Hoje não existe nenhum.
      `docs/domain.md` — a tabela do verbete `tipo de renda` (142-154) passa a cobrir os seis
        valores; hoje ela lista três.
      `roadmap.md` — os dois itens de F-011 no M12 marcados conforme o entregue, e a "mudança de
        comportamento a declarar" escrita, no molde do que o M11 fez.
      `docs/inventario.md` e `docs/engineering-os-adoption.md` — baseline de validação novo,
        MEDIDO, nunca copiado.
      `docs/features/F-011-renda-tipada/evidence.md` (novo) — os seis `BUILD REPORT` com atribuição
        por tarefa, baseline, validação integrada, commits e `PLAN_DEVIATION`.
    out_of_scope: |
      Código de feature. T6 escreve teste e documento.
      Marcar como validado em device o que não foi visto em aparelho. Nenhum gate deste
      repositório prova que a tela está legível ou que cabe na tela.
      Fundir os `BUILD REPORT` num resumo. A atribuição por tarefa é o que o Reviewer precisa.
    expected_areas: backend/tests/test_caixa_integracao.py · src/test/screens/ ·
      docs/api-contract.md · docs/design-system.md · docs/domain.md · roadmap.md ·
      docs/inventario.md · docs/engineering-os-adoption.md ·
      docs/features/F-011-renda-tipada/evidence.md
    acceptance_criteria: |
      T6-AC1 O teste cruzado prova que os QUATRO consumidores caem, e que o teto do simulador desce
        EXATAMENTE o compromisso declarado.
      T6-AC2 O teste de regressão prova que quem não declarou percentual nem alíquota por fonte tem
        os quatro números idênticos aos de antes do F-011.
      T6-AC3 O teste de copy quebra por injeção nas superfícies novas.
      T6-AC4 Nenhum documento canônico afirma validação em device que não aconteceu.
      T6-AC5 `evidence.md` preserva os seis Builder Reports com atribuição por tarefa.
      T6-AC6 Os sete perfis passam, e o relato distingue o executado do pulado.
    depends_on: [T2, T4, T5]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check ; cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/tests, src/test, docs/, roadmap.md),
      VALIDATE (todos os perfis)
    risk: Baixo tecnicamente, alto por ser o último portão. É onde a feature deixa de mentir ou
      passa a mentir.
    relative_effort: M

parallel_groups:
  - onda_1: [T1]            # ninguém antes; é a fundação e a única migração
  - onda_2: [T2, T3]        # ambas dependem só de T1; arquivos majoritariamente disjuntos
  - onda_3: [T4, T5]        # ambas dependem de T3; dividem src/api/types.ts
  - onda_4: [T6]

critical_path: T1 → T3 → T4 → T6 (M, L, L, M)
  O caminho é o da API, não o do domínio. T3 é a maior tarefa do backend — o `422` do piso, o CRUD
  de evento previsível e os campos novos num arquivo de 1153 linhas — e T4 é a maior do front, com
  seis comportamentos num formulário só. T2 (M) sai em paralelo a T3 e reencontra o caminho em T6;
  T5 (M) é mais curta que T4 e sai de graça na mesma onda.

integration_strategy: |
  Fundação primeiro, fatias verticais depois — a mesma ordem que funcionou no F-010, e pelo mesmo
  motivo: `leitura.capacidade_atual` é o ponto único por onde a mudança alcança os quatro
  consumidores, então o efeito colateral aparece já no commit de T1, com a suíte inteira do backend
  como rede.

  Integração contínua no `main`, uma tarefa por commit, nunca big-bang no fim.

  Duas tarefas de onda paralela não devem editar o mesmo arquivo ao mesmo tempo — ver
  PARALLELISM_RISK. Se a execução for sequencial (um agente por vez), o risco desaparece e a ordem
  é T1, T2, T3, T5, T4, T6.

  T6 fecha a feature com os dois testes que provam o efeito cruzado e a regressão. Nenhuma tarefa
  marca item de device.

human_gates:
  - SATISFEITO em 20/08/2026 — **PF-4: sobre qual base o compromisso percentual incide.** Decidido
    pelo usuário: **renda líquida típica**. O `ARCHITECTURE_DECISION_REQUIRED` está fechado, e a
    decisão vive na Nota de desempate da ADR 0021, não nesta conversa.
  - SATISFEITO em 20/08/2026 — aprovação deste plano. F-011 está `READY_FOR_BUILD`.
  - Aprovar a migração e sua estratégia para o dado de `tipo` já existente em produção
    (`Human Gates` do contrato). A estratégia deste plano é: **nenhum dado migra**, todas as
    colunas nascem `nullable`, e quem não declarar nada continua com os números de hoje.
  - SATISFEITO em 20/08/2026 — as sete incógnitas de modelagem, pela ADR 0021.
  - SATISFEITO em 20/08/2026 — o quarto consumidor (PF-1) e a forma da tela dos seis tipos (PF-5).
  - Validar em device os fluxos novos de declaração de renda — leitura, teclado sobre campo de
    valor, acessibilidade. Fecha a feature; nenhum agente o declara satisfeito.
  - NÃO se aplica aqui, mas fica registrado: a revisão da copy de negociação por advogado é gate de
    F-012 e do pré-lançamento, não desta feature.

planning_findings:
  - id: PF-1
    severity: RESOLVIDO por decisão humana em 20/08/2026
    finding: a ADR 0021 e os dois contratos falam em TRÊS consumidores de `leitura.capacidade_atual`.
      `grep -rn "capacidade_atual"` encontra QUATRO. O quarto é
      `backend/routers/revisao.py:176`, dentro de `_capacidade_para_oferta` (160-185), que usa
      `caixa.capacidade_hoje` menos as parcelas das outras dívidas para montar a frase
      "consigo comprometer até R$ X por mês" do script de negociação
      (`revisao.py:149-155`). Compromisso percentual declarado derruba **a oferta que o usuário faz
      ao credor**.
    decision: aceitar o efeito e prová-lo por teste. Oferecer ao credor o que não cabe no mês é
      exatamente o plano quebrado que o produto existe para evitar. T6 cobre os QUATRO consumidores,
      não três. Consequência de planejamento a registrar: a premissa "F-011 e F-012 não têm
      interseção" vale **por arquivo, não por efeito** — F-011 muda o número que o script do F-012
      recita, e o F-012 herda um teste de regressão sobre a oferta.
  - id: PF-2
    severity: resolvido no plano
    finding: `EntradaCaixa.imposto_bps` (`domain/caixa.py:84`) é um campo escalar, e
      `calcular_caixa:338` faz `aplicar_percentual(bruta, imposto_bps)` sobre a renda bruta
      **somada**. A decisão 1 da ADR 0021 — alíquota por fonte com o `Perfil` como fallback — não é
      implementável mudando esse campo, porque a cascata não sabe de qual fonte o dinheiro veio.
    resolution: campo aditivo `imposto_por_fonte: int | None` em `EntradaCaixa`, preenchido por
      `leitura.montar_entrada_caixa` com o somatório por fonte, no laço que já percorre as fontes
      (128-137). `None` significa "nenhuma fonte declarou" e a cascata cai no comportamento de hoje.
      Nenhum tenant muda de número sem ter declarado alíquota em alguma fonte (T1-AC4), e é o mesmo
      padrão aditivo que o respiro usou.
  - id: PF-3
    severity: informativo, coberto por T2
    finding: o mês âncora da renda típica não existe hoje porque `leitura.py:129-133` faz
      `select(orm.Recebimento.valor)` e **descarta o mês**. A decisão 3 da ADR 0021 promete que "o
      mês que ancorou o valor viaja para a tela", e isso exige mudar a query, não só a tela.
  - id: PF-4
    severity: RESOLVIDO por decisão humana em 20/08/2026
    finding: a ADR 0021, item 4, diz que o compromisso percentual "incide sobre a **renda típica**",
      e não desempata entre `renda_bruta_tipica` e `renda_liquida`. A escolha muda o número para
      todo mundo que declarar: com alíquota de 6%, um compromisso de 10% sobre a bruta reserva ~6,4%
      a mais que sobre a líquida.
    decision: **renda LÍQUIDA típica** — a bruta típica menos o imposto reservado, exatamente o
      `liquida` da cascata. Compromisso é "percentual do que entra", e o que entra é o que sobra
      depois do imposto; usar a bruta comprometeria dinheiro que a pessoa nunca vê, e para quem é
      `pj_hora` ou `autonomo` — o público desta feature — a diferença é grande. É também o que
      mantém a coerência com o piso, já medido sobre `liquida − essenciais` (`caixa.py:254-276` e
      `:382-384`). Registrada na **Nota de desempate de 20/08/2026** da ADR 0021 e no contrato de T1.
    impact: nenhum residual. T1 está desbloqueada e escreve a cascata sobre a base decidida.
  - id: PF-5
    severity: RESOLVIDO por decisão humana em 20/08/2026
    finding: os seis tipos de renda não têm desenho pronto. `docs/design-system.md` não tem verbete
      de renda tipada — `grep -n "renda"` devolve uma única linha, e ela é sobre outra coisa — e
      `IncomeSetup` só existe em `docs/concepcao/`, que é fonte histórica e não canônica. A ADR 0021
      marca isso como "o item do M12 que mais pode inchar".
    decision: **um formulário que se adapta ao tipo**, não seis fluxos dedicados. Seis
      comportamentos, um fluxo, mantendo T4 em `L` em vez de `XL` e sem inventar design system novo.
      Os fluxos dedicados ficam para pós-MVP, decididos com dado de uso real na mão. O verbete de
      design system é escrito em T6, a partir do que T4 entregou — documentar antes de existir é
      como o `ScriptCard` ficou dois milestones em "Ainda só especificação".
  - id: PF-6
    severity: informativo
    finding: `FonteRenda` já tem uma coluna `variavel: bool` (`orm.py:260`) que nenhuma regra de
      domínio consulta — o mesmo defeito que `tipo` tem, um campo mais discreto. Este plano NÃO a
      toca, para não ampliar escopo, mas ela deveria ser derivada do `tipo` ou removida numa
      limpeza posterior. Duas fontes de verdade para "essa renda oscila?" é a mesma classe de
      dívida que a ADR 0021 assumiu para o `imposto_bps`.
  - id: PF-7
    severity: informativo
    finding: a tabela nova entra sozinha na exclusão de conta, porque
      `routers/conta.tabelas_do_tenant()` é derivada do metadata (`conta.py:20-32`), filtrando por
      presença de `tenant_id`. Nenhuma tarefa precisa editar `conta.py` — mas T1-AC6 **prova** que a
      varredura de fato a alcança, em vez de assumir.
  - id: PF-8
    severity: informativo
    finding: `docs/domain.md:142-154` descreve a tabela de `tipo de renda` com **três** valores
      (`clt`, `pj_hora`, `autonomo`), enquanto o `Literal` de `schemas.py:519` tem **seis**. O
      documento vive à frente do código na descrição e atrás dele na enumeração. T6 corrige.

PARALLELISM_RISK:
  - arquivo: backend/domain/caixa.py
    tarefas: [T1, T2]
    natureza: T1 acrescenta campos e muda a cascata; T2 muda a aridade de `renda_tipica` e
      acrescenta `imposto_nao_declarado`. Resolvido pela dependência — T2 depende de T1 e nunca
      roda antes dela —, mas as duas não devem rodar concorrentes.
  - arquivo: src/api/types.ts
    tarefas: [T4, T5]
    natureza: T4 escreve em `FonteRenda`, T5 na interface `Caixa`. Sem sobreposição semântica, com
      conflito de merge se rodarem juntas na onda 3.
  - arquivo: backend/schemas.py
    tarefas: [T3]
    natureza: dentro do F-011 não há concorrência. **Entre features, há**: T2 e T3 do F-012 também
      escrevem em `backend/schemas.py`. Se F-011 e F-012 rodarem em paralelo, use worktrees
      separados ou serialize os commits que tocam esse arquivo.
```

---

## Resultado da validação do plano

```text
PLAN_VALID
ARCHITECTURE_DECISION_REQUIRED — PF-4
```

Conferido item a item contra a checklist de `agents/planner.md`:

| Verificação | Resultado |
|---|---|
| IDs únicos | T1–T6, sem repetição |
| Toda dependência aponta para tarefa existente | sim |
| Aciclicidade | sim — ondas 1 a 4, sem aresta de volta |
| Critério de aceite por tarefa | 6 tarefas, 42 critérios, idênticos nos Task Contracts |
| Validação por tarefa | comandos reais, conferidos contra `package.json` e o venv do backend |
| Capacidades declaradas | sim, com o escopo de escrita nomeado em arquivos |
| Requisitos da feature com dono | os 9 itens de `Scope` e os 10 `Acceptance Criteria` do `feature.md` estão cobertos; nenhum órfão, nenhum duplicado |
| Escopo de tarefa delimitado em arquivos | sim, com `out_of_scope` explícito em todas |
| Paralelismo seguro | 3 `PARALLELISM_RISK` registrados, nenhum bloqueante |
| Caminho crítico | T1 → T3 → T4 → T6, com a razão escrita |
| Estratégia de integração | contínua, uma tarefa por commit |

**O plano é internamente válido e NÃO está congelado.** As duas coisas convivem: a checklist acima
passa inteira, e ao mesmo tempo o `PF-4` é um `ARCHITECTURE_DECISION_REQUIRED` — a base sobre a qual
o percentual incide não foi decidida por nenhum documento, e o Planner **não a cria**
(`agents/planner.md`). T1 escreveria a cascata sobre uma escolha que ninguém tomou.

Decidido o `PF-4` e aprovado o plano, a feature passa a `READY_FOR_BUILD` e este documento é
congelado; a partir daí, mudança em dependência ou em trabalho planejado é `PLAN_DEVIATION`.

**Cobertura dos `Acceptance Criteria` do contrato:**

| Critério do `feature.md` | Tarefa |
|---|---|
| Seis tipos com comportamento de domínio distinto e verificável | T2 |
| Toda regra nova declara FONTE ou "dado do usuário" | T1, T2 |
| `pj_hora` sem alíquota: nada reservado, ausência tipada na API | T2 (domínio), T3 (API), T4 (tela) |
| Percentual subtraído antes de `capacidade_maxima`, com teste de posição | T1 |
| Teste cruzado, gêmeo do `TestRespiroNosTresConsumidores` | T6 |
| Tenant sem percentual tem cascata idêntica, campo a campo | T1 (unitário), T6 (integrado) |
| `422` em pt-BR sem valor no corpo, no padrão de `_validar_aporte` | T1 (regra pura), T3 (HTTP) |
| Nenhum valor derivado calculado no cliente | T4, T5 |
| Quatro estados em toda tela nova | T4, T5 |
| 48pt e `accessibilityLabel` | T4, T5 |
| `docs/api-contract.md` atualizado no mesmo commit | T3 (contrato do endpoint), T6 (Bloco 14) |

---

## `PLAN_DEVIATION`

Nenhum. O plano ainda não foi congelado para execução — falta o `PF-4`. A partir do congelamento,
mudança em dependência ou em trabalho planejado entra aqui com tarefa, estado planejado, estado
real, impacto e resolução; não se corrige o plano em silêncio.

---

## PLAN_DEVIATION — 20/08/2026 · coordenação da cadeia Alembic entre F-011 e F-012

- **task:** F-011 T1 e F-012 T3.
- **planned:** cada plano assumiu, isoladamente, ser o único a escrever migração no milestone, e
  ambos declararam encadear em `116f2181bdda`.
- **actual:** as duas features foram autorizadas a executar **em paralelo** por decisão humana de
  20/08/2026. Duas migrações nascidas do mesmo pai partem a cadeia em dois ramos, e
  `alembic upgrade head` passa a falhar por múltiplas cabeças.
- **impact:** nenhum no escopo das tarefas; é ordem de execução. Nenhum plano perde tarefa ou
  critério de aceite.
- **resolution:** **F-011 T1 escreve a primeira migração**, encadeada em `116f2181bdda`. **F-012 T3
  encadeia na cabeça que T1 deixar** — confirmada por `venv/bin/alembic heads` no início da tarefa,
  não presumida. Se `heads` devolver mais de uma cabeça, a tarefa para e reporta. Registrado nos
  contratos de T1 (F-011) e T3 (F-012).
