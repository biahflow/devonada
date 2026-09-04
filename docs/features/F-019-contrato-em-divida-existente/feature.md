# FDD — Documento em dívida já cadastrada

## Cabeçalho

| | |
|---|---|
| Feature | Anexar documento a uma dívida que já existe, com conciliação campo a campo |
| Slug | F-019-contrato-em-divida-existente |
| Milestone | Sem milestone novo — fecha a **lacuna nº 1** de `docs/inventario.md`, Parte III, antes do feature freeze de outubro |
| Telas | `app/(tabs)/dividas/[id]/documento.tsx` (nova) · `app/(tabs)/dividas/[id]/index.tsx` · `app/(tabs)/dividas/[id]/revisao.tsx` · `app/(tabs)/dividas/contrato/[id].tsx` (refactor) |
| Endpoints | `POST /v1/dividas/{id}/documento` (novo) · `POST /v1/contratos` · `GET /v1/contratos/{id}` · `GET /v1/dividas/{id}` |
| Depende de | ADR 0025 (esta feature), ADR 0005 (descarte), ADR 0008 (valorJusto vem dos achados), guardrail 8, M1.5 |

## Objetivo e não objetivos

Quem cadastra a dívida à mão fica **permanentemente fora da revisão de cobrança**. `revisao._campos`
sai por `None` quando `divida.extracao_id` é nulo (`backend/routers/revisao.py:37-38`), o domínio
recebe um `Contrato` só com `valor_cobrado`, nenhuma das cinco checagens consegue produzir achado
(`revisao.py:59-61`), e sem achado não há `valorJusto` (ADR 0008). É a limitação 7 do
`docs/inventario.md` — e, como o fluxo de documento sempre termina em **criação**
(`contrato/[id].tsx:142`), não havia como sair dela a não ser cadastrando a dívida de novo.

Pior: a tela **convida** para uma porta que não existe. O vazio da revisão diz "envie o contrato e a
gente revisa ponto a ponto" (`revisao.tsx:105-114`) e não tem botão nenhum.

Esta feature abre o caminho: da dívida existente, mandar o documento, conciliar campo a campo o que
o documento diz com o que a pessoa digitou, e ligar a extração — para a revisão daquela dívida
passar a produzir achados com fonte, `valorJusto` e script.

**Não objetivos:**

- **Não** guardar histórico de documentos. Uma dívida tem no máximo um vínculo; ligar de novo
  substitui, e a tela **nomeia** a substituição (ADR 0025, decisão 6).
- **Não** aceitar `extracaoId` no `PATCH /v1/dividas/{id}`. O formulário de edição não liga
  documento (ADR 0025, decisão 1).
- **Não** mexer em `app/(onboarding)/entrada.tsx`. A fila multi-dívida tem invariante próprio
  (ADR 0022, "nada gravado antes do fim") e continua com sua cópia da máquina de estados. Ficam
  duas cópias em vez de três, e a dívida fica declarada.
- **Não** criar migração. `divida.extracao_id` existe desde `8864a227fc79_inicial.py:38`.
- **Não** exibir os encargos (tarifa, seguro, IOF, multa, CET, modalidade) na conciliação. Eles não
  têm coluna em `Divida` — viajam com o vínculo e aparecem na revisão, como achado.

## Jornada e interface

**Duas entradas, e as duas já deviam existir:**

1. **Detalhe da dívida** (`[id]/index.tsx`, array de ações, linhas 133-162): "Mandar o documento"
   quando `divida.extracaoId` é nulo, "Trocar o documento" quando não é.
2. **O vazio da revisão** (`revisao.tsx:105-114`): a frase que já convida ganha o botão que falta.

As duas levam a `app/(tabs)/dividas/[id]/documento.tsx`.

**O caminho:**

1. **Aviso de descarte à vista, ANTES do toque** que abre o seletor (guardrail 8.3).
2. Escolha do tipo de documento — contrato · boleto · carta · print, o mesmo `OptionGroup` de
   `contrato/index.tsx`. Sem restrição: a dívida existente pode receber qualquer um dos quatro.
