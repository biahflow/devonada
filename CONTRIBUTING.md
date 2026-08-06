# Contribuindo

Leia `docs/agent-guidelines.md` antes de alterar código. Ele traz a ordem de precedência dos
documentos canônicos, os princípios inegociáveis e a Definition of Done.

Convenções de código, nomenclatura e commits estão em `docs/engineering-conventions.md`.
Regras de produto e segurança que nenhuma conveniência supera estão em `docs/guardrails.md`.

Antes de abrir pull request, `npm run typecheck` precisa passar — junto com `npm run lint` e
`npm test` a partir de M0. Não desative verificação de qualidade para concluir uma tarefa.
Mudança de estrutura, token de design ou contrato de API atualiza o documento correspondente
**no mesmo commit**.

O diretório `backend/` é desenvolvido pelo dono do repositório e não é alterado por agentes de
código. Necessidade de endpoint novo se registra em `docs/api-contract.md`.
