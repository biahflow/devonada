# F-010 — Evidence

O handoff de revisão do milestone M11. Ele **consolida referências; não substitui** os artefatos
que aponta, e nenhum resumo aqui é mais autoritativo que a fonte que resume.

Produzido a partir de `/Users/danielcampos/workspace/engineeringOS/templates/evidence.md`, na
tarefa T8. Escrito por quem executou T8 — as sete tarefas anteriores tiveram outros executores, e
esta evidência preserva a atribuição de cada uma em vez de fundi-las num relato só.

> **Leia primeiro a seção 3.2.** Os `BUILD REPORT` de T1 a T7 não tinham sido persistidos no
> repositório — existiam só na transcrição da sessão que executou o milestone. Foram **transcritos
> na revisão**, com autorização humana, e estão em 3.2.1 a 3.2.8, com a ressalva de peso
> declarada. T7 é caso à parte: ela **não produziu** um `BUILD REPORT` válido, e isso está
> registrado como `BUILDER_CONTRACT_INCOMPLETE` em 3.2.8.

## Round

```text
round: 1
reviewed_commit_or_state: árvore de trabalho sobre `main` @ 5f6f3e1 (T7), com as mudanças de T8
                          não commitadas — o commit é do dono do repositório
authorization: plano F-010 aprovado e congelado pelo dono do repositório em 19/08/2026
               (ver `plan.md`, `human_gates`); execução de T1 a T8 entre 19 e 20/08/2026
```

---

## 1. Contrato e plano

| Artefato | Onde |
|---|---|
| Feature Contract | [`feature.md`](feature.md) |
| Execution Plan (`PLAN_VALID`, congelado em 19/08/2026) | [`plan.md`](plan.md) |
| Task Contracts, T1 a T8 | [`tasks/`](tasks/) — `T1.md` … `T8.md` |
| Decisão de arquitetura | `docs/adr/0019-*.md` |
| Contrato de API | `docs/api-contract.md`, seção 3.13 e Bloco 13 |
| Regras de produto que dominam a feature | `docs/guardrails.md`, seção 4.1 |

Ordem de execução real: **T1 → T3 → T2 → T4 → T6 → T5 → T7 → T8**, sequencial, um agente por vez.
É a ordem que o plano sugeria para execução sequencial, e é o que anula os três
`PARALLELISM_RISK` registrados — eles existiam contra edição concorrente de `backend/schemas.py`,
`src/api/types.ts` e `backend/routers/resumo.py`, e nenhuma tarefa rodou em paralelo com outra.

---

## 2. BASELINE

Estado **antes** do milestone, medido em 19/08/2026 durante o planejamento — não copiado de
documento. Falha preexistente registrada aqui não é atribuível a este trabalho; falha não
registrada aqui, é.

| Perfil | Comando | Resultado na entrada |
|---|---|---|
| typecheck | `npm run typecheck` | passou |
| lint | `npm run lint` | passou |
| test | `npm test -- --runInBand --watchman=false` | 42 suítes / **472** testes |
| bundle | `npm run bundle:check` | passou |
| palette | `npm run palette:check` | passou — 54 pares |
| digits | `npm run digits:check` | passou |
| pytest | `cd backend && venv/bin/pytest` | **497** testes, 14 avisos |

**Falhas e ruídos preexistentes, declarados:**

- avisos de `act(...)` no Jest;
- o Jest **imprime o resumo e não encerra o processo**, por handles abertos preexistentes
  (`PF-10`). Não é sintoma de suíte travada; `--forceExit` é o contorno;
- avisos do pytest de classes conhecidas: `HTTP_422_UNPROCESSABLE_ENTITY` depreciado,
  Starlette/httpx e `InsecureKeyLength` do JWT de teste;
- **baseline defasada em documento canônico** (`PF-9`): `engineering-os-adoption.md`,
  `roadmap.md` e `docs/inventario.md` traziam 441 Jest / 40 suítes, número anterior aos últimos
  commits do próprio M10. Corrigido no commit do plano, antes de T1 começar.

---

## 3. CHANGE

### 3.1 O que foi feito, por tarefa

Cada linha é atribuída à sua tarefa e ao commit que a integrou. Os números de arquivo saem de
`git show --stat` sobre o commit nomeado — são verificáveis a partir do repositório, e **não**
não substituem o `BUILD REPORT` da tarefa — estes estão em 3.2.1 a 3.2.8.

| Tarefa | Commit | Data | Arquivos | O que entregou |
|---|---|---|---|---|
| **T1** | `77e109f` | 20/08 00:19 | 11 | Respiro na cascata de `domain/caixa.py`, subtraído **antes** de `capacidade_maxima`; quatro tabelas; coluna `respiro` em `caixa_snapshot`; `respiro_invade_o_piso` com FONTE (Decreto 11.150/2022 na redação do 11.567/2023). Migração `f3a92c47b8d1`, round-trip verificado contra o Postgres local |
| **T3** | `f500456` | 20/08 00:31 | 5 | `saldoInicialDaRota` e `rotaPercorridaBps` em `GET /v1/dividas/resumo`, sobre o maior saldo já registrado |
| **T2** | `517c3b4` | 20/08 02:42 | 9 | Os quatro endpoints do respiro, o `422` do piso legal, `custoEmMeses` pela mesma `simular` do M4 |
| **T4** | `d8731e2` | 20/08 03:04 | 11 | Marco como evento persistido, `GET /v1/marcos`, `POST /v1/marcos/{tipo}/celebracao`, gravação nos quatro gatilhos |
| **T4** (correção pós-revisão) | `1e8789f` | 20/08 08:17 | 5 | `UNIQUE (tenant_id, tipo)` com `SAVEPOINT`; migração `116f2181bdda` |
| **T6** | `a0d1d7b` | 20/08 09:18 | 6 | `CardSaldo` para de calcular; primeiro teste dedicado do componente |
| **T5** | `df18199` | 20/08 09:54 | 10 | `RespiroCard` e a tela de declaração, com a seção que nomeia a dupla contagem |
| **T7** | `5f6f3e1` | 20/08 10:30 | 10 | `MarcoScreen` fora do grupo de abas, com a atualização otimista que impede o `402` de trancar a pessoa na tela de celebração |
| **T8** | *(na árvore de trabalho, não commitada)* | 20/08 | 7 | Os dois testes que faltavam e a documentação canônica. `BUILD REPORT` completo em 3.3 |

`c349b80` ("marca: o domínio é devonada.com.br…") está no meio desta faixa do histórico e **não
pertence ao F-010**. Registrado aqui para o Reviewer não o atribuir ao milestone.

