# FDD — Documento durante a fila multi-dívida do onboarding

## Cabeçalho

| | |
|---|---|
| Feature | Documento lido inline na fila multi-dívida do onboarding |
| Slug | F-015-documento-na-fila |
| Milestone | M13 (ver `roadmap.md`) |
| Telas | `app/(onboarding)/entrada.tsx`; espelha `app/(tabs)/dividas/contrato/[id].tsx` |
| Endpoints | `POST /v1/contratos`, `GET /v1/contratos/{id}`, `POST /v1/dividas` (com `extracaoId`) |
| Depende de | ADR 0016 (fila; ponto 5 revogado pela ADR 0022), ADR 0005 (descarte), ADR 0008 (valorJusto), guardrail 8 |

## Objetivo e não objetivos

Quem marca **duas ou mais** dívidas no onboarding hoje cadastra tudo por valor e recebe uma triagem
sem achado — porque `/dividas/contrato` vive fora do grupo `(onboarding)` e ir para lá abandonaria a
fila (ADR 0016, ponto 5). Esta feature permite **mandar o documento de cada dívida ali dentro da
fila**, com a leitura rodando inline, para a dívida nascer ligada à extração e a triagem dela ter
valor justo, achados com fonte e script — o "aha" que hoje só quem tem uma dívida recebe.

A feature tem **dois escopos**:

- **Parte 1 (bug pré-existente).** A ligação dívida→extração está quebrada no cliente: o backend
  aceita e grava `extracaoId`, mas nenhum código do app o envia. Conserto do tipo `NovaDivida`, de
  `extracaoParaProposta` e do `DividaForm`, para o `extracaoId` viajar da proposta até o POST.
- **Parte 2 (a feature).** Upload de documento inline na fila, com revisão campo-a-campo e vínculo
  no POST final.

**Não objetivos:**

- **Não** escolher o TIPO de documento (boleto/carta/print) inline. A leitura da fila assume
  contrato — o tipo que produz os achados que motivam a decisão. A variante de UMA dívida, que
  empurra para `/dividas/contrato`, mantém a escolha de tipo completa.
- **Não** persistir a fila entre rotas (caminho (b) da ADR 0022, descartado).
- **Não** mudar a variante de uma dívida marcada: documento primeiro, valor como alternativa,
  intocado.
- **Não** reescrever a ADR 0016 — a ADR 0022 revoga só o ponto 5.

## Jornada e interface

Passo 2 do onboarding, variante de fila (2+ dívidas). Para cada dívida, um "Mandar o documento"
**opcional** ao lado dos dois campos. Ao tocar:

1. **Aviso de descarte à vista ANTES do toque** (guardrail 8.3): o arquivo é lido e descartado.
2. Seletor nativo (`SeletorDeArquivo`).
3. Upload (`useEnviarContrato`) e leitura (`useExtracao`, polling 2,5 s, teto 2 min), **inline** —
   sem sair de `(onboarding)`.

**Os quatro estados da leitura inline:**

- **Enviando / lendo (carregando):** `LoadingState` com rótulo; ao estourar o teto, aviso de demora
  com "Verificar de novo" e "Seguir só pelo valor".
- **Erro (upload/rede) / falhou (extração):** `Feedback` com a mensagem, e as saídas "Tentar de
  novo/outro arquivo" e "Seguir só pelo valor" — a fila nunca vira beco.
- **Vazio:** extração sem nenhum campo com trecho → aviso "melhor seguir só pelo valor nessa".
- **Conteúdo (lido):** revisão **campo a campo com o trecho de origem** (`linhasDeRevisao` +
  `CampoRevisao`), texto puro. "Usar estes dados" confirma; "Descartar e digitar" volta ao
  formulário.

Ao confirmar, os campos propostos (via `extracaoParaProposta`) e o `extracaoId` entram na
`Resposta` **local** daquela dívida, e o formulário volta preenchido. No fim da fila, o
`enviarTudo()` cria cada dívida — as com `extracaoId` ligadas à extração, as sem seguem por valor.

## Contrato

- **Endpoints:** nenhum novo. `POST /v1/contratos` e `GET /v1/contratos/{id}` (M1.5) rodam inline;
  `POST /v1/dividas` ganha `extracaoId` opcional (já aceito pelo backend desde sempre — ver
  `api-contract.md`, `POST /v1/dividas` e "POST /v1/dividas com vínculo").
