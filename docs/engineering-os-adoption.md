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
- **Feature Contracts:** `docs/features/`; F-010 está em `SPEC_IN_PROGRESS`, portanto não é
  elegível para planejamento ou implementação.
- **Status derivado:** `docs/inventario.md`; o M10 fechou seus quatro débitos em 19/08/2026 e o
  M13 segue parcialmente entregue, conforme o roadmap.

## Critérios de conformidade

- Contextos global e de projeto acessíveis.
- Adaptadores sem contradição conhecida com a Core.
- Fontes de trabalho, status e arquitetura identificadas.
- Lifecycle de feature documentado e Feature Contracts descobertos pelo planner.
- Perfis conhecidos: `typecheck`, `lint`, `test`, `bundle:check`, `palette:check`, `digits:check` e `pytest`.
- Gates humanos de produção, banco, segurança, arquitetura e validação em device preservados.
- Nenhum artefato de usuário de origem desconhecida foi alterado durante a adoção.

## Baseline de validação — 19/08/2026

| Perfil | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test -- --runInBand --watchman=false` | 441 testes / 40 suítes passaram |
| `npm run bundle:check` | passou |
| `npm run palette:check` | passou — 54 pares, 48 passam, 6 exceções declaradas |
| `npm run digits:check` | passou |
| `backend/venv/bin/pytest` | 497 testes passaram em SQLite |

Os perfis conhecidos passaram de quatro para **seis** com o fechamento do M10: `palette:check` e
`digits:check` entraram como gate (ADR 0018). O baseline anterior, de 17/08/2026, era 328 Jest /
35 suítes e 480 pytest.

O Watchman não pôde criar estado local no ambiente de execução; desativá-lo não altera a
configuração do projeto. Permanecem avisos conhecidos de `act(...)` e handles abertos no Jest, e
14 avisos no pytest. A suíte contra Postgres e a validação em device continuam obrigatórias antes
de release quando aplicáveis.

## Política atual de CI

Não há CI versionado nem evidência de CI externo. Os gates locais e sua evidência no PR são
obrigatórios até decisão humana em contrário.

## Reavaliação

Repita a adoção quando a Engineering OS mudar de modo incompatível, quando uma fonte de verdade
for substituída ou quando um conflito material de status, contrato ou validação surgir.
