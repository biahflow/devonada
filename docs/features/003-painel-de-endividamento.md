# FDD — Painel de endividamento

## Cabeçalho

| | |
|---|---|
| Feature | Painel de endividamento |
| Slug | `painel-de-endividamento` |
| Milestone | M2 (ver `roadmap.md`) |
| Telas | `app/(tabs)/painel/index.tsx`, `painel/renda.tsx` |
| Endpoints | `GET /v1/dividas/resumo`, `GET/PUT /v1/perfil` |
| Depende de | M1 (dívidas cadastradas para agregar) |

## Objetivo e não objetivos

Responder a pergunta que o usuário realmente faz — **"quão ruim está?"** — com números que ele
não precisa calcular: total devido, quanto da renda está comprometido, onde a dívida está
concentrada, o que vence primeiro e para onde a curva aponta.

**Não objetivos:**

- **Calcular qualquer coisa no cliente.** Todo agregado vem do backend. Se o front precisar somar
  para exibir, o endpoint está incompleto.
- **Simular cenários.** Isso é M4.
- **Julgar.** O painel descreve a situação; não repreende quem chegou nela.

## Jornada e interface

O usuário abre a aba Painel e vê o mês corrente. Total devido em destaque, juros médios e quitado
no ano lado a lado, comprometimento de renda com o limite marcado, distribuição por criticidade,
evolução do saldo e próximos vencimentos. As setas navegam entre meses; o futuro é bloqueado.

Quando a renda ainda não foi informada, o bloco de comprometimento vira um convite com ação
direta para `painel/renda` — o convite tem destino, que era a lacuna do contrato original.

**Os quatro estados:**

| Estado | Painel | Renda |
|---|---|---|
| Carregando | `LoadingState` "Somando tudo" | `LoadingState` |
| Erro | `ErrorState` com retry | `ErrorState` com retry |
| Vazio | distingue "sem dívidas" de "nada neste mês", com ações diferentes | — |
| Conteúdo | cartões, medidor e gráficos | formulário |

## Contrato

- **Endpoints:** `docs/api-contract.md`, seção M2.
- **Tipos:** `ResumoDividas`, `PerfilFinanceiro`, `TotalPorCriticidade`, `VencimentoProximo`,
  `PontoEvolucao` em `src/api/types.ts`.
- **Chaves de cache:** `['dividas', 'resumo', mes]` vive **dentro** do prefixo `['dividas']`, então
  as mutações do M1 já revalidam o painel — `useQuitarDivida` não precisa saber que ele existe.
  `usePerfil` usa `['perfil']` e invalida os dois na escrita.
- **Unidades:** centavos para dinheiro, basis points para percentual, contagem para quantidade.

## Requisitos funcionais

- **RF-001** — O painel exibe o total devido como número protagonista, com a contagem de dívidas.
- **RF-002** — Todo valor exibido vem calculado do backend. Nenhuma soma, média ou percentual é
  produzido no cliente.
- **RF-003** — Campo ausente exibe "ainda não calculado", **nunca R$ 0,00**.
- **RF-004** — Sem renda informada, o bloco de comprometimento convida a preencher, com ação.
- **RF-005** — O comprometimento é exibido em medidor com o limite saudável (30%) marcado.
- **RF-006** — Acima do limite, o estado é anunciado por **ícone e texto**, não só por cor, e usa
  `warning` — nunca `danger`.
- **RF-007** — A distribuição por criticidade usa um tom só; a identidade vem do badge.
- **RF-008** — O gráfico de evolução trata série vazia e de um ponto só sem quebrar.
- **RF-009** — O eixo do gráfico começa na base; nada de eixo truncado.
- **RF-010** — As setas navegam entre meses e **bloqueiam o futuro**.
- **RF-011** — O estado vazio distingue "nenhuma dívida" de "nada neste mês".
- **RF-012** — A tela de renda coleta renda em centavos inteiros e dependentes.
- **RF-013** — Salvar a renda revalida o resumo, porque o comprometimento muda.
- **RF-014** — Vencimento atrasado é sinalizado com `warning` e a palavra "atrasada"; a situação
  vem do backend, não de comparação de data no cliente.

## Guardrails desta feature

| Guardrail | Como é respeitado |
|---|---|
| 1.2 Sem valor derivado | Nenhum `reduce` nem soma. `src/util/grafico.ts` é geometria, não finança |
| 2 Egress único | `resumo.ts` e `perfil.ts` sobre `request` |
| 4 Tom anti-ansiedade | `danger` não aparece no painel; atraso e excesso são `warning` |
| 5 LGPD | Renda não vai para log nem mensagem de erro |
| 6 Multi-tenant | Nenhum parâmetro de tenant |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Lacuna do contrato (perfil de renda) identificada e especificada antes do código.
- [x] Paleta de gráfico **validada por script**, não estimada.
- [x] Estados de erro, vazio e de série sem histórico definidos.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint` e `npm test` passam (94 testes).
- [x] Os quatro estados implementados nas duas telas.
- [x] Nenhum valor calculado no cliente.
- [x] Nenhum dado de renda em log.
- [x] Alvo de 48pt nas setas de mês e `accessibilityLabel` nelas.
- [ ] **Testado em iOS e Android** — depende dos endpoints do backend.
- [x] Documentos canônicos atualizados no mesmo commit.

## Riscos e modos de falha

- **Nada é verificável em runtime.** Nem `/v1/dividas/resumo` nem `/v1/perfil` existem. Terceiro
  milestone seguido nessa condição.
- **`evolucaoSaldo` virá vazio por meses.** Precisa de histórico acumulado; o gráfico exibe uma
  frase explicando em vez de uma área em branco.
- **O seletor de mês devolve vazio na maioria dos meses** enquanto não houver histórico. Por isso
  o estado vazio distingue os dois casos.
- **`react-native-svg` é módulo nativo** e é a única dependência nova do milestone.
