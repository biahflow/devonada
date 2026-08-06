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

> Estas divergências existem hoje em `backend/` e precisam ser resolvidas pelo dono do
> repositório. Agentes **não** editam `backend/` — só reportam.

1. **`id` tipado como `int`.** `backend/models.py:11` declara `id: int`, mas
   `backend/routers/dividas.py:20` gera `str(uuid.uuid4())` e o passa em `id=id_gerado` na
   linha 26. Pydantic v2 não coage UUID em string para `int`, então `POST /v1/dividas` estoura
   `ValidationError` na primeira chamada.
   O front espera `Uuid` (string) e o `TUTORIAL_API.md` documenta `id: str` — o código divergiu
   do próprio tutorial. Correção: `id: str`.
2. **`tipo` sem validação.** É `str` livre no backend e `CriticidadeTipo` (quatro valores) no
   front. Um valor fora da enumeração quebra o render do badge de criticidade sem erro de rede.
   Correção: `Literal["essencial", "com_garantia", "juros_abusivos", "consumo"]`.
3. **Sem persistência.** `dividas_db` é uma lista em memória; some a cada reload do uvicorn.
   Aceitável para desenvolvimento, bloqueante a partir de M1.
4. **Auth ignorada.** O backend aceita o header `Authorization` mas não o valida, e `CORS` está
   com `allow_origins=["*"]`. Bloqueante antes de qualquer dado real.
5. **`/v1/chat/messages` é mock.** Ecoa o input e devolve sempre o mesmo `card_valor_justo`
   hardcoded. Suficiente para M0–M4; M5 depende do fluxo real.

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
      "cet":             { "valor": 18000,             "confianca": "baixa", "trecho": "CET: 180,00% a.a." }
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
| Monetário em centavos, taxa e CET em basis points | Mesma regra da seção 1. `cet` é anual. |
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
  }
}
```

`comparacao` vem calculada pelo servidor **de propósito**: se o front subtraísse
`totalJurosPagos` das duas simulações, teria replicado uma regra de negócio. A diferença é a
mensagem central da tela — ela precisa ter uma única origem.

`economiaVsMinimo` compara o cenário com aporte extra contra o cenário de pagar só o mínimo.
É o número que justifica o esforço para o usuário.

`422` se `aporteExtraMensal` invadir o mínimo existencial, com `message` explicando — o produto
não sugere plano que comprometa o básico.

---

### M5 — Dívidas dentro do chat

Novos `kind` em `ActionCardData`. O mecanismo de união discriminada em `src/api/types.ts` já
suporta; basta acrescentar os tipos e o caso no dispatcher `ActionCard`.

```json
{ "kind": "divida_resumo", "dividaId": "...", "credor": "Nubank", "saldoDevedor": 320000, "proximoVencimento": "2024-03-20", "situacao": "ativa", "criticidade": "juros_abusivos" }
```

```json
{ "kind": "plano_sugerido", "estrategia": "avalanche", "aporteExtraMensal": 50000, "mesesAteQuitacao": 26, "dataLiberdade": "2026-05", "economia": 940000, "simulacaoId": "..." }
```

Ambos carregam um identificador que permite o deep link para a tela correspondente
(`app/dividas/[id].tsx`, `app/dividas/simulador.tsx`). Card é o ponto de entrada para a tela,
não um substituto dela.

**Nenhum card dispara escrita sozinho.** Um card que sugere criar uma dívida abre o formulário
preenchido para o usuário confirmar. Ver `guardrails.md`, seção 7.2.

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
- [x] Mínimo existencial pelo Decreto 11.150/2022 (25% do salário mínimo).
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

### Bloco 5 — sem front construído ainda

- [~] M3: `GET /v1/dividas/{id}/parcelas`, `POST /v1/parcelas/{id}/pagamento`,
      `POST /v1/dividas/{id}/renegociacao`, `GET /v1/lembretes` — implementados e exercitados
      por request; falta ver no app
- [ ] M4: `POST /v1/dividas/simulacoes` — inclusive o campo `comparacao`, que vem calculado de
      propósito para o front não replicar regra de negócio
- [ ] M5: chat real com os `kind` `divida_resumo` e `plano_sugerido`

### Estado observado em device

| Endpoint | Estado |
|---|---|
| `GET /v1/dividas` | funcionando — lista carrega no app |
| Blocos 0 a 4 | implementados e exercitados por request real; **ainda não vistos no app** |
| M3 (parcelas, pagamento, renegociação, lembretes) | idem — 116 testes, dos quais 116 passam contra Postgres |
| `POST /v1/chat/messages` | mock: card fixo, sem LLM. Ganhou auth |
| Leitura de contrato | implementada, **bloqueada** por falta de `ANTHROPIC_API_KEY` |
| Bloco 5 (M3/M4/M5) | não existe |