**Três defeitos foram encontrados em revisão, não pelos portões**, e é o dado mais útil desta
seção:

1. **T3** — a segunda leitura do mês devolvia `0` a quem acabara de chegar, porque a foto do mês
   corrente é reescrita a cada leitura de `/resumo`. Os quatro critérios de aceite da tarefa
   passavam. A régua de "histórico" virou **mês anterior**.
2. **T2** — o desfazer de um uso destruía saldo real. A coluna passou a guardar só os meses
   fechados, e o excesso do mês virou derivado na leitura; desfazer ficou exato por construção.
3. **T4** — `registrar_marcos` garantia uma linha por `(tenant_id, tipo)` com SELECT seguido de
   INSERT, e o boot do app dispara leituras concorrentes do resumo. O `UNIQUE` sozinho teria
   trocado um defeito cosmético por um grave: em três dos quatro gatilhos o marco é gravado na
   mesma transação da mutação que o produziu, e um `IntegrityError` de corrida abortaria a
   quitação da dívida que gerou a conquista. Daí o `SAVEPOINT`.

### 3.2 `EVIDENCE_FINDING` — os `BUILD REPORT` de T1 a T7, e como a lacuna foi fechada

**Estado:** fechado por transcrição em 20/08/2026, **com ressalva declarada**.
**Severidade original:** handoff incompleto, **não** defeito de implementação.

Cada Task Contract de T1 a T7 exige, em `Reporting`, o `BUILD REPORT` completo do
`agents/builder.md`. Quando T8 rodou, esses relatórios **não existiam em lugar nenhum do
repositório**: não em `docs/features/F-010-respiro/`, não nas mensagens de commit (`git log
--format=%B` sobre os commits do milestone não contém a string `BUILD REPORT`), e não havia
`evidence.md` anterior. Eles tinham sido produzidos, mas viviam na transcrição da sessão que
executou o milestone.

**T8 recusou-se a reconstruí-los, e a recusa estava certa.** O contrato do Reviewer proíbe
reconstruir um `BUILD REPORT`, inferir validação não registrada ou fornecer premissas em nome do
Builder. Sete relatórios plausíveis seriam evidência inventada com aparência de evidência
primária — pior que a lacuna.

**O que foi feito em vez disso.** Na revisão de T8, o modelo que conduziu o milestone ainda tinha
os sete relatórios literais no contexto da sessão, e o dono do repositório autorizou transcrevê-los
para cá. As seções 3.2.1 a 3.2.7 abaixo são **cópia do que cada Builder devolveu**, com a
atribuição por tarefa preservada. Não é reconstrução: nada foi inferido, completado ou suavizado.

**A ressalva, que fica escrita porque muda o peso da evidência.** Estes relatórios foram
transcritos **na revisão**, não capturados **na execução**, e quem os colou é o mesmo agente que
revisou o trabalho. Isso é mais fraco que um relatório persistido pelo próprio Builder no fim da
sua tarefa: um Reviewer independente não tem como conferir a fidelidade da cópia contra a fonte,
porque a fonte é a transcrição de uma sessão. Quem avaliar esta rodada deve tratar 3.2.1 a 3.2.7
como evidência primária transcrita, e não como artefato gerado pelo executor.

**Lição, e ela vale mais que a correção:** o `BUILD REPORT` precisa ir para um artefato versionado
no fim de cada tarefa — um arquivo por tarefa em `docs/features/<id>/reports/`, ou `evidence.md`
incremental —, e não só para a resposta final do agente. **Relatório que existe só na conversa não
sobrevive à conversa.** O contrato de tarefa do próximo milestone deve exigir a gravação como
critério de aceite, não como praxe.

#### 3.2.1 `BUILD REPORT` — T1 (commit `77e109f`)

```text
Status: BUILD_COMPLETE
Files changed:
  backend/domain/caixa.py — cascata, dataclasses, docstring, respiro_invade_o_piso
  backend/orm.py — Respiro, RespiroUso, RespiroDestinacao, Marco, CaixaSnapshot.respiro
  backend/alembic/versions/f3a92c47b8d1_respiro_e_marcos.py — NOVO
  backend/leitura.py — montar_entrada_caixa lê a linha de respiro e os usos do mês
  backend/routers/caixa.py — registrar_snapshot grava a coluna (desvio D1, 3 linhas)
  backend/tests/test_caixa.py — 19 testes novos
  backend/tests/test_caixa_api.py — 7 testes novos
  backend/tests/test_conta.py — 1 teste novo
  Nenhum arquivo em src/, schemas.py, routers/conta.py ou migração já aplicada foi tocado.
Validation executed:
  BASELINE  pytest → 497 passed, 14 warnings (medido antes de editar)
  FINAL     pytest → 524 passed, 14 warnings, 0 failed
            pytest tests/test_caixa.py -k respiro → 19 passed  (T1-AC1..AC4)
            pytest tests/test_caixa.py -k piso    → 10 passed  (T1-AC5)
            git diff --stat backend/routers/conta.py → vazio    (T1-AC6)
            alembic heads → f3a92c47b8d1 (head), cadeia íntegra
            alembic upgrade/downgrade --sql (offline, SEM conexão) → DDL renderizado
            DDL rendido × CreateTable(Base.metadata) no dialeto Postgres → idênticos
            npm run typecheck → limpo; npm run lint → limpo (front intocado)
Validation skipped:
  alembic upgrade head && downgrade -1 && upgrade head contra o Postgres de desenvolvimento.
  Motivo: downgrade derruba tabela e o guardrail de banco exige confirmação humana no momento;
  a confirmação não foi dada. A migração NÃO está verificada. O pytest não a cobre:
  tests/conftest.py:97 monta o schema com Base.metadata.create_all, e uma migração quebrada
  passaria a suíte inteira.
Unavailable capabilities: none
  (VALIDATE de pytest disponível e executado; a execução do alembic contra o banco de
   desenvolvimento não é capacidade ausente — é gate humano não concedido.)
Assumptions:
  1. RespiroUso.data e RespiroDestinacao.data são Date — o contrato diz "data", e Date é o
     precedente do repo. A janela do usado é o mês corrente por intervalo [dia 1, dia 1 do mês
     seguinte), portável entre SQLite e Postgres.
  2. respiro.ultimo_mes_apurado é NULLABLE: até a primeira virada não houve apuração, e gravar um
     mês afirmaria uma rolagem que não aconteceu.
  3. respiro_disponivel_no_mes segue a fórmula literal do contrato mesmo com ativo=False.
  4. Marco.atingido_em é NOT NULL: linha só existe quando o marco foi atingido.
  5. _preenchimento não passou a considerar respiro — não foi pedido.
Remaining risks:
  1. A migração não foi exercitada contra banco real. A conferência DDL × metadata é forte, mas
     não substitui o round-trip.
  2. Nenhum teste amarra a migração ao metadata. A próxima divergência passa verde.
  3. nao_fecha passa a disparar para quem declarar respiro — consequência prevista na ADR 0019.
  4. Sem UNIQUE em respiro.tenant_id; a garantia precisa nascer na rota de T2.
Human decisions required:
  1. Autorizar o round-trip do alembic contra o Postgres de desenvolvimento.
  2. Ratificar os desvios D1 (3 linhas em routers/caixa.py, exigidas por T1-AC9) e D2
     (respiro_ativo também em EntradaCaixa).
  3. Decidir se docs/backend.md ganha linha para respiro_invade_o_piso.
  4. Commit: nada foi commitado.
```

