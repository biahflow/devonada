# Roadmap — front do Buddy Financeiro

> Atualizado em 06/08/2026. Sequência de construção, **não cronograma**.
> Escopo: o cliente Expo / React Native. O **backend faz parte do repositório** e é desenvolvido
> junto a partir do M3 — o que cada milestone exige dele está em `docs/api-contract.md`, que
> continua sendo a fila canônica. (M0–M2 foram construídos com o backend ainda por fazer, e é
> por isso que ainda esperam device.)
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
- [x] **Backend destravado no M5.** Os dois endpoints existem desde o M1.5, mas faltava chave de
      LLM. Com a camada de provedor (ADR 0007) e a chave da OpenAI, a leitura foi exercitada de
      ponta a ponta: um contrato sintético voltou com **trecho literal nos sete campos**, data
      convertida para ISO, dinheiro em centavos, taxa em basis points e dois alertas escritos
      como investigação.
- [ ] **Validação em device pendente.** O fluxo das duas telas, a permissão de câmera e a leitura
      de uma foto de contrato real exigem aparelho.

**Sai com:** enviar um contrato real de consignado, acompanhar a leitura, revisar os campos com
os trechos citados e confirmar a criação da dívida. **Ainda não fechado** — falta o device.

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

## M4 — Simulador de quitação — entregue, aguardando validação em device

Segundo milestone em que o backend veio junto. É o que prova o ADR 0003: a amortização de
avalanche e bola de neve é a maior tentação de cálculo local do produto, e o guardrail 1.2 a
proíbe pelo nome. Spec em `docs/features/004-simulador-de-quitacao.md`.

- [x] **Backend:** `backend/domain/simulacao.py` (motor puro) e `POST /v1/dividas/simulacoes`.
      Cada escolha de método — ordem da fila, rolagem do mínimo liberado, juros antes do
      pagamento — está declarada no docstring, porque nenhuma delas vem de lei.
- [x] `src/api/simulacoes.ts` + `useSimulacao(aporte)`, com a chave de cache incluindo o
      parâmetro e `keepPreviousData` para o número não sumir enquanto o novo carrega.
- [x] **Slider e `CurrencyInput` juntos** para o aporte extra, sobre o mesmo estado em centavos
      inteiros, com atalhos e `debounce` de 400 ms. O roadmap previa só o slider; digitar o
      valor exato entrou porque arrastar não acerta um centavo.
- [x] Comparação **avalanche vs. bola de neve** lado a lado: meses até a quitação, total de
      juros, economia contra o cenário mínimo.
- [x] A diferença entre as duas vem de `comparacao` no payload — o front não subtrai os dois
      resultados.
- [x] Ordem de pagamento sugerida, dívida a dívida, com o mês previsto de quitação de cada uma.
- [x] **Data de liberdade** como número de destaque, em `display` e `accent`.
- [x] Copy que apresenta as duas estratégias sem eleger vencedora, coberta por teste que falha
      se alguém escrever "recomendada" na tela.
- [x] Os dois `422` tratados com `Feedback` `warning` e a frase do backend, não com erro
      genérico: aporte que invade o mínimo existencial e plano que não quita.
- [x] Dívida **sem taxa conhecida** entra sem juros projetados e é **nomeada na tela** — o prazo
      seria otimista em silêncio. Decisão registrada em `docs/backend.md`, limitação 5.
- [ ] **Validação em device pendente.** Conforto do slider, os dois cartões lado a lado em tela
      pequena e o teclado sobre o campo de aporte exigem aparelho.

**Sai com:** as duas estratégias comparadas na mesma tela, com a diferença em reais e em meses
explicitada, e nenhuma operação aritmética de amortização no código do app. **Ainda não
fechado** — falta o device.

---

## M5 — Dívidas dentro do chat — entregue, aguardando validação em device

Fecha o ciclo: o assistente deixa de ser um oráculo genérico e passa a falar sobre os dados
reais do usuário. Spec em `docs/features/005-dividas-no-chat.md`.

É também o primeiro milestone **exercitado com chamada real ao provedor de LLM** — o que
destravou, de quebra, a leitura de contrato do M1.5.

- [x] **Camada de provedor de LLM** (`backend/llm/`, ADR 0007): a abstração é do provedor, não
      da capacidade. Duas capacidades **mais** N provedores, em vez de duas vezes N.
- [x] Novos `kind` em `ActionCardData`: `divida_resumo` e `plano_sugerido`. O `switch` do
      dispatcher `ActionCard` perdeu o `default` e ficou **exaustivo** — `kind` sem tratamento é
      erro de compilação, não card invisível.
- [x] Deep link do card para a tela correspondente (`dividas/[id]`, `dividas/simulador`), sempre
      por campo tipado, nunca por id extraído de texto.
- [x] Histórico do chat persistido no backend, com os cards **remontados a cada leitura** — uma
      parcela paga ontem não reaparece hoje com o saldo de ontem.
- [x] Guardrail 7.1 verificado, em três camadas independentes: o schema não tem campo para valor,
      o prompt não recebe valores, e número no texto sem card é cortado no servidor.
