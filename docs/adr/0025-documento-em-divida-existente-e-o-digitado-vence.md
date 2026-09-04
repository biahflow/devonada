# ADR 0025 — Documento em dívida existente entra por rota própria, e o que a pessoa digitou vence

**Status:** aceito
**Data:** 2026-09-03

## Contexto

O fluxo de documento nasceu global: envia o arquivo, lê, **cria** dívida. `contrato/[id].tsx:142`
termina em `criar.mutate`, e é o único desfecho que existe. Nunca houve caminho para levar um
documento a uma dívida **que já existe**.

O custo disso não é de conveniência, é do valor central do produto. Dívida cadastrada à mão devolve
`achados: []` (limitação 7 do `docs/inventario.md`), porque `revisao._campos` sai por `None` quando
`divida.extracao_id` é nulo (`backend/routers/revisao.py:37-38`) e `_contrato` então monta um
`Contrato` só com `valor_cobrado`, do qual nenhuma das cinco checagens consegue produzir achado
(`revisao.py:59-61`). Sem achado não há `valorJusto` (ADR 0008). Quem entrou pelo caminho manual
fica permanentemente fora da revisão de cobrança — que é a razão de o produto existir.

E a tela dizia isso na cara do usuário sem oferecer saída: o vazio da revisão convida a "envie o
contrato e a gente revisa ponto a ponto" (`app/(tabs)/dividas/[id]/revisao.tsx:105-114`) e **não
tem botão nenhum**. Convite para uma porta que não existe.

Três fatos do código moldaram a decisão, e dois deles são armadilhas:

1. **`divida.extracao_id` já existe desde a migração inicial** (`8864a227fc79_inicial.py:38`):
   `String(36)`, nullable, sem `unique`, sem `ForeignKey` declarada — vínculo lógico
   unidirecional `Divida → Extracao`. **Não falta coluna, falta caminho.** Esta ADR não gera
   migração.
2. **O caminho mais curto é um caminho morto.** `PatchDivida` no cliente é
   `Partial<NovaDivida>` (`src/api/debts.ts:26`), então o tipo do front **já aceita** `extracaoId`
   num PATCH. Mas `schemas.PatchDivida` (`backend/schemas.py:61`) não tem o campo, e `Camel` usa
   `ConfigDict(populate_by_name=True)` — o `extra` do Pydantic v2 é `ignore`. Mandar `extracaoId`
   no PATCH **compila, roda, devolve 200 e não faz nada.**
3. **A escrita do vínculo nunca foi validada.** `POST /v1/dividas` grava `extracao_id=nova.extracaoId`
   cru (`backend/routers/dividas.py:109`), sem conferir existência, tenant ou status. A única
   blindagem que existe é de **leitura** (`revisao.py:41-43` filtra a extração por tenant), o que
   barra vazamento entre tenants mas deixa a coluna aceitar qualquer string.

## Decisão

**1. Rota própria, não `extracaoId` no PATCH.**

`POST /v1/dividas/{id}/documento`, corpo `{ extracaoId, campos? }`. O PATCH é o formulário de
edição; ligar documento tem pré-condições que edição de campo não tem (a extração existe, é do
mesmo tenant, terminou). Enfiar as duas coisas na mesma rota faria o formulário de edição capaz de
re-ligar documento por acidente — e, pior, manteria de pé a armadilha 2, em que um cliente
desatualizado acha que ligou e não ligou.

**2. Vínculo e campos aceitos viajam na MESMA chamada, e ou entram os dois ou nenhum.**

"O documento chegou e eis o que eu aceito dele" é **uma** ação do usuário. Partir em `PATCH` +
`POST …/documento` cria a falha parcial pior possível: os campos do documento gravados e o vínculo
não, que é exatamente a dívida que exibe número de documento **sem** achado que o sustente.

**3. O que a pessoa digitou vence por padrão. A extração nunca sobrescreve em silêncio.**

`campos` é opcional e **ausente significa "não mude nada"**. A tela mostra lado a lado — "você
informou X · o documento diz Y", com o trecho à vista — e só vai para o corpo da requisição o que a
pessoa marcou. Campo vazio na dívida se oferece a ser preenchido; campo preenchido não muda sem
toque.