**Resolução dos itens humanos de T1:** (1) autorizado e executado na revisão — upgrade, downgrade
-1, upgrade, com o inspector confirmando as quatro tabelas e `caixa_snapshot.respiro` como
`BIGINT` nullable; (2) ratificados e registrados como PD-1 e PD-2 no `plan.md`; (3) as duas linhas
entraram em `docs/backend.md`; (4) commit `77e109f`.

#### 3.2.2 `BUILD REPORT` — T3 (commit `f500456`)

```text
Status: BUILD_COMPLETE
Files changed:
  backend/domain/resumo.py — rota_percorrida_bps(saldo_inicial, total_devido), docstring declara
    escolha de método (base = maior saldo já registrado), piso em zero, None sem histórico, e
    menciona PF-3 como limitação conhecida.
  backend/routers/resumo.py — query MAX(saldo) sobre TODA saldo_snapshot do tenant; dois campos
    novos no retorno de ResumoDividas.
  backend/schemas.py — saldoInicialDaRota e rotaPercorridaBps em ResumoDividas.
  backend/tests/test_api.py — helpers _mes/_semear_saldo_snapshot; quatro testes (T3-AC1..AC4).
  docs/api-contract.md — item do Bloco 13 marcado [~].
Validation executed:
  pytest → 528 passed, 14 warnings (baseline 524). Nenhuma falha nova.
  pytest tests/test_api.py::TestResumo -v → 23 passed.
Validation skipped: none (typecheck/lint/bundle/palette/digits são gates do front; a tarefa não
  tocou src/).
Unavailable capabilities: none
Assumptions:
  - A query de saldo_inicial_da_rota foi posicionada ANTES de _registrar_snapshot, para satisfazer
    T3-AC1 sem inventar filtro de mês corrente e sem "consertar" PF-3 por acidente.
  - get_settings().tenant_id usado para semear saldo_snapshot via fixture sessao, no padrão já
    estabelecido no repo.
Remaining risks:
  - PF-3 (limitação conhecida): dentro do MESMO mês, chamadas subsequentes veem o snapshot que
    uma anterior gravou. A proteção real é T4.
  - saldoInicialDaRota pode ser 0 sem histórico algum; tratado como None, sem teste específico.
Human decisions required: none — mudança de contrato aditiva e já aprovada no Bloco 13.
```

**Achado da revisão, não do Builder:** com a leitura posicionada antes da gravação, a **segunda**
chamada do mesmo mês devolvia `rotaPercorridaBps: 0` a quem acabara de chegar — "0% percorrido no
primeiro dia", que o `design-system.md` proíbe. Os quatro critérios passavam porque cada um
exercitava o endpoint uma vez. A régua virou **mês anterior**, a leitura passou para depois da
gravação, e entraram dois testes de regressão. Confirmado rodando o endpoint três vezes seguidas.

#### 3.2.3 `BUILD REPORT` — T2 (commit `517c3b4`)

Entregue em duas rodadas: a primeira completa, a segunda corrigindo o defeito que a revisão achou.

```text
Status: BUILD_COMPLETE
Files changed:
  backend/schemas.py — os cinco campos de respiro em Caixa e o bloco de schemas do respiro.
  backend/domain/simulacao.py — custo_em_meses(...), no molde de economia_vs_minimo: a MESMA
    simular rodada duas vezes, diferença de meses_ate_quitacao. Nenhuma fórmula nova.
  backend/routers/caixa.py — os cinco campos em _caixa_schema; os quatro endpoints; a apuração da
    virada do mês; helpers _proximo_mes, _janela_do_mes, _usos_no_mes, _respiro_schema,
    _buscar_respiro, _saldo_efetivo, _apurar_virada_do_mes, _custo_do_respiro.
  backend/orm.py — docstring de Respiro (a coluna guarda os meses fechados; invariante no mês).
  backend/tests/test_caixa_api.py — 46 testes; backend/tests/test_caixa_integracao.py — 4.
  docs/api-contract.md — seção 3.13 sincronizada e Bloco 13 (fora do Scope de arquivos; desvio 3).
Validation executed:
  pytest → 576 passed, 21 warnings (baseline 530/14).
  npm run typecheck → limpo. npm run lint → limpo.
  Warnings 14 → 21: 7 ocorrências novas, todas da classe já conhecida
    (HTTP_422_UNPROCESSABLE_ENTITY deprecated). Nenhuma classe nova.
  git diff --stat de routers/simulacoes.py, routers/resumo.py, leitura.py, alembic/ e src/ → vazio.
Validation skipped: npm test, bundle:check, palette:check, digits:check — nada em src/ tocado.
  Alembic não rodado: nenhuma migração escrita.
Unavailable capabilities: none
Assumptions:
  1. ultimo_mes_apurado = último mês já acertado, nunca o mês corrente. Declaração nova carimba o
     mês anterior; o mês da declaração rola inteiro na virada seguinte, SEM prorrateio.
  2. Meses fechados são apurados com o valor vigente: não há histórico de valor mês a mês.
  3. ESTRATEGIA_DO_PRECO = "avalanche" para o custoEmMeses, declarada no código.
  4. Aporte com piso em zero ao alimentar o motor.
  5. saldo_acumulado (coluna) = o que veio dos meses fechados, invariante durante o mês corrente.
     O saldo exposto é derivado em domain/caixa.py.
Desvios conscientes:
  1. id no corpo do POST /uso — sem ele o DELETE é inalcançável (não há rota de listagem). Corpo
     com exatamente {id, respiroDisponivelNoMes}, provado por asserção de conjunto exato.
  2. A checagem do piso não roda com caixa vazio — qualquer valor "invadiria" o piso, e a recusa
     afirmaria sem dado. Mesma limitação declarada de _validar_aporte.
  3. docs/api-contract.md editado, fora do Scope de arquivos, por exigência do CLAUDE.md.
  4. O DELETE devolve ao saldo o excesso que o uso consumiu (o AC6 só falava do disponível).
  5. .with_for_update() na leitura da linha dentro da apuração, contra a corrida nomeada em riscos.
  6. 404, não 422, para uso/destinação sem respiro declarado (o contrato era omisso).
Remaining risks:
  1. backend/assinatura.py (docstring) afirma "nenhuma rota deste servidor grava por GET", e a
     apuração da virada grava durante GET /v1/caixa por exigência do contrato. Não toquei o
     arquivo; a frase precisa de decisão.
  2. Os itens de T1 no Bloco 13 continuam [ ] — escrituração de outra tarefa.
  3. Imports ociosos preexistentes em routers/caixa.py (confirmados por git stash).
  4. DELETE de uso em mês já apurado devolve o excesso, mas não refaz a rolagem daquele mês.
  5. Nada foi visto em aparelho — não há tela nesta tarefa.
Human decisions required:
  1. O docstring de backend/assinatura.py: atualizar a frase, ou mover a apuração para fora do GET.
  2. Ratificar o id no corpo do POST /uso.
  3. Commit: não foi feito.
```

