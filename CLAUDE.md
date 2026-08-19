# CLAUDE.md

Instruções específicas para o Claude Code neste repositório.

## Engineering OS

Este repositório adota a Engineering OS. Antes de qualquer trabalho, carregue o contexto global
em `/Users/danielcampos/workspace/engineeringOS/`: `README.md`, princípios, guardrails,
Definition of Done e o contrato de agente aplicável. A Engineering OS define os gates humanos e
o ciclo de vida; este repositório define seus documentos canônicos, arquitetura e comandos.

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

## `backend/` faz parte do repositório

Agentes desenvolvem o backend também. O que muda em relação ao front é o rigor exigido:

> **Nenhuma regra financeira é inventada.** Toda regra em `backend/domain/` leva a FONTE no
> docstring (artigo de lei, decreto, ou o contrato do próprio usuário). Regra sem fonte
> devolve `None`, e o app exibe "ainda não calculado" — que é a verdade. O `valorCobrado * 1.1`
> que existia aqui é o exemplo do que não fazer: um número inventado que o usuário poderia
> levar para uma negociação real.

Ler `docs/backend.md` antes de tocar em `backend/`. Mudança de contrato atualiza
`docs/api-contract.md` no mesmo commit. `backend/venv/` continua fora do versionamento.

## Claude Code

- Preserve alterações existentes e trate mudanças desconhecidas como trabalho do usuário.
- Não use subagentes nem paralelize edições no mesmo worktree sem solicitação explícita ou
  coordenação clara de arquivos.
- Rode `npm run typecheck` antes de encerrar. Se houver lint e testes configurados, rode-os
  também (ver `docs/engineering-conventions.md`).
- Antes de encerrar, informe arquivos alterados, validações executadas e pendências.
- Documentação desatualizada é fonte de alucinação. Mudou a estrutura de pastas, um token de
  design ou o contrato de um endpoint? Atualize o doc correspondente **no mesmo commit**.
