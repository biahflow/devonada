# Roadmap — devo.nada

> **Leia primeiro (10/08/2026).** Este produto virou **devo.nada** (ADR 0014). O que está escrito
> abaixo de "Base atual" até o M9 é o histórico da construção sob a marca anterior, e fica como
> está: são as decisões que explicam por que o código é como é. Do **M10 em diante** é o que falta
> para dezembro.
>
> **A data manda.** O lançamento é em dezembro de 2026, no curso de finanças de fim de ano de uma
> igreja — audiência cativa, no mês em que o brasileiro mais se endivida, com o 13º recém-caído na
> mão de quem vai negociar. São ~16 semanas, e elas não perdoam semana parada.
>
> Este roadmap continua sendo **sequência de construção, não cronograma** — a única seção com
> datas é "Sequência até dezembro", no fim.

---

## Onde a concepção do devo.nada mora

`docs/concepcao/` guarda o material que originou a marca: `roadmap-v1.md`, `design-system-v1.md` e
as telas `v1`–`v3`. É **fonte histórica, não canônica**. Em qualquer divergência, mandam os
documentos vivos: `docs/domain.md`, `docs/guardrails.md`, `docs/design-system.md`,
`docs/api-contract.md` e este arquivo.

Uma nota que vale a leitura, porque poupa retrabalho: a concepção descrevia como novidade uma
dúzia de coisas que **já eram código verde** — cronograma de parcelas, avalanche × bola de neve,
mínimo existencial, achados com fonte legal, cascata da capacidade, provisões anuais, fechamento
do mês, conta e assinatura. Antes de "construir" qualquer item vindo de lá, confira em
`docs/inventario.md` se ele já existe.

E duas decisões que a concepção trazia e **foram revertidas** ao encontrar o código:

- **Valor justo não vem de taxa média do Banco Central.** Vem da soma dos achados citáveis
  (ADR 0008). Sem achado, é `null` e a tela diz "ainda não calculado". Não existe lei que diga
  quanto uma dívida *deveria* custar, e produzir esse número seria inventar regra financeira —
  justamente o que o produto não faz.
- **Renda típica é o pior mês, não a mediana.** O plano precisa sobreviver ao mês fraco, e quem
  ganha por hora tem mês fraco.

---

> Atualizado em 07/08/2026. Sequência de construção, **não cronograma**.
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

## M1 — CRUD de dívidas — entregue, aguardando validação em device

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
Validação em device, tela a tela. **Os cinco endpoints existem** — o que falta em todos é a mesma
coisa, e não é backend:

- [x] **Lista** — carrega do backend e exibe as dívidas.
- [~] **Cadastro** — `POST /v1/dividas` exercitado por request; ainda não no app.
- [ ] **Detalhe** — `GET /v1/dividas/{id}` pronto; falta exercitar no app.
- [ ] **Edição** — `PATCH /v1/dividas/{id}` pronto; falta exercitar no app.
- [ ] **Quitação e exclusão** — `POST .../quitacao` e `DELETE` prontos (exclusão lógica, e `409`
      ao quitar duas vezes); falta exercitar no app.

Estado por endpoint em `docs/api-contract.md`, seção 4, Bloco 1.

**Sai com:** cadastrar, ver, editar, quitar e excluir uma dívida ponta a ponta contra o backend
real, com os quatro estados verificáveis em cada tela. **Ainda não fechado** — falta o device.

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

## M2 — Painel de endividamento — entregue, aguardando validação em device

O que transforma uma lista num diagnóstico. Zero agregação no cliente: todo número vem de
`GET /v1/dividas/resumo`. Spec em `docs/features/003-painel-de-endividamento.md`.

- [x] `src/api/resumo.ts` + `useResumo(mes)`, com a chave dentro do prefixo `['dividas']` — as
      mutações do M1 revalidam o painel de graça.
- [x] **Lacuna do contrato resolvida:** `GET/PUT /v1/perfil` especificado, e o convite a informar
      renda ganhou destino. **Revisto no M7.2:** o destino passou a ser o Caixa, e a tela do
      painel virou `painel/preferencias` — só dependentes e lembretes.
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
- [ ] **Validação em device pendente.** Os dois endpoints existem — `GET/PUT /v1/perfil` e
      `GET /v1/dividas/resumo`, Blocos 2 e 3 de `docs/api-contract.md`, seção 4. O que falta é
      exercitar a tela no aparelho.

**Sai com:** aba Painel exibindo apenas números vindos do backend — nenhuma soma, média ou
percentual calculado em TypeScript. **Ainda não fechado** — falta o device.

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

## M7 — Módulo de caixa — entregue, aguardando validação em device

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
- [x] Quarta aba **Caixa** (Chat · Dívidas · Caixa · Painel), com cinco telas e captura
      progressiva. O vazio convida ao Nível 0 — dois campos e o número aparece — porque quem
      está endividado e com medo não preenche formulário: o valor tem de vir antes do esforço.
- [x] Teste de copy do caixa, gêmeo dos do M4 e do M6: quebra em "recomendada", "ilegal",
      "abusiv", "você tem direito" e **"superendividado"**.
- [ ] **Validação em device pendente.** A cascata em tela pequena, o teclado sobre os campos de
      valor e a quarta aba na barra inferior exigem aparelho.

### M7.1 — Fechamento do mês

**Gasto fixo já não se redigita:** `gasto`, `fonte_renda` e `provisao_anual` são registros
permanentes com valor mensal, não lançamentos datados. Aluguel entra uma vez e vale até ser
alterado ou desativado (`ativo: false`, que é a chave de liga/desliga). Isso sai de graça no M7.

O que sobra é o que muda de valor: o `recebimento` do PJ, que é mensal por natureza, e o gasto
variável.

- [x] Tela de fechamento que abre **pré-preenchida com o mês anterior**, para o usuário confirmar
      ou ajustar em vez de digitar do zero. Entram só as duas coisas que mudam de valor — o
      recebimento de fonte variável e o gasto `fixo: false`.
- [x] **Cada linha diz de onde veio o número.** Valor pré-preenchido sem procedência visível é
      indistinguível de valor inventado. Sem referência anterior, o campo vai vazio — nunca zero,
      que afirmaria que a pessoa não recebeu nada.
- [x] **Item omitido não é gravado.** Não confirmar não é declarar zero, e há teste nos dois
      lados provando — o gêmeo do teste do M5 que prova que a conversa não cria dívida.
- [x] Um fechamento grava **um** snapshot, não um por item: o histórico existe para responder
      "com base em qual renda eu propus aquele acordo?", e oito fotos idênticas o sujariam.
- [x] Lembrete opcional de fechamento, reusando o `expo-notifications` do M3. Ele **agenda uma
      ocorrência por vez** em vez de gatilho mensal repetido, que não tem suporte igual nas duas
      plataformas. De quebra, `reagendar` deixou de cancelar tudo: ele apagaria este lembrete sem
      nenhum sinal.
- [x] Sinal quando o caixa está velho: `caixaDefasado` vem do backend, com o limiar de dois meses
      declarado como escolha de método. Quem **nunca** fechou não aparece como atrasado — os três
      campos vêm ausentes, porque "ainda não fechou" e "está em dia" são afirmações diferentes.
