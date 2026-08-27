# F-011 — Evidence

Evidência de execução da feature **Renda tipada e compromisso percentual**, plano em
[`plan.md`](plan.md), contrato em [`feature.md`](feature.md). Seis tarefas (T1–T6), executadas em
27/08/2026 na worktree da feature, em paralelo com o F-012 (coordenação da cadeia Alembic registrada
no `PLAN_DEVIATION` do plano).

Os `BUILD REPORT` completos, com atribuição por tarefa, vivem em [`reports/`](reports/) — este
documento os referencia, em vez de transcrevê-los, para não divergir da fonte:

| Tarefa | Report | Commit | Essência |
|---|---|---|---|
| T1 | [reports/T1.md](reports/T1.md) | `f28b755` (+ `413bc48`, `2804cc5`, `55ebdc6`) | A sétima linha na cascata, alíquota por fonte, `percentual_invade_o_piso`, migração `482c266f5c6a` e a tabela `evento_previsivel` |
| T2 | [reports/T2.md](reports/T2.md) | `43cf24b` | `domain/renda.py` (seis tipos), `imposto_nao_declarado`, mês âncora da renda típica |
| T3 | [reports/T3.md](reports/T3.md) | `8673371` | Compromisso percentual e o `422` do piso em `PUT /metas`; alíquota e dia por fonte; CRUD de evento previsível |
| T4 | [reports/T4.md](reports/T4.md) | `eb0f24c` | A tela de fonte que se adapta ao tipo; "não está reservando imposto" de `impostoNaoDeclarado` |
| T5 | [reports/T5.md](reports/T5.md) | `d3be20b` | `CompromissoCard` de dois estados; o mês âncora na leitura da renda típica |
| T6 | [reports/T6.md](reports/T6.md) | _este commit_ | Teste cruzado dos quatro consumidores, regressão gêmea, sweep de copy e os documentos canônicos |

## Validação integrada — fechamento (27/08/2026)

Medida na worktree da feature, com todas as suítes das tarefas dentro do número.

| Perfil | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` (jest, `--forceExit`) | **48 suítes / 589 testes** |
| `npm run bundle:check` | exit 0 |
| `npm run palette:check` | exit 0 — nenhum token de cor tocado |
| `npm run digits:check` | exit 0 — nenhuma fonte tocada |
| `backend/venv/bin/pytest` | **698 testes, 27 avisos** (SQLite) |

Baseline de ENTRADA (em `main`, antes da feature): **46 suítes / 541 Jest** e **662 pytest**. A
feature acrescentou 2 suítes / 48 testes Jest e 36 pytest. Os avisos do pytest subiram de 23 para 27
sem classe nova — quatro ocorrências a mais do `HTTP_422_UNPROCESSABLE_ENTITY` depreciado, do `422`
novo de `PUT /v1/caixa/metas`, que o contrato mandou copiar do registro do respiro.

**A ação a distância, provada:** `TestCompromissoNosQuatroConsumidores`
(`backend/tests/test_caixa_integracao.py`) prova que compromisso percentual declarado derruba os
QUATRO consumidores de `leitura.capacidade_atual` — simulador, `margemDisponivel`, card
`plano_sugerido` e a oferta do script de negociação — sem que nenhum dos quatro arquivos seja
tocado, e que o teto do simulador desce EXATAMENTE o compromisso. A regressão gêmea prova que quem
não declarou tem os quatro números idênticos aos de antes.

## Ambiente

O `python3` do sistema é 3.9, abaixo do que o `requirements.txt` exige; o `pysqlite3==0.6.0` não
compila nesta máquina. O venv foi criado com Python 3.12 via `uv`, sem `pysqlite3` — ele não é
importado por teste nenhum, e o dialeto `sqlite+pysqlite` usa o `sqlite3` da stdlib.
`requirements.txt` **não** foi modificado.

## PLAN_DEVIATION

- **Coordenação da cadeia Alembic (F-011 T1 × F-012 T3)** — registrada no plano em 20/08/2026:
  F-011 T1 escreveu a primeira migração (`482c266f5c6a`, encadeada em `116f2181bdda`); F-012 encadeia
  na cabeça que ela deixou. Sem impacto de escopo.
- **`impostoNaoDeclarado` na interface `Caixa` foi para T4, não T5** (ver `reports/T4.md`). T4-AC2
  exige que a tela de renda leia esse campo do servidor, e T4 depende de T3, não de T5. Os outros
  três campos da `Caixa` (`compromissoPercentualBps`, `compromissoPercentual`, `mesAncoraRenda`)
  seguiram para T5. Execução sequencial, sem conflito de merge.

## Gates humanos — ABERTOS

- **Validação em device** dos fluxos de T4 (tela de fonte por tipo) e T5 (card de compromisso e
  declaração): leitura, teclado sobre campo de valor, safe area, acessibilidade. Nenhum agente o
  declara satisfeito.
- **Suíte contra Postgres** antes do release — não executada nesta worktree.
- A migração e sua estratégia para o dado de `tipo` já existente em produção: a estratégia executada
  é a do plano — **nenhum dado migra**, todas as colunas nascem `nullable`, e quem não declarou nada
  tem os números de hoje campo a campo.
- A passagem de `READY_FOR_HUMAN_REVIEW` para `DONE`. Nenhum executor a faz.
