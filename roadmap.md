# Roadmap — front do Buddy Financeiro

> Atualizado em 06/08/2026. Sequência de construção, **não cronograma**.
> Escopo: o cliente Expo / React Native. O backend é desenvolvido separadamente; o que cada
> milestone exige dele está em `docs/api-contract.md`.
> Marcações: `[x]` entregue · `[~]` parcial · `[ ]` pendente.
> Princípio de ordem: **contrato e fundação antes de tela bonita.** Toda tela de dívida depende
> de um endpoint que ainda não existe — construir a tela primeiro só produz mock que mente.

---

## Base atual — entregue

- [x] App Expo / React Native / TypeScript com `strict` e `noUncheckedIndexedAccess`.
- [x] Chat single-screen (`App.tsx` → `ChatScreen`) com composer, lista e auto-scroll.
- [x] `src/api/client.ts` como único egress de rede: Bearer do `expo-secure-store`, JSON,
      `ApiError` tipada com `status 0` para falha de conexão.
- [x] Dinheiro em centavos inteiros com `formatBRL` (`src/util/money.ts`).
- [x] Tokens de design em `src/theme/theme.ts`.
- [x] `ActionCardData` como união discriminada, com `ValorJustoCard` e `InfoCard`.
- [x] Contrato de dívidas em `src/api/types.ts` e `src/api/debts.ts`.
- [~] `src/api/debts.ts` existe mas **não é importado por nenhuma UI**. É o ponto de partida
      de M1.
- [x] Repositório sob controle de versão.

---

## M0 — Fundação do front — entregue

Nada de dívidas ainda. Este milestone existe porque construir quatro telas sobre um
`App.tsx` single-screen sem navegação, sem cache e sem componentes de estado significa
reescrever tudo em M2.

- [x] Migrado para **expo-router** com a estrutura de rotas de `docs/architecture.md`, seção 3.
      Três abas: Chat · Dívidas · Painel. `App.tsx` removido; a entrada é `expo-router/entry`.
      (ADR 0001)
- [x] `react-native-safe-area-context` no lugar do `SafeAreaView` deprecado do `react-native`.
- [x] **TanStack Query**: `QueryClientProvider` em `app/_layout.tsx`, com a política de retry
      alinhada ao `ApiError` (nunca em `4xx`; até duas vezes em `0` e `5xx`). (ADR 0002)
- [x] Fonte **Inter** via `@expo-google-fonts/inter`, com fallback de sistema se o
      carregamento falhar.
- [x] `@expo/vector-icons` (Feather).
- [x] `src/theme/theme.ts` na paleta híbrida, com `shadow`, `fontFamily`, `display` e
      `eyebrow`. (ADR 0004, `docs/design-system.md`)
- [x] Componentes de `docs/design-system.md`: `Screen`, `PageHeader`, `Card`, `FormField`,
      `CurrencyInput`, `Feedback`, `LoadingState`, `EmptyState`, `ErrorState`, `Badge` /
      `CriticidadeBadge`, `MoneyText`. `Button` com `danger` e `ghost`.
- [x] ESLint + Prettier + Jest + React Native Testing Library, com scripts `lint` e `test`.
- [x] Testes: `formatBRL` (zero, centavo isolado, milhar, negativo, float acidental) e
      `CurrencyInput` (a garantia de que o valor emitido nunca é fracionário). 13 passando.
- [x] `.env.example` criado.

**Saiu com:** navegação de três abas sobre o design system portado, `typecheck`, `lint` e
`test` verdes, e o `CurrencyInput` provado por teste.

---

## M1 — CRUD de dívidas

A prioridade declarada. Primeira vez que `src/api/debts.ts` sai do limbo.

Depende de: `GET/PATCH/DELETE /v1/dividas/{id}`, `POST /v1/dividas/{id}/quitacao` e dos campos
novos de `Divida` (`situacao`, `saldoDevedor`, `taxaJurosMensal`, `totalParcelas`,
`parcelasPagas`, `proximoVencimento`) — `docs/api-contract.md`, seção 3.