- [ ] **Validação em device pendente.** O teclado sobre a lista de campos de valor, o conforto da
      lista longa em tela pequena e o disparo da notificação mensal exigem aparelho.

**Replicação automática e silenciosa está descartada.** Número que o usuário nunca confirmou
entrando na capacidade — e daí no plano que ele leva a um credor — é o mesmo erro de gravar
extração de LLM sem revisão (`guardrails.md`, seção 8.1). Pré-preencher e pedir confirmação
custa dois toques e mantém a garantia.

**Sai com:** o simulador recusando o aporte que hoje ele aceita, porque agora ele conhece o
custo de vida real — e o usuário sabendo, em janeiro, que o IPVA já está guardado.

### M7.2 — Uma renda só

O M7 mudou a renda de casa e não avisou o painel. `fonte_renda` passou a ser onde a renda mora,
mas `GET /v1/dividas/resumo` continuou lendo `perfil.renda_mensal` — então quem preenchia o Caixa
via o painel vazio, com a renda cadastrada bem ali, a uma aba de distância. Duas fontes de verdade
para o mesmo número, e ele não aparecendo em nenhuma.

O desenho certo já estava escrito: a migration do M7 declara, em comentário, que `renda_mensal`
"continua sendo lida por `GET /v1/perfil`, agora derivada da soma das fontes ativas". A derivação
nunca virou código. Isto não inventa arquitetura — implementa a que o M7 documentou.

- [x] `GET /v1/dividas/resumo` lê a renda do caixa, com o perfil como fallback — o mesmo caminho
      que `simulacoes._validar_aporte` já usava. Usa a renda **líquida**: o limite de 30% se lê
      sobre o que de fato entra, e sem `imposto_bps` informado ela degrada para a bruta.
- [x] `GET /v1/perfil` devolve `rendaMensal` **derivado** das fontes ativas. `PUT` continua
      aceitando o campo — app instalado que não atualizou ainda o envia —, mas o valor pousa na
      fonte. Com duas ou mais fontes ativas a rota **recusa** com `422` em vez de escolher uma:
      um escalar não se reparte entre fontes sem inventar dado.
- [x] **`margemDisponivel` passa a ser `aporteMaximo`** quando o caixa conhece a saída. As duas
      abas respondiam "quanto sobra" com números diferentes, e o painel anunciava uma sobra que o
      simulador recusava. Não é `capacidadeHoje`: essa não desconta as parcelas atuais, e exibi-la
      como sobra contaria duas vezes o dinheiro que já sai.
- [x] **Renda sem gasto não vira margem.** No Nível 0 sabemos o que entra e nada do que sai; ali a
      margem continua saindo do piso legal. Devolver quase a renda inteira como sobra seria o
      número mais perigoso do produto — tem cara de calculado e afirma que dá para comprometer
      tudo.
- [x] Uma porta só para informar renda: `painel/renda` virou `painel/preferencias` (dependentes e
      lembretes) e o convite do painel leva ao Nível 0 do Caixa. O formulário antigo **exigia**
      renda para salvar, obrigando quem já preenchera o Caixa a redigitá-la para mudar o horário
      de um lembrete.
- [x] Teste ligando as duas pontas — fonte cadastrada ⇒ painel preenchido —, que era exatamente o
      que não existia: nenhum teste cruzava o módulo de caixa com o resumo, e por isso o defeito
      passou por quatro gates verdes.

**Sai com:** renda informada em um lugar só, aparecendo em todos — e painel e simulador dando a
mesma resposta para "quanto ainda cabe".

---

## M8 — Conta de usuário — entregue, aguardando validação em device

Primeiro milestone que não entrega feature: entrega a condição para publicar. Os três itens de
"Conta de usuário" do pré-lançamento existiam porque o acesso era um token fixo colado no
aparelho por QR, e a própria ADR 0006 escreveu por que aquilo não duraria — "não distingue
dispositivos e não tem revogação granular; inaceitável no primeiro convidado". Spec em
`docs/features/008-conta-de-usuario.md`; as decisões, na ADR 0012.

- [x] **A troca custou uma fixture.** Os 370 testes do backend autenticavam por `auth` em
      `conftest.py`, e nenhum deles conhecia o mecanismo — trocar token fixo por conta de verdade
      não tocou um único router. Foi o retorno do investimento que a ADR 0006 justificou: filtrar
      por `tenant_id` em toda query com um usuário só parecia cerimônia.
- [x] Cadastro, login, `refresh` e `logout`. Access JWT de 15 minutos, refresh opaco em tabela,
      **rotacionado a cada uso** — o mesmo refresh apresentado duas vezes significa duas cópias, e
      a segunda leva `401`. É o que dá revogação de verdade: logout, troca de senha e exclusão
      derrubam a sessão no servidor, não só no aparelho.
- [x] **A autenticação não conta quem tem conta.** Senha errada e e-mail inexistente saem com a
      mesma frase E o mesmo tempo — o bcrypt roda contra um hash falso quando não há usuário,
      senão o relógio responde o que a mensagem se recusou a responder. `senha/recuperacao`
      devolve `202` sempre.
- [x] Recuperação por código de 6 dígitos, com hash no banco, teto de tentativas e validade de 30
      minutos. Código, e não link: link que abre o app exige *universal link* com domínio
      associado nas duas plataformas, e não há host https.
- [x] Correio plugável (`DEVONADA_CORREIO`), no padrão da ADR 0007. A suíte usa o de memória — a
      regra de que **nenhum teste toca a rede** passou a valer para e-mail também.
- [x] **O primeiro cadastro adota o tenant do beta.** Sem isso, as dívidas e o caixa já
      cadastrados ficariam alcançáveis por nenhum login e apagáveis por nenhuma exclusão de conta.
      A condição é `count(usuario) == 0`, e ela deixa de valer no instante em que é usada.
- [x] **Exclusão de conta física, em transação, reconfirmando a senha** — Apple, diretriz
      5.1.1(v). É o oposto da regra de `divida`, e pelo motivo certo: lá a exclusão lógica protege
      o histórico do usuário; aqui é ele pedindo que o histórico deixe de existir.
- [x] **A varredura de exclusão é derivada do metadata, não escrita à mão.** Lista à mão envelhece
      na primeira migration que alguém escrever sem lembrar da rota, e o dado órfão só apareceria
      numa auditoria de loja. Há teste que falha se uma tabela ficar fora das duas listas.
- [x] Página pública `GET /exclusao` — exigência do Google, **adicional** à do app.
- [x] **Renovação silenciosa com uma promise compartilhada.** Sem ela, o app abre, dez telas
      montam juntas com o access vencido, cada uma rotaciona o mesmo refresh, nove ficam com token
      revogado — e a sessão morre no boot sem o usuário ter feito nada. Há teste que dispara dez
      requisições concorrentes e exige **uma** renovação.
- [x] Falha de **rede** na renovação não desloga. Deslogar ali expulsaria quem entrou no elevador,
      e a credencial dele continua boa.
- [x] O grupo `(auth)/` fica fora de `(tabs)/`: login com barra de abas embaixo é convite a tocar
      numa aba que vai `401`ar.
- [x] Saíram a tela de token, o `ConfigurarConexaoButton`, o ramo `semToken` do `ErrorState`, o
      `isAuthError` e o script `token:qr`. Nenhuma tela decide mais o que fazer com `401`.
