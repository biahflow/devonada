# Engineering OS — adoção do devo.nada

## Status

`ENGINEERING_OS_COMPLIANT`

**Aprovado por humano em 17/08/2026.** Esta classificação descreve a estrutura operacional do
repositório; não declara ausência de bugs, dívida técnica ou validação pendente em device.

## Escopo e evidência

- **Contexto global:** `/Users/danielcampos/workspace/engineeringOS/`, referenciado por
  `AGENTS.md` e `CLAUDE.md`.
- **Contexto do projeto:** `docs/agent-guidelines.md` e seus documentos canônicos.
- **Roadmap do produto/front:** `roadmap.md`.
- **Fila do backend:** `docs/api-contract.md`, seção 4.
- **Feature Contracts:** `docs/features/`; F-010 está em `READY_FOR_HUMAN_REVIEW` desde
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

## Baseline de validação — 20/08/2026

Medida no fechamento do M11 (F-010, T8), com a árvore em `main` e as duas suítes de teste da
própria T8 já dentro do número. É esta linha que vale como baseline do próximo milestone.

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

## Política atual de CI

Não há CI versionado nem evidência de CI externo. Os gates locais e sua evidência no PR são
obrigatórios até decisão humana em contrário.

## Reavaliação

Repita a adoção quando a Engineering OS mudar de modo incompatível, quando uma fonte de verdade
for substituída ou quando um conflito material de status, contrato ou validação surgir.