3. `escolherArquivo()` → `useEnviarContrato` → `useExtracao` (polling 2,5 s, teto 2 min).
4. **Os quatro estados**, pelo `PainelDeDocumento` novo (ver Contrato):
   - **Carregando:** `LoadingState`; ao estourar o teto, aviso de demora com "Verificar de novo" e
     "Voltar para a dívida".
   - **Erro** (rede/upload) e **falhou** (extração): `Feedback` com a mensagem, saídas "Tentar outro
     arquivo" e "Voltar para a dívida". Nunca beco.
   - **Vazio:** extração concluída sem nenhum campo com `trecho` → "não deu para ler nada citável
     nesse arquivo", com as mesmas saídas. Nada é ligado.
   - **Conteúdo:** a conciliação, abaixo.
5. **Conciliação campo a campo**, com o trecho de origem à vista, em três situações por campo:

   | Situação | Quando | O que a tela faz |
   |---|---|---|
   | **confere** | documento e dívida dizem o mesmo | mostra os dois e marca que confere. Nada a decidir. |
   | **diverge** | documento e dívida discordam | "você informou X · o documento diz Y", com o trecho. **Desmarcado por padrão** — o digitado vence (ADR 0025, decisão 3). |
   | **preenche** | a dívida não tem o campo | oferece o valor lido, **já marcado** — não há afirmação anterior a sobrescrever. |

   Campos participantes: os que `Divida` tem coluna para e o `PATCH` aceita — `credor`,
   `valorCobrado`, `dataOrigem`, `tipo`, `taxaJurosMensal`. Campo sem `trecho` já foi descartado
   por `extracaoParaProposta` e não chega aqui (guardrail 8.1).

6. **Confirmar** → `POST /v1/dividas/{id}/documento` com `{ extracaoId, campos }`, onde `campos`
   traz **só o que ficou marcado**. Sucesso → invalida `['dividas']` e
   `router.replace('/dividas/{id}/revisao')` — a pessoa cai exatamente na tela onde o documento que
   ela acabou de mandar virou achado. É o "aha" da feature, e escondê-lo atrás de mais um toque
   seria desperdiçá-lo.
7. **Descartar** → volta para a dívida sem ligar nada.

**Quando tudo confere**, a tela diz que o documento confirma o que ela já tinha informado, e o
vínculo acontece assim mesmo — é ele que destrava os encargos, que são a matéria-prima dos achados.

## Contrato

- **Endpoints:** `POST /v1/dividas/{id}/documento` — novo, especificado em `docs/api-contract.md`,
  seção 3.16, **antes** desta implementação. `POST /v1/contratos` e `GET /v1/contratos/{id}`
  inalterados. `Divida` passa a devolver `extracaoId`.
- **Tipos:** `Divida` (`src/api/types.ts`) ganha `extracaoId?: Uuid | null`. Novo
  `ligarDocumento(dividaId, { extracaoId, campos })` em `src/api/debts.ts`. Novo hook
  `useLigarDocumento(id)` em `src/hooks/useDividas.ts`, invalidando `['dividas']` como as irmãs.
- **Chaves de cache:** lê `contratosKeys.extracao(id)` e `dividasKeys.detail(id)`; invalida
  `dividasKeys.all` (prefixo inteiro, como toda mutação de dívida hoje).
- **Unidades:** dinheiro em centavos inteiros, taxa em basis points. **Nenhum cálculo no cliente** —
  a conciliação compara e formata, nunca soma.
- **Componente novo:** `src/components/dividas/PainelDeDocumento.tsx` — a máquina de quatro estados
  extraída, consumida pela tela nova **e** por `contrato/[id].tsx`. `entrada.tsx` fica intacto.
- **Util novo:** `src/util/conciliacao.ts` — função pura `linhasDeConciliacao(proposta, divida)`,
  testável sem tela, que classifica cada campo em `confere` · `diverge` · `preenche`.

## Requisitos funcionais

- **RF-001** — `POST /v1/dividas/{id}/documento` liga extração concluída do mesmo tenant a uma
  dívida existente e devolve a `Divida` atualizada.
- **RF-002** — Vínculo e campos aceitos são **atômicos**: ou entram os dois, ou nenhum.
- **RF-003** — `campos` ausente ou vazio **não muda nada** na dívida. Só o marcado viaja.
- **RF-004** — Extração inexistente ou de outro tenant → `404`; nunca `403`.
- **RF-005** — Extração com `status` diferente de `concluida` → `409`.
- **RF-006** — Ligar documento numa dívida que já tem um **substitui** o vínculo.
- **RF-007** — `POST /v1/dividas` passa a usar o **mesmo** validador: `extracaoId` inválido, de
  outro tenant ou não concluído deixa de ser gravado em silêncio.
