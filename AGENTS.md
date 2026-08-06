# AGENTS.md

Instruções específicas para o Codex e demais agentes de código neste repositório.

## Leitura obrigatória

Antes de planejar, revisar ou alterar código, leia integralmente `docs/agent-guidelines.md`.
Esse documento é a fonte compartilhada de regras para Codex, Claude Code e qualquer outro
agente. Leia também os documentos canônicos da área afetada, conforme a ordem de precedência
declarada nele.

Não replique aqui regras compartilhadas. Quando uma convenção de engenharia, guardrail,
arquitetura, contrato de API ou Definition of Done mudar, atualize somente
`docs/agent-guidelines.md` e os documentos canônicos correspondentes.

## Princípios inegociáveis (resumo — o texto completo está no rulebook)

1. O app **nunca calcula valor monetário**. Juros, correção, amortização e projeção vêm do
   backend. O front formata e exibe.
2. Dinheiro é **centavo inteiro** em todo lugar. Nunca float, nunca `Number` com decimal.
3. `src/api/client.ts` é o **único egress de rede** do app. Nenhum `fetch` fora dele.
4. Nenhum segredo no bundle. `EXPO_PUBLIC_*` é público por definição.
5. `backend/` é território do dono do repositório. Agentes não editam nada lá.
6. Sem número de fonte confiável, o assistente **não afirma** — ele diz que não sabe.
7. Tom anti-ansiedade: vermelho é exceção, não estética.

## Antes de abrir pull request

- `npm run typecheck` passa.
- Lint e testes aplicáveis passam (`docs/engineering-conventions.md`).
- Nenhuma verificação de qualidade foi desativada para concluir a tarefa.
- Doc afetado foi atualizado no mesmo commit.
- O template `.github/pull_request_template.md` está preenchido.

## Comandos locais

```bash
npm install
npm start           # Expo dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # jest
```