- [x] O plano do chat usa a **mesma** `domain/simulacao.py` do M4 — conferido por teste e por
      request real.
- [x] Card que sugere criar ou alterar dívida abre o **formulário preenchido** para o usuário
      confirmar (`guardrails.md`, 7.2). `kind` `divida_proposta`, com os valores saneados no
      servidor e revalidados na chegada à tela. **Nenhuma rota de escrita nova** — a gravação
      continua sendo a do cadastro manual, e um teste prova que a conversa não cria dívida.
- [ ] **Validação em device pendente.** Rolagem do chat com card, teclado sobre o composer,
      legibilidade dos cards em tela pequena e o caminho card → formulário preenchido exigem
      aparelho.

**Sai com:** o assistente responde sobre as dívidas do usuário com card tipado, nenhum número que
ele comunica como fato foi escrito por ele, e o que ele propõe só vira dado quando o usuário
confirma. **Ainda não fechado** — falta o device.

---

## M6 — Revisão de cobrança — entregue, aguardando validação em device

Fecha a última pendência de contrato do projeto: o card `valor_justo` existia em
`src/api/types.ts`, tinha componente pronto e exemplo no contrato **desde o primeiro commit**, e
nenhum endpoint o produzia. Spec em `docs/features/006-revisao-de-cobranca.md`.

O desbloqueio não foi ceder e inventar a regra — foi **redefinir o campo** (ADR 0008).
`valorJusto` era "quanto o backend estima que a dívida deveria custar", e estimativa é justamente
o que não tem fonte. Agora é subtração: `valorCobrado` menos a soma dos achados citáveis, cada um
com artigo, súmula ou resolução no docstring. Sem achado, o número não sai.

- [x] **Toda citação conferida no texto primário antes do código.** CDC e Lei 10.820 lidos
      íntegros no Planalto. A verificação **derrubou três decisões do plano**: a margem
      consignável saiu (incide sobre a soma das consignações, não sobre uma dívida), o achado de
      juros acima do teto virou **sem valor** (quantificar exigiria reamortizar o contrato), e o
      teto do consignado entrou **sem default** — não foi confirmável em fonte oficial.
- [x] `backend/domain/revisao.py`, módulo puro, uma função por regra, `None` quando falta insumo.
- [x] Cinco regras: multa acima de 2% (CDC 52 §1º), tarifa de cadastro repetida (STJ, Súmula 566),
      seguro prestamista embutido (CDC 39, I; STJ, Tema 972), juros acima do teto do consignado
      (CNPS) e CET não informado (CDC 52, II). As três primeiras somam; as duas últimas, não.
- [x] `GET /v1/dividas/{id}/revisao`. **Nenhuma rota de escrita nova** — a revisão é leitura pura.
- [x] Extração estendida com os encargos (`modalidade`, `tarifaCadastro`, `seguroPrestamista`,
      `iof`, `multaMoratoriaMensal`). Como todos são `CampoExtraido`, o guardrail 8.1 os alcança
      de graça: **achado derivado do contrato nasce com trecho literal**.
- [x] Guardrail 8.1 **reaplicado na leitura**, não só antes de gravar — a garantia passa a valer
      pela forma da função, não pela confiança em quem escreveu a linha do banco.
- [x] Tetos móveis em config **datada e sem default**. Teto ausente ⇒ achado ausente. A data de
      vigência viaja na resposta e a tela a exibe: teto velho fica visível ao usuário.
- [x] Card `valor_justo` no chat, preenchido **pela rota** com a mesma `domain/revisao.py`. Ele
      **não** sustenta número no texto livre — pode ser descartado, e número cujo card sumiu é o
      modo de falha do guardrail 7.1.
- [x] `script` de negociação por **template determinístico**, sem LLM (`guardrails.md`, seção 3).
- [x] Tela com **dois vazios diferentes**: sem contrato lido leva ao envio; com contrato lido e
      sem achado, diz o que sabemos conferir. "Nada encontrado" soaria como "está tudo certo".
- [x] Testes de copy nos dois lados que **quebram** em "ilegal", "abusiv" ou "é seu direito" —
      gêmeos do teste que quebra em "recomendada" no simulador.
- [ ] **Validação em device pendente.** Legibilidade do trecho citado do contrato em tela pequena,
      os cartões de achado empilhados, e o caminho card → tela de revisão exigem aparelho.

**Sai com:** o usuário vendo, ponto a ponto, o que vale contestar no próprio contrato, com a fonte
e o trecho de cada achado, e uma mensagem pronta para o credor. **Ainda não fechado** — falta o
device.

---

## M7 — Módulo de caixa — em construção

O produto sabia o que a pessoa **deve** e não sabia o que ela **ganha e gasta**. Por isso todo
plano que ele propunha era um chute sobre a capacidade real de pagar. Spec em
`docs/features/007-modulo-de-caixa.md`; a decisão que o organiza, em `docs/adr/0009`.

