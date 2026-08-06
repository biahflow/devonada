# CLAUDE.md

Instruções específicas para o Claude Code neste repositório.

## Leitura obrigatória

Antes de planejar, revisar ou alterar código, leia integralmente `docs/agent-guidelines.md`.
Esse documento é a fonte compartilhada de regras para Claude Code, Codex e qualquer outro
agente. Leia também os documentos canônicos da área afetada, conforme a ordem de precedência
declarada nele.

Não replique aqui regras compartilhadas. Quando uma convenção de engenharia, guardrail,
arquitetura, contrato de API ou Definition of Done mudar, atualize somente
`docs/agent-guidelines.md` e os documentos canônicos correspondentes.

**Mapas vivos (leia antes de tocar arquitetura, contrato ou visual):** `docs/architecture.md`,
`docs/guardrails.md`, `docs/api-contract.md`, `docs/design-system.md`, `docs/domain.md`.
Sequência de construção em `roadmap.md`.

## `backend/` não é seu

> O diretório `backend/` (FastAPI) é desenvolvido pelo dono do repositório. **Agentes não
> alteram nada dentro dele** — nem para consertar um bug óbvio, nem para destravar uma tela.
> Se o front precisa de um endpoint que não existe, ou se o backend diverge do contrato,
> especifique a necessidade em `docs/api-contract.md` e reporte. Não implemente.

O mesmo vale para `backend/venv/` e `backend/requirements.txt`.

## Claude Code

- Preserve alterações existentes e trate mudanças desconhecidas como trabalho do usuário.
- Não use subagentes nem paralelize edições no mesmo worktree sem solicitação explícita ou
  coordenação clara de arquivos.
- Rode `npm run typecheck` antes de encerrar. Se houver lint e testes configurados, rode-os
  também (ver `docs/engineering-conventions.md`).
- Antes de encerrar, informe arquivos alterados, validações executadas e pendências.
- Documentação desatualizada é fonte de alucinação. Mudou a estrutura de pastas, um token de
  design ou o contrato de um endpoint? Atualize o doc correspondente **no mesmo commit**.