- [x] **Um defeito de acessibilidade apareceu no caminho:** `Button` em `loading` trocava o texto
      pelo spinner e ficava sem nome nenhum para o leitor de tela, justamente no instante em que a
      pessoa espera saber o que está acontecendo. Corrigido com `accessibilityLabel` explícito.
- [ ] **Validação em device pendente.** O teclado sobre o campo de senha, o gerenciador de senhas
      do sistema se oferecendo para salvar, a confirmação de exclusão em tela pequena e — o mais
      importante — **o app voltando do background com o access vencido**. A renovação silenciosa é
      a peça mais fácil de quebrar do milestone e nenhum gate a exercita como o aparelho a
      exercita.

**Sai com:** entrar no app em qualquer aparelho com e-mail e senha, recuperar o acesso sem falar
com ninguém, e apagar tudo o que é seu sem pedir permissão.

---

## M9 — Assinatura in-app — entregue, aguardando validação em device

Segundo milestone que não entrega feature: entrega a condição para **cobrar**. Era o único item do
pré-lançamento que é código de produto — as duas lojas obrigam o meio de pagamento delas para
conteúdo digital, e nada no app sabia quem tinha pago. Spec em `docs/features/009-assinatura.md`;
as decisões, na ADR 0013.

- [x] **A fronteira não é acesso, é escrita.** Sete dias de teste da criação da conta; depois,
      **somente leitura**. Quem parou de pagar continua vendo as próprias dívidas, o próprio caixa
      e o próprio histórico. Trancar alguém endividado para fora da lista das dívidas dele seria o
      oposto do que este produto faz — e não sobreviveria ao art. 18 do LGPD, porque acesso do
      titular ao próprio dado não é recurso pago.
- [x] **A trava é derivada do método HTTP**, numa dependência global de `main.py`: `GET` passa,
      write exige situação válida, `402` na recusa. Lista por rota envelheceria na primeira rota
      criada sem lembrar dela, e o buraco apareceria como **receita que não entra** — não como
      teste vermelho. Mesmo raciocínio de `tabelas_do_tenant()`, e há um teste que varre
      `app.openapi()` e falha se a lista de livres crescer sem decisão explícita.
- [x] Fora da trava ficam `/v1/auth`, `/v1/assinatura` e `/v1/conta`. Não são exceções de recurso:
      são as rotas de começar, gerenciar e encerrar a relação. Exigir assinatura para assinar é
      deadlock, e travar a exclusão de conta reprova na diretriz 5.1.1(v) da Apple.
- [x] `backend/loja/` plugável (`DEVONADA_LOJA`), no padrão da ADR 0007: Apple, Google e memória.
      **Cobrança entrou na regra de que nenhum teste toca a rede.**
- [x] **O recibo do aparelho é chave de busca, nunca fonte da verdade.** O servidor extrai o
      identificador e pergunta à loja com credencial que só ele tem. Um app modificado consegue
      apontar para a assinatura de um estranho; não consegue inventar uma que não existe.
- [x] **RevenueCat foi recusado por um custo que não é técnico.** Ele receberia identificador de
      usuário e histórico de compra, virando um processador terceiro a declarar na política de
      privacidade e no App Privacy — dois itens que ainda não foram escritos. Adicionar um
      processador a um produto que ainda não declarou os que tem é a ordem errada.
- [x] Reconferência sob demanda no lugar de webhook: *Server Notifications V2* e o RTDN exigem URL
      pública, que continua pendente. Falha de rede na reconferência **não derruba ninguém** —
      respondemos com o que está gravado.
- [x] **Nenhum preço trafega pelo nosso servidor nem pelo bundle.** Ele vem da loja já localizado,
      exigência das duas. O que é público é o id do produto, que já está impresso na página da
      assinatura na App Store.
- [x] `finishTransaction` **só depois** que o backend confirma. Encerrar antes deixaria o usuário
      cobrado com o servidor sem saber, e a loja não reentrega o que já foi reconhecido — ele
      ficaria pagando por um app travado.
- [x] `assinatura` entrou na exclusão de conta **sem uma linha a mais**, pela varredura derivada do
      metadata. É a terceira vez que aquela decisão do M8 se paga sozinha.
- [x] **A fixture `auth` não mudou, ao contrário do que o plano previa.** Toda conta da suíte nasce
      pela rota de registro, e conta recém-criada está dentro do teste — os 420 testes anteriores
      passaram intactos. 452 testes agora.
- [ ] **Validação em device pendente, e aqui ela é mais determinante que nos outros milestones.**
      Nenhum gate exercita a loja: a folha de compra, o sandbox das duas lojas, o app voltando
      destravado sem logout, e sobretudo **restaurar compras num aparelho novo** — o caminho que a
      revisão da Apple testa primeiro e o que mais reprova.

> **O Expo Go deixa de bastar.** In-app purchase exige módulo nativo, e o binário do Expo Go não o
> tem. `app.json` ganhou `bundleIdentifier` e `package`, entrou `eas.json`, e o fluxo de assinatura
> só roda em `eas build --profile development`. O resto do produto continua rodando em Expo Go.

**Sai com:** o app cobrando pelas lojas, com sete dias de teste e somente leitura depois — e
ninguém trancado para fora do próprio dado.

---

## M10 — Fork e marca — entregue, aguardando validação em device

O produto virou devo.nada. Ver ADR 0014 (o fork), ADR 0015 (vermelho é status, e a interface é
escura) e ADR 0018 (a medição volta para dentro do repositório).

**Os quatro débitos do fork fecharam em 19/08/2026**, e três deles fecharam medindo — não
declarando. O que sobrou de aberto aqui é o mesmo que sobra em M1.5–M9: device.

- [x] Fork com histórico preservado; identidade renomeada (`app.json`, `package.json`, prefixo
      `DEVONADA_*`, bundle id `br.com.devonada.app`). O domínio **não** foi renomeado: `divida`,
      `valorCobrado`, `CriticidadeTipo` e `caixa` são a linguagem ubíqua, e mexer neles custaria
      743 testes sem entregar nada ao usuário.
- [x] `src/theme/theme.ts` reescrito para a paleta escura. Custou **um arquivo** mais uma borda no
      `Card` — porque a regra de zero hex fora do theme se pagou: 75 arquivos consomem token e
      nenhum define cor.
- [x] Inter + Archivo Black no lugar de Nunito Sans, com `numeric` mantido em Inter de propósito
      (ver abaixo). Fontes confirmadas no bundle exportado.
- [x] `Button` variante `danger` perdeu o fundo vermelho — neste app não existe botão vermelho,
      nem para destruição.
- [x] Gates verdes depois da troca: 291 Jest em 30 suítes, 452 pytest, typecheck, lint e
      `bundle:check`. **Em 19/08/2026, depois de fechar os débitos: 472 Jest em 42 suítes e 497
      pytest**, com dois gates novos — `palette:check` e `digits:check` — que não existiam ali.
      (O número do Jest ficou registrado como 441 / 40 antes dos últimos commits do próprio M10, e
      foi remedido ao planejar o F-010, no mesmo dia. Baseline copiada envelhece em silêncio.)
