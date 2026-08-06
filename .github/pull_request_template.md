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
- [ ] Vermelho usado só para erro ou ação destrutiva
- [ ] Escrita disparada pelo chat pede confirmação explícita

## Validação

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Os quatro estados de tela verificados (carregando, erro, vazio, conteúdo)
- [ ] Testado em iOS
- [ ] Testado em Android
