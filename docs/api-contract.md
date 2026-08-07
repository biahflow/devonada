# Contrato de API — o que o front espera do backend

> Documento vivo. Esta é a **especificação que o backend precisa satisfazer** para que as telas
> do `roadmap.md` funcionem. Escrito da perspectiva do cliente: o front é o consumidor, e este
> arquivo é o pedido.
> Quando o contrato mudar, `src/api/types.ts` e este documento mudam **no mesmo commit**.

---

## 1. Regras transversais

- **Base URL** em `EXPO_PUBLIC_API_BASE_URL`. Todas as rotas são versionadas sob `/v1/`.
- **Auth:** `Authorization: Bearer <token>`. O token guarda o `tenant_id`; **o cliente nunca
  envia tenant** em query, body ou header. Ver `guardrails.md`, seção 6.
- **Todo valor monetário é inteiro em centavos.** `150000` significa R$ 1.500,00. Nunca float,
  nunca string. Vale para request e response.
- **Datas em ISO 8601.** Data pura: `"2024-03-15"`. Instante: `"2024-03-15T13:45:00Z"`.
- **`id` é UUID em string.** O front tipa como `Uuid = string`.
- **Content-Type `application/json`** nos dois sentidos.
- **Nenhum cálculo é delegado ao cliente.** Se um número aparece na tela, ele veio pronto num
  campo desta especificação. Ver ADR 0003.
- Campos opcionais são omitidos ou `null`; o front trata os dois como ausência e exibe
  "ainda não calculado", nunca zero.

### 1.1 Formato de erro

`src/api/client.ts` normaliza qualquer falha em `ApiError { status, message, body }`. Ele
procura um campo `message` na resposta e o exibe **direto ao usuário**. Portanto:

```json
{ "message": "Não encontramos essa dívida.", "campo": "id" }
```

- `message` é obrigatório em toda resposta de erro, em **pt-BR**, redigido para o usuário final
  — não é `stack trace` nem string técnica.
- `message` **nunca contém dado sensível** (valor, CPF, nome de credor). Ver `guardrails.md`,
  seção 5.
- Em `422`, inclua `campo` com o nome do campo inválido, para o front destacá-lo no formulário.

| Status | Quando usar | O que o front faz |
|---|---|---|
| `400` / `422` | payload inválido | erro por campo no formulário |
| `401` | token ausente, inválido ou expirado | limpa o token e vai para o login |
| `403` | autenticado, sem permissão | banner de erro |
| `404` | recurso inexistente ou de outro tenant | estado vazio da tela |
| `409` | conflito de estado (ex.: quitar dívida já quitada) | banner + revalidação |
| `5xx` | falha do servidor | banner + retry manual |

O front **não retenta `4xx`**; retenta `0` (sem conexão) e `5xx` no máximo duas vezes.

### 1.2 Divergências conhecidas com o backend atual

> **O backend faz parte do repositório e é desenvolvido por agentes também** — ver `CLAUDE.md` e
> `docs/backend.md`. A versão anterior desta seção dizia o contrário e listava cinco divergências
> que já não existem (`id: int`, `tipo` sem validação, sem persistência, auth ignorada). Todas
> foram resolvidas no Bloco 0 da fila. O que sobrou está abaixo.

1. **Auth é de beta: um token, um tenant.** Suficiente para um usuário, insuficiente no dia em
   que houver dois. A troca por JWT não muda o cliente, que já manda `Bearer` e trata `401`.
2. **LLM exige chave do provedor configurado** (`OPENAI_API_KEY` por padrão; ver ADR 0007). Sem
   ela, o chat responde `503` e a leitura de contrato responde `status: "falhou"`, ambos com
   frase útil — o app trata os dois estados e oferece o caminho manual.