- [x] **Contrastes remedidos, e a medição virou gate** (ADR 0018). 54 pares declarados em
      `scripts/paleta-check.mjs`, medidos em WCAG 2.1 e CIEDE2000: 48 passam, 6 são exceções
      justificadas, 0 reprovam. A tabela do `design-system.md` é a saída do script, não digitada.
      **A medição achou o que a leitura de tela não achava:** `inkSoft`, o par que o documento
      temia, passa em todas (pior caso 4,85); quem reprovava era `#E5352B` como TEXTO — 4,35 /
      4,00 / 3,66 sobre as três superfícies e 4,04 sobre o próprio `dangerSurface`, contra o piso
      de 4,5. A saída não foi mudar o hex da marca: entrou `debtText`, o mesmo vermelho clareado
      só até passar, e `debt` segue intacto onde é objeto gráfico — a começar pelo ponto do
      wordmark. O gate reprova quem trocar um hex sem remedir.
- [x] **Largura de dígito medida — e não era item de device.** A largura de avanço de um glifo
      está na tabela `hmtx` do TTF: é fato do arquivo, igual em todo aparelho, e `npm run
      digits:check` a lê sem aparelho nenhum. O resultado justificou o receio: **a Inter é
      proporcional nos três pesos** — em `Inter_700Bold` o "1" avança 883 onde o "0" avança 1381,
      amplitude de 502 em 2048 (0,245 em). A coluna de reais dançava mesmo, ~4,4px por dígito "1"
      que entrasse ou saísse da linha. `typography.numeric` ganhou `fontVariant: ['tabular-nums']`,
      autorizado por a Inter DECLARAR a feature `tnum` na GSUB — pedir recurso OpenType que a
      família não tem derruba o texto para fonte de sistema no Android. Archivo Black já era
      tabular (amplitude zero), então `display`/`displaySm` não precisaram de nada.
- [x] **Ícone e splash refeitos**, e o comando que os gera entrou no repositório
      (`npm run assets:build`, Chrome headless, três SVG versionados como fonte). Os PNG antigos
      eram da marca anterior — fundo branco, traçado teal, círculo violeta.
      **Um erro de unidade apareceu na conferência:** o `design-system.md` mandava o ponto do
      Android a "72%, dentro da zona segura", e a frase se contradizia — a janela garantida da
      máscara é a de **72dp de 108dp**, ou 66,7%. O 72 era dp e virou porcentagem na escrita. A
      72% da caixa o disco era recortado na borda em launcher circular, o grafite sumia e o ícone
      virava um círculo vermelho cheio. Ficou em 55% no Android e 62% no iOS: **o ponto precisa de
      moldura para ler como ponto**, e um disco que preenche o quadro não se distingue de qualquer
      outro app de ícone vermelho.
- [x] **Abas renomeadas e reordenadas** para Rota · Dívidas · Tino · Caixa. Rótulo e ordem, não
      rota: `painel`, `dividas`, `index` e `caixa` continuam sendo o que são no código.
- [x] **O ponto da marca virou código** — `Brand` mais `estadoDaRota()`, uma função pura com
      teste. Vermelho enquanto há saldo devedor, verde depois de quitar, e `neutro` para conta
      nova, que é o estado que impede o ponto de nascer verde. A barra de abas segue o mesmo
      estado: quando a pessoa zera, o app inteiro muda de fase.
- [x] **Splash, login e registro com a marca**, mais a `NotaDePrivacidade` — a regra de ouro nº 1
      dita na tela em que a pessoa mais desconfia.
- [x] **Home "Rota de Fuga"**: topbar com o ponto, saldo devedor em Archivo Black, card do Tino
      com a próxima ação determinística. O diagnóstico completo continua logo abaixo.
- [x] **`custoDiarioJuros` no resumo, e ele não viaja sozinho.** A frase que faltava ao card do
      Tino é conta, então nasceu no servidor (guardrail 1.2), em `domain/resumo.py`, com as três
      escolhas de método declaradas no docstring: divisor 30 do mês comercial, base igual à de
      `custo_medio_juros_mensal`, e agregado. Nenhuma vem de lei, e está escrito que não vêm —
      o docstring diz, com todas as letras, que o número **não é valor exigível e não deve ser
      levado a uma negociação como se fosse**.
      O agregado subestima quando parte da carteira não tem taxa, e o caso que prova isso é real:
      R$ 91.000 devidos devolvendo R$ 1,00 por dia, porque R$ 90.000 estão sem taxa cadastrada.
      Por isso entrou junto `quantidadeDividasSemTaxa`, e **o cliente exige os dois campos para
      dizer a frase** — sem a contagem ele cala, porque não saberia se o número é total ou piso.
      Ausência devolve `None`; zero só aparece quando a taxa zero foi de fato informada.
- [x] **Documentação herdada varrida.** `README.md`, `architecture.md`, `agent-guidelines.md`,
      `inventario.md` e `backend.md` deixaram de falar da marca anterior. A varredura achou mais
      do que o nome: o template de PR ainda proibia vermelho fora de erro e destruição — o
      oposto da ADR 0015 —, e a seção 4b do `design-system.md` **alegava** ter reexecutado o
      validador contra a paleta escura enquanto citava os hex da clara. A alegação saiu; a
      medição de verdade é o item acima.

## M11 — Respiro — entregue, aguardando validação em device

**Feature Contract:** [F-010 — Respiro](docs/features/F-010-respiro/feature.md) · `READY_FOR_HUMAN_REVIEW`.
**Plano de execução:** [plan.md](docs/features/F-010-respiro/plan.md) — oito tarefas, `PLAN_VALID`,
congelado em 19/08/2026, executado em sequência entre 19 e 20/08/2026 com **três
`PLAN_DEVIATION` ratificadas** (PD-1, PD-2, PD-3, registradas no próprio plano).
**Evidência:** [evidence.md](docs/features/F-010-respiro/evidence.md).
**Decisões:** ADR 0019 · **Contrato:** `api-contract.md`, Bloco 13.

O item mais valioso que a concepção trouxe, e o único que nenhum concorrente tem. A justificativa
inteira está em `domain.md` (verbete `respiro`) e as regras de copy em `guardrails.md`, 4.1.

**A spec fechou em 19/08/2026**, e fechou reenquadrando a feature. `capacidade_maxima` é hoje,
literalmente, o cenário em que **todo o não essencial foi cortado** — a cascata já continha a
austeridade total que o Respiro existe para impedir, e é dela que saem o teto do simulador, a sobra
do painel e o aporte do card do chat. O trabalho do respiro não é reservar uma sobra: é **pôr um
piso sob esse corte**.

As três decisões que destravaram o gate humano (ADR 0019):

- **Quem diz o valor é o usuário.** Nenhum coeficiente, nenhum default. A faixa "5–8% da
  capacidade" que a concepção trazia **não sobe** para documento canônico: a ADR 0009 proíbe
  coeficiente de alocação sem fonte, e esta ADR a aplica em vez de substituí-la. Consequência
  aceita: quem não declara não tem respiro.
- **O marco celebra e libera o acumulado; não mexe no valor.** Some a tabela de escala marco a
  marco, que era o item de maior risco do milestone. "Escalar com o marco" acontece por acúmulo.
- **Respiro não usado acumula em silêncio.** Destinar a aporte extra é botão, nunca pergunta
  mensal — perguntar todo mês transformaria o respiro em prestação de contas.