- [ ] Expandir `src/api/debts.ts`: `getDebt`, `updateDebt`, `quitarDebt`, `deleteDebt`.
- [ ] Atualizar `Divida` em `src/api/types.ts` com os campos novos, **junto** com a atualização
      de `docs/api-contract.md`.
- [ ] Hooks: `useDividas`, `useDivida(id)`, `useCriarDivida`, `useAtualizarDivida`,
      `useQuitarDivida`, com invalidação declarada no próprio hook.
- [ ] **Lista** (`app/(tabs)/dividas/index.tsx`): item com credor, valor, `Badge` de
      criticidade, próximo vencimento. Ordenação por criticidade, valor e vencimento.
      Os quatro estados implementados.
- [ ] **Detalhe** (`app/(tabs)/dividas/[id].tsx`): valores, `possivelPrescricao` como alerta
      para investigar (nunca afirmação), ações de editar e quitar.
- [ ] **Formulário** (`app/(tabs)/dividas/nova.tsx`): credor, `CurrencyInput` para valor,
      seletor de data de origem, seletor de criticidade com a explicação de cada tipo vinda de
      `docs/domain.md`. Erro por campo a partir do `422`.
- [ ] Quitação e exclusão com diálogo de confirmação. (`guardrails.md`, seção 7.2)
- [ ] Estado vazio da lista que orienta o primeiro cadastro em vez de só dizer "sem dados".

**Sai com:** cadastrar, ver, editar, quitar e excluir uma dívida ponta a ponta contra o backend
real, com os quatro estados verificáveis em cada tela.

---

## M2 — Painel de endividamento

O que transforma uma lista num diagnóstico. Zero agregação no cliente: todo número vem de
`GET /v1/dividas/resumo`.

- [ ] `src/api/resumo.ts` + `useResumo()`.
- [ ] Cards de total devido, quantidade de dívidas, custo médio de juros e distribuição por
      criticidade.
- [ ] Comprometimento de renda e mínimo existencial. Quando a renda ainda não foi informada,
      o card convida a preencher — não exibe zero.
- [ ] Próximos vencimentos, com link para o detalhe da dívida.
- [ ] Gráfico de evolução do saldo devedor a partir de `evolucaoSaldo` (`react-native-svg` ou
      `victory-native`). Linha em `primary`, sem preenchimento vermelho, sem eixo invertido
      que dramatize a curva.
- [ ] `MoneyText` com `tabular-nums` em toda coluna de valores.

**Sai com:** aba Painel exibindo apenas números vindos do backend — nenhuma soma, média ou
percentual calculado em TypeScript.

---

## M3 — Plano de pagamento e lembretes

Depende de: `GET /v1/dividas/{id}/parcelas`, `POST /v1/parcelas/{id}/pagamento`,
`POST /v1/dividas/{id}/renegociacao`, `GET /v1/lembretes`.

- [ ] Tela de cronograma (`app/dividas/[id]/plano.tsx`): parcelas com número, valor,
      vencimento e situação. "Atrasada" vem do backend — o front não compara datas, senão o
      fuso do aparelho vira fonte de divergência.
- [ ] Marcar parcela como paga, com atualização otimista e rollback, invalidando `['dividas']`
      inteiro no sucesso (o resumo do painel também muda).
- [ ] Registro de renegociação, preservando o histórico das parcelas anteriores.
- [ ] `expo-notifications`: agendamento local a partir de `GET /v1/lembretes`, com o texto já
      formatado pelo backend. Permissão pedida **no contexto**, ao ativar o lembrete — nunca
      no primeiro boot.
- [ ] Configuração de horário do lembrete pelo usuário. Nada dispara de madrugada.
- [ ] Parcela quitada ganha destaque em `accent`. Atraso é `warning`, nunca `danger`.

**Sai com:** parcela marcada como paga reflete no painel na mesma sessão, e o lembrete local
dispara na data e no horário escolhidos.

---

## M4 — Simulador de quitação

Depende de: `POST /v1/dividas/simulacoes`. É o milestone que prova o ADR 0003 — a matemática de
amortização acontece no servidor, e o app continua sendo só a superfície.