- [x] **Conferência no texto primário antes do código, e ela achou um erro em produção.**
      `domain/minimo_existencial.py` calculava 25% do salário mínimo citando o Decreto
      11.150/2022 — mas essa é a redação **original**. O Decreto 11.567, de 19/06/2023, fixou o
      mínimo existencial em **R$ 600,00** e revogou o § 2º que congelava o valor. O app usava
      R$ 379,50 onde a lei manda R$ 600,00, e por isso `_validar_aporte` aceitava plano que
      invade a proteção legal. Corrigido, com o valor em config datada e `None` quando não
      configurado.
- [x] A leitura também **estreitou o sinal de superendividamento**: o CDC art. 54-A, § 1º exige
      **boa-fé** e **dívida de consumo**, e o art. 4º do decreto exclui da aferição consignado,
      imobiliário, garantia real, crédito rural e mais. Nada disso é apurável por software, então
      o produto passa a dizer que **os números não fecham** — fato aritmético — e a nomear a
      repactuação como caminho a investigar. Nunca "você está superendividado".
- [x] ADR 0009: **o usuário decide a ordem dos potes; o app mostra a aritmética.** Os
      coeficientes `× 0,5 / 0,7 / 0,9` do desenho original ficaram de fora — são a mesma classe
      do `* 1.1`. Sem rendimento informado, nenhuma comparação dívida × investimento aparece.
- [x] FDD, contrato de API (Bloco 7), vocabulário e roadmap escritos antes do código.
- [x] `backend/domain/caixa.py` — motor puro: cascata da capacidade, renda típica pelo pior mês,
      provisão pelos meses restantes, os sinais de piso e de "não fecha". 38 testes.
- [x] Cinco tabelas, migration com migração de `perfil.renda_mensal`, e os 17 endpoints do
      Bloco 7. A migração de dado foi exercitada contra Postgres de verdade — downgrade, perfil
      com renda semeado, upgrade, fonte criada. 330 testes, verdes em SQLite **e** em Postgres.
- [x] Integração com o módulo de dívida. O simulador passou a recusar o aporte que o piso legal
      aceitava — há teste que prova os dois lados do mesmo cenário. O script de negociação faz
      uma oferta ancorada no caixa, descontando as parcelas das **outras** dívidas. A simulação
      sinaliza plano acima dos 5 anos do art. 104-A, como informação. O card `plano_sugerido`
      usa a capacidade em vez de zero.
- [x] `backend/leitura.py`: as leituras compartilhadas saíram dos routers. Elas nunca foram do
      router — traduzem tabela em entrada de função pura, e três routers precisam da **mesma**
      tradução. Sem isso, `simulacoes` e `caixa` passariam a se importar mutuamente.
- [ ] Quarta aba **Caixa**, com captura progressiva em dois níveis.

### M7.1 — Fechamento do mês

**Gasto fixo já não se redigita:** `gasto`, `fonte_renda` e `provisao_anual` são registros
permanentes com valor mensal, não lançamentos datados. Aluguel entra uma vez e vale até ser
alterado ou desativado (`ativo: false`, que é a chave de liga/desliga). Isso sai de graça no M7.

O que sobra é o que muda de valor: o `recebimento` do PJ, que é mensal por natureza, e o gasto
variável.

- [ ] Tela de fechamento que abre **pré-preenchida com o mês anterior**, para o usuário confirmar
      ou ajustar em vez de digitar do zero.
- [ ] Lembrete opcional de fechamento, reusando o `expo-notifications` do M3.
- [ ] Sinal quando o caixa está velho: capacidade calculada sobre número de três meses atrás é
      um número que envelheceu, e a tela precisa dizer isso.

**Replicação automática e silenciosa está descartada.** Número que o usuário nunca confirmou
entrando na capacidade — e daí no plano que ele leva a um credor — é o mesmo erro de gravar
extração de LLM sem revisão (`guardrails.md`, seção 8.1). Pré-preencher e pedir confirmação
custa dois toques e mantém a garantia.

**Sai com:** o simulador recusando o aporte que hoje ele aceita, porque agora ele conhece o
custo de vida real — e o usuário sabendo, em janeiro, que o IPVA já está guardado.

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
  Com dívidas reais, é o argumento de valor do produto. Ele também depende do M3 de um jeito que
  não era óbvio no início: saldo e parcela mínima de cada dívida saem das **parcelas reais**, e
  sem elas a simulação teria de arbitrar uma prestação.
- **M5 depois de M1–M4.** O assistente só tem o que dizer quando existe dado sobre o que falar.
  Essa é exatamente a tese do produto: contexto contínuo é o que separa um oráculo de dicas de
  um planejador financeiro.
- **M6 por último, e não por acaso.** A revisão de cobrança depende do M1.5 de um jeito que era
  óbvio desde o começo e mesmo assim não dava para antecipar: sem os encargos lidos do contrato,
  não há achado com fonte, e sem achado o `valorJusto` continuaria sendo o palpite que ele nunca
  chegou a ser. Construí-lo antes teria produzido exatamente o número inventado que o resto do
  projeto existe para evitar.