- [x] `respiro` entra na **cascata de `domain/caixa.py`** como linha de primeira classe, subtraída
      **antes de `capacidade_maxima`** — é essa posição que a torna imune ao aperto. `None` é
      "nunca declarou" e nunca vira zero na saída: o `or 0` mora só na aritmética, e há teste que
      prova que cortar todo o não essencial **não** zera o respiro. Migração `f3a92c47b8d1`, com
      round-trip verificado contra o Postgres local.
- [x] Validação de piso: `422` quando o respiro declarado faz
      `renda_liquida − essenciais − respiro` cair abaixo do mínimo existencial. A regra é
      `domain/caixa.respiro_invade_o_piso`, com FONTE no docstring — Decreto 11.150/2022 na
      redação do 11.567/2023 —, e o HTTP segue o padrão de `_validar_aporte`: mensagem em pt-BR
      **sem valor no corpo**, porque renda não vaza em mensagem de erro (guardrail 5).
- [x] Tabelas `respiro`, `respiro_uso` e `respiro_destinacao`, mais `marco`. Gasto de respiro
      **não** entra em nenhum cálculo de alerta. As quatro entram sozinhas na exclusão de conta,
      porque `tabelas_do_tenant()` é derivada do metadata — e há teste que prova a varredura
      alcançá-las, em vez de assumir.
      **O desfazer de um uso destruía saldo real**, e a revisão pegou: a coluna passou a guardar
      só os meses fechados, e o excesso do mês virou derivado na leitura. Derivado, o desfazer é
      exato por construção — não há nada a desfazer.
- [x] `marco` como **evento persistido**: primeira negociação fechada, primeira dívida quitada,
      25/50/75% da rota. Os cinco gatilhos já tinham dado — `renegociacao` e `situacao = 'quitada'`
      existem desde M3 e M1, e nenhum dependeu do M12. Um marco atingido **não se desfaz** quando
      o usuário cadastra dívida nova, e há teste que cadastra a dívida e verifica.
      **A unicidade desceu para o banco** depois da revisão (`UNIQUE (tenant_id, tipo)`, migração
      `116f2181bdda`) — e precisou de `SAVEPOINT` junto: `registrar_marcos` grava na mesma
      transação da mutação que o produziu, e a constraint sozinha faria uma corrida abortar a
      quitação da dívida que gerou o marco. Segunda migração do milestone, fora de T1: `PD-3`.
- [x] **Defeito corrigido junto:** `src/components/rota/CardSaldo.tsx` calculava a porcentagem da
      rota no cliente, sobre uma linha de base móvel. Virou `saldoInicialDaRota` e
      `rotaPercorridaBps` no servidor, sobre o **maior saldo já registrado**. A revisão achou um
      defeito que os quatro critérios não pegavam — a segunda leitura do mês devolvia `0` a quem
      acabara de chegar, porque o mês corrente é reescrito a cada leitura —, e a régua virou "mês
      anterior". Limitação que fica declarada: a base ainda pode encolher **dentro** do primeiro
      mês (`PF-3` do plano); a mitigação é o marco ser evento que não se desfaz.
- [x] `RespiroCard`, a tela de declaração e `MarcoScreen` (verbetes em `design-system.md`, seção 4c).
      O card tem dois estados, e o vazio é o que faz a feature existir para quem mais precisa dela:
      sem respiro declarado ele **convida**, sem sugerir valor, faixa ou percentual. `Meter` não foi
      usado de propósito — ele vira `warning` acima de um limiar, e aqui não existe limite a
      ultrapassar. A `MarcoScreen` ficou **fora do grupo de abas**, com atualização otimista para
      que um `402` não tranque ninguém na tela de celebração.
- [x] Teste de copy gêmeo dos do M4/M6/M7, quebrando em "você já gastou", "você mereceu", "se você
      economizar", "desvio" e "extrapolou" — `src/test/screens/respiro-copy.test.tsx`, 36 casos
      varrendo as três superfícies, incluindo os cinco marcos × cinco estados de saldo. Provado
      por injeção: com um termo proibido plantado em cada superfície, ele **falha** nas três.
- [x] **O teste cruzado**, que é o item que o milestone mais precisava: respiro declarado derruba o
      teto do simulador, e o teto desce **exatamente** o valor declarado. Os três consumidores de
      `leitura.capacidade_atual` são cobertos, porque mudam de número sem que nenhum dos três
      arquivos seja tocado — e ação a distância não aparece em diff.
- [x] O piso legal continua acima: respiro sai da capacidade, e a capacidade nunca invade o mínimo
      existencial.
- [ ] **Validação em device de `RespiroCard`, da tela de declaração e da `MarcoScreen`** — leitura,
      safe area, teclado e acessibilidade. É o gate humano que fecha o milestone. Nenhum agente o
      declara satisfeito, e nenhum gate deste repositório o substitui: contraste medido é **piso**,
      não legibilidade.

**Saiu com:** um teto de pagamento que assume que a pessoa continua viva — e uma conquista que não
se desfaz quando ela é honesta sobre uma dívida nova.

**Gates verdes no fechamento**, medidos em 20/08/2026: **539 Jest em 45 suítes** e **620 pytest**,
mais `typecheck`, `lint`, `bundle:check`, `palette:check` (56 pares, 0 reprovam) e `digits:check`.
Baseline de entrada do milestone: 472 Jest em 42 suítes e 497 pytest — o M11 acrescentou 3 suítes,
67 testes Jest e 123 pytest.

**Mudança de comportamento a declarar:** `aporte_maximo` cai para quem declarar respiro, porque
`capacidade_maxima` passou a ser calculada com a linha nova subtraída. Com isso, **três
consumidores mudam de número sem que nenhum deles tenha sido tocado neste milestone** — o
simulador (`routers/simulacoes._validar_aporte`), o painel (`margemDisponivel` em
`GET /v1/dividas/resumo`) e o card `plano_sugerido` do chat, que usa a capacidade real como aporte
default. Os três leem `leitura.capacidade_atual`, e é por isso que a mudança não aparece no diff
de nenhum dos três arquivos; `TestRespiroNosTresConsumidores`, em
`backend/tests/test_caixa_integracao.py`, é o teste que a torna visível.
`nao_fecha` (`comprometido_dividas > capacidade_maxima`) passa a disparar mais, e **está correto**:
o plano de fato não fecha se a pessoa precisa viver. Quem nunca declarou respiro tem a cascata e os
três números idênticos aos de antes do M11, e há teste de regressão dos dois lados.

## M12 — Renda tipada, negociação por canal e a Rota de Chegada

**Feature Contracts:** o que resta do M12 foi partido em dois, em 20/08/2026, porque renda tipada
e negociação por canal não têm interseção de **arquivos** — uma mora em `domain/caixa.py` e
`leitura.py`, a outra em `routers/revisao.py` e `orm.Renegociacao`. Executáveis em paralelo.
Elas **têm** interseção de efeito, descoberta no planejamento: ver o quarto consumidor, abaixo.

- [F-011 — Renda tipada e compromisso percentual](docs/features/F-011-renda-tipada/feature.md) ·
  `READY_FOR_BUILD` · [plano](docs/features/F-011-renda-tipada/plan.md), seis tarefas, `PLAN_VALID`,
  congelado em 20/08/2026
