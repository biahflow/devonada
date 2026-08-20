## Resumo

O que muda, do ponto de vista do usuário.

## Documentação relacionada

- [ ] FDD em `docs/features/` — qual:
- [ ] ADR em `docs/adr/` — qual:
- [ ] `docs/api-contract.md` atualizado (contrato mudou)
- [ ] `docs/design-system.md` atualizado (token ou componente mudou)
- [ ] Nenhuma documentação afetada

## Impactos

- **Contrato de API:**
- **Tipos em `src/api/types.ts`:**
- **Dependências novas:**
- **Guardrails pressionados:**

## Guardrails

- [ ] Nenhum cálculo de valor monetário no cliente
- [ ] Dinheiro em centavos inteiros; taxa em basis points
- [ ] Nenhum `fetch` fora de `src/api/client.ts`
- [ ] Nenhum segredo novo com prefixo `EXPO_PUBLIC_`
- [ ] Nenhum dado financeiro ou pessoal em log, analytics ou mensagem de erro
- [ ] Vermelho é status de dívida, nunca cenário — e não há botão vermelho, nem para destruição
- [ ] Vermelho em texto usa `debtText`/`dangerText`; `debt`/`danger` só em objeto gráfico e no
      número protagonista (ADR 0018)
- [ ] Escrita disparada pelo chat pede confirmação explícita

## Validação

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run bundle:check`
- [ ] `npm run palette:check` — e toda combinação de cor nova entrou na lista de
      `scripts/paleta-check.mjs`
- [ ] `npm run digits:check` — e família de fonte nova entrou em `scripts/digitos-check.mjs`
- [ ] Tela nova tem teste em `src/test/screens/` cobrindo os quatro estados

Validação humana — os gates acima **não** substituem isto:

- [ ] Aberto em iOS
- [ ] Aberto em Android
- [ ] Layout, legibilidade e safe area conferidos em aparelho real