3. ~~`valor_justo` ainda não é calculado~~ — **resolvido no M6.** `GET /v1/dividas/{id}/revisao`
   o produz, e o chat passou a emitir o card. O que mudou não foi a disposição de inventar a
   regra: foi a definição do campo. `valorJusto` deixou de ser estimativa ("quanto deveria
   custar", que não tem fonte) e passou a ser subtração dos achados citáveis. Ver ADR 0008.

As limitações **declaradas** do cálculo (o que o backend deliberadamente não calcula, e por quê)
estão em `docs/backend.md`, não aqui: elas não são divergências a corrigir, são decisões.

---

## 2. Endpoints existentes

### `GET /` — health check
```json
{ "status": "ok" }
```

### `POST /v1/chat/messages`
Consumido por `src/api/chat.ts`.

Request:
```json
{ "content": "Recebi uma cobrança de R$ 1.500 do Banco Teste" }
```

Response `200`:
```json
{
  "message": {
    "id": "6f1e...",
    "role": "assistant",
    "content": "Vamos olhar essa cobrança com calma.",
    "cards": [
      {
        "kind": "valor_justo",
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000,
        "valorJusto": 90000,
        "script": "Olá, gostaria de negociar...",
        "fundamentos": ["CDC art. 42", "CDC art. 51"]
      }
    ],
    "createdAt": "2024-03-15T13:45:00Z"
  }
}
```

`cards` é opcional. **Todo número comunicado ao usuário vai num card**, nunca no `content`.

Desde o M5 esta rota fala com os dados reais do usuário — ver a seção M5 para os `kind` novos,
para o `GET` do histórico e para como o guardrail acima é sustentado no servidor.

`503` quando o assistente não está disponível (sem chave configurada, ou falha do provedor), com
`message` em pt-BR. A pergunta do usuário **já foi gravada** antes: o que ele escreveu não se
perde por falha nossa.

### `GET /v1/dividas`
Consumido por `listDebts()` em `src/api/debts.ts`.

Response `200`:
```json
{ "dividas": [ { "id": "...", "credor": "...", "valorCobrado": 150000, "dataOrigem": "2021-06-01", "tipo": "juros_abusivos", "valorCorrigido": 165000, "possivelPrescricao": false } ] }
```

### `POST /v1/dividas`
Consumido por `createDebt()`.

Request — os campos que o usuário informa. `taxaJurosMensal` é **opcional** e vem em basis
points inteiros; quando o usuário não a informa, o campo é **omitido** do payload, nunca enviado
como `0` (ausência e "juros zero" são afirmações diferentes):
```json
{ "credor": "Banco Teste S/A", "valorCobrado": 150000, "dataOrigem": "2021-06-01", "tipo": "juros_abusivos", "taxaJurosMensal": 1250 }
```

Response `201`: `{ "divida": Divida }` — com `id`, `valorCorrigido` e `possivelPrescricao`
já calculados pelo servidor.

---

## 3. Endpoints por milestone

### M1 — CRUD de dívidas

#### `GET /v1/dividas/{id}`
Response `200`: `{ "divida": Divida }`. `404` se não existir ou for de outro tenant —
**nunca `403`**, para não revelar a existência do recurso.

#### `PATCH /v1/dividas/{id}`
Aceita subconjunto de `{ credor, valorCobrado, dataOrigem, tipo }`. Response `200`:
`{ "divida": Divida }` com os derivados recalculados.

#### `POST /v1/dividas/{id}/quitacao`
Marca como quitada. Request `{ "dataQuitacao": "2024-03-15", "valorPago": 90000 }`.
Response `200`: `{ "divida": Divida }`. `409` se já estiver quitada.

#### `DELETE /v1/dividas/{id}`
Exclusão **lógica**. Response `204`. Dívida excluída some de `GET /v1/dividas` mas não é
apagada do banco — histórico financeiro não se destrói.

A partir de M1, `Divida` ganha campos:

```ts
situacao: 'ativa' | 'quitada' | 'renegociada';
saldoDevedor?: number;   // centavos
taxaJurosMensal?: number; // basis points (250 = 2,50% a.m.) — inteiro, nunca float
totalParcelas?: number;
parcelasPagas?: number;
proximoVencimento?: IsoDate;
```

> **Por que basis points:** taxa é dinheiro disfarçado. `2.5` como float sofre do mesmo problema
> de precisão que os centavos resolvem. Inteiro em centésimos de ponto percentual mantém a
> aritmética exata em toda a stack.

---

### M1.5 — Ingestão de contrato

O usuário envia o PDF ou a foto do contrato; o backend extrai e devolve uma **proposta** para
revisão. Nada é gravado por este fluxo — a criação continua sendo `POST /v1/dividas`, disparada
pelo usuário depois de conferir.

#### `POST /v1/contratos`

`multipart/form-data`, campo `arquivo`. Aceita `application/pdf`, `image/jpeg` e `image/png`.

Response `202`:
```json
{ "extracao": { "id": "…", "status": "processando" } }
```

Assíncrono de propósito: OCR mais extração levam segundos a minutos, e segurar a conexão desse
tempo em rede móvel é receita para timeout.

> **O arquivo é descartado após a extração** (ADR 0005). Persistem os campos estruturados e os
> trechos curtos citados. O app comunica isso ao usuário antes do upload.

#### `GET /v1/contratos/{id}`

O front faz polling a cada 2,5s, com teto de 2 minutos.

Response `200` com `status: "concluida"`:
```json
{
  "extracao": {
    "id": "…",
    "status": "concluida",
    "campos": {
      "credor":          { "valor": "Banco Teste S/A", "confianca": "alta",  "trecho": "CREDOR: Banco Teste S/A", "pagina": 1 },
      "valorCobrado":    { "valor": 150000,            "confianca": "alta",  "trecho": "Valor total: R$ 1.500,00", "pagina": 1 },
      "dataOrigem":      { "valor": "2021-06-01",      "confianca": "alta",  "trecho": "Contratação em 01/06/2021", "pagina": 1 },
      "tipo":            { "valor": "juros_abusivos",  "confianca": "media", "trecho": "Modalidade: crédito rotativo" },
      "taxaJurosMensal": { "valor": 1250,              "confianca": "alta",  "trecho": "Taxa de juros: 12,50% a.m.", "pagina": 2 },
      "totalParcelas":   { "valor": 12,                "confianca": "alta",  "trecho": "Em 12 parcelas" },
      "cet":             { "valor": 18000,             "confianca": "baixa", "trecho": "CET: 180,00% a.a." },

      "modalidade":           { "valor": "consignado_inss", "confianca": "alta", "trecho": "Empréstimo consignado — benefício INSS" },
      "tarifaCadastro":       { "valor": 50000,             "confianca": "alta", "trecho": "Tarifa de cadastro: R$ 500,00" },
      "seguroPrestamista":    { "valor": 120000,            "confianca": "alta", "trecho": "Seguro prestamista: R$ 1.200,00" },
      "iof":                  { "valor": 8000,              "confianca": "media","trecho": "IOF: R$ 80,00" },
      "multaMoratoriaMensal": { "valor": 500,               "confianca": "alta", "trecho": "Multa por atraso: 5%" }
    },
    "alertas": [
      { "id": "…", "titulo": "Seguro prestamista embutido", "explicacao": "O contrato inclui um seguro que pode não ter sido oferecido de forma opcional.", "trecho": "…", "pagina": 3 }
    ]
  }
}
```

Regras de forma — **não negociáveis, porque o front depende delas para não mentir**:

| Regra | Motivo |
|---|---|
| `valor: null` quando não encontrado | O front deixa o campo vazio. Zero seria uma afirmação falsa. |
| `trecho` é texto **literal** do contrato | Sem ele o front **descarta o campo**, mesmo com valor. Ver `src/util/extracao.ts`. |
| `confianca`: `alta \| media \| baixa` | `baixa` entra destacada para conferência do usuário. |
| Monetário em centavos, taxa e CET em basis points | Mesma regra da seção 1. `cet` é anual. `multaMoratoriaMensal` também é bps. |
| `modalidade` diz que PRODUTO é, não a criticidade | `tipo` classifica pela consequência de não pagar; `modalidade` diz se é consignado, rotativo, financiamento. A revisão (M6) precisa do segundo: teto de consignado só se aplica a consignado. |
| Os encargos existem para o M6 | `tarifaCadastro`, `seguroPrestamista`, `iof` e `multaMoratoriaMensal` são a matéria-prima dos achados. Sem `trecho`, o campo é zerado e o achado não existe. |
| `alertas[].explicacao` em tom de investigação | "Pode não ter sido oferecido de forma opcional", nunca "é ilegal". Guardrail 3. |

`status: "falhou"` acompanha `erro` com mensagem em pt-BR para o usuário — qualidade de imagem,
formato inesperado, PDF protegido.

#### `POST /v1/dividas` com vínculo

Ao confirmar a revisão, o front chama o endpoint já existente acrescido de `extracaoId`, para o
backend ligar a dívida à extração que a originou.

---

### M2 — Painel de endividamento

#### `GET /v1/perfil` e `PUT /v1/perfil`

O painel prevê `comprometimentoRenda` e `minimoExistencial`, mas nada disso existe sem a renda —
e não havia endpoint para o usuário informá-la. Estes são esses endpoints.

Response `200` (ambos):
```json
{ "perfil": { "rendaMensal": 550000, "dependentes": 2 } }
```

Request do `PUT`: o mesmo objeto sem envelope.

| Campo | Unidade | Ausente significa |
|---|---|---|
| `rendaMensal` | centavos | não informado — **nunca zero** |
| `dependentes` | contagem | zero dependentes |

> **`minimoExistencial` continua sendo calculado no backend**, a partir da renda e dos
> dependentes. O front coleta e exibe; não aplica nenhuma regra de mínimo existencial
> (guardrail 1, ADR 0003). Nenhuma sugestão do produto pode propor plano que invada esse mínimo.

Dado de renda é sensível: não deve aparecer em log nem em mensagem de erro.

#### `GET /v1/dividas/resumo`

Query opcional: `?mes=2024-03` (default: mês corrente).

Response `200`:
```json
{
  "resumo": {
    "totalDevido": 4850000,
    "totalQuitadoNoAno": 320000,
    "quantidadeDividas": 7,
    "custoMedioJurosMensal": 380,
    "rendaMensal": 550000,
    "comprometimentoRenda": 2200,
    "minimoExistencial": 180000,
    "margemDisponivel": 90000,
    "porCriticidade": [
      { "tipo": "juros_abusivos", "total": 2100000, "quantidade": 2 },
      { "tipo": "com_garantia",   "total": 1900000, "quantidade": 1 },
      { "tipo": "consumo",        "total": 850000,  "quantidade": 4 }
    ],
    "proximosVencimentos": [
      { "dividaId": "...", "credor": "Nubank", "valor": 45000, "vencimento": "2024-03-20", "situacao": "pendente" }
    ],
    "evolucaoSaldo": [
      { "mes": "2023-10", "saldo": 5400000 },
      { "mes": "2023-11", "saldo": 5210000 }
    ]
  }
}
```

Unidades, sem exceção:

| Campo | Unidade |
|---|---|
| `totalDevido`, `totalQuitadoNoAno`, `rendaMensal`, `minimoExistencial`, `margemDisponivel`, `total`, `valor`, `saldo` | centavos |
| `custoMedioJurosMensal`, `comprometimentoRenda` | basis points (`2200` = 22,00%) |
| `quantidadeDividas`, `quantidade` | contagem |

`rendaMensal`, `comprometimentoRenda`, `minimoExistencial` e `margemDisponivel` são opcionais —
se o usuário ainda não informou a renda, vêm ausentes e o painel exibe um convite a preencher,
não um zero.

`evolucaoSaldo` traz no máximo 12 pontos, do mais antigo ao mais recente. O front só desenha.

---

### M3 — Plano de pagamento

#### `GET /v1/dividas/{id}/parcelas`

Response `200`:
```json
{
  "parcelas": [
    { "id": "...", "numero": 3, "total": 12, "valor": 45000, "vencimento": "2024-03-20", "situacao": "pendente", "pagoEm": null, "valorPago": null }
  ]
}
```

`situacao`: `'pendente' | 'paga' | 'atrasada'`. "Atrasada" é derivada da data pelo **backend** —
o front não compara datas para decidir isso, senão o fuso do aparelho vira fonte de divergência.

#### `POST /v1/parcelas/{id}/pagamento`
Request `{ "pagoEm": "2024-03-18", "valorPago": 45000 }`. Response `200`: `{ "parcela": Parcela }`.
`409` se já estiver paga.

O front faz atualização otimista aqui (o rollback é trivial) e invalida `['dividas']` inteiro
no sucesso, porque o resumo do painel também muda.

#### `POST /v1/dividas/{id}/renegociacao`
Request:
```json
{ "novoValor": 90000, "novoTotalParcelas": 10, "novaTaxaJurosMensal": 150, "primeiroVencimento": "2024-04-10", "observacao": "Acordo por telefone" }
```
Response `200`: `{ "divida": Divida }` com `situacao: "renegociada"` e novas parcelas geradas.
As parcelas antigas são preservadas no histórico, não apagadas.

#### `GET /v1/lembretes`
Alimenta o agendamento local de `expo-notifications`.

Response `200`:
```json
{
  "horaLembrete": "09:00",
  "lembretes": [
    { "id": "...", "dividaId": "...", "parcelaId": "...", "titulo": "Nubank vence em 3 dias", "corpo": "Parcela 3 de 12 — R$ 450,00", "dataLembrete": "2024-03-17" }
  ]
}
```

> **`dataLembrete` é DATA, não instante — isto corrige a especificação original.**
> A versão anterior previa `dispararEm` como timestamp UTC, o que está errado: **o servidor não
> sabe o fuso do aparelho**, e um instante calculado nele tocaria na hora errada para qualquer
> dispositivo fora do fuso do servidor. Agendar notificação local é inerentemente local.
>
> A divisão correta: o **backend decide o quê e o qual dia**; o **aparelho compõe a hora**, a
> partir de `horaLembrete` (preferência do usuário, guardada no perfil).

O texto vem **pronto do backend**, já formatado, para não haver formatação de moeda duplicada
entre servidor e cliente. Tom obrigatoriamente neutro — ver `guardrails.md`, seção 4.

---

### M4 — Simulador de quitação

#### `POST /v1/dividas/simulacoes`

O endpoint que sustenta o guardrail: **a matemática de amortização acontece aqui, não no app.**

Request:
```json
{ "aporteExtraMensal": 50000, "estrategias": ["avalanche", "bola_de_neve"], "dividasIds": null }
```

- `aporteExtraMensal`: centavos que o usuário consegue pagar além das parcelas mínimas.
- `estrategias`: quais simular. O front sempre pede as duas, para comparar.
- `dividasIds`: `null` significa todas as dívidas ativas.

Response `200`:
```json
{
  "simulacoes": [
    {
      "estrategia": "avalanche",
      "mesesAteQuitacao": 26,
      "dataLiberdade": "2026-05",
      "totalJurosPagos": 780000,
      "totalPago": 5630000,
      "economiaVsMinimo": 940000,
      "ordemPagamento": [
        { "dividaId": "...", "credor": "Cartão X", "posicao": 1, "quitadaEm": "2024-08", "jurosPagos": 120000 }
      ],
      "evolucaoSaldo": [ { "mes": "2024-03", "saldo": 4850000 } ]
    },
    { "estrategia": "bola_de_neve", "...": "mesma forma" }
  ],
  "comparacao": {
    "melhorEstrategia": "avalanche",
    "diferencaJuros": 130000,
    "diferencaMeses": 2
  },
  "dividasSemTaxa": [ { "dividaId": "...", "credor": "Financeira Y" } ]
}
```

`comparacao` vem calculada pelo servidor **de propósito**: se o front subtraísse
`totalJurosPagos` das duas simulações, teria replicado uma regra de negócio. A diferença é a
mensagem central da tela — ela precisa ter uma única origem. É **nula** quando só uma estratégia
foi pedida: com uma só não há comparação, e inventar uma seria pior que omiti-la.

`economiaVsMinimo` compara o cenário com aporte extra contra o cenário de pagar só o mínimo.
É o número que justifica o esforço para o usuário. É **nulo** quando o cenário mínimo não quita
dentro do teto — o que acontece de verdade com juros altos, em que pagar só o mínimo nunca fecha
a dívida. Sem o outro lado da comparação não há economia a afirmar, e o app exibe "ainda não
calculado".

`dividasSemTaxa` lista as dívidas que entraram na simulação **sem taxa conhecida**. Elas são
amortizadas normalmente, mas nenhum juro é projetado sobre elas, e na avalanche vão para o fim
da fila — taxa desconhecida não justifica prioridade. O prazo devolvido é, portanto, otimista
para quem tem dívida assim, e a tela **nomeia essas dívidas** em vez de esconder o efeito.

Dois `422`, ambos com `campo: "aporteExtraMensal"`:

- **aporte que invade o mínimo existencial** — o produto não sugere plano que comprometa o
  básico. Só é verificável com renda informada no perfil; sem ela a simulação segue, e isso está
  declarado em `docs/backend.md`;
- **plano que não quita** — quando o pagamento não cobre nem os juros, o saldo só cresce. Um
  prazo devolvido nesse caso seria ficção.

Saldo e parcela mínima de cada dívida saem das **parcelas reais** (M3). Dívida sem cronograma
entra com o valor cobrado e parcela mínima **zero**: nenhum valor de prestação é inventado.

A simulação **não escreve nada** — é leitura, apesar do `POST`, que existe pelo payload
estruturado.

---

### M5 — Dívidas dentro do chat

Novos `kind` em `ActionCardData`. O `switch` do dispatcher `ActionCard` é **exaustivo**: `kind`
novo sem tratamento é erro de compilação, não card invisível.

```json
{ "kind": "divida_resumo", "dividaId": "...", "credor": "Nubank", "saldoDevedor": 320000, "proximoVencimento": "2024-03-20", "situacao": "ativa", "criticidade": "juros_abusivos" }
```

```json
{ "kind": "plano_sugerido", "estrategia": "avalanche", "aporteExtraMensal": 50000, "mesesAteQuitacao": 26, "dataLiberdade": "2026-05", "economia": 940000 }
```

```json
{ "kind": "divida_proposta", "dividaId": null, "dividaCredor": null, "credor": "Nubank", "valorCobrado": 150000, "dataOrigem": "2026-03-10", "tipo": "consumo", "taxaJurosMensal": null, "totalParcelas": null, "primeiroVencimento": null }
```

Os três carregam um identificador que permite o deep link para a tela correspondente
(`dividas/[id]`, `dividas/simulador`, `dividas/nova`). Card é o ponto de entrada para a tela, não um
substituto dela. `economia` é anulável, pelo mesmo motivo de `economiaVsMinimo` no M4.

> **O modelo escolhe QUAL card; o backend preenche os NÚMEROS.** Todo valor de `divida_resumo` e de
> `plano_sugerido` é lido do banco em `routers/chat.py::montar_cards`. O schema que o assistente
> responde não tem campo para valor monetário no que ele **afirma** — ele devolve, no máximo, um
> `dividaId` e o aporte que o próprio usuário declarou. Número no texto sem card de banco é
> **cortado no servidor**. Ver `docs/features/005-dividas-no-chat.md` para as três camadas.

**`divida_proposta` é a exceção, e é de outra natureza.** Seus campos são o RASCUNHO do que a pessoa
disse na conversa, para ela conferir num formulário (`guardrails.md`, 7.2) — não é dado apurado, não
é afirmação, e não foi gravado. Todo campo é anulável: ausente significa "ela não disse", nunca zero.
`dividaId` ausente é cadastro novo; presente é alteração daquela dívida, e aí vem também
`dividaCredor`, **lido do banco**, dizendo qual dívida vai mudar. Ele é separado de `credor`, que é o
valor proposto e pode ser justamente a correção do nome. Cada campo é saneado no servidor e
revalidado na chegada à tela; `dividaCredor` não é campo de formulário e não viaja como parâmetro.

#### `GET /v1/chat/messages`

O histórico da conversa, para ela sobreviver ao fechamento do app.

Query: `?limite=` (1 a 200, padrão 50).

Response `200`:
```json
{ "mensagens": [ { "id": "...", "role": "user", "content": "e o nubank?", "cards": [], "createdAt": "2026-08-06T18:00:00Z" } ] }
```

Ordem **cronológica** — o app rola para o fim, não para o começo.

Os cards vêm **remontados a cada leitura**, a partir do banco, e não servidos do JSON gravado:
uma parcela paga ontem não pode reaparecer hoje com o saldo de ontem. `divida_proposta` é a única
exceção — ele não tem lastro no banco para remontar, e registro do que foi dito não envelhece.

**Nenhum card dispara escrita sozinho.** `divida_proposta` abre o formulário preenchido, e a
gravação acontece pela rota do cadastro manual, quando o usuário confirma (`guardrails.md`, 7.2).

---

### M6 — Revisão de cobrança

Fecha o `valor_justo`, que existia no contrato e no front desde o primeiro commit sem nenhum
produtor. Spec em `docs/features/006-revisao-de-cobranca.md`; a decisão, na **ADR 0008**.

`valorJusto` **não é estimativa**: é `valorCobrado` menos a soma dos achados que têm valor, cada
um com fonte legal própria. Nenhum achado com valor ⇒ `valorJusto: null` ⇒ nenhum card.

#### `GET /v1/dividas/{id}/revisao`

Leitura pura. **Nenhuma rota de escrita entrou com este milestone.**

Response `200`:
```json
{
  "revisao": {
    "dividaId": "…",
    "credor": "Banco Teste S/A",
    "valorCobrado": 1500000,
    "valorJusto": 1320000,
    "achados": [
      {
        "id": "multa_acima_do_teto",
        "titulo": "Multa de atraso acima do limite do CDC",
        "explicacao": "O contrato prevê multa de 5% por atraso. O Código de Defesa do Consumidor limita a multa de mora a 2% do valor da prestação. Vale contestar a diferença.",
        "fonte": "Código de Defesa do Consumidor, art. 52, §1º",
        "comoConferir": "Procure no contrato a cláusula de multa por atraso e confira o percentual.",
        "valorContestavel": 18000,
        "evidencia": "Multa por atraso: 5% sobre o valor da parcela"
      }
    ],
    "script": "Olá. Sou cliente e gostaria de rever alguns pontos…",
    "fundamentos": ["Código de Defesa do Consumidor, art. 52, §1º"],
    "baseLegalVigenteEm": "2025-03-25"
  }
}
```

Regras de forma — **não negociáveis**:

| Regra | Motivo |
|---|---|
| `valorJusto: null` sem achado com valor | Igual a `valorCobrado` afirmaria "conferimos e está tudo certo". Não temos como afirmar isso. |
| `valorJusto: null` se a soma alcança o cobrado | "Deveria custar nada" quase sempre é encargo lido errado. Os achados continuam; o número de destaque não sai. |
| `valorContestavel: null` é achado **sem número** | Quantificá-lo exigiria reamortizar o contrato — estimativa disfarçada (ADR 0008). Ele aparece na tela e não soma. |
| `evidencia` é trecho **literal** do contrato | `null` quando o achado não veio da extração. O guardrail 8.1 é reaplicado **na leitura**, não só antes de gravar. |
| `economia` **não** viaja | O cliente a calcula. É a única subtração que o guardrail 1.2 lhe permite. |
| Achado que depende de teto não configurado **não é produzido** | Teto do CNPS muda por resolução e vive em `.env`. Sem ele, `None` — nunca um teto chutado. |
| `baseLegalVigenteEm` só quando algum achado dependeu de teto | A multa do CDC não envelhece; exibir vigência ao lado dela sugeriria que todos os achados envelhecem juntos. |
| `script` montado por **template**, nunca por LLM | `guardrails.md`, seção 3: fundamento legal é curado no backend. |

Dívida de outro tenant: **404, nunca 403**. Dívida sem contrato lido: `200` com `achados: []`.

#### Card `valor_justo` no chat

Mesmo regime do `divida_resumo`: o assistente escolhe **qual** dívida, e `montar_cards` preenche
os números chamando a **mesma** `domain/revisao.py` da rota. Sem achado com valor, a rota não
emite o card.

`valor_justo` **não** sustenta número no texto livre (ao contrário de `divida_resumo` e
`plano_sugerido`): como ele pode ser descartado, contá-lo abriria caminho para um número cujo
card sumiu — o modo de falha exato do guardrail 7.1.

---

## 4. Fila do backend

> **Esta é a fila de trabalho canônica do backend.** `roadmap.md` aponta para cá e não repete a
> lista — duas fontes divergem em uma semana.
> Marcações: `[x]` feito e **visto funcionando no app** · `[~]` implementado mas ainda não
> exercitado em device · `[ ]` a fazer.
> A ordem é por desbloqueio: quanto mais tela cada bloco libera, mais cedo ele aparece.

### Bloco 0 — fundação (destrava tudo o resto)

- [x] `id: str` — era `int` e fazia `POST /v1/dividas` estourar `ValidationError`
- [x] **Persistência real** — Postgres via SQLAlchemy + Alembic (`backend/docker-compose.yml`)
- [x] **Autenticação** — Bearer token com comparação em tempo constante; todo query filtra tenant
- [x] `tipo` validado como `Literal` dos quatro valores de `CriticidadeTipo`
- [x] CORS restrito às origens do Expo

### Bloco 1 — M1 · CRUD de dívidas
*Destrava: detalhe, edição, quitação e exclusão. Quatro telas prontas esperando.*

- [x] `GET /v1/dividas` — **visto funcionando no app**
- [~] `POST /v1/dividas` — implementado e exercitado por request; falta ver no app
- [~] `GET /v1/dividas/{id}` — implementado; 404 (nunca 403) para id de outro tenant
- [~] `PATCH /v1/dividas/{id}` — implementado
- [~] `POST /v1/dividas/{id}/quitacao` — implementado; 409 ao quitar duas vezes
- [~] `DELETE /v1/dividas/{id}` — exclusão **lógica**, implementada
- [x] Campos novos de `Divida`: `situacao`, `saldoDevedor`, `taxaJurosMensal`, `totalParcelas`,
      `parcelasPagas`, `proximoVencimento`
- [x] `valorCorrigido` pela taxa do contrato — **`null` sem taxa**, substituindo o `* 1.1`
- [x] `possivelPrescricao` pelo art. 206, §5º, I do Código Civil

### Bloco 2 — M2 · perfil de renda
*Destrava: metade do painel. Vem antes do resumo — sem renda, comprometimento e mínimo
existencial não têm o que exibir.*

- [~] `GET /v1/perfil` — implementado; campos ausentes quando não informados
- [~] `PUT /v1/perfil` — implementado
- [x] Mínimo existencial pelo Decreto 11.150/2022, art. 3º, na redação do Decreto 11.567/2023
      (R$ 600,00 fixos). Piso não configurado ⇒ `minimoExistencial` e `margemDisponivel` ausentes.
      **`dependentes` não entra na fórmula** — o decreto não escala por dependente

### Bloco 3 — M2 · resumo
*Destrava: a outra metade do painel.*

- [~] `GET /v1/dividas/resumo` com `?mes=` — implementado
- [x] Agregados: totais, `custoMedioJurosMensal` (ponderado pelo saldo), `porCriticidade`
- [x] `proximosVencimentos` — com parcelas reais (M3), deixou de voltar vazio
- [x] `evolucaoSaldo` via `saldo_snapshot`, um ponto por mês, acumulando a partir de hoje

### Bloco 4 — M1.5 · ingestão de contrato
*Destrava: as duas telas de contrato. É o que remove o atrito de digitar a taxa de juros à mão.*

- [~] `POST /v1/contratos` — multipart, `202`, processamento em background
- [~] `GET /v1/contratos/{id}` — polling
- [x] Extração com extrator plugável (`BUDDY_EXTRATOR`), Claude com visão lendo PDF e foto
- [x] **Campo sem `trecho` é zerado no servidor** antes de sair da rota (guardrail 8.1)
- [x] Arquivo lido em memória e nunca gravado em disco (ADR 0005)
- [ ] **Exige `ANTHROPIC_API_KEY`.** Sem ela o upload responde "falhou" com mensagem útil

### Bloco 5 — M3 e M4 implementados, M5 a fazer

- [~] M3: `GET /v1/dividas/{id}/parcelas`, `POST /v1/parcelas/{id}/pagamento`,
      `POST /v1/dividas/{id}/renegociacao`, `GET /v1/lembretes` — implementados e exercitados
      por request; falta ver no app
- [~] M4: `POST /v1/dividas/simulacoes` — implementado e exercitado por request; falta ver no app
- [x] `comparacao` calculada no servidor, para o front não replicar regra de negócio
- [x] `dividasSemTaxa` na resposta: dívida sem taxa amortiza sem juros projetados, e a tela
      nomeia quais foram — o prazo exibido seria otimista em silêncio
- [x] Os dois `422`: aporte que invade o mínimo existencial e plano que não quita
- [~] M5: chat real com os `kind` `divida_resumo` e `plano_sugerido` — implementado e
      **exercitado com chamada real ao provedor**; falta ver no app
- [~] M5: `divida_proposta` — o chat propõe cadastro e alteração, e o formulário confirma
      (guardrail 7.2). Nenhuma rota de escrita nova: a gravação continua sendo a do cadastro manual.
      **Exercitado com chamada real**: valor em centavos, criticidade classificada, campo não dito
      nulo, e `GET /v1/dividas` inalterado depois da conversa. Falta ver no app
- [x] `GET /v1/chat/messages`: o histórico sobrevive ao fechamento do app
- [x] Camada de provedor de LLM (ADR 0007), com OpenAI padrão e Anthropic vivo no repositório
- [x] Leitura de contrato **destravada**: exercitada de ponta a ponta com contrato sintético

### Bloco 6 — M6 · revisão de cobrança
*Destrava: o `valor_justo`, que estava no contrato e no front desde o primeiro commit sem
nenhum produtor.*

- [~] `GET /v1/dividas/{id}/revisao` — implementado; 404 (nunca 403) para id de outro tenant
- [~] Card `valor_justo` no chat, com os números preenchidos pela rota
- [x] `domain/revisao.py` com FONTE no docstring de cada regra, **conferida no texto primário**
- [x] Encargos na extração: `modalidade`, `tarifaCadastro`, `seguroPrestamista`, `iof`,
      `multaMoratoriaMensal` — todos sujeitos ao guardrail 8.1
- [x] Tetos do consignado em config **datada e sem default**: teto ausente ⇒ achado ausente
- [x] `script` de negociação por template determinístico, sem LLM

### Estado observado em device

| Endpoint | Estado |
|---|---|
| `GET /v1/dividas` | funcionando — lista carrega no app |
| Blocos 0 a 4 | implementados e exercitados por request real; **ainda não vistos no app** |
| M3 (parcelas, pagamento, renegociação, lembretes) | idem |
| M4 (`POST /v1/dividas/simulacoes`) | idem — inclusive os dois `422`, conferidos por request |
| M5 (chat real, histórico) | implementado; **exercitado com chamada real à OpenAI**, ainda não visto no app |
| M5 (`divida_proposta`) | idem — cadastro e alteração propostos por um modelo de verdade, sem gravar nada |
| Leitura de contrato | **destravada** — contrato sintético lido com trecho literal nos sete campos |
| M6 (`GET .../revisao`, card `valor_justo`) | implementado e coberto por teste; **ainda não visto no app** |

Suíte do backend: **260 testes**, verdes em SQLite e em Postgres, **sem tocar a rede**.

Nenhum endpoint da fila continua sem implementação. O que falta em todos é a mesma coisa:
**ver funcionando no aplicativo, em aparelho**.