- **RF-008** — `Divida` devolve `extracaoId` em `GET /v1/dividas` e `GET /v1/dividas/{id}`.
- **RF-009** — O detalhe da dívida oferece "Mandar o documento" ou "Trocar o documento" conforme
  `extracaoId`.
- **RF-010** — O vazio da revisão ganha o botão que a sua própria frase promete.
- **RF-011** — A tela nova trata os quatro estados, e nenhum deles é beco sem saída.
- **RF-012** — A conciliação classifica cada campo em `confere` · `diverge` · `preenche`, mostra o
  trecho de origem, e **`diverge` nasce desmarcado**.
- **RF-013** — Confirmar leva à revisão da dívida, onde o achado agora existe.
- **RF-014** — `PainelDeDocumento` é consumido pela tela nova e por `contrato/[id].tsx`, sem
  regressão na segunda.

## Guardrails desta feature

| Guardrail | Como a feature o respeita |
|---|---|
| 8.1 — extração é proposta, nunca gravação | Conciliação campo a campo com trecho à vista; `diverge` desmarcado por padrão; campo sem trecho descartado por `extracaoParaProposta`. |
| 8.2 — trecho é texto puro | `CampoRevisao` renderiza `selectable`, nunca markdown, HTML ou link. |
| 8.3 — arquivo lido e descartado | Aviso antes do toque que abre o seletor. |
| 1.2 — o app nunca calcula valor derivado | A conciliação compara e formata. Nenhuma aritmética monetária no cliente. |
| 1.3 — números exibidos têm procedência | É o guardrail que motiva a feature inteira: sem conciliação, a revisão compararia "cobrado" de uma fonte com "justo" de outra sem dizer. |
| 5 — nada sensível em log | Nenhum credor, valor ou trecho em log, analytics ou mensagem de erro. |
| 6 — multi-tenant | O validador novo confere o tenant da extração **na escrita**, que era o lado desprotegido. |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Todos os endpoints consumidos estão especificados em `docs/api-contract.md` (seção 3.16).
- [x] Estados de erro e de vazio definidos, não só o caminho feliz.
- [x] Guardrails aplicáveis identificados.
- [x] Copy em pt-BR revisada contra o vocabulário de `docs/domain.md`.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint` e `npm test` passam — 54 suítes / 702 testes.
- [x] `pytest` passa: baseline **819** → **837**.
- [x] `npm run palette:check` e `npm run digits:check` — exit 0, nenhum par de cor novo.
- [x] Os quatro estados implementados e verificáveis.
- [x] Nenhum valor monetário calculado no cliente — a conciliação compara e formata.
- [x] Nenhum dado financeiro ou pessoal em log, analytics ou mensagem de erro.
- [x] Alvo de toque de 48pt e `accessibilityLabel` em controle sem texto.
- [ ] Testado em iOS e Android — **pendente de device**.
- [x] Documentos canônicos afetados atualizados no mesmo commit.

## Riscos e modos de falha

- **A conciliação vira formulário de novo.** Se a tela pedir decisão em campo demais, a pessoa
  desiste no meio e não liga o documento. Mitigação: `confere` não pede decisão nenhuma, e
  `preenche` já vem marcado — só `diverge` exige toque, e divergência é rara quando a pessoa
  digitou olhando o próprio documento.
- **Substituição silenciosa.** Trocar documento apaga o vínculo anterior. Mitigação: o botão se
  chama "Trocar o documento" e a tela diz o que a troca faz, em vez de descobrir depois.
- **O refactor do `PainelDeDocumento` quebra `contrato/[id].tsx`.** Mitigação: as 176 linhas de
  `src/test/screens/contrato.test.tsx` são o oráculo — incluindo o teste de regressão do
  `extracaoId` no POST (linhas 138-154). Elas não podem ser reescritas para acomodar o refactor.
- **A validação nova quebra cliente antigo.** `POST /v1/dividas` passa a recusar `extracaoId`
  inválido. Verificado: os dois caminhos que enviam o campo só o fazem com extração própria e
  `concluida`. Declarado em `api-contract.md` e na ADR 0025.