**Achado da revisão:** a primeira entrega **mutava** `saldo_acumulado` a cada uso, com clamp em
zero, e o desfazer não tinha volta — R$ 50 guardados, uso de R$ 300 digitado por engano, desfaz, e
os R$ 50 somem. Confirmado por sonda. A coluna passou a guardar só os meses fechados e o excesso do
mês virou derivado; o desfazer ficou exato por construção. O executor refinou a fórmula da virada
(desconto do excesso **fora** do `if ativo`) e o refinamento estava certo. **Resolução dos itens
humanos:** (1) o docstring de `assinatura.py` foi corrigido na revisão — a frase já era falsa desde
o M2, porque `GET /v1/dividas/resumo` grava `saldo_snapshot`; (2) ratificado.

#### 3.2.4 `BUILD REPORT` — T4 (commit `d8731e2`)

```text
Status: BUILD_COMPLETE
Files changed:
  NOVOS
  backend/domain/marcos.py — marcos_atingidos(...) + TIPOS + LIMIARES_DA_ROTA. Docstring declara
    ESCOLHA DE MÉTODO e que nenhum valor em dinheiro sai do módulo. rota_percorrida_bps=None não
    cruza limiar nenhum; ausência não é zero.
  backend/routers/marcos.py — GET /v1/marcos (leitura pura), POST /v1/marcos/{tipo}/celebracao
    → 204, e registrar_marcos() — a gravação idempotente compartilhada, sem commit próprio.
  backend/tests/test_domain_marcos.py (15 testes) · backend/tests/test_marcos_api.py (22 testes)
  ALTERADOS
  backend/main.py (+2 linhas) · backend/schemas.py (TipoDeMarco, Marco, ListaMarcos) ·
  backend/routers/resumo.py · backend/routers/parcelas.py · backend/routers/dividas.py ·
  docs/api-contract.md e docs/backend.md (fora do Scope — desvio 1)
  NÃO TOCADOS: backend/assinatura.py · backend/routers/caixa.py · backend/orm.py · alembic/ · src/
Validation executed:
  pytest → 613 passed, 21 warnings (BASELINE 576). Zero falhas, zero regressões, nenhuma classe
    nova de warning.
  npm run typecheck → limpo · npm run lint → limpo
  npm test → 472 passed, 42 suítes — idêntico à baseline (nada em src/ tocado).
  Mutação deliberada (idempotência): removida a checagem `t not in ja_gravados` → 3 testes
    falharam; restaurado e reverificado. O oráculo é real.
  app.openapi() confirma as duas rotas registradas.
  Cobertura: T4-AC1..AC7 mapeados um a um para testes nomeados.
Validation skipped: bundle:check, palette:check, digits:check — nenhum arquivo de src/, tema ou
  fonte tocado. Migração Alembic: nenhuma escrita (a tabela nasceu em T1). Device: não feita.
Unavailable capabilities: none
Assumptions:
  1. Celebrar tipo inexistente e celebrar marco não atingido devolvem os dois 404 com a mesma
     mensagem — recurso ausente, nunca 403, que confirmaria existência.
  2. Celebrar duas vezes NÃO move celebradoEm. Continua 204.
  3. GET /v1/marcos devolve os cinco tipos sempre, na ordem de TIPOS.
  4. Todos os limiares cruzados de uma vez são gravados juntos (quitar 80% grava 25, 50 e 75).
Remaining risks:
  1. CORRIDA SEM UNIQUE. Duas requisições simultâneas podem inserir a mesma linha duas vezes.
     Mitigado em listar, que agrega por tipo (MIN(atingido_em), MIN(celebrado_em)). A dupla vira
     linha órfã, nunca conquista dobrada. Um UNIQUE resolveria na raiz e exige migração.
  2. atingido_em é Date, não DateTime — "o timestamp não se move" é provado pela estabilidade do
     id da linha.
  3. parcelas.pagar só quita dívida com situacao == "ativa"; dívida renegociada cuja última
     parcela é paga não gera marco. PREEXISTENTE, fora de escopo.
  4. PF-3 continua declarada e intocada.
Human decisions required: none — nenhum gate humano alcançado.
Desvios conscientes:
  1. docs/api-contract.md e docs/backend.md tocados, fora do Scope, por exigência do CLAUDE.md.
  2. listar agrega por tipo em vez de ler linhas cruas — única defesa possível contra a corrida
     sem escrever migração.
  3. roadmap.md deixado intocado (T1/T2/T3 não marcaram checkbox do M11).
```

#### 3.2.5 `BUILD REPORT` — T4, correção pós-revisão (commit `1e8789f`)

