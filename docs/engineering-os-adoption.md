# Engineering OS — adoção do devo.nada

## Status

`ENGINEERING_OS_COMPLIANT` contra a Engineering OS `v0.1.0`, **reverificado em 26/08/2026**.

A adoção de 17/08/2026 não sobreviveu à exigência de alcançabilidade que a camada global passou
a fazer depois: a única referência ao contexto global era um caminho absoluto da máquina do
operador, e ele morreu em silêncio quando o diretório mudou de lugar. O espelho vendorizado
fecha essa lacuna ([ADR 0012](adr/0012-camada-global-vendorizada-e-pinada-por-tag.md)); avançar
o pino é mudança revisada, nunca automática.

**Aprovado por humano em 17/08/2026.** Esta classificação descreve a estrutura operacional do
repositório; não declara ausência de bugs, dívida técnica ou validação pendente em device.

## Escopo e evidência

- **Contexto global:** vendorizado e pinado em
  [`engineering-os/`](engineering-os/PROVENANCE.md) na tag `v0.1.0`, referenciado por
  `AGENTS.md`, `CLAUDE.md`, `README.md` e este documento.
- **Contexto do projeto:** `docs/agent-guidelines.md` e seus documentos canônicos.
- **Roadmap do produto/front:** `roadmap.md`.
- **Fila do backend:** `docs/api-contract.md`, seção 4.
- **Feature Contracts:** `docs/features/`; **F-011 e F-012 estão em `READY_FOR_BUILD` desde
  20/08/2026**, cada uma com `plan.md` de seis tarefas congelado e seis Task Contracts em `tasks/`.
  O `ARCHITECTURE_DECISION_REQUIRED` do F-011 caiu no mesmo dia: o `PF-4` nomeava que a ADR 0021
  não desempatava entre renda bruta e líquida como base do compromisso percentual, e o usuário
  decidiu pela **líquida**, registrada na Nota de desempate da ADR. O Planner nomeou a decisão; não
  a tomou. As duas executam em paralelo, com a coordenação da cadeia Alembic registrada como
  `PLAN_DEVIATION` nos dois planos.
  F-010 está em `READY_FOR_HUMAN_REVIEW` desde
  20/08/2026 — as oito tarefas foram executadas em sequência e os sete perfis passam. Antes disso
  ele foi `READY_FOR_BUILD` em 19/08/2026, quando a ADR 0019 fechou as quatro incógnitas que o
  prendiam em `SPEC_IN_PROGRESS` e as duas decisões restantes (PF-1 e PF-2) mais a aprovação do
  plano vieram na mesma data. O plano de execução vive em `docs/features/F-010-respiro/plan.md`,
  congelado, com oito Task Contracts em `tasks/` e três `PLAN_DEVIATION` ratificadas; a evidência
  consolidada, em `docs/features/F-010-respiro/evidence.md`. **O que falta para `DONE` é o gate
  humano de validação em device**, que nenhum agente declara satisfeito.
- **Status derivado:** `docs/inventario.md`; o M10 fechou seus quatro débitos em 19/08/2026, o M11
  fechou em 20/08/2026 aguardando device, e o M13 segue parcialmente entregue, conforme o roadmap.

## Critérios de conformidade

- Contextos global e de projeto acessíveis.
- Adaptadores sem contradição conhecida com a Core.
- Fontes de trabalho, status e arquitetura identificadas.
- Lifecycle de feature documentado e Feature Contracts descobertos pelo planner.
- Perfis conhecidos: `typecheck`, `lint`, `test`, `bundle:check`, `palette:check`, `digits:check` e `pytest`.
- Gates humanos de produção, banco, segurança, arquitetura e validação em device preservados.
- Nenhum artefato de usuário de origem desconhecida foi alterado durante a adoção.

## Baseline de validação — 27/08/2026 (fechamento do F-011)

Medida no fechamento do F-011 (renda tipada e compromisso percentual, T1–T6), executada na worktree
da feature, com a árvore incluindo as suítes das próprias tarefas. **É esta linha que vale como
baseline do próximo trabalho.**

| Perfil | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` (jest, `--forceExit`) | **48 suítes / 589 testes** passaram |
| `npm run bundle:check` | passou |
| `npm run palette:check` | passou — nenhum token de cor tocado no F-011 |
| `npm run digits:check` | passou — nenhuma fonte tocada |
| `backend/venv/bin/pytest` | **698 testes** passaram em SQLite, com **27 avisos** |

Baseline de ENTRADA do F-011 (em `main`, antes da feature, medido em 27/08/2026): **46 suítes / 541
Jest** e **662 pytest**. A feature acrescentou **2 suítes e 48 testes Jest** (`renda.test.tsx` e
`renda-tipada-copy.test.tsx`) e **36 pytest**. Os avisos do pytest foram de 23 para 27 sem classe
nova: são quatro ocorrências a mais do `HTTP_422_UNPROCESSABLE_ENTITY` depreciado, emitidas pelo
`422` novo de `PUT /v1/caixa/metas` — o contrato mandava copiar o registro exato do respiro, que usa
essa constante.

**Nota de ambiente:** o `python3` do sistema é 3.9, abaixo do que o `requirements.txt` exige (≥3.10),
e o `pysqlite3==0.6.0` não compila contra o SQLite dessa máquina. O venv foi criado com Python 3.12
via `uv`, e `pysqlite3` foi omitido da instalação — ele não é importado por teste nenhum, e o
dialeto `sqlite+pysqlite` usa o `sqlite3` da stdlib. `requirements.txt` **não** foi modificado.
Postgres **não** foi executado nesta worktree; continua obrigatório antes do release.

## Baseline de validação — 20/08/2026

Medida no fechamento do M11 (F-010, T8), com a árvore em `main` e as duas suítes de teste da
própria T8 já dentro do número. Baseline histórica; a linha vigente é a de 27/08/2026 acima.

**Remedida em 20/08/2026 ao planejar F-011 e F-012**, com a árvore limpa em `38a69d3`: `npx jest`
deu **45 suítes / 539 testes** e `venv/bin/pytest` deu **620 testes com 23 avisos** — idêntico à
tabela abaixo, campo a campo. Ao contrário do que aconteceu ao planejar o F-010 (`PF-9` daquele
plano), a baseline documentada **não** estava defasada e não precisou de correção. A cabeça da
cadeia Alembic foi confirmada em `116f2181bdda` por `alembic heads`.

| Perfil | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test -- --runInBand --watchman=false --forceExit` | 45 suítes / 539 testes passaram |
| `npm run bundle:check` | passou |
| `npm run palette:check` | passou — 56 pares, 49 passam, 7 exceções declaradas, 0 reprovam |
| `npm run digits:check` | passou |
| `backend/venv/bin/pytest` | 620 testes passaram em SQLite, com 23 avisos |