- [ ] `src/api/simulacoes.ts` + `useSimulacao(params)`, com a chave de cache incluindo os
      parâmetros.
- [ ] Slider de aporte extra mensal, em centavos, com o valor exibido por `MoneyText`.
      `debounce` antes de disparar a chamada.
- [ ] Comparação **avalanche vs. bola de neve** lado a lado: meses até a quitação, total de
      juros, data de liberdade.
- [ ] A diferença entre as duas vem de `comparacao` no payload — o front não subtrai os dois
      resultados, porque isso seria replicar regra de negócio.
- [ ] Ordem de pagamento sugerida, dívida a dívida, com o mês previsto de quitação de cada uma.
- [ ] **Data de liberdade** como número de destaque, em `display` e `accent`.
- [ ] Copy que apresenta as duas estratégias sem eleger vencedora: a ótima no papel não vale
      nada se o usuário abandona o plano. (`docs/domain.md`, seção 4)
- [ ] Tratar o `422` de aporte que invade o mínimo existencial com uma explicação acolhedora,
      não com erro genérico.

**Sai com:** as duas estratégias comparadas na mesma tela, com a diferença em reais e em meses
explicitada, e nenhuma operação aritmética de amortização no código do app.

---

## M5 — Dívidas dentro do chat

Fecha o ciclo: o assistente deixa de ser um oráculo genérico e passa a falar sobre os dados
reais do usuário.

- [ ] Novos `kind` em `ActionCardData`: `divida_resumo` e `plano_sugerido`. O `switch` exaustivo
      do dispatcher `ActionCard` faz o compilador cobrar o tratamento.
- [ ] Deep link do card para a tela correspondente (`dividas/[id]`, `dividas/simulador`).
- [ ] Card que sugere criar ou alterar dívida abre o **formulário preenchido** para o usuário
      confirmar. Nenhuma escrita como efeito colateral de conversa. (`guardrails.md`, 7.2)
- [ ] Persistir o histórico do chat entre sessões (hoje `useChat` mantém tudo em memória).
- [ ] Verificar o guardrail na prática: nenhum número no `content` da mensagem sem card
      correspondente.

**Sai com:** o assistente responde sobre as dívidas do usuário com card tipado, e toda ação que
altera dado passa por confirmação explícita.

---

## Pós-MVP — direção, não compromisso

- **Ingestão de dados de Open Finance** — extrato, saldo e cartão alimentando o contexto do
  assistente. Ver `docs/data-ingestion.md`. É o que transforma o produto de "assistente de
  dívidas" em planejador financeiro, e é também o maior salto de complexidade e de risco.
- **Renda, orçamento e metas** — o outro lado do fluxo de caixa.
- **Onboarding, signup e billing** — o cliente já é multi-tenant, então não há retrofit de
  isolamento a fazer.
- **Offline-first** com storage cifrado. `AsyncStorage` cru está descartado por `guardrails.md`,
  seção 5.
- **Proteção contra screenshot** nas telas de dívida.
- **Acessibilidade auditada** com leitor de tela real, não só `accessibilityLabel` presente.

---

## Regra de sequência

Por que a ordem não é negociável:

- **M0 antes de tudo.** Migrar navegação e introduzir cache com quatro telas prontas custa
  mais que construí-las já na estrutura certa.
- **M1 antes de M2, M3 e M4.** Os três consomem endpoints que só fazem sentido depois que
  existir dívida persistida com `situacao`, `saldoDevedor` e `taxaJurosMensal`. Construir o
  painel primeiro produz uma tela alimentada por mock — bonita, e mentirosa.
- **M4 por último entre as features.** Um simulador sem dívidas reais é uma demo de calculadora.
  Com dívidas reais, é o argumento de valor do produto.
- **M5 depois de M1–M4.** O assistente só tem o que dizer quando existe dado sobre o que falar.
  Essa é exatamente a tese do produto: contexto contínuo é o que separa um oráculo de dicas de
  um planejador financeiro.