- [F-012 — Negociação por canal e registro de resultado](docs/features/F-012-negociacao-por-canal/feature.md) ·
  `READY_FOR_BUILD` · [plano](docs/features/F-012-negociacao-por-canal/plan.md), seis tarefas,
  `PLAN_VALID`, congelado em 20/08/2026

A [**ADR 0021**](docs/adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md)
fechou as sete incógnitas de modelagem em 20/08/2026, e com ela os dois contratos subiram para
planejamento. Os dois planos foram escritos em 20/08/2026, com seis tarefas cada, e **os dois foram
congelados no mesmo dia**.

O gate que segurava o F-011 caiu com a **Nota de desempate** da ADR: a ADR dizia que o compromisso
percentual incide sobre "a renda típica" e não desempatava entre bruta e líquida (`PF-4` do plano).
Decidido em 20/08/2026 — **incide sobre a renda LÍQUIDA típica**, a mesma base sobre a qual o piso
legal já é medido (`caixa.py:254-276`). Sobre a bruta, o app comprometeria dinheiro que a pessoa
nunca vê, e para `pj_hora` e `autonomo` — o público desta feature — a diferença é grande.

**As duas executam em paralelo**, com uma coordenação que nenhum dos dois planos tinha visto: ambos
declaravam encadear sua migração em `116f2181bdda`, e duas migrações do mesmo pai partem a cadeia
Alembic em dois ramos. Registrado como `PLAN_DEVIATION` nos dois planos — a T1 do F-011 escreve a
primeira, e a T3 do F-012 encadeia na cabeça que ela deixar.

**O planejamento também achou um quarto consumidor de `leitura.capacidade_atual`** que nem a ADR
nem os contratos citavam: `revisao._capacidade_para_oferta` (`backend/routers/revisao.py:176`), que
monta a oferta do script de negociação. Compromisso percentual declarado vai derrubar **a oferta
que a pessoa faz ao credor** — aceito em 20/08/2026, porque oferecer o que não cabe no mês é o
plano quebrado que o produto existe para evitar. O teste cruzado do M12 cobre **quatro**
consumidores, não três.

O eixo das sete: **nada muda por conversão, tudo entra por adição** — alíquota por
fonte com o global como fallback, 13º e férias como evento previsível fora da cascata, compromisso
percentual como pote novo, resultado de negociação como entidade nova. Os potes, o `min()` da renda
típica e a `Renegociacao` ficam como estão.

**Uma decisão altera comportamento que já está no ar**, e é a única: a oferta de valor
(*"consigo comprometer até R$ X por mês"*) sai do primeiro contato nos canais escritos. Hoje
`montar_script` a insere para qualquer destino, contra o que `domain.md` manda — o código é que
cede. Atinge a tela de revisão e o card `valor_justo` do chat.

- [x] **Metas nomeadas e a aba da fase verde** (ADR 0017). A tela 09 pedia uma lista de metas com
      nome, emoji, prazo e selo de situação; o que existia eram seis colunas fixas no `perfil` que
      alimentam a cascata do caixa. A entidade `Meta` entrou **aditiva** — mover os potes mudaria a
      capacidade de todo mundo em silêncio no primeiro deploy —, e o custo assumido é o produto ter
      dois sentidos de "meta": "Seus potes" no Caixa, "Suas metas" na aba.
- [x] **`aporteSugerido` e `status` vêm do servidor e não são persistidos.** A conta é o que falta
      dividido pelos meses que faltam, o mesmo método de `aporte_de_provisao`. Sem prazo não há
      sugestão; sem aporte declarado não há status — e a tela então **não exibe selo**, em vez de
      exibir palpite. `aporte_baixo` é âmbar, nunca vermelho (ADR 0015).
- [x] **A segunda aba troca na fase verde** com `href: null`, que tira da barra sem tirar da rota:
      `/dividas` continua alcançável e a tela de Metas oferece o caminho. Sem isso, quem quitasse
      tudo e contraísse dívida nova não teria como cadastrá-la.
- [ ] **F-011** · `fonte_renda` ganha `tipo` (`clt` · `pj_hora` · `autonomo`), com a UX dedicada de
      cada um — 13º e férias no CLT, taxa × horas menos imposto no PJ, renda típica no autônomo.
      **O campo já existe** e não faz nada: é coluna desde a migração do M7, validada em seis
      valores, e nenhuma regra de domínio a consulta. O trabalho é dar efeito a dado que usuários
      já preencheram — o que muda o plano de quem já usa o app, retroativamente. `beneficio`,
      `aluguel` e `outro` também ganham UX, por decisão de 20/08/2026.
- [ ] **F-011** · Compromisso **percentual** para renda variável, no lugar de valor fixo. Incide
      sobre a renda típica e sai antes de `capacidade_maxima`, junto aos potes (decisão de
      20/08/2026) — logo, ação a distância nos mesmos três consumidores do M11.
- [~] **F-012** · `script` ganha as **três variantes de canal** (`telefone` · `chat` · `email`),
      mesmo motor de valor justo, formatos diferentes. Ver `domain.md`, verbete `canal`. Barato do
      jeito certo: `montar_script` é template curado, sem LLM, por guardrail. **Entregue** (T1–T4):
      `domain/script.py`, rota com `?canal`, `ScriptCard` com seletor. Não visto em device.
- [~] **F-012** · Alerta de validação de canal abrindo o script escrito e regra de pagamento
      fechando — **é anti-golpe embutido no próprio script**, e é o item de maior retorno por linha
      do milestone. Decidido em 20/08/2026 que ele **alcança quem não tem achado**: `montar_script`
      deixa de devolver `None`, porque validação de canal é segurança, não argumento de negociação,
      e quem cadastrou a dívida na mão é justamente o mais exposto ao golpe. **Entregue** (T1, T4): a
      tela de revisão exibe o script mesmo com `valorJusto` nulo. Guardrail 3.1, novo.
- [~] **F-012** · Registro de resultado da negociação em qualquer canal. Coletar isso **desde o
      dia 1** é o que constrói o benchmark de desconto por credor, que é o maior ativo competitivo
      do produto. Hoje `orm.Renegociacao` é grava-e-esquece: **nenhum `GET` a devolve**, e ela só
      nasce quando houve acordo — recusa e silêncio do credor não cabem nela. **Entregue** (T3, T5):
      `ResultadoNegociacao` com os quatro desfechos, `POST`/`GET /v1/…/negociacoes` e
      `GET /v1/negociacoes`, e a tela de registro por canal tipado. Não visto em device.

**Mudança de comportamento a declarar:** a **oferta de valor sai do primeiro contato** nos canais
escritos (`chat`, `email`). Quem copiou o script na semana passada encontra outro texto: a frase
"consigo comprometer até R$ X por mês" deixa de abrir a conversa e vira bloco separado, marcado para
uso **depois** da proposta do credor — quem diz primeiro quanto pode pagar entrega a âncora
(ADR 0021, item 5). Atinge as **duas** superfícies que `revisar_divida` alimenta: a tela de revisão
e o card `valor_justo` do chat. Deliberado; foi o conflito entre `domain.md` e o código em produção
que a ADR resolveu **alterando o código**.

## M13 — Entrada pelo alívio — parcialmente entregue

O app começava pelo formulário. Quem está endividado e com medo não preenche formulário — o valor
tem de vir antes do esforço. O M7 já tinha provado isso com o "Nível 0" do caixa.

