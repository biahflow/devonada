# Roadmap — front do Buddy Financeiro

> Atualizado em 06/08/2026. Sequência de construção, **não cronograma**.
> Escopo: o cliente Expo / React Native. O backend é desenvolvido separadamente; o que cada
> milestone exige dele está em `docs/api-contract.md`.
> Marcações: `[x]` entregue · `[~]` parcial · `[ ]` pendente.
> Princípio de ordem: **contrato e fundação antes de tela bonita.** Toda tela de dívida depende
> de um endpoint que ainda não existe — construir a tela primeiro só produz mock que mente.
>
> **A fila de trabalho do backend é `docs/api-contract.md`, seção 4.** Este documento não a
> repete: duas listas da mesma coisa divergem em uma semana.
>
> "Entregue" aqui significa **código pronto e gates verdes**, não validado em device. O que foi
> visto funcionando de verdade está marcado explicitamente, tela a tela — os gates automáticos
> provam que a tela renderiza e reage, **não** que ela está legível ou cabe na tela.

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

- [x] **Validado em device.** As três abas navegam, a fonte Inter carregou e a safe area é
      respeitada.

**Saiu com:** navegação de três abas sobre o design system portado, `typecheck`, `lint` e
`test` verdes, e o `CurrencyInput` provado por teste.

---

## M1 — CRUD de dívidas — front entregue, aguardando backend

A prioridade declarada. Primeira vez que `src/api/debts.ts` sai do limbo.
Spec completa em `docs/features/001-crud-de-dividas.md`.

- [x] `src/api/debts.ts` expandido: `getDebt`, `updateDebt`, `quitarDebt`, `deleteDebt`.
- [x] `Divida` com os campos novos (`situacao`, `saldoDevedor`, `taxaJurosMensal`,
      `totalParcelas`, `parcelasPagas`, `proximoVencimento`), **todos opcionais** — o front
      tolera o backend atual e exibe "ainda não calculado" em vez de zero.
- [x] Hooks em `src/hooks/useDividas.ts`, com a invalidação declarada dentro de cada mutação.
- [x] **Lista** com credor, valor, `CriticidadeBadge` e vencimento; ordenação por prioridade,
      valor e vencimento (`src/util/dividas.ts`, função pura e testada).
- [x] **Detalhe** com `possivelPrescricao` como alerta para investigar, disclaimer jurídico e
      ações de editar, quitar e excluir.
- [x] **Cadastro e edição** compartilhando `DividaForm`, com `CurrencyInput`, `DateField`,
      `OptionGroup` e `PercentInput` opcional.
- [x] Quitação e exclusão com confirmação nativa. (`guardrails.md`, seção 7.2)
- [x] Estado vazio que convida ao primeiro cadastro.
Validação em device, tela a tela:

- [x] **Lista** — carrega do backend e exibe as dívidas.
- [~] **Cadastro** — `POST /v1/dividas` corrigido (`id: str`), ainda não exercitado no app.
- [ ] **Detalhe** — depende de `GET /v1/dividas/{id}`.
- [ ] **Edição** — depende de `PATCH /v1/dividas/{id}`.
- [ ] **Quitação e exclusão** — dependem de `POST .../quitacao` e `DELETE`.

Fila do backend em `docs/api-contract.md`, seção 4, Bloco 1.

**Sai com:** cadastrar, ver, editar, quitar e excluir uma dívida ponta a ponta contra o backend
real, com os quatro estados verificáveis em cada tela. **Ainda não fechado** — o front está
pronto; falta o backend.

---

## M1.5 — Ingestão de contrato — front entregue, aguardando backend

O atalho que torna o M1 usável de verdade: em vez de digitar credor, valor, data e taxa, o
usuário manda o contrato e confere o que foi lido. Spec em
`docs/features/002-ingestao-de-contrato.md`.

Também é o que torna o `valorJusto` defensável — contrato de consignado carrega CET, IOF, tarifa
de cadastro e seguro prestamista embutido, que é exatamente onde mora a cobrança indevida.

- [x] `upload()` multipart dentro de `src/api/client.ts` — o egress segue único, e documento
      sensível é o último lugar para abrir exceção.
- [x] `src/api/contratos.ts` com `CampoExtraido<T>`: todo campo carrega valor, confiança e o
      **trecho literal** do contrato que o sustenta.
