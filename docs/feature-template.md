# FDD — [Nome da funcionalidade]

> Copie este arquivo para `docs/features/NNN-slug.md` ao iniciar uma feature.
> Preencha a Definition of Ready **antes** de escrever código.

## Cabeçalho

| | |
|---|---|
| Feature | |
| Slug | |
| Milestone | M? (ver `roadmap.md`) |
| Telas | rotas de `app/` afetadas |
| Endpoints | rotas de `docs/api-contract.md` consumidas |
| Depende de | |

## Objetivo e não objetivos

O que esta feature resolve, em uma frase, do ponto de vista do usuário.

**Não objetivos** — o que explicitamente fica de fora, para evitar escopo silencioso.

## Jornada e interface

O caminho do usuário, passo a passo. Onde ele entra, o que vê, o que faz, onde termina.
Descreva os **quatro estados** de cada tela: carregando, erro, vazio e conteúdo.

## Contrato

- **Endpoints:** método, rota, request, response. Se algum não existe ainda, especifique-o em
  `docs/api-contract.md` antes de começar — não invente formato aqui.
- **Tipos:** o que muda em `src/api/types.ts`.
- **Chaves de cache:** quais chaves esta feature lê e quais invalida.
- **Unidades:** confirme que todo valor monetário é centavo inteiro e toda taxa é basis point.

## Requisitos funcionais

IDs estáveis. Um requisito nunca é renumerado — se sair de escopo, marque como removido e
mantenha o número.

- **RF-001** —
- **RF-002** —

## Guardrails desta feature

Quais itens de `docs/guardrails.md` esta feature pressiona, e como ela os respeita.
Se a feature parece exigir uma exceção, isso é assunto de ADR, não de decisão local.

## Definition of Ready

- [ ] Objetivo e não objetivos escritos.
- [ ] Todos os endpoints consumidos estão especificados em `docs/api-contract.md`.
- [ ] Estados de erro e de vazio definidos, não só o caminho feliz.
- [ ] Guardrails aplicáveis identificados.
- [ ] Copy em pt-BR revisada contra o vocabulário de `docs/domain.md`.

## Definition of Done

- [ ] `npm run typecheck`, `npm run lint` e `npm test` passam.
- [ ] Os quatro estados implementados e verificáveis.
- [ ] Nenhum valor monetário calculado no cliente.
- [ ] Nenhum dado financeiro ou pessoal em log, analytics ou mensagem de erro.
- [ ] Alvo de toque de 48pt e `accessibilityLabel` em controle sem texto.
- [ ] Testado em iOS e Android.
- [ ] Documentos canônicos afetados atualizados no mesmo commit.

## Riscos e modos de falha

O que pode dar errado, e o que o produto faz quando dá.