Isto é o guardrail 8.1 aplicado ao caso que ele não previa. Ele foi escrito para a **criação**
("nada vira dívida sem o usuário revisar campo a campo"); aqui a dívida já existe, e o número já
foi confirmado uma vez pela pessoa. Um modelo de linguagem reescrevendo em silêncio um valor que o
usuário digitou é a mesma falha da seção 1.2 — LLM como fonte da verdade sobre dinheiro — com o
agravante de apagar uma afirmação humana anterior.

**4. `schemas.Divida` passa a expor `extracaoId`.**

Hoje o vínculo é *write-only*: entra em `NovaDivida`, nunca volta na leitura
(`backend/schemas.py:74`, `src/api/types.ts:34-60`). Sem ele o app não tem como saber se a dívida
já tem documento, e a única forma de oferecer "mandar" ou "trocar" seria adivinhar.

**5. O validador de escrita é um só, e `POST /v1/dividas` passa a usá-lo.**

Ampliação de escopo aceita e declarada: F-019 escreveria esse validador de qualquer jeito, e deixar
a criação sem validação enquanto a rota nova valida seria incoerência dentro do mesmo commit.
Extração inexistente ou de outro tenant → **404** (nunca 403, pela mesma razão de `_buscar`:
um 403 confirmaria que o id existe). Extração que não terminou → **409**, conflito de estado.

**6. Uma dívida tem no máximo um documento, e ligar de novo substitui.**

`extracao_id` é coluna única, não lista. Substituir é o comportamento honesto — quem mandou o
boleto e depois achou o contrato quer o contrato —, e a tela **nomeia** a substituição em vez de
fazê-la calada. Esta ADR não cria histórico de documentos anteriores; a extração substituída
continua existindo, apenas deixa de ser apontada.

## Consequências

- Dívida cadastrada à mão deixa de ser condenada a `achados: []`. A limitação 7 do
  `docs/inventario.md` passa a ter saída, e a lacuna nº 1 da Parte III fecha.
- O vazio da revisão vira caminho de verdade, e o convite deixa de mentir.
- **Mudança de comportamento a declarar:** `POST /v1/dividas` com `extracaoId` inválido, de outro
  tenant ou não concluído passa a **falhar** onde antes gravava em silêncio. Nenhum cliente legítimo
  é atingido — os dois caminhos que enviam `extracaoId` (`contrato/[id].tsx` e a fila do onboarding)
  só o fazem com extração própria e `status === 'concluida'`.
- Terceira cópia da máquina de quatro estados **não** nasce: o painel vira componente
  (`PainelDeDocumento`), consumido pela tela nova e por `contrato/[id].tsx`. `entrada.tsx` fica
  intacto de propósito — a fila multi-dívida tem invariante próprio (ADR 0022) e mexer nela no mesmo
  commit é risco sem retorno. Ficam **duas** cópias em vez de três, e a dívida fica declarada.
- Sem migração. A coluna já existia; o que faltava era caminho.

## Alternativas consideradas

- **`extracaoId` no `PATCH /v1/dividas/{id}`.** Menor diff aparente. Descartada por misturar edição
  com vínculo, por deixar o formulário de edição capaz de re-ligar documento sem intenção, e por
  manter viva a armadilha do campo silenciosamente ignorado.
- **Extração passa a apontar a dívida (`extracao.divida_id`).** Exigiria migração e inverteria um
  vínculo que já funciona na direção certa: quem precisa saber a origem é a dívida, e é ela que a
  revisão carrega em mãos.
- **O documento vence e sobrescreve os campos.** Menos toques. Descartada por violar o guardrail
  8.1 e por reescrever em silêncio número que a pessoa já confirmou.
- **Só ligar o vínculo, sem tocar em campo nenhum.** Menor diff real, e coerente com
  `revisao.py:66-69`, onde a taxa da dívida já vence a do contrato. Descartada porque, quando o
  valor digitado diverge do documento, a tela passaria a comparar "cobrado" de uma fonte com
  "justo" de outra **sem dizer** — o tipo de número sem procedência que o guardrail 1.3 proíbe.
