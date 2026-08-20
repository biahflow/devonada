# Contribuindo

Leia `docs/agent-guidelines.md` antes de alterar código. Ele traz a ordem de precedência dos
documentos canônicos, os princípios inegociáveis e a Definition of Done.

Convenções de código, nomenclatura e commits estão em `docs/engineering-conventions.md`.
Regras de produto e segurança que nenhuma conveniência supera estão em `docs/guardrails.md`.

Antes de abrir pull request, os seis gates precisam passar: `npm run typecheck`,
`npm run lint`, `npm test`, `npm run bundle:check`, `npm run palette:check` e
`npm run digits:check`. Não desative verificação de qualidade para concluir uma tarefa.

`palette:check` mede os pares de cor declarados em `scripts/paleta-check.mjs` contra
`src/theme/theme.ts`, em WCAG 2.1 e CIEDE2000, e é ele que impede a medição de envelhecer em
silêncio quando um hex muda (ADR 0018). Combinação de cor nova entra na lista **no mesmo commit**
em que aparece na tela.

`digits:check` lê a tabela `hmtx` dos TTF das fontes do app e confere que a escala do número em
coluna (`typography.numeric`) não ficou dependendo de uma família de dígitos proporcionais sem
pedir `tabular-nums`. Mesma lição do anterior, aplicada à tipografia.

Eles provam que o código compila, tipa, que as telas renderizam e reagem, que as cores passam o
piso de contraste e que a coluna de valores não dança por causa da fonte. **Não** provam que a
interface está legível ou cabe no aparelho — isso continua exigindo abrir o app num device.
Mudança de estrutura, token de design ou contrato de API atualiza o documento correspondente
**no mesmo commit**.

O backend está em `backend/` (FastAPI + Postgres) — ver `docs/backend.md` para subir e
`docs/api-contract.md` para o contrato. Regra financeira sem fonte citável não entra: devolve
`None` e o app exibe "ainda não calculado".