- [x] Onboarding cuja **primeira pergunta é "qual dívida tira seu sono?"** — não renda, não CPF.
      Cinco escolhas que já classificam a dívida por criticidade, sem o usuário precisar saber o
      que é criticidade. Gatilho derivado de `quantidadeDividas === 0`, sem flag nova.
- [x] **A escolha é MÚLTIPLA, e a concepção pedia uma só** (ADR 0016). "Começa por uma só" foi
      abandonado porque a carteira real não é assim — cartão E empréstimo é o caso comum —, e o
      "depois cuida do resto" nunca virou caminho: a lista de dívidas só oferecia cadastro no
      estado vazio. O passo 2 virou uma fila de dois campos por dívida, com a contagem à vista
      ("1 de 2"), e **nada é gravado antes do fim** — voltar na fila não duplica dívida.
- [x] **A lista de dívidas passa a oferecer cadastro com a lista cheia.** Era o outro lado da mesma
      falha, e o teste que a cobre é regressão nomeada em `lista-dividas.test.tsx`.
- [x] **Dois caminhos de entrada**, e esta foi a descoberta que mudou o desenho: `montar_script()`
      devolve `None` sem achados, e cadastro manual não produz achado nenhum. Quem tem o documento
      manda a foto e recebe a triagem inteira; quem não tem recebe a triagem honesta.
- [x] **Triagem instantânea em duas versões.** Com contrato: cobrado × justo, economia e os
      achados com fonte. Sem contrato: **"ainda não calculado"** no lugar do número, e o caminho
      para o documento. Há teste que quebra se um número de economia aparecer sem achado que o
      sustente — é a ADR 0008 aplicada à tela que mais teria tentação de inventar.
- [x] "Devo pra uma pessoa" como escolha de entrada. É enorme no Brasil, nenhum app trata, e o
      peso emocional é diferente do de uma dívida bancária.
- [ ] Data de origem no onboarding. Hoje entra como "hoje", e a consequência é conhecida: a
      prescrição (CC art. 206) conta a partir daí, então ela alerta cedo demais, nunca tarde.
- [ ] **Documento durante a fila multi-dívida.** Quem marca duas ou mais cadastra por valor e
      recebe triagem sem achado: `/dividas/contrato` vive fora do grupo `(onboarding)` e sair para
      lá abandonaria o resto da fila. Resolver pede uma tela de upload dentro do grupo, ou a fila
      persistida entre rotas.
- [ ] **Login social (Apple e Google).** A tela de entrada já tem os dois botões do desenho da
      tela 11, **desligados**, com legenda dizendo quando chegam. Falta tudo do servidor: troca de
      token, coluna de provedor no usuário, `expo-apple-authentication` e Google Sign-In no app, e
      credenciais reais nas duas plataformas. Sign in with Apple é **exigência** da Apple para app
      que ofereça qualquer login social, então os dois andam juntos.
- [ ] **Páginas de Termos e Política de Privacidade.** A linha legal da tela de entrada é texto sem
      link porque as URLs não existem. Item de pré-lançamento, não polimento: as duas lojas pedem.
- [ ] Extração de **boleto, carta e print de cobrança** — a camada de extração existe para
      contrato; falta o schema e o prompt destes. Vale integralmente o guardrail 8: campo sem
      trecho citável é descartado, e o arquivo é lido e descartado.
- [ ] Notificações discretas: a palavra "dívida" nunca aparece em push (guardrail 4).

## M14 — Lei do Superendividamento no corpus

- [ ] Lei 14.181/2021 no RAG jurídico, ao lado do CDC. Para quem tem muitos credores, o script
      individual não resolve: o caminho é a repactuação em bloco.
- [ ] A triagem reconhece o perfil e nomeia esse caminho — **mantendo o enquadramento do M7**: o
      app diz que os números **não fecham** (fato aritmético) e convida a investigar a
      repactuação. Nunca "você está superendividado". A definição legal (CDC art. 54-A, § 1º)
      exige boa-fé e dívida de consumo, e software não apura nenhuma das duas. O teste de copy que
      quebra na palavra continua valendo.
- [ ] Trilha de auditoria "como calculamos" exposta na tela — o backend já tem a fonte em
      docstring; falta o campo na API e o disclosure na interface.

---

## Fora do MVP de dezembro — de propósito

Não porque sejam ruins, mas porque a data é real e o escopo tem de caber nela. Cada um tem valor
claro e nenhum bloqueia o lançamento:

- **Open Finance.** A concepção o colocava cedo; ele é, na verdade, o maior salto de
  complexidade, custo e risco regulatório do produto — o Banco Central exige instituição
  autorizada para integração direta, e o caminho realista é agregador. Ver `docs/data-ingestion.md`.
- **"Posso?"** — decisão de compra em tempo real, no momento da tentação. Depende do Respiro e do
  envelope de variáveis funcionando, e por isso vem depois deles. Forte candidato a subir de
  prioridade se o dogfood mostrar que é a feature mais usada no dia a dia — é o tipo de coisa que
  só o uso real revela.
- **Analisador de propostas** (print da contraproposta → armadilhas: juros embutidos, reaging,
  seguro empurrado).
- **Diretório verificado de canais oficiais** por credor, com deep link `wa.me`. Não é bot proxy:
  a API do WhatsApp não permite terceiro enviar mensagem em nome de alguém, e não se ia querer o
  risco jurídico de um bot "aceitando" acordo errado. Quem conversa é o usuário, na conta dele.
- **Validação anti-golpe de boleto/Pix** antes de pagar acordo (beneficiário × credor).
- **Simulador de ligação (roleplay)**, teleprompter com objeções, metas pós-quitação, modo casal,
  turmas de quitação, calculadora web.

---

## Pré-lançamento — o que bloqueia publicar e cobrar

> **Escopo maior que o front.** O resto deste documento fala do cliente Expo; esta seção fala do
> produto. Nada aqui é código de tela, e três itens não são código nenhum.
>
> Nada do que foi construído é desqualificante para as lojas. O app **não é instituição
> financeira**: não empresta, não intermedeia crédito e não custodia dinheiro, e é por isso que
> não há autorização de BACEN a obter. As escolhas que teriam custado reescrita na véspera —
> multi-tenant desde o primeiro commit, nenhum segredo no bundle, todo cálculo no servidor,
> exclusão lógica de dívida — já estão certas. O que falta é a camada de conta e a burocracia.

**Conta de usuário — entregue no M8.**

- [x] Autenticação real. O token fixo por QR (ADR 0006) saiu; entrou conta com e-mail e senha,
      sessão revogável e recuperação (ADR 0012).
- [x] **Exclusão de conta dentro do app** — Apple, diretriz 5.1.1(v). Física, em transação, com a
      senha reconfirmada.
- [x] **Página web de solicitação de exclusão** — `GET /exclusao`, servida pelo backend. Continua
      precisando de **URL pública**: hoje ela só existe onde a API existe. O domínio deixou de ser
      a incógnita em 20/08/2026 — é `devonada.com.br` —, e o que falta é hospedar a API num
      endereço estável e apontar o DNS.

**Declarações — nenhuma escrita.**

- [ ] Política de privacidade com URL pública.
- [ ] *App Privacy* (Apple) e *Data safety* (Google) preenchidos. Renda, gastos, dívidas e o
      contrato são o dado mais sensível do produto, e declarar errado é motivo comum de remoção.