- [x] `useExtracao` com polling que para ao concluir, ao falhar e no teto de 2 minutos —
      polling infinito em rede móvel queima bateria.
- [x] `SeletorDeArquivo` com PDF, câmera e galeria; permissão pedida no contexto.
- [x] Tela de envio com o **aviso de descarte antes do upload** (ADR 0005).
- [x] Tela de revisão campo a campo, com trecho citado e alertas de cláusula.
- [x] `extracaoParaProposta` **descarta campo sem evidência**, mesmo trazendo valor.
- [x] ADR 0005 e seção 8 de `docs/guardrails.md` escritos antes do código.
- [ ] **Validação em device bloqueada.** Nenhum dos dois endpoints existe — fila em
      `docs/api-contract.md`, seção 4, Bloco 4.

**Sai com:** enviar um contrato real de consignado, acompanhar a leitura, revisar os campos com
os trechos citados e confirmar a criação da dívida. **Ainda não fechado** — falta o backend.

---

## M2 — Painel de endividamento — front entregue, aguardando backend

O que transforma uma lista num diagnóstico. Zero agregação no cliente: todo número vem de
`GET /v1/dividas/resumo`. Spec em `docs/features/003-painel-de-endividamento.md`.

- [x] `src/api/resumo.ts` + `useResumo(mes)`, com a chave dentro do prefixo `['dividas']` — as
      mutações do M1 revalidam o painel de graça.
- [x] **Lacuna do contrato resolvida:** `GET/PUT /v1/perfil` especificado e tela `painel/renda`
      construída. Sem endpoint de renda, o convite a preencher não tinha destino.
- [x] `StatTile` para o total devido, juros médios e quitado no ano. Ausência exibe "ainda não
      calculado", nunca zero.
- [x] `Meter` de comprometimento com o limite de 30% marcado. Acima do limite usa `warning` com
      ícone e texto — nunca `danger`, nunca cor sozinha.
- [x] Distribuição por criticidade e próximos vencimentos.
- [x] Gráfico de evolução em `react-native-svg`, série única, eixo na base, sem curva suavizada.
- [x] Seletor de mês com o futuro bloqueado.
- [x] **Paleta de gráfico validada por script, não estimada.** A proposta de uma cor por
      criticidade falhou no piso de distinção; a decisão e o motivo estão em
      `docs/design-system.md`, seção 4b.
- [ ] **Validação em device bloqueada.** Nenhum dos dois endpoints existe — fila em
      `docs/api-contract.md`, seção 4, Blocos 2 e 3.

**Sai com:** aba Painel exibindo apenas números vindos do backend — nenhuma soma, média ou
percentual calculado em TypeScript. **Ainda não fechado** — falta o backend.

---

## M3 — Plano de pagamento e lembretes — entregue, aguardando validação em device

Primeiro milestone em que o backend veio junto, e por isso o único que **fecha limitações
declaradas**: com parcelas reais, `comprometimentoRenda` deixou de ser aproximação e
`proximosVencimentos` deixou de voltar vazio.

- [x] Tela de cronograma (`app/dividas/[id]/plano.tsx`): parcelas com número, valor,
      vencimento e situação. "Atrasada" vem do backend — o front não compara datas, senão o
      fuso do aparelho vira fonte de divergência.
- [x] Marcar parcela como paga, com atualização otimista e rollback, invalidando `['dividas']`
      inteiro no sucesso (o resumo do painel também muda).
- [x] Registro de renegociação, preservando o histórico das parcelas anteriores.
- [x] `expo-notifications`: agendamento local a partir de `GET /v1/lembretes`, com o texto já
      formatado pelo backend. Permissão pedida **no contexto**, ao ativar o lembrete — nunca
      no primeiro boot.
- [x] Configuração de horário do lembrete pelo usuário. Nada dispara de madrugada.
- [x] Parcela quitada ganha destaque em `accent`. Atraso é `warning`, nunca `danger`.

- [x] O formulário passou a coletar número de parcelas e primeiro vencimento — sem os dois não
      havia de onde gerar cronograma.
- [ ] **Disparo do lembrete só você confirma.** Eu agendo e testo a lógica (hora válida,
      instante local, reagendamento); que a notificação toca na hora certa exige aparelho.

**Sai com:** parcela marcada como paga reflete no painel na mesma sessão, e o lembrete local
dispara na data e no horário escolhidos. **Ainda não fechado** — falta o device.

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