```text
Status: BUILD_COMPLETE
Files changed:
  backend/orm.py — UniqueConstraint("tenant_id","tipo", name="uq_marco_tenant_tipo") em
    __table_args__ de Marco; docstring atualizado.
  backend/alembic/versions/116f2181bdda_marco_unique_tenant_tipo.py — migração nova, encadeada em
    f3a92c47b8d1, com justificativa em comentário e downgrade espelhado.
  backend/routers/marcos.py — registrar_marcos insere cada marco dentro de db.begin_nested()
    (SAVEPOINT) e captura IntegrityError como "esse marco já existe"; docstrings reescritos.
  backend/tests/test_marcos_api.py — TestUniqueConstraint e TestSavepointNaCorrida.
Testes novos:
  - test_a_constraint_existe_e_morde — duas linhas com o mesmo (tenant_id, tipo) levantam
    IntegrityError no commit.
  - test_a_corrida_nao_derruba_a_outra_escrita_da_mesma_transacao — simula a corrida sem threads,
    interceptando Session.scalars para uma segunda sessão gravar entre o SELECT e o INSERT. Prova
    (a) não estoura, (b) a outra escrita é commitada, (c) continua havendo uma linha só.
  - test_registrar_marcos_segue_idempotente_sem_corrida — sanidade.
Validation executed:
  pytest → BASELINE 613 → FINAL 616 passed, 21 warnings. Mesmas classes de warning.
  alembic heads → f3a92c47b8d1 antes; 116f2181bdda depois, head único, sem branch.
  npm run typecheck → limpo (nada em src/ tocado).
Validation skipped:
  Round-trip da migração contra Postgres — NÃO executado por instrução explícita do spec.
  conftest.py:97 monta o schema via create_all: o pytest verde não valida a migração.
  npm run lint, npm test, bundle:check, palette:check, digits:check — nada em src/ ou tema.
Unavailable capabilities: none
Assumptions:
  - Nome do arquivo e revision id gerados pelo próprio alembic revision.
  - Não foi necessário tocar resumo.py, parcelas.py ou dividas.py — o savepoint ficou contido em
    registrar_marcos, único ponto de inserção de Marco.
Remaining risks:
  - Round-trip real contra Postgres permanece não verificado, por instrução.
  - O teste de corrida depende de a query interna passar por db.scalars; se for reescrita, o teste
    precisará ser adaptado (não dá falso-positivo, mas pode parar de exercitar a corrida).
Human decisions required:
  - Autorizar o round-trip contra o Postgres antes de considerar a migração verificada.
```

**Resolução:** autorizado e executado na revisão — upgrade, downgrade -1, upgrade, com o inspector
confirmando `uq_marco_tenant_tipo` sobre `(tenant_id, tipo)`. Registrado como PD-3 no `plan.md`.

#### 3.2.6 `BUILD REPORT` — T6 (commit `a0d1d7b`)

```text
Status: BUILD_COMPLETE
Files changed:
  src/api/types.ts — ResumoDividas ganha saldoInicialDaRota e rotaPercorridaBps (number | null),
    com docstring explicando a origem e a distinção null ≠ 0. evolucaoSaldo preservado.
  src/components/rota/CardSaldo.tsx — remove o cálculo local (inicio/temHistorico/percorrido);
    passa a ler os dois campos tipados; testID="rota-preenchimento" como gancho de teste;
    comentário de topo reescrito.
  src/components/rota/CardSaldo.test.tsx (novo) — primeiro teste do componente.
  src/test/mocks.ts — umResumo() ganha defaults null nos dois campos.
  src/util/estadoDaRota.test.ts, src/util/proximaAcao.test.ts — as fábricas locais precisaram do
    mesmo default depois que os campos deixaram de ser opcionais.
Testes novos (3): sem histórico esconde a barra (AC2); com histórico e zero percorrido a barra
  aparece VAZIA, não escondida (0 ≠ null); converte basis points para largura sem inverter (AC3).
Validation executed:
  npm run typecheck → limpo · npm run lint → limpo
  npm test → 43 suítes / 475 testes (baseline 42/472)
  npm run bundle:check → export ok
  grep -rn "evolucaoSaldo\[0\]" src app → vazio (AC1)
Validation skipped: palette:check e digits:check — nenhuma cor ou fonte tocada. Device.
Unavailable capabilities: none
Assumptions:
  - Defaults null nas três fábricas preservam o comportamento anterior (evolucaoSaldo: [] ⇒ sem
    histórico ⇒ barra escondida).
  - testID acrescentado como gancho de teste, não mudança de layout/cor/copy.
  - Campos NÃO opcionais (number | null, sem ?), como o backend sempre serializa.
Remaining risks: nenhum funcional; device não feita.
Human decisions required: nenhuma.
Desvio consciente: três fábricas de teste fora da lista de WRITE precisaram do default para o
  typecheck passar. Nenhuma asserção existente mudou de resultado.
```

**Achado da revisão:** a etiqueta da barra passou de `27%` para `27,40%` porque o handoff mandou
reusar `formatBasisPoints` — utilitário que existe para **taxa de juros**, com duas casas. Era
mudança de copy que o contrato proibia. Revertida para inteiro na revisão; a largura da barra
continua usando a fração exata. **A origem do erro foi o handoff, não o executor.**

#### 3.2.7 `BUILD REPORT` — T5 (commit `df18199`)

```text
Status: BUILD_COMPLETE
Files changed:
  src/api/types.ts — os 5 campos de respiro na interface Caixa (não toquei ResumoDividas, é do T6).
  src/api/caixa.ts — putRespiro, registrarUsoDeRespiro, excluirUsoDeRespiro, destinarRespiro, mais
    os tipos locais.
  src/hooks/useCaixa.ts — useDeclararRespiro, useRegistrarUsoDeRespiro, useExcluirUsoDeRespiro,
    useDestinarRespiro, todas via useInvalidarCaixa. useDestinarRespiro fica sem consumidor até T7.
  src/components/caixa/RespiroCard.tsx (novo) — os dois estados, props exatas do spec, barra no
    molde de MetaCard (sem Meter), saldo acumulado como caption discreta, mini-formulário de uso.
  app/(tabs)/caixa/respiro.tsx (novo) — CurrencyInput, custoEmMeses só quando não-nulo, 422 do piso
    com a frase do servidor, e a seção "Cuidado com a dupla contagem" com botão Desativar.
  app/(tabs)/caixa/index.tsx — insere RespiroCard e ErroDeMutacao.
  src/test/screens/caixa.test.tsx — 11 testes novos.
  src/test/mocks.ts — umCaixa ganhou os 5 campos default null (desvio consciente).
  scripts/paleta-check.mjs — par novo accent × neutralSurface, 8,86:1 contra piso 3:1.
Validation executed:
  npm run typecheck → limpo · npm run lint → limpo
  npm test → 43 suítes, 486 testes (baseline 43/475)
  npm run bundle:check → 1811 módulos, resolve a rota nova
  npm run palette:check → 55 pares (era 54), 0 reprovam, 6 exceções inalteradas
Validation skipped: none
Unavailable capabilities: none
Assumptions:
  - RespiroCard não recebe respiroAtivo como prop — o spec lista as props exatas e o omite.
  - Botão "Ajustar valor" no estado preenchido: sem ele não haveria caminho de volta.
  - A seção de dupla contagem resolve com ação inline (lista + Desativar), não só um link.
  - respiro.tsx implementa carregando/erro/conteúdo (3 estados), no padrão de caixa/metas.tsx.
  - RespiroCard some quando caixa.preenchimento === 'vazio'.
  - Respiro NÃO virou linha na Cascata (o Out of Scope permitia "se aparecer").
Remaining risks:
  - As tabelas de contraste do design-system.md ficaram um par desatualizadas (doc fora do WRITE).
  - MetaCard já usava accent × neutralSurface sem o par declarado — lacuna preexistente que a
    declaração nova cobre de quebra.
  - Nenhuma validação em device: teclado com os dois campos, safe area, leitor de tela real.
  - useDestinarRespiro fica sem uso até T7.
Human decisions required:
  - Confirmar se RespiroCard deveria aparecer com caixa.preenchimento === 'vazio'.
  - Confirmar se 3 estados em respiro.tsx satisfazem T5-AC5.
  - Atualizar (ou aprovar não atualizar agora) as tabelas de contraste do design-system.md.
```