- **Tipos:** `NovaDivida` (`src/api/debts.ts`) ganha `extracaoId?: Uuid`. Nenhuma mudança em
  `src/api/types.ts`.
- **Chaves de cache:** a fila é estado local; o POST final invalida `['dividas']` via
  `useCriarDivida`. A leitura usa `contratosKeys.extracao(id)`.
- **Unidades:** dinheiro em centavos inteiros; taxa em basis points. Nenhum cálculo no cliente.

## Requisitos funcionais

- **RF-001** — `NovaDivida` carrega `extracaoId?` e `createDebt` o envia.
- **RF-002** — `extracaoParaProposta` inclui o `extracaoId` da extração (a chave da leitura, isenta
  do descarte do guardrail 8.1), mantendo o descarte de campo sem trecho para os campos lidos.
- **RF-003** — `DividaForm` repassa `inicial.extracaoId` ao `onSubmit` sem que ele vire campo
  editável.
- **RF-004** — Na variante de fila, cada dívida oferece "Mandar o documento" opcional; quem não
  manda segue por valor.
- **RF-005** — A leitura roda inline, sem `router.push` para fora de `(onboarding)`, tratando os
  quatro estados.
- **RF-006** — Antes de a dívida entrar na fila, a revisão mostra **campo a campo com o trecho**;
  só após confirmação a `Resposta` recebe os campos e o `extracaoId`.
- **RF-007** — No POST final, cada dívida com `extracaoId` é criada ligada à extração; nada é
  gravado como `divida` antes do `enviarTudo()`.
- **RF-008** — O aviso de descarte do arquivo aparece antes do toque que abre o seletor.

## Guardrails desta feature

| Guardrail | Como a feature o respeita |
|---|---|
| 8.1 — extração é proposta, não gravação | Revisão campo-a-campo com trecho antes de confirmar; `extracaoParaProposta` descarta campo sem trecho. `extracaoId` é a chave da leitura, não campo lido — exceção declarada na ADR 0022. |
| 8.2 — trecho é texto puro | `CampoRevisao` renderiza o trecho como texto puro, `selectable`, nunca markdown/link. |
| 8.3 — arquivo lido e descartado, aviso antes do upload | Aviso de descarte à vista antes do toque; nenhum trecho em log. |
| ADR 0016 ponto 4 — nada gravado antes do fim | Extração ≠ criação de dívida: grava linha `extracao`, nunca `divida`. POST único no fim. |
| 1.2 — app não calcula valor | Só formatação (`linhasDeRevisao`); nenhuma aritmética monetária no cliente. |
| 5 — nada sensível em log | Nenhum credor, valor ou trecho em log/analytics. |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Todos os endpoints consumidos estão especificados em `docs/api-contract.md`.
- [x] Estados de erro e de vazio definidos, não só o caminho feliz.
- [x] Guardrails aplicáveis identificados.
- [x] Copy em pt-BR revisada contra o vocabulário de `docs/domain.md`.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint` e `npm test` passam.
- [x] Os quatro estados implementados e verificáveis.
- [x] Nenhum valor monetário calculado no cliente.
- [x] Nenhum dado financeiro ou pessoal em log, analytics ou mensagem de erro.
- [x] Alvo de toque de 48pt e `accessibilityLabel` em controle sem texto (todos os controles têm
      rótulo visível).
- [ ] Testado em iOS e Android — **pendente de device** (seletor nativo, safe area, teclado).
- [x] Documentos canônicos afetados atualizados no mesmo commit.

## Riscos e modos de falha

- **A leitura assíncrona faz a fila esperar.** Mitigação: os quatro estados e o teto de 2 min com
  saída "seguir só pelo valor" — a espera nunca vira travamento.
- **Documento tratado como contrato quando não é.** Aceito como não objetivo (a variante de uma
  dívida tem a escolha de tipo). A revisão campo-a-campo expõe o que foi lido antes de aceitar.
- **Vínculo perdido de novo.** O par de testes (`extracao.test.ts`, `contrato.test.tsx`,
  `onboarding.test.tsx`) quebra se qualquer elo — tipo, util, form, fila — se romper.