- [ ] Declaração de recursos financeiros no Play Console. O app não empresta, mas administra
      dívida — essa seção do formulário precisa ser lida com atenção.
- [ ] Divulgar que o contrato é enviado a um provedor de LLM. A ADR 0005 e o guardrail 8 já
      sustentam o texto: o arquivo é **descartado** após a extração. O PDF pode conter CPF e
      dados de terceiros, e isso precisa estar dito.
- [~] **Caixa de e-mail `contato@devonada.com.br` funcionando.** O domínio foi definido em
      20/08/2026 e o endereço já está na página pública `GET /exclusao`, no lugar do da marca
      anterior (ADR 0020, item 3). **O que falta é a caixa existir e alguém
      ler**: é por ali que quem perdeu acesso ao app exerce o direito de excluir a conta, e a
      própria página promete resposta em até 30 dias. Endereço que não recebe é tão ruim quanto
      endereço errado. Ver ADR 0020, item 3.

**Cobrança — entregue no M9.**

- [x] Assinatura por **in-app purchase** (`expo-iap` + validação direta com as duas lojas). Sete
      dias de teste, somente leitura depois, preço vindo da loja (ADR 0013).
- [ ] **Produto de assinatura cadastrado** na App Store Connect e no Play Console, e as credenciais
      preenchidas (`DEVONADA_APPLE_*`, `DEVONADA_GOOGLE_*`). O código está pronto e a suíte prova o ciclo
      contra o adaptador de memória; **compra de verdade não foi exercitada uma única vez.**
- [ ] *Development build* pelo EAS. O Expo Go não carrega o módulo nativo da loja.

**Risco que não é de loja, e é o maior.**

- [ ] **Revisão da copy de negociação por advogado**, antes do público. Consultoria jurídica e
      postulação são privativas de advogado (Lei 8.906/94, art. 1º); informar sobre a lei não é.
      Os guardrails já fazem o certo — citar fonte, nunca afirmar ilegalidade, não redigir
      petição, disclaimer no card, teste que quebra em "ilegal" e "é seu direito" — e é essa
      postura que mantém o produto do lado certo da linha. É o único item da lista que pode
      **encerrar** o produto em vez de atrasar um release.
- [ ] Publicar sob **CNPJ**, não conta pessoal: app de serviço financeiro vem da entidade que
      presta o serviço.

**Validação em device.**

- [ ] M0 a M9, milestone a milestone. Está detalhado em cada um acima e não se resolve em lote:
      nenhum gate automático prova que a tela é legível, que o teclado não cobre o campo, que a
      notificação toca na hora certa ou que a sessão se renova quando o app volta do background.

---

## Pós-MVP — direção, não compromisso

- **Ingestão de dados de Open Finance** — extrato, saldo e cartão alimentando o contexto do
  assistente. Ver `docs/data-ingestion.md`. É o que transforma o produto de "assistente de
  dívidas" em planejador financeiro, e é também o maior salto de complexidade e de risco.
- **Renda, orçamento e metas** — o outro lado do fluxo de caixa.
- **Billing avançado** — signup no M8, in-app purchase no M9. Ficaram de fora, de propósito: plano
  anual, plano familiar, cupom e paywall com teste A/B. Nada disso antes do primeiro pagante.
- **Webhook de renovação** — *App Store Server Notifications V2* e RTDN do Google, quando houver
  URL pública. Substitui a reconferência sob demanda do M9 sem mudar o contrato da rota.
- **Segundo fator e login social** — ficaram de fora do M8 de propósito (ver os não objetivos da
  spec 008). Adotar login social obriga a oferecer *Sign in with Apple*, diretriz 4.8.
- **Conta compartilhada** — casal olhando o mesmo caixa. O modelo já suporta: `usuario.tenant_id`
  é coluna separada de `usuario.id` exatamente por isso. Falta rota de convite.
- **Offline-first** com storage cifrado. `AsyncStorage` cru está descartado por `guardrails.md`,
  seção 5.
- **Proteção contra screenshot** nas telas de dívida.
- **Acessibilidade auditada** com leitor de tela real, não só `accessibilityLabel` presente.
- **Teste que amarra a migração ao `Base.metadata`.** Hoje nada liga os dois: `backend/tests/
  conftest.py` monta o schema com `Base.metadata.create_all`, não pelo Alembic, então **uma
  migração quebrada ou divergente do ORM passa a suíte inteira verde**. O buraco apareceu ao
  escrever a migração do M11 (F-010, T1), e a conferência que o fechou naquela vez foi manual —
  DDL rendido × `CreateTable(Base.metadata)`, mais o round-trip contra o Postgres local. Isso não
  escala: a próxima divergência entre ORM e migração passa sem ninguém tropeçar nela. É a mesma
  classe de defeito que `tabelas_do_tenant()` derivada do metadata resolveu para exclusão de conta
  no M8 — lista escrita à mão envelhece; verificação derivada, não.

---

## Sequência até dezembro

A única seção deste documento com datas. Ela é escrita de trás para frente, a partir do dia do
curso.

| Quando | O quê |
|---|---|
| **Ago, sem. 1** | M10 fechado: fork, marca, gates verdes. *(feito em 10/08)* |
| **Ago–Set** | M11 (Respiro) — *código fechado em 20/08, aguardando device* — e M12 (renda tipada + script por canal) |
| **Set–Out** | M13 (entrada pelo alívio) e M14 (Lei do Superendividamento) |
| **Fim de Out** | **Feature freeze.** Daqui em diante só bugfix, polimento e device |
| **Nov, sem. 1–2** | Submissão nas lojas |
| **Nov, sem. 2–4** | Beta fechado com 10–20 pessoas da própria igreja |
| **Dez** | Lançamento no curso |

**Submeter em novembro não é folga, é seguro de vida.** O review da Apple fica lento e
imprevisível em dezembro, e a data do curso não se move.

**Contingência, definida agora e não em novembro:** se as lojas atrasarem, o curso recebe
TestFlight/APK mais a calculadora de valor justo na web. Ninguém sai de mãos vazias nem no pior
cenário.

**Dois itens que não são código e podem parar o lançamento** — ambos precisam começar em agosto:

1. **Revisão da copy de negociação por advogado.** Consultoria jurídica e postulação são
   privativas de advogado (Lei 8.906/94, art. 1º); informar sobre a lei não é. Os guardrails já
   fazem o certo — citar fonte, nunca afirmar ilegalidade, não redigir petição, disclaimer no
   card, teste que quebra em "ilegal" e "é seu direito". É o único item da lista que pode
   **encerrar** o produto em vez de atrasar um release.
2. **Publicar sob CNPJ**, não conta pessoal.

E um risco que não é técnico e merece ser dito: **o que decide este lançamento não é o roadmap, é
quantas horas por semana dá para proteger para ele** entre os clientes. Essa conta vale ser feita
honestamente antes de a data ser prometida à igreja.

---

## Métrica de ativação — instrumentar desde já

O momento "aha" deste produto é **a primeira negociação registrada com desconto**. Tudo no
onboarding deve ser medido contra isso: quantos % chegam lá, e em quantos dias. É essa taxa que
diz se o produto funciona, muito antes de qualquer número de receita.

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