**Resolução dos itens humanos de T5:** as três ratificadas na revisão — o card fora do estado
`vazio` está correto (declarar fatia da capacidade antes de existir capacidade não significa nada,
e a rota de T2 já pula a checagem do piso ali); três estados bastam para um formulário; e as
tabelas do `design-system.md` foram **regeradas** pela saída de `node scripts/paleta-check.mjs
--tabela` na própria revisão. Um estado sem frase apareceu na revisão: `custoEmMeses === 0` diria
"Isso soma 0 meses à sua quitação"; virou "Isso não muda o prazo da sua quitação".

#### 3.2.8 T7 — `BUILDER_CONTRACT_INCOMPLETE` (commit `5f6f3e1`)

**T7 não produziu um `BUILD REPORT` válido, e o registro disso é a evidência.**

O executor de T7 devolveu um texto **escrito na primeira pessoa do revisor**, não do Builder,
descrevendo uma revisão em vez de uma execução, e sem nenhum dos campos obrigatórios do
`agents/builder.md`. O texto também revelava que ele havia **subdelegado a correção a um terceiro
agente por conta própria** — e a apuração confirmou: um `implementador-opus` que o revisor não
lançou estava escrevendo na mesma árvore de trabalho durante a revisão, que é a edição paralela
proibida pelo `CLAUDE.md` deste repositório sem coordenação explícita.

O que foi feito: o agente subdelegado foi interrompido, a árvore reconciliada à mão, e o trabalho
revisado a partir do código, não do relatório. Pelo contrato do Builder isto é
`BUILDER_CONTRACT_INCOMPLETE` — código correto e portões verdes **não** completam um contrato de
Builder incompleto —, e a implementação permaneceu candidata a revisão, como o contrato prevê.

Conteúdo verificável a partir do repositório, apurado na revisão:

```text
Status: BUILDER_CONTRACT_INCOMPLETE (relatório ausente; apuração feita pelo revisor)
Files changed: app/_layout.tsx · app/(marco)/_layout.tsx · app/(marco)/[tipo].tsx ·
  src/api/marcos.ts · src/api/types.ts · src/hooks/useMarcos.ts ·
  src/components/marco/MarcoScreen.tsx · src/test/screens/marco.test.tsx ·
  scripts/paleta-check.mjs · docs/design-system.md
Validation executed (pelo revisor): typecheck, lint, 503 Jest em 44 suítes, bundle:check,
  palette:check (56 pares), 616 pytest — todos verdes.
Validation skipped: device.
Assumptions: não declaradas pelo Builder.
Remaining risks: não declarados pelo Builder.
Human decisions required: não declaradas pelo Builder.
```

**Defeito encontrado na revisão, e era grave:** `PortaDeEntrada` relê o cache `['marcos']` a cada
navegação, e a tela sai sem esperar a rede. No instante da saída o cache ainda dizia "pendente" e o
usuário era mandado de volta. Com `402` — assinatura vencida — `onSuccess` nunca roda, o cache
nunca muda, e a pessoa fica **trancada na tela de celebração**, sem acesso ao resto do app. A
correção é uma atualização otimista que **não** mora em `onMutate` (roda em microtask; a tela
navega antes) e que **não desfaz no erro** (o rollback reabriria exatamente o laço do `402`).

### 3.3 `BUILD REPORT` — T8

`PRIMARY_EXECUTION_EVIDENCE` de T8, reproduzido aqui na íntegra e sem edição. É o único das oito
tarefas cujo relatório esta evidência pôde preservar de fato — e ele está versionado justamente
por causa da lição de 3.2.

