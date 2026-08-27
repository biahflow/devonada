# AGENTS.md

Instruções específicas para o Codex e demais agentes de código neste repositório.

## Engineering OS

Este repositório adota a Engineering OS. A camada global está vendorizada e pinada em
[`docs/engineering-os/`](docs/engineering-os/PROVENANCE.md), alcançável do próprio checkout.
Antes de qualquer trabalho, carregue
[os princípios](docs/engineering-os/core/principles/engineering.md),
[os guardrails](docs/engineering-os/core/guardrails/git.md),
[a Definition of Done](docs/engineering-os/core/definition-of-done.md) e o contrato de agente
aplicável — [Planner](docs/engineering-os/agents/planner.md),
[Builder](docs/engineering-os/agents/builder.md) ou
[Reviewer](docs/engineering-os/agents/reviewer.md). A Engineering OS define os gates humanos e
o ciclo de vida; este repositório define seus documentos canônicos, arquitetura e comandos.

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
5. **Nenhuma regra financeira é inventada.** Toda regra em `backend/domain/` cita a fonte;
   sem fonte, devolve `None` e o app exibe "ainda não calculado".
6. Sem número de fonte confiável, o assistente **não afirma** — ele diz que não sabe.
7. Tom anti-ansiedade: vermelho é exceção, não estética.

## Antes de abrir pull request

- Os seis gates passam: `typecheck`, `lint`, `test`, `bundle:check`, `palette:check` e
  `digits:check`.
- Mexeu em cor? O par novo está declarado em `scripts/paleta-check.mjs`, e todo número de
  contraste que foi parar em documentação saiu da saída do script (ADR 0018).
- Mexeu em fonte? A família nova está em `scripts/digitos-check.mjs`. Largura de dígito é fato do
  arquivo da fonte — medida, nunca estimada nem adiada para "validação em aparelho".
- Nenhuma verificação de qualidade foi desativada para concluir a tarefa.
- Doc afetado foi atualizado no mesmo commit.
- O template `.github/pull_request_template.md` está preenchido.

## Comandos locais

```bash
npm install
npm start           # Expo dev server
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # jest — inclui os testes de tela
npm run bundle:check # expo export: prova que o grafo inteiro compila
npm run palette:check # WCAG 2.1 e CIEDE2000 dos pares declarados de src/theme/theme.ts
npm run digits:check  # largura de dígito lida da tabela hmtx dos TTF das fontes do app
```

Nenhum desses gates prova que a tela está legível ou cabe no aparelho. Isso exige validação
humana em device — não afirme que testou o que não dá para testar daqui.