Baseline de ENTRADA do M11, para o `BASELINE → CHANGE → FINAL` do milestone ficar legível:
42 suítes / 472 Jest e 497 pytest, medidos em 19/08/2026. O M11 acrescentou **3 suítes, 67 testes
Jest e 123 pytest**. Os avisos do pytest foram de 21 para 23 sem classe nova: são duas ocorrências
a mais do `HTTP_422_UNPROCESSABLE_ENTITY` depreciado, emitidas pelos dois testes novos de T8 que
exercitam a recusa do simulador.

Os perfis conhecidos passaram de quatro para **seis** com o fechamento do M10: `palette:check` e
`digits:check` entraram como gate (ADR 0018). Baselines anteriores: 17/08/2026, 328 Jest / 35
suítes e 480 pytest; 19/08/2026, 472 Jest / 42 suítes e 497 pytest.

A linha do Jest já foi **remedida** uma vez, ao planejar o F-010, e corrigida de 441 / 40 para
472 / 42: o número anterior fora registrado antes dos últimos commits do M10, que trouxeram suítes
novas (`PF-9` do plano). Baseline copiada é baseline que envelhece em silêncio — e uma baseline
errada faz o Builder atribuir à própria mudança um teste que já existia. Por isso o número desta
tabela sai sempre de execução, nunca de outro documento.

O Watchman não pôde criar estado local no ambiente de execução; desativá-lo não altera a
configuração do projeto. Permanecem avisos conhecidos de `act(...)` e handles abertos no Jest, e
23 avisos no pytest — `HTTP_422_UNPROCESSABLE_ENTITY` depreciado, Starlette/httpx e
`InsecureKeyLength` do JWT de teste. **Os handles abertos têm efeito visível:** o Jest imprime o
resumo em ~13s e depois não encerra o processo (`PF-10` do plano F-010). Quem não souber disso vai
concluir que a suíte travou e matá-la antes de ler o resultado; `--forceExit` é o contorno usado na
medição acima. A suíte contra Postgres e a validação em device continuam obrigatórias antes
de release quando aplicáveis.

## Baseline de validação — F-012 (27/08/2026)

Medida no fechamento do F-012 (negociação por canal), na worktree do agente Builder, ramificada de
`main` **antes** do merge do F-011 — logo, estes números refletem `main + F-012`, não F-011. Sai de
execução, não de outro documento.

| Perfil | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` | **48 suítes / 558 testes** passaram |
| `npm run bundle:check` | passou — bundle iOS exportado |
| `npm run palette:check` | passou — 0 reprovam |
| `npm run digits:check` | passou |
| `backend/venv/bin/pytest` | **685 testes** passaram em SQLite, com 23 avisos (mesmas classes) |

Delta sobre a baseline de 20/08 (45 / 539 Jest e 620 pytest): **+3 suítes, +19 testes Jest** (a
suíte de `renegociar`, a de copy de negociação, e a expansão da de revisão) e **+65 pytest**
(`test_script.py` de T1, `test_negociacoes_api.py` de T3, e os testes de canal/copy/regressão em
`test_revisao*.py` e `test_caixa_integracao.py`). Os 23 avisos do pytest são as mesmas três classes
da baseline — nenhuma nova.

Cabeça da cadeia Alembic confirmada por `venv/bin/alembic heads` em `75331c212261` no início da
T3; a migração `a1c2e3f40b5d` encadeou nela. **Ambiente:** o `venv` foi recriado com Python 3.12
(o `requirements.txt` pina `alembic==1.19.0`, que exige `>=3.10`; o Python do sistema era 3.9), e
`pysqlite3` foi omitido da instalação por não compilar contra os headers de SQLite da máquina — a
suíte usa o dialeto `sqlite+pysqlite` do stdlib, que não depende dele. **Postgres indisponível na
máquina:** o round-trip da migração foi feito contra SQLite, em isolamento (carimbando o pai), com
o DDL conferido campo a campo contra `orm.ResultadoNegociacao.__table__`. Round-trip contra
Postgres e validação em device continuam obrigatórios antes de release.

## Política atual de CI

Não há CI versionado nem evidência de CI externo. Os gates locais e sua evidência no PR são
obrigatórios até decisão humana em contrário.

## Reavaliação

Repita a adoção quando a Engineering OS mudar de modo incompatível, quando uma fonte de verdade
for substituída ou quando um conflito material de status, contrato ou validação surgir.