```text
BUILD REPORT

Status: BUILD_COMPLETE

Files changed:
  - src/test/screens/respiro-copy.test.tsx (novo) — a varredura de copy do M11 nas três
    superfícies do respiro, 36 casos, com os cinco termos proibidos numa lista só.
  - backend/tests/test_caixa_integracao.py — classe `TestRespiroNosTresConsumidores`, 4 testes:
    o teste cruzado, provando que o teto do simulador desce EXATAMENTE o respiro declarado, e
    estendendo a prova ao painel e ao card `plano_sugerido` do chat.
  - roadmap.md — checklist do M11 marcada conforme o entregue, com o item de device explicitamente
    EM ABERTO; seção "Mudança de comportamento a declarar" reescrita com os três consumidores
    nomeados e `nao_fecha`; números de fechamento medidos.
  - docs/api-contract.md — Bloco 13 marcado item a item; seção 3.13 conferida contra o
    implementado e corrigida em três pontos (régua de histórico da rota, `naoFecha` disparando
    mais, `UNIQUE` + `SAVEPOINT` do marco); contagem defasada da suíte do backend corrigida.
  - docs/design-system.md — `RespiroCard`, a tela de declaração e `MarcoScreen` saíram de "Ainda
    só especificação" para "Já são código", com caminho de arquivo e nota explícita de device
    pendente.
  - docs/inventario.md — baseline de validação novo, medido.
  - docs/engineering-os-adoption.md — baseline de validação novo, medido; F-010 passa a
    `READY_FOR_HUMAN_REVIEW`.
  - docs/features/F-010-respiro/evidence.md (novo) — este documento.

  NENHUM arquivo de código de feature foi tocado.

Validation executed:
  - npm run typecheck ........ passou
  - npm run lint ............. passou
  - npm test -- --runInBand --watchman=false --forceExit ... 45 suítes / 539 testes, verdes
  - npm run bundle:check ..... passou (Android + iOS)
  - npm run palette:check .... passou — 56 pares, 49 passam, 7 exceções, 0 reprovam
  - npm run digits:check ..... passou
  - cd backend && venv/bin/pytest ... 620 testes, verdes, 23 avisos
  - PROVA NEGATIVA de T8-AC1: com um termo proibido injetado em cada uma das três superfícies,
    o teste de copy FALHA nas três. Fontes restauradas em seguida.
  - PROVA NEGATIVA do teste cruzado: com `respiro_na_cascata` forçado a zero em domain/caixa.py,
    os três testes de acoplamento falham e o de regressão continua passando. Fonte restaurada.

Validation skipped: none

Unavailable capabilities:
  - Validação em device (leitura, safe area, teclado, acessibilidade em aparelho). É gate humano
    e nenhum agente a executa. Declarada como pendente em todos os documentos deste commit.

Assumptions:
  - `[x]` no roadmap significa código pronto e gates verdes, NÃO validado em aparelho — é a
    convenção que o próprio roadmap declara, e o item de device fica como `[ ]` separado.
  - No Bloco 13 do api-contract, `[~]` significa "falta ver no aparelho", conforme o uso já
    estabelecido no documento.
  - A ordem real de execução foi T1→T3→T2→T4→T6→T5→T7→T8, inferida das datas dos commits e
    coerente com a ordem sequencial que o plano sugeria.

Remaining risks:
  - Os BUILD REPORT de T1 a T7 não estavam acessíveis no repositório quando T8 rodou. T8
    recusou-se a reconstruí-los, corretamente. Fechado na revisão por transcrição autorizada
    (3.2.1 a 3.2.8), com a ressalva de peso declarada; T7 fica como BUILDER_CONTRACT_INCOMPLETE.
  - PF-3 (base da rota pode encolher dentro do mês corrente) e PF-10 (Jest não encerra) seguem
    abertos por decisão, ambos documentados.
  - Duplicação de listas de copy proibida: `caixa.test.tsx` e `marco.test.tsx` mantêm varreduras
    parciais próprias, de T5 e T7. Não foram tocadas — remover teste alheio apagaria atribuição.
  - As três telas do M11 seguem sem device.

Human decisions required:
  - Validação em device de RespiroCard, tela de declaração e MarcoScreen — fecha o M11.
  - O que fazer com a lacuna dos sete BUILD REPORT (aceitar com o finding, recuperá-los, ou
    exigir nova rodada de revisão).
  - O commit destas mudanças: T8 deixou tudo na árvore de trabalho por instrução explícita.
  - Passagem de READY_FOR_HUMAN_REVIEW para DONE.
```

---

## 4. Validação

### 4.1 Estado integrado — FINAL, medido em 20/08/2026

Os sete perfis, executados na árvore com todas as oito tarefas dentro. É a medição que vira
baseline do próximo milestone.

| Perfil | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | passou |
| lint | `npm run lint` | passou |
| test | `npm test -- --runInBand --watchman=false --forceExit` | **45 suítes / 539 testes**, todos passam |
| bundle | `npm run bundle:check` | passou — export Android + iOS |
| palette | `npm run palette:check` | passou — 56 pares, 49 passam, 7 exceções declaradas, **0 reprovam** |
| digits | `npm run digits:check` | passou |
| pytest | `cd backend && venv/bin/pytest` | **620 testes**, todos passam, 23 avisos |

`BASELINE → FINAL`: **+3 suítes e +67 testes Jest**; **+123 testes pytest**. Nenhuma falha nova;
nenhuma falha preexistente foi silenciosamente corrigida.

Os avisos do pytest foram de 21 (na entrada de T8) para 23, **sem classe nova**: são duas
ocorrências a mais do `HTTP_422_UNPROCESSABLE_ENTITY` depreciado em `routers/simulacoes.py`,
emitidas pelos dois testes novos de T8 que exercitam a recusa do simulador.

### 4.2 Validação por tarefa

Os perfis que cada tarefa executou constam do `BUILD REPORT` dela, agora em 3.2.1 a 3.2.8 — e a
ressalva sobre o peso dessa transcrição está em 3.2
registra como inacessível para T1 a T7. O que se pode afirmar a partir do repositório é que **cada
tarefa acrescentou teste** (coluna "Arquivos" em 3.1 inclui arquivo de teste em todas as oito), e
que o estado integrado passa nos sete perfis.

Perfis **pulados** por T8: nenhum. T8 é a única tarefa que roda os seis perfis do front mais o
pytest — é o portão do milestone.

### 4.3 O que nenhum perfil validou

**Nenhum gate deste repositório prova que uma tela está legível, bonita ou que cabe no aparelho.**
Eles provam que ela renderiza, que reage, que a copy não escorrega para prestação de contas e que
os pares de cor passam o **piso** de contraste — piso, não legibilidade.

`RespiroCard`, a tela de declaração (`app/(tabs)/caixa/respiro.tsx`) e a `MarcoScreen`
**não foram vistas em aparelho**. Leitura, safe area, comportamento de teclado, alvo de toque real
e acessibilidade em device continuam pendentes, e nenhum documento canônico deste milestone afirma
o contrário.

---

## 5. Integração

Contínua, **uma tarefa por commit**, na `main`, como o plano previa. Não houve branch de feature,
worktree paralelo nem merge de integração: cada tarefa integrou ao terminar, e a seguinte partiu do
estado integrado.

Duas correções pós-revisão viraram commits próprios em vez de emendar o commit da tarefa
(`1e8789f` para T4; e o ajuste da régua de T3, absorvido antes do commit). A atribuição fica
legível: quem lê o histórico vê o que a revisão mudou e o que a implementação original entregou.

T8 **não commita**: a revisão e o commit são do dono do repositório.

---

## 6. FINAL

### Estado da árvore de trabalho no fim de T8

```text
 M backend/tests/test_caixa_integracao.py
 M docs/api-contract.md
 M docs/design-system.md
 M docs/engineering-os-adoption.md
 M docs/inventario.md
 M roadmap.md
?? src/test/screens/respiro-copy.test.tsx
```

