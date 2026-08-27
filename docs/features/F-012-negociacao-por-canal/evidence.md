# F-012 — Evidence

O handoff de revisão da feature F-012 (negociação por canal e registro de resultado). Ele
**consolida referências; não substitui** os artefatos que aponta, e nenhum resumo aqui é mais
autoritativo que a fonte que resume.

Produzido a partir do [template global de evidência](../../engineering-os/templates/evidence.md), na
tarefa T6. Os seis `BUILD REPORT` estão **persistidos** em [`reports/`](reports/) — um por tarefa,
com a atribuição preservada, sem fundi-los num relato só.

## Round

```text
round: 1
reviewed_commit_or_state: branch worktree-agent-af6fb5c7594ac929c, ramificada de `main` @ 0a40164,
                          com T2 (048a4bd), T3 (7f864db), T4 (9b23081), T5 (81b3074) e T6
                          commitados. T1 já estava em `main` (977a00e).
authorization: plano F-012 aprovado e congelado em 20/08/2026 (ver `plan.md`, `human_gates`);
               execução em paralelo com F-011, por decisão humana da mesma data.
```

---

## 1. Contrato e plano

| Artefato | Onde |
|---|---|
| Feature Contract | [`feature.md`](feature.md) |
| Execution Plan (`PLAN_VALID`, congelado em 20/08/2026) | [`plan.md`](plan.md) |
| Task Contracts, T1 a T6 | [`tasks/`](tasks/) — `T1.md` … `T6.md` |
| Decisão de arquitetura | `docs/adr/0021-*.md` |
| Contrato de API | `docs/api-contract.md`, seção **3.15**, **Bloco 15**, e a M6 atualizada |
| Regras de produto que dominam a feature | `docs/guardrails.md`, seções 3 e **3.1** (anti-golpe, nova) |
| Design system | `docs/design-system.md`, verbete `ScriptCard` (promovido de "Ainda só especificação") |

Ordem de execução real: **T1 (em `main`) → T3 → T2 → T4 → T5 → T6**, sequencial, um agente por vez —
a ordem que o plano sugeria para execução sequencial, e que anula os `PARALLELISM_RISK` sobre
`backend/schemas.py` e `src/api/types.ts`.

---

## 2. BASELINE

Medida no início da execução, na worktree ramificada de `main` (não copiada de documento):

- `backend/venv/bin/pytest` → **662 testes**, 23 avisos, verdes (620 da baseline de 20/08 + 42 de
  T1, que já estava em `main`).
- `npm test` → **45 suítes / 539 testes** (idêntico à baseline de 20/08).
- `venv/bin/alembic heads` → **`75331c212261`** (cabeça única — a T1 do F-011 já a deixara; a T3
  encadeou nela, conforme o `PLAN_DEVIATION` de 20/08).

**Ambiente:** o `venv` foi recriado com Python 3.12 (o `requirements.txt` pina `alembic==1.19.0`,
que exige `>=3.10`; o Python do sistema era 3.9). `pysqlite3` foi omitido por não compilar contra
os headers de SQLite da máquina — a suíte usa o dialeto `sqlite+pysqlite` do stdlib, que não
depende dele. **Postgres indisponível na máquina.**

---

## 3. CHANGE — por tarefa

Cada `BUILD REPORT` completo está em `reports/T<n>.md`. Resumo da atribuição:

| Tarefa | Commit | O que entregou | Report |
|---|---|---|---|
| T1 | `977a00e` (em `main`) | `domain/script.py` — blocos tipados por canal, sem LLM; segurança abrindo/fechando os escritos | [`reports/T1.md`](reports/T1.md) |
| T3 | `7f864db` | `ResultadoNegociacao` + migração `a1c2e3f40b5d` + `POST`/`GET /v1/…/negociacoes` + `GET /v1/negociacoes` | [`reports/T3.md`](reports/T3.md) |
| T2 | `048a4bd` | `?canal` na rota, `script` vira `ScriptNegociacao` (mudança de forma), oferta sai do 1º contato escrito | [`reports/T2.md`](reports/T2.md) |
| T4 | `9b23081` | `ScriptCard` com seletor de canal e copiar por bloco; script exibido mesmo sem `valorJusto` | [`reports/T4.md`](reports/T4.md) |
| T5 | `81b3074` | Tela de renegociar com canal/desfecho tipados, quatro desfechos, histórico da dívida | [`reports/T5.md`](reports/T5.md) |
| T6 | (este commit) | Provas de copy nas 3 variantes, regex alinhado (PF-4), regressão PF-3, e os docs | [`reports/T6.md`](reports/T6.md) |

---

## 4. FINAL — gates no fechamento (27/08/2026)

| Perfil | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` | **48 suítes / 558 testes** passaram |
| `npm run bundle:check` | passou — bundle iOS exportado |
| `npm run palette:check` | passou — 0 reprovam |
| `npm run digits:check` | passou |
| `backend/venv/bin/pytest` | **685 testes**, 23 avisos (mesmas classes), verdes em SQLite |
| Migração T3 (round-trip) | `upgrade head` → `downgrade -1` → `upgrade head` verdes contra SQLite, em isolamento (pai carimbado); DDL conferido campo a campo contra `orm.ResultadoNegociacao.__table__` |

Delta sobre a baseline: +65 pytest (662 → 685) e +3 suítes / +19 Jest (45/539 → 48/558).

---

## 5. Gates humanos — ABERTOS (nenhum agente os declara satisfeitos)

- **Revisão da copy das três variantes por advogado** — gate de pré-lançamento. Esta feature
  triplicou a superfície de copy de negociação; o roadmap marca isso como o único item capaz de
  encerrar o produto em vez de atrasar um release. Os testes de copy pegam palavra proibida; **não**
  avaliam postura jurídica.
- **Validação em device** do `ScriptCard` com seletor de canal e da tela de registro por canal —
  leitura dos blocos, alvo de toque percebido, teclado, safe area, e a separação visual entre
  segurança e contestação. Nenhum gate automatizável prova isso.
- **Round-trip da migração contra Postgres** — não foi possível (Postgres indisponível na máquina);
  feito contra SQLite, obrigatório contra Postgres antes de release.
- A passagem de `READY_FOR_HUMAN_REVIEW` para `DONE` — decisão humana.

---

## 6. Limitações declaradas (não fingir sucesso)

- **Front dependente do backend em produção:** T2 mudou a forma do campo `script`; se o backend em
  produção não subir junto, o app quebra. É a natureza da mudança de contrato, declarada em T2.
- **`renegociacaoId` no acordo fica nulo:** o endpoint de renegociação devolve a `Divida`, não o id
  da `Renegociacao`; ligar os dois exigiria mudar aquele contrato, fora do escopo. Não impede o
  benchmark.
- **Números de `main + F-012`:** a worktree ramificou antes do merge do F-011. A integração dos dois
  no `main` pode ter conflito de merge em `backend/schemas.py` e `src/api/types.ts` (classes
  diferentes, sem interseção semântica) e nos docs derivados — previsto no `PARALLELISM_RISK` do
  plano.