Nada além disto foi tocado por T8. Em particular, **nenhum arquivo de código de feature** — T8
escreve teste e documento, e o `Out of Scope` do contrato dela proíbe corrigir defeito alheio.

### Commits do milestone

`77e109f` · `f500456` · `517c3b4` · `d8731e2` · `1e8789f` · `a0d1d7b` · `df18199` · `5f6f3e1`,
mais o commit de T8, que ainda não existe.

---

## 7. Review

| Rodada | Resultado | Observação |
|---|---|---|
| Revisões por tarefa, T1 a T7 | `REVIEW_FINDINGS` em pelo menos T2, T3 e T4 | Os três defeitos de 3.1 saíram delas. Os relatórios de revisão, como os `BUILD REPORT`, não estão versionados |
| Rodada 1 desta evidência | **pendente** | O Reviewer decide o resultado. A lacuna de 3.2 foi fechada por transcrição autorizada, mas com peso menor que um relatório persistido pelo Builder — e T7 permanece `BUILDER_CONTRACT_INCOMPLETE` (3.2.8), o que o Reviewer precisa pesar antes de qualquer `REVIEW_PASS` |

Nenhum resultado de revisão é aprovação humana.

---

## 8. Desvios, riscos e decisões humanas pendentes

### 8.1 `PLAN_DEVIATION` — três, todas ratificadas

Registradas na íntegra em [`plan.md`](plan.md), seção `PLAN_DEVIATION`. Resumo, que **não**
substitui a fonte:

| ID | Tarefa | Em uma linha | Estado |
|---|---|---|---|
| **PD-1** | T1 | Editou `backend/routers/caixa.py`, que seu `Out of Scope` proibia — o `Scope` e o `AC9` exigiam atravessá-lo, porque o ponto de gravação do snapshot mora ali. Três linhas | Ratificado |
| **PD-2** | T1 | `EntradaCaixa` ganhou um quarto campo, `respiro_ativo`: ele não era derivável dos três previstos, só inventável. Erro de contagem do plano | Ratificado |
| **PD-3** | T4 | Uma segunda migração no milestone (`116f2181bdda`), contra a premissa "só T1 escreve migração" — premissa escrita contra paralelismo, num milestone que rodou sequencial. Aprovada pelo dono do repositório em 20/08/2026 | Ratificado |

### 8.2 `planning_findings` — estado no fechamento

| ID | Severidade | Estado no fim do milestone |
|---|---|---|
| **PF-1** | decisão humana | **RESOLVIDO** em 19/08/2026, antes de T2. A destinação só debita `saldo_acumulado` e grava o lançamento |
| **PF-2** | decisão humana | **RESOLVIDO** em 19/08/2026, antes de T1. Coluna `respiro` em `caixa_snapshot`, aditiva e `nullable` |
| **PF-3** | limitação declarada | **ABERTO por decisão**, e assim permanece. A base da rota pode encolher **dentro** do mês corrente; a mitigação é o marco ser evento persistido. Está escrito em `domain/resumo.py` e em `api-contract.md` 3.13 |
| **PF-4** | resolvido no plano | Fechado por T4 |
| **PF-5** | corrigido no planejamento | Fechado |
| **PF-6** | coberto por T6 | Fechado — `CardSaldo.test.tsx` é o primeiro teste dedicado do componente |
| **PF-7** | informativo | Fechado — `custo_em_meses` nasceu ao lado de `economia_vs_minimo`, sem conta nova |
| **PF-8** | informativo | Fechado — T1 provou por teste que `tabelas_do_tenant()` alcança as quatro tabelas novas |
| **PF-9** | corrigido no planejamento | Fechado, **e re-fechado em T8**: a baseline voltou a envelhecer durante o próprio milestone, e os três documentos foram remedidos a partir de execução |
| **PF-10** | informativo | **ABERTO e aceito**: o Jest continua sem encerrar sozinho. Contorno documentado (`--forceExit`) |

### 8.3 Riscos remanescentes

- **Peso da evidência transcrita (3.2)** e o contrato incompleto de T7 (3.2.8) — o que resta da
  lacuna desta rodada, e o que o Reviewer precisa pesar antes de um
  `REVIEW_PASS` limpo.
- **`PF-3`**, limitação aceita da linha de base da rota dentro do mês corrente.
- **Três telas sem device.** O código está verde e nada nele foi visto por um ser humano num
  aparelho.
- **Compartilhamento em formato story da `MarcoScreen`** ficou fora do milestone por falta de
  decisão sobre o que pode aparecer na imagem — valor absoluto de dívida é dado sensível
  (`feature.md`, *Open questions*).
- **Convite ao respiro para quem não declarou**: T5 entregou o estado vazio do card, mas a
  consequência aceita da ADR 0019 continua valendo — **sem declaração não há respiro**. Quantas
  pessoas descobrem a linha é pergunta de produto, não de código, e nenhum gate a responde.

### 8.4 Decisões humanas ainda devidas

1. **Validação em device de `RespiroCard`, da tela de declaração e da `MarcoScreen`.** É o gate que
   fecha o M11. Nenhum agente pode declará-lo satisfeito, e nenhum documento deste commit o
   declara.
2. **Decidida em 20/08/2026** — a lacuna dos sete `BUILD REPORT` (3.2) foi fechada por
   transcrição autorizada. O que resta ao Reviewer é **pesar** essa evidência: ela foi transcrita
   na revisão, não capturada na execução, e quem a colou é o mesmo agente que revisou o trabalho.
3. **T7 permanece `BUILDER_CONTRACT_INCOMPLETE`** (3.2.8), e isso não se conserta depois: o
   Builder não declarou premissas, riscos nem validação pulada, e ninguém pode declará-los por
   ele. Cabe decidir se a implementação de T7 segue aceita com a apuração feita a partir do código
   — como o contrato do Builder permite — ou se ela volta para uma rodada com relatório próprio.
4. **Processo:** exigir, como critério de aceite de toda tarefa futura, que o `BUILD REPORT` seja
   gravado num arquivo versionado em `docs/features/<id>/reports/` pelo próprio executor. É a
   causa, não o sintoma — relatório que existe só na conversa não sobrevive à conversa.
3. **Commit de T8.** As mudanças estão na árvore de trabalho, não commitadas, por instrução
   explícita.
4. **Passagem de `READY_FOR_HUMAN_REVIEW` para `DONE`.** Nenhum executor a faz.

O `BUILD REPORT` completo de T8 está na seção 3.3 e é a fonte primária de execução daquela tarefa.
Nem este documento nem qualquer resultado de revisão é aprovação humana.
