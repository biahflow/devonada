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
- **Assinatura (M9):** toda rota de escrita — `POST`, `PUT`, `PATCH`, `DELETE` — exige teste em
  curso ou assinatura ativa, e devolve `402` quando não há. **Todo `GET` é livre, sempre.** Ficam
  fora da trava `/v1/auth`, `/v1/assinatura` e `/v1/conta`. A regra é derivada do método e vive
  numa dependência global; rota de escrita nova nasce coberta. Ver ADR 0013.
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
| `402` | teste vencido e sem assinatura, em rota de escrita | aviso `warning` + caminho para a assinatura |
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

1. ~~**Auth é de beta: um token, um tenant.**~~ — **resolvida no M8.** Há cadastro, login, sessão
   revogável e recuperação de senha (ADR 0012). A previsão de que "a troca não muda o cliente" só
   valeu pela metade: ele de fato já mandava `Bearer` e já tratava `401`, mas ganhou renovação
   silenciosa, e o `401` deixou de ser assunto de tela.
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

> **`rendaMensal` aqui é uma VISTA de `fonte_renda`** (M7.2), não uma coluna. A leitura é a soma
> do `valorTipicoInformado` das fontes ativas; sem fonte nenhuma, cai na coluna legada
> `perfil.renda_mensal`. A escrita continua aceita — app instalado que não atualizou ainda envia
> o campo —, e o valor pousa na fonte:
>
> | Fontes ativas | `PUT` com `rendaMensal` faz |
> |---|---|
> | 0 | cria a fonte `"Renda informada"` (`tipo: "outro"`, `variavel: false`) |
> | 1 | atualiza o `valorTipicoInformado` dela |
> | 2 ou mais | **`422`** com `campo: "rendaMensal"` |
>
> O `422` existe porque um escalar não se reparte entre várias fontes: dividir o valor ou eleger
> uma para sobrescrever inventaria dado. A tela que trata o caso é a do Caixa.
>
> **`rendaMensal` ausente no corpo não apaga a renda.** A tela de preferências deixou de enviá-lo,
> e tratar ausente como zero apagaria a fonte de quem só queria mudar o horário do lembrete.

> **Atenção: `rendaMensal` aqui e em `/v1/dividas/resumo` são números diferentes, de propósito.**
>
> | Endpoint | O que é | Exemplo |
> |---|---|---|
> | `GET /v1/perfil` | o que o usuário **informou**, somado e bruto | `960000` |
> | `GET /v1/dividas/resumo` | renda **típica e líquida** — pior mês registrado, menos o imposto reservado | `902400` |
>
> O perfil devolve o informado porque é o que um formulário precisa reexibir: devolver o valor
> derivado faria um app antigo mostrar um número que o usuário nunca digitou e, ao salvar,
> sobrescrever o informado com ele. Quem quer o número que o **plano** usa pede
> `GET /v1/caixa`, que traz junto o `origemRenda` — e é lá que a tela diz de onde ele veio.

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
    "custoDiarioJuros": 4100,
    "quantidadeDividasSemTaxa": 2,
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
| `custoDiarioJuros` | centavos **por dia** (`4100` = R$ 41,00/dia) |
| `custoMedioJurosMensal`, `comprometimentoRenda` | basis points (`2200` = 22,00%) |
| `quantidadeDividas`, `quantidade`, `quantidadeDividasSemTaxa` | contagem |

`rendaMensal`, `comprometimentoRenda`, `minimoExistencial` e `margemDisponivel` são opcionais —
se o usuário ainda não informou a renda, vêm ausentes e o painel exibe um convite a preencher,
não um zero.

> **`custoDiarioJuros` e `quantidadeDividasSemTaxa` andam JUNTOS** (M10). O card do Tino na Rota
> diz "essa dívida cresce R$ 41 por dia" — a frase mais concreta que a tela poderia ter, e
> concretude é o que o `guardrails.md`, seção 4, pede da copy. O número é valor derivado, e o
> guardrail 1.2 proíbe o cliente produzi-lo: quem calcula é
> `backend/domain/resumo.py::custo_diario_juros`, e o docstring de lá é a fonte de verdade sobre
> o método.
>
> | | |
> |---|---|
> | **Fórmula** | Σ (`saldo` × `taxaJurosMensal`) ÷ **30**, sobre as dívidas ATIVAS com taxa conhecida |
> | **Unidade** | centavos por dia, inteiro, `ROUND_HALF_UP` aplicado **uma vez** sobre a soma |
> | **Ausente (`null`)** | nenhuma dívida ativa tem taxa informada — não há o que calcular |
> | **Zero** | a conta deu zero: taxa 0% informada, ou juros abaixo de um centavo ao dia. **Não** é o mesmo que ausente |
>
> **Três escolhas de MÉTODO, nossas, não do contrato do usuário e não da lei** — nenhuma lei fixa
> custo diário, e é por isso que elas ficam declaradas em vez de passarem por regra financeira dele:
>
> 1. **Divisor 30 (mês comercial) e divisão simples.** O contrato fixa juro mensal; decompô-lo é
>    aritmética, mas 31, 28 ou 30,44 dariam outro número, e a taxa diária equivalente composta
>    daria um número menor. O resultado é **ordem de grandeza**, não valor exigível — não é o que
>    o credor cobra por um dia de atraso.
> 2. **Base = o mesmo `saldo` de `custoMedioJurosMensal`**, que a rota preenche com `valorCobrado`.
>    Bases diferentes fariam o mesmo payload carregar dois números de juros que não fecham.
> 3. **Agregado, não por dívida.** Soma as ativas com taxa; dívida sem taxa é ignorada, **nunca
>    tratada como 0%** — tratá-la como zero afirmaria que ela não cresce.
>
> **A consequência da escolha 3 é que o agregado SUBESTIMA**, e ela não passa em silêncio:
> `quantidadeDividasSemTaxa` conta quantas ficaram de fora e viaja no mesmo payload. Maior que
> zero ⇒ o número é **piso**, e a tela diz "cresce pelo menos R$ 41,00 por dia — 2 dívidas ainda
> estão sem a taxa cadastrada". É a mesma disciplina de `dividasSemTaxa` na simulação (M4), que
> nomeia o que ficou de fora em vez de esconder que o prazo saiu otimista.
>
> **O cliente exige os DOIS campos para dizer a frase.** Sem a contagem não dá para saber se o
> número é total ou piso, e piso anunciado como total é a subestimação silenciosa que este par
> existe para impedir. Sem `custoDiarioJuros`, ou com ele em zero, o card diz o que já dizia —
> nunca "R$ 0,00 por dia". Ver `src/util/proximaAcao.ts`.

> **De onde sai a renda deste resumo** (M7.2). O caixa é a fonte; o perfil é fallback — o mesmo
> caminho de `POST /v1/dividas/simulacoes`. `rendaMensal` é a renda **líquida** da cascata do
> caixa: o limite de 30% se lê sobre o que de fato entra, e sem `imposto_bps` informado a líquida
> degrada para a bruta, então ninguém perde número por não ter preenchido imposto.
>
> **`margemDisponivel` tem duas definições, e a diferença importa:**
>
> | Estado | `margemDisponivel` |
> |---|---|
> | Caixa conhece a saída (há gasto, provisão ou pote) | `aporteMaximo` de `GET /v1/caixa` — o mesmo número, para as duas abas não divergirem |
> | Caixa só com renda (Nível 0), ou sem caixa | `renda − mínimo existencial − comprometido do mês` |
> | Piso não configurado, no segundo caso | **ausente** |
>
> É `aporteMaximo` e não `capacidadeHoje` porque só o primeiro desconta as parcelas que já
> existem — `capacidadeHoje` é o total que *pode* ir para dívida, parcelas incluídas, e exibi-lo
> como sobra contaria duas vezes o dinheiro que já sai. De quebra, é o teto que o simulador
> aplica ao aporte extra: o painel para de anunciar uma sobra que o simulador recusa.
>
> No Nível 0 a margem **não** vem do caixa: ali sabemos o que entra e nada do que sai, e devolver
> quase a renda inteira como sobra seria o número mais perigoso do produto.

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

### M7 — Módulo de caixa

Spec em `docs/features/007-modulo-de-caixa.md`. Todos os valores em **centavos inteiros**;
`impostoBps` e `rendimentoEsperadoBps` em **basis points**. Toda rota filtra `tenant_id`; id
alheio devolve **404, nunca 403**.

#### `GET /v1/caixa`

A cascata inteira, calculada no servidor (ADR 0003).

```json
{
  "caixa": {
    "rendaBrutaTipica": 1200000,
    "origemRenda": "informada",
    "impostoReservado": 72000,
    "rendaLiquida": 1128000,
    "essenciais": 620000,
    "naoEssenciais": 90000,
    "provisaoMensal": 41667,
    "aporteReserva": 50000,
    "aporteAposentadoria": 30000,
    "comprometidoDividas": 180000,
    "capacidadeHoje": 116333,
    "capacidadeMaxima": 206333,
    "aporteMaximo": -63667,
    "minimoExistencial": 60000,
    "minimoExistencialVigenteEm": "2023-06-19",
    "abaixoDoPiso": false,
    "naoFecha": false,
    "preenchimento": "nivel_1"
  }
}
```

- `origemRenda`: `"informada"` | `"pior_mes_registrado"`. O usuário vê de onde saiu o número.
- `preenchimento`: `"vazio"` | `"nivel_0"` | `"nivel_1"`. É o que a tela usa para escolher entre
  o convite e o conteúdo.
- `capacidadeHoje` e `capacidadeMaxima` **podem ser negativas** — o negativo é a informação.
- **As parcelas de dívida não entram na cascata.** A capacidade é o total que pode ir para
  dívida, e as parcelas atuais já são dívida — descontá-las ali as contaria duas vezes. Quem
  precisa do teto do aporte **extra** usa `aporteMaximo` = `capacidadeHoje − comprometidoDividas`,
  que também pode ser negativo (as parcelas atuais já não cabem).
- `minimoExistencial` é `null` com piso não configurado, e nesse caso `abaixoDoPiso` também é
  `null`. Nunca `false` otimista.
- `naoFecha`: soma das parcelas mínimas > `capacidadeMaxima`. É **fato aritmético**, não
  diagnóstico de superendividamento — o campo nunca se chama `superendividado` e a copy não
  afirma direito (ver o FDD, "O que a leitura da lei mudou").

#### `GET · POST · PATCH · DELETE /v1/caixa/fontes[/{id}]`

```json
{ "fonte": { "id": "…", "nome": "Contrato PJ", "tipo": "pj_hora",
             "valorTipicoInformado": 1200000, "variavel": true, "ativo": true } }
```

`tipo`: `pj_hora` | `clt` | `autonomo` | `beneficio` | `aluguel` | `outro`.

#### `POST /v1/caixa/fontes/{id}/recebimentos`

O que **de fato** caiu. É daqui que sai a renda típica real.

```json
{ "recebimento": { "id": "…", "mes": "2026-07", "valor": 980000 } }
```

#### `GET · POST · PATCH · DELETE /v1/caixa/gastos[/{id}]`

```json
{ "gasto": { "id": "…", "descricao": "Aluguel", "categoria": "moradia",
             "essencial": true, "fixo": true, "valorMensal": 250000, "ativo": true } }
```

`categoria`: `moradia` | `alimentacao` | `transporte` | `contas` | `saude` | `dependentes` |
`outros`.

#### `GET · POST · PATCH · DELETE /v1/caixa/provisoes[/{id}]`

```json
{ "provisao": { "id": "…", "descricao": "IPVA do carro", "valorAnual": 180000,
                "mesVencimento": 1, "saldoAcumulado": 30000,
                "aporteMensal": 30000, "mesesRestantes": 5, "ativo": true } }
```

`aporteMensal` e `mesesRestantes` são **derivados no servidor**: o aporte divide o que falta
pelos meses restantes até o vencimento, nunca por 12 fixo.

#### `PUT /v1/caixa/metas`

```json
{ "metas": { "impostoBps": 600, "reservaMetaMeses": 6, "reservaSaldo": 150000,
             "reservaAporte": 50000, "aposentadoriaAporte": 30000,
             "rendimentoEsperadoBps": null } }
```

Todos opcionais, e `null` **grava** ausência — é como o usuário desfaz uma meta.

Os três campos de reserva são coisas diferentes, e só um entra na cascata: `reservaSaldo` é o
que já existe, `reservaMetaMeses` é aonde se quer chegar, e **`reservaAporte` é o que sai do
mês** — este é o que a capacidade desconta.

`rendimentoEsperadoBps` ausente ⇒ **nenhuma comparação dívida × investimento é exibida**
(ADR 0009). `impostoBps` ausente ⇒ nada é reservado, e a tela diz isso.

#### `GET /v1/caixa/metas`

Mesmo corpo. Perfil inexistente devolve todos os campos ausentes, nunca zerados.

#### Efeitos no módulo de dívida

- **`POST /v1/dividas/simulacoes`** valida o aporte contra `aporteMaximo` quando há caixa
  preenchido. Sem caixa, cai no critério antigo (piso legal), que é otimista mas mantém a
  ferramenta disponível para quem ainda não preencheu. A `message` do `422` **não carrega
  valor** — renda não vaza em corpo de erro (guardrail 5).
- **`Simulacao`** ganha `acimaDoPrazoDeRepactuacao: boolean`. Verdadeiro quando o plano passa de
  60 meses — o prazo máximo do plano apresentado em repactuação (CDC, art. 104-A). É informação,
  **não** impedimento: a simulação continua devolvendo `200`.
- **`script`** da revisão ganha uma frase com o valor que o usuário consegue comprometer por mês,
  por template determinístico. Só aparece com caixa preenchido e capacidade positiva. O valor é
  `capacidadeHoje` menos as parcelas das **outras** dívidas: o acordo substitui a prestação desta,
  mas as demais continuam saindo.
- **Card `plano_sugerido`** usa a capacidade como aporte padrão quando o assistente não pede um
  valor, em vez de zero. O número vem do servidor, nunca do modelo (guardrail 7.1).

#### `GET /v1/caixa/historico`

Os `caixa_snapshot`, do mais recente ao mais antigo. **Append-only**: nenhuma rota atualiza uma
linha existente.

---

### M8 — Conta de usuário

Spec em `docs/features/008-conta-de-usuario.md`; as decisões, na ADR 0012.

**As rotas de `/v1/auth` são públicas** — são as únicas do contrato que não exigem
`Authorization`. `DELETE /v1/conta` exige, e mais a senha no corpo.

#### Sessão

Toda entrada bem-sucedida devolve o mesmo corpo:

```json
{ "sessao": { "acesso": "eyJhbGci...", "refresh": "8f3c...", "expiraEm": "2026-08-07T14:15:00Z" } }
```

- **`acesso`** — JWT HS256 de 15 minutos, enviado como `Authorization: Bearer`. É dele que sai o
  `tenant_id`; o cliente continua não conhecendo tenant (guardrail 6).
- **`refresh`** — valor opaco de 30 dias. O servidor guarda **o hash**, nunca o valor.
- **`expiraEm`** — instante de expiração do `acesso`. O app não precisa dele para funcionar: a
  renovação é reativa ao `401`. Ele existe para permitir renovar antes de falhar, se um dia isso
  for desejável.

Os dois ficam no `expo-secure-store`. Nenhum deles em `AsyncStorage` (guardrails, seção 5).

#### `POST /v1/auth/registro`

```json
{ "email": "voce@exemplo.com", "senha": "uma senha boa" }
```

`201` com o corpo de sessão. E-mail é normalizado (aparas e minúsculas) antes de qualquer coisa.

| Status | Quando |
|---|---|
| `409` | e-mail já cadastrado — a `message` manda para o login |
| `422` | e-mail inválido ou senha com menos de 8 caracteres, com `campo` |

**O primeiro cadastro num banco sem usuários adota `DEVONADA_TENANT_ID`** (ADR 0012, item 2). Os
demais recebem um UUID novo. Nada disso é visível no contrato — é comportamento de servidor.

#### `POST /v1/auth/login`

```json
{ "email": "voce@exemplo.com", "senha": "uma senha boa" }
```

`200` com o corpo de sessão.

| Status | Quando |
|---|---|
| `401` | credencial inválida — **a mesma `message` para senha errada e e-mail inexistente** |
| `429` | conta temporariamente bloqueada por excesso de tentativas |

A indistinguibilidade do `401` é requisito, não detalhe de implementação: mensagens diferentes
transformariam a rota num verificador de cadastro.

#### `POST /v1/auth/refresh`

```json
{ "refresh": "8f3c..." }
```

`200` com um par **novo**. O refresh enviado é revogado no mesmo instante — **rotação a cada uso**.
Refresh desconhecido, expirado ou já rotacionado devolve `401`, e o app vai para o login.

Esta é a única rota que o `src/api/client.ts` chama fora do interceptor de renovação. Ela não
pode passar por ele: um `401` aqui dispararia uma renovação que chamaria esta rota de novo.

#### `POST /v1/auth/logout`

```json
{ "refresh": "8f3c..." }
```

`204`. Revoga aquela sessão. Corpo vazio revoga **todas** as sessões do usuário — é o
"sair de todos os aparelhos". Autenticada.

#### `POST /v1/auth/senha/recuperacao`

```json
{ "email": "voce@exemplo.com" }
```

**`202` sempre**, o e-mail existindo ou não, e sem corpo que distinga os dois casos. Envia um
código de 6 dígitos, válido por 30 minutos.

Código, e não link: link que abre o app exige *universal link* com domínio associado nas duas
plataformas, e não há host https. O e-mail leva **o código e nada mais** (guardrail 5).

#### `POST /v1/auth/senha/redefinicao`

```json
{ "email": "voce@exemplo.com", "codigo": "418302", "senha": "outra senha boa" }
```

`200` com sessão nova. **Todas as sessões anteriores são revogadas** — quem troca a senha em geral
perdeu o aparelho, e uma troca que não derruba o aparelho perdido não protege de nada.

| Status | Quando |
|---|---|
| `400` | código incorreto, expirado ou já usado — frases distintas entre si |
| `422` | senha nova com menos de 8 caracteres |

Aqui a distinção entre os erros **ajuda e não vaza**: quem chegou até esta rota já provou ter
acesso ao e-mail.

#### `DELETE /v1/conta`

```json
{ "senha": "uma senha boa" }
```

`204`. Autenticada, **e** reconfirmando a senha: exclusão é irreversível, e um celular desbloqueado
esquecido na mesa não pode apagar a vida financeira de alguém em dois toques.

Apaga **fisicamente**, numa transação, todas as linhas do tenant em todas as tabelas, mais o
usuário, as sessões e os códigos de recuperação. É o oposto da regra de `divida`, e pelo motivo
certo: lá a exclusão lógica protege o histórico do usuário; aqui ele está pedindo que o histórico
suma. Senha errada devolve `401`.

#### `GET /exclusao` — página pública

HTML, **fora de `/v1/`** e sem autenticação. Exigência do Google, adicional à exclusão dentro do
app — não a substitui. Diz o que é apagado, em quanto tempo, como fazer pelo app, e um contato
para quem perdeu o acesso.

### 3.11 M9 · assinatura (ADR 0013)

As duas rotas ficam **fora da trava de escrita**, e não por concessão: exigir assinatura para
assinar é deadlock. Ver a regra completa na seção 1 e o raciocínio na ADR 0013.

#### `GET /v1/assinatura`

```json
{
  "status": "em_teste",
  "podeEscrever": true,
  "expiraEm": "2026-08-14T00:00:00Z",
  "diasRestantes": 5,
  "produtoId": null,
  "renovacaoAutomatica": null
}
```

`status` é `em_teste` · `ativa` · `expirada`.

**`podeEscrever` é redundante com `status`, de propósito.** O app não reimplementa a regra
"expirada é o único que bloqueia": no dia em que aparecer um quarto status — período de graça,
cobrança em nova tentativa —, a versão já instalada continua acertando porque a decisão vem
pronta. Mesma disciplina de `situacao` em `Divida`.

`produtoId` e `renovacaoAutomatica` só vêm quando há compra: quem está no teste não comprou nada.

**Não há preço nesta resposta e não deve haver.** Ele vem da loja pelo SDK, já localizado em moeda
e formato; servi-lo daqui mentiria para quem está em outro país e envelheceria na primeira
promoção. As duas lojas exigem que seja assim.

`diasRestantes` é **arredondado para cima**: faltando 30 horas, a resposta é `2`. Truncar
subestimaria o prazo de quem está em aperto, justamente na véspera de decidir.

Quando o registro local já passou de `expira_em`, a rota **reconfere na loja** antes de responder —
é o que substitui webhook. Se a loja não responde, ela devolve o que está gravado: tirar acesso de
quem pagou por instabilidade da Apple é o erro caro.

#### `POST /v1/assinatura/compra`

```json
{ "plataforma": "ios", "recibo": "eyJhbGciOi..." }
```

Devolve o mesmo corpo do `GET`. `plataforma` é `ios` ou `android`; `recibo` é o JWS do StoreKit ou
o `purchaseToken` do Play Billing — o `expo-iap` unifica os dois no mesmo campo.

**É também a restauração.** O botão "Restaurar compras" que a Apple exige (diretriz 3.1.1) manda o
mesmo recibo para cá, e a unicidade de `transacao_original_id` faz o reenvio encontrar a linha que
já existe. Uma rota, não duas.

**O corpo não tem `expiraEm` nem `produtoId`, e não pode ter.** O recibo é chave de busca: o
servidor extrai o identificador, pergunta à loja por TLS autenticado com a chave dele, e grava o
que a loja responde. Aceitar validade declarada pelo aparelho seria deixar um app modificado
assinar a si mesmo.

| Status | Quando |
|---|---|
| `422` | a loja não reconheceu o recibo, ou as credenciais não estão configuradas |
| `409` | esse recibo já pertence a outra conta — mesma conta de loja em dois cadastros |

### 3.12 M12 · metas nomeadas (ADR 0017)

> **`/v1/metas` NÃO é `/v1/caixa/metas`.** Aquele guarda os seis potes fixos do perfil que entram na
> **cascata** do fechamento do mês (imposto, reserva, aposentadoria) — ver M7. Este é uma coleção
> livre que o usuário cria e apaga, e que **não entra em cálculo de capacidade nenhum**. A colisão de
> nome é dívida assumida na ADR 0017, porque unificar obrigaria a recalcular a cascata. Na tela, um é
> "Seus potes" e o outro é "Suas metas".

#### `GET /v1/metas`

```json
{ "metas": [
  { "id": "uuid", "nome": "Reserva de emergência", "emoji": "🛟",
    "valorAlvo": 1340000, "saldo": 536000,
    "dataAlvo": "2027-08", "aporteMensal": 67000,
    "aporteSugerido": 67000, "status": "em_dia", "ativa": true }
] }
```

Dinheiro em **centavos**. `dataAlvo` é `AAAA-MM` — meta não vence num dia, vence num mês.

**`aporteSugerido` e `status` são DERIVADOS NO SERVIDOR e nunca persistidos** (ADR 0003 e 0017). O
sugerido divide o que falta pelos meses que faltam, arredondando para cima — o mesmo método de
`aporte_de_provisao`. Gravá-lo deixaria a tela mostrando o número de quando a meta foi criada: a
mesma meta pede um valor em agosto e outro em novembro.

| Campo | Ausente (`null`) quando |
|---|---|
| `aporteSugerido` | falta `dataAlvo` — sem prazo não existe divisor, e inventar um horizonte produziria número que o usuário levaria a sério |
| `status` | falta `dataAlvo` **ou** falta `aporteMensal` — em nenhum dos dois casos há base para dizer que alguém está atrasado |

`status` é `em_dia` \| `aporte_baixo` \| `atingida`. `atingida` vem antes de tudo e não depende de
aporte. **Na tela, `aporte_baixo` é âmbar e nunca vermelho** (ADR 0015).

#### `POST /v1/metas` → `201`

```json
{ "nome": "Viagem em família", "emoji": "✈️", "valorAlvo": 600000,
  "saldo": 180000, "dataAlvo": "2027-07", "aporteMensal": 38000 }
```

`nome` e `valorAlvo` obrigatórios (`valorAlvo > 0`); o resto é opcional. `dataAlvo` fora de
`AAAA-MM` devolve `422`.

#### `PATCH /v1/metas/{id}` · `DELETE /v1/metas/{id}` → `204`

`PATCH` é parcial: campo ausente fica como está, e **`null` grava ausência** — é como o usuário
remove o prazo ou o aporte de uma meta. Sem essa distinção não haveria desfazer.

`DELETE` apaga de verdade, como fonte de renda e ao contrário de dívida: meta cadastrada errado é
ruído de cadastro, não histórico financeiro. Quem quer guardar sem ver na lista usa `ativa: false`.
Id de outro tenant devolve `404`, nunca `403` — um `403` confirmaria que o id existe.

### 3.13 M11 · respiro e marcos (ADR 0019)

> **O respiro entra ANTES de `capacidadeMaxima`, e é isso que o define.** Descontá-lo depois faria
> dele a sobra que some quando aperta — exatamente o que `domain.md` proíbe que ele seja. Quem não
> declarou respiro tem a cascata idêntica à de hoje: **não existe valor default**, porque um default
> seria o coeficiente que a ADR 0009 proíbe entrando pela porta dos fundos.

#### Campos novos em `GET /v1/caixa`

```json
{ "caixa": {
  "capacidadeMaxima": 62000,
  "respiro": 15000,
  "respiroUsadoNoMes": 8000,
  "respiroDisponivelNoMes": 7000,
  "respiroSaldoAcumulado": 22000,
  "respiroAtivo": true
} }
```

Tudo em **centavos**. A cascata passa a ser:

```
capacidadeMaxima = rendaLiquida − essenciais − provisaoMensal − aporteReserva
                   − aporteAposentadoria − respiro
capacidadeHoje   = capacidadeMaxima − naoEssenciais
aporteMaximo     = capacidadeHoje − comprometidoDividas
```

| Campo | Ausente (`null`) quando |
|---|---|
| `respiro` | o usuário nunca declarou. **Nunca `0` por ausência** — zero declarado é uma escolha legítima e diferente de não ter escolhido |
| `respiroUsadoNoMes` | não há respiro declarado. Com respiro declarado e nada usado, é `0` — o zero aqui é fato |
| `respiroDisponivelNoMes` | idem. **Derivado, nunca persistido**: `respiro − respiroUsadoNoMes`, com piso em `0` |
| `respiroSaldoAcumulado` | idem. Persistido é o dos **meses fechados**, no molde de `provisao_anual.saldo_acumulado`; o exposto é ele menos o que o uso deste mês passou da fatia, com piso em `0` |

O saldo acumulado rola na **virada do mês**, na primeira leitura que perceber que o mês mudou, e o
mês já apurado fica registrado para a rolagem ser idempotente. A virada liquida o mês fechado nas
duas pontas — tira o que passou da fatia, soma o que não foi usado —, e só um dos dois termos é
diferente de zero em qualquer mês. Não há job, não há notificação e não
há pergunta: o guardrail 4.1 diz que respiro não usado não vira cobrança, e perguntar todo mês o que
fazer com ele seria transformá-lo em prestação de contas.

#### `PUT /v1/caixa/respiro`

```json
{ "valorMensal": 15000, "ativo": true }
```

Resposta devolve o respiro gravado **mais o preço dele**:

```json
{ "respiro": { "valorMensal": 15000, "ativo": true, "saldoAcumulado": 22000 },
  "custoEmMeses": 2 }
```

`custoEmMeses` é a diferença de prazo entre o plano com e sem este respiro, pela **mesma**
`domain/simulacao.py` do M4 — não é estimativa nova, é a simulação existente rodada duas vezes.
É `null` quando não há dívida com dado suficiente para simular; a tela então grava sem exibir preço,
em vez de exibir palpite.

**`422` quando o respiro invade o piso legal**, isto é, quando
`rendaLiquida − essenciais − valorMensal < minimoExistencial`. Mesmo padrão e mesmo registro de
`_validar_aporte`: a mensagem diz o que aconteceu, em pt-BR, e não chama o usuário de nada.
`valorMensal` negativo devolve `422`. `ativo: false` **preserva o saldo acumulado** — desativar não
é apagar.

**Sem caixa preenchido, a declaração passa sem a checagem do piso.** Com renda e essenciais em
zero, qualquer valor "invadiria" o mínimo existencial, e a recusa diria a quem nunca informou nada
que o respiro dele é ilegal — afirmação sem dado. É a mesma limitação declarada de `_validar_aporte`
em `routers/simulacoes.py`, que também segue sem validar quando não há capacidade apurada.

#### `POST /v1/caixa/respiro/uso` → `201` · `DELETE /v1/caixa/respiro/uso/{id}` → `204`

```json
{ "valor": 8000, "descricao": "cinema" }
```

A resposta:

```json
{ "id": "b3f1…", "respiroDisponivelNoMes": 7000 }
```

`descricao` é opcional e livre. **Registrar uso de respiro não produz alerta, aviso, sinal nem
campo de comparação**: a resposta é o novo `respiroDisponivelNoMes` e o `id` do lançamento, e nada
além disso. Uso que exceda o disponível do mês é aceito e consome o saldo acumulado; excedendo os
dois, ainda é aceito e o disponível vai a `0` — o app não impede ninguém de gastar o próprio
dinheiro, e recusar aqui seria o policiamento que a feature existe para desmontar.

O `id` está na resposta porque **o `DELETE` é inalcançável sem ele**: não há rota de listagem de
usos, e desfazer um valor digitado errado é a razão de o `DELETE` existir. Identificador do registro
que acabou de nascer não é juízo sobre o gasto — o que a resposta não carrega é comparação, sinal de
excesso ou "quanto você já gastou".

`DELETE` existe porque valor digitado errado precisa de desfazer, e obrigar a conviver com ele
transformaria um erro de digitação em culpa. **O desfazer é exato, inclusive quando o uso tinha
consumido todo o acumulado** — R$ 300 digitados no lugar de R$ 30 voltam sem custo nenhum.

Ele é exato por construção: **registrar uso não escreve em `saldoAcumulado`.** A coluna guarda o que
veio dos **meses fechados** e é invariante durante o mês; o que o uso corrente passa da fatia é
descontado **na leitura** — `max(0, saldoAcumulado − max(0, usadoNoMes − respiro))` — e liquidado na
virada, junto com o não usado. Apagar o lançamento devolve os dois números ao que eram, porque não
houve débito a estornar. Gravar o desconto a cada uso destruiria saldo real de quem corrige um erro
de digitação, num produto cuja promessa é que respiro não usado acumula. É a mesma razão pela qual
`respiroDisponivelNoMes` nunca é persistido: valor calculado que dorme em coluna é valor que
envelhece errado.

**Registrar uso sem respiro declarado devolve `404`**, e não um `422`: é operação sobre recurso
ausente, e responder qualquer outra coisa inventaria um respiro de zero para quem nunca declarou.

#### `POST /v1/caixa/respiro/destinacao` → `201`

```json
{ "valor": 22000 }
```

A resposta:

```json
{ "respiroSaldoAcumulado": 0 }
```

Manda saldo acumulado para aporte extra na dívida. Sempre por ação explícita — **nunca automático,
nunca sugerido em push**. `422` se `valor > saldoAcumulado`; `404` sem respiro declarado.

O teto é o saldo **exposto**, não a coluna: destinar sobre o valor cru deixaria o usuário mandar
para a dívida um dinheiro que a tela dele já não mostra.

**Ela debita `saldoAcumulado` e grava o lançamento, e nada mais** (decidido em 19/08/2026). Não
escreve em parcela, pagamento nem dívida: "aporte extra" segue sendo parâmetro de simulação, não
dado gravado, e registrar um pagamento real exigiria dizer contra qual dívida — decisão que este
milestone não tomou.

#### `GET /v1/marcos`

```json
{ "marcos": [
  { "tipo": "primeira_negociacao", "atingidoEm": "2026-07-14", "celebradoEm": "2026-07-14" },
  { "tipo": "rota_25", "atingidoEm": "2026-08-02", "celebradoEm": null },
  { "tipo": "primeira_quitacao", "atingidoEm": null, "celebradoEm": null }
] }
```

`tipo` é `primeira_negociacao` \| `primeira_quitacao` \| `rota_25` \| `rota_50` \| `rota_75`.

**Marco é evento persistido, atingido uma vez e para sempre.** Não é predicado recalculado sobre o
estado atual, e a distinção é a coisa mais importante deste bloco: a porcentagem da rota se move
para trás quando o usuário cadastra uma dívida nova, e um marco recalculado se **desfaria** — a
pessoa perderia uma conquista por ter sido honesta sobre a própria situação.

`atingidoEm` grava quando o gatilho ocorreu; `celebradoEm`, quando a `MarcoScreen` foi exibida. Os
dois são separados para a tela não reaparecer a cada abertura do app, e para um marco atingido
offline não se perder.

Fontes dos gatilhos, todas já existentes: `renegociacao` para `primeira_negociacao`,
`divida.situacao = 'quitada'` para `primeira_quitacao`, e `rotaPercorridaBps` cruzando `2500`,
`5000` e `7500`.

#### `POST /v1/marcos/{tipo}/celebracao` → `204`

Grava `celebradoEm`. É escrita, e por isso passa pela trava de assinatura como qualquer outra —
mas um marco atingido durante o período somente leitura **não se perde**: ele fica com
`celebradoEm: null` e a tela aparece quando a assinatura voltar.

#### Campos novos em `GET /v1/dividas/resumo`

```json
{ "saldoInicialDaRota": 9100000, "rotaPercorridaBps": 2740 }
```

Isto **move para o servidor** uma conta que hoje o app faz em `src/components/rota/CardSaldo.tsx`,
e corrige a linha de base no caminho. Hoje ela é `evolucaoSaldo[0]`, que é o primeiro ponto da
série devolvida — e a série é recortada pelo mês selecionado. Passa a ser o **maior saldo já
registrado** em `saldo_snapshot`: linha de base que não encolhe, e porcentagem que nunca fica
negativa.

Os dois são `null` sem histórico — quem cadastrou hoje tem um ponto só, e "0% percorrido" no
primeiro dia seria desanimador **e falso**: a pessoa não deixou de andar, ela acabou de chegar.

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
- [x] Extração com extrator plugável (`DEVONADA_EXTRATOR`), Claude com visão lendo PDF e foto
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

### Bloco 7 — M7 · módulo de caixa
*Destrava: a capacidade real de pagamento. Sem ela, todo plano que o produto propõe é um chute
sobre quanto a pessoa consegue pagar.*

- [x] **Mínimo existencial corrigido** — estava na redação revogada (25% do salário mínimo);
      o Decreto 11.567/2023 fixou R$ 600,00. Config datada, `None` quando não configurado
- [x] `backend/domain/caixa.py` — motor puro, sem I/O, com as escolhas de método no docstring
- [~] Tabelas `fonte_renda`, `recebimento`, `gasto`, `provisao_anual`, `caixa_snapshot`
- [~] Campos novos em `perfil`; `renda_mensal` copiada para `fonte_renda` na migration
- [x] **A derivação que faltava (M7.2).** A migration declarava que `renda_mensal` continuaria
      sendo lida "derivada da soma das fontes ativas", e essa metade nunca virou código: o resumo
      seguia lendo a coluna, e quem preenchia o caixa via o painel vazio. `GET /v1/perfil` agora
      deriva, `PUT` grava na fonte (`422` com 2+ fontes) e `GET /v1/dividas/resumo` lê o caixa
      com o perfil como fallback
- [~] `GET /v1/caixa` e o CRUD de fontes, gastos e provisões
- [~] `GET`/`PUT /v1/caixa/metas` e `GET /v1/caixa/historico`
- [~] `_validar_aporte` passa a usar a capacidade real no lugar do piso legal
- [~] Frase do caixa no `script` de negociação, por template determinístico
- [~] `acimaDoPrazoDeRepactuacao` na simulação — CDC art. 104-A, 5 anos
- [~] Card `plano_sugerido` do chat usa a capacidade como aporte padrão, não zero

### Bloco 8 — M7.1 · fechamento do mês
*Destrava: o caixa deixar de envelhecer em silêncio. Gasto fixo e provisão já não se redigitam
pela forma do modelo; sobram o recebimento variável e o gasto que muda de valor.*

- [~] Tabela `fechamento_mes` — um por tenant por mês, com unicidade garantida no banco
- [~] `perfil.fechamento_dia_do_mes` — dia do lembrete; `None` é desligado
- [~] `GET /v1/caixa/fechamento?mes=AAAA-MM` — a proposta pré-preenchida. **Propõe e não grava.**
      Cada item traz `origem` (`mes_anterior` · `valor_atual` · `sem_referencia`) e, quando vem
      do mês anterior, o `mesDeReferencia`. Sem referência ⇒ `valorSugerido` **ausente**, nunca 0
- [~] `POST /v1/caixa/fechamento` — grava **só os itens enviados**, numa transação, com **um**
      snapshot. Item omitido não é gravado e não vira zero
- [~] `GET /v1/caixa` ganha `ultimoFechamentoMes`, `mesesDesdeFechamento` e `caixaDefasado`.
      Os três **ausentes** quando nunca houve fechamento: "ainda não fechou" e "está em dia" são
      afirmações diferentes
- [x] `domain/caixa.caixa_defasado` — o limiar de 2 meses é escolha de método, declarada no
      docstring: um mês de atraso é o estado normal entre fechamentos

### Bloco 9 — M7.2 · uma renda só
*Não destrava tela nova: conserta a que já existia e aparecia vazia.*

- [x] `GET /v1/dividas/resumo` lê a renda do caixa, perfil como fallback — renda **líquida**
- [x] `GET /v1/perfil` deriva `rendaMensal` das fontes ativas; `PUT` grava na fonte
- [x] `422` quando há 2+ fontes ativas: um escalar não se reparte sem inventar dado
- [x] `rendaMensal` ausente no corpo do `PUT` não apaga a fonte
- [x] `margemDisponivel` = `aporteMaximo` quando o caixa conhece a saída; piso legal no Nível 0
- [x] Teste cruzando caixa e resumo — a ponte que faltava, e por onde o defeito passou

### Bloco 10 — M8 · conta de usuário
*Destrava: publicar. Os três itens de "Conta de usuário" do pré-lançamento dependiam deste bloco,
e dois deles são código.*

- [~] `usuario`, `sessao` e `codigo_recuperacao` — migration `a71d4e9c05b2`, exercitada em
      Postgres com `upgrade`, `downgrade` e `upgrade` de novo
- [~] `POST /v1/auth/registro` · `/login` · `/refresh` · `/logout` — JWT de 15 min mais refresh
      opaco rotacionado a cada uso (ADR 0012)
- [~] `POST /v1/auth/senha/recuperacao` · `/senha/redefinicao` — código de 6 dígitos por e-mail,
      com hash no banco, teto de tentativas e revogação de todas as sessões ao redefinir
- [x] **Login não distingue senha errada de e-mail inexistente**, nem por mensagem nem por tempo:
      o bcrypt roda contra um hash falso quando não há usuário
- [x] **`recuperacao` responde `202` sempre** — responder `404` faria da rota um verificador de
      cadastro
- [x] Trava de força bruta: `login_max_falhas` tentativas e a conta bloqueia por
      `login_bloqueio_minutos`
- [~] `DELETE /v1/conta` — exclusão **física**, em transação, reconfirmando a senha
- [x] **A varredura de exclusão é derivada do metadata**, não uma lista à mão: tabela nova com
      `tenant_id` entra na exclusão no commit em que nasce. Há teste que falha se alguma tabela
      ficar fora — sem ele, a próxima migration deixaria dado órfão em silêncio
- [~] `GET /exclusao` — página pública, exigência do Google
- [x] Correio plugável (`DEVONADA_CORREIO`), no padrão da ADR 0007. A suíte usa o de memória: e-mail
      entra na regra de que **nenhum teste toca a rede**
- [x] O token fixo do beta **saiu** de `config.py`, de `auth.py` e do app
- [x] A fixture `auth` do `conftest.py` passou a criar conta de verdade — os 370 testes anteriores
      não conheciam o mecanismo, e por isso nenhum deles mudou

### Bloco 11 — M9 · assinatura in-app
*Destrava: cobrar. Era o único item do pré-lançamento que é código de produto.*

- [~] `assinatura` — migration `d94a6b18c7f2`. Uma linha por tenant, não um extrato: a pergunta do
      produto é uma só, "até quando esta pessoa pode escrever?"
- [~] `GET /v1/assinatura` — situação atual. **Reconfere na loja** quando o registro local já
      passou de `expira_em`; é isto que substitui webhook enquanto não há URL pública
- [~] `POST /v1/assinatura/compra` — confere o recibo com a loja e grava. **É também a
      restauração**: idempotente por `transacao_original_id`, então o botão que a Apple exige
      (3.1.1) usa esta mesma rota. `409` quando o mesmo recibo já pertence a outro tenant
- [x] **A trava é derivada do método**, numa dependência global de `main.py` — não uma lista por
      rota, que envelheceria na primeira rota criada sem lembrar dela. `402` na recusa
- [x] **Leitura nunca é bloqueada**, e a exclusão de conta também não (Apple 5.1.1(v); LGPD, 18)
- [x] Teste que varre `app.openapi()` e falha se `LIVRES` crescer sem decisão explícita — gêmeo do
      que varre as tabelas na exclusão de conta
- [x] `backend/loja/` plugável (`DEVONADA_LOJA`), no padrão da ADR 0007: Apple, Google e memória. A
      suíte usa o de memória, e **cobrança entra na regra de que nenhum teste toca a rede**
- [x] **O recibo do aparelho é chave de busca, nunca fonte da verdade** — quem afirma a validade é
      a loja, consultada pelo servidor com credencial que só ele tem
- [x] `chave_consulta` como coluna separada de `transacao_original_id`: a Apple consulta pelo id da
      transação, o Google pelo `purchaseToken`. Guardar só um faria a renovação ser detectada no
      iPhone e não no Android
- [x] `assinatura` entrou na exclusão de conta **sem uma linha a mais**, pela varredura do metadata
- [x] **Nenhum preço trafega.** Ele vem da loja pelo SDK, já localizado — exigência das duas

> **A fixture `auth` não mudou.** Toda conta da suíte nasce pela rota de registro, e conta
> recém-criada está dentro do teste de 7 dias — os 420 testes anteriores passaram intactos. O
> plano previa cirurgia no `conftest.py` e ela não foi necessária.

### Bloco 12 — M12 · metas nomeadas (ADR 0017)

- [~] `meta` — migration `e07b3c5d91a8`. **Aditiva**: as seis colunas de meta do `perfil` não são
      migradas, porque alimentam a cascata de `domain/caixa` e movê-las mudaria a capacidade de todo
      mundo em silêncio no primeiro deploy
- [~] `GET`/`POST`/`PATCH`/`DELETE /v1/metas` — CRUD no formato de `fontes`/`gastos`/`provisoes`
- [~] `domain/metas.py` — `aporte_sugerido` e `status`, puros. **Sem fonte legal, e o módulo declara
      isso no cabeçalho**: ele divide o que o usuário informou pelo prazo que o usuário escolheu, que
      é o mesmo método de `aporte_de_provisao`. Seria invenção afirmar quanto ele *deveria* guardar
- [~] **Nenhuma coluna de valor calculado.** Sugerido e status saem a cada resposta, porque dependem
      do mês em que a pergunta é feita
- [~] Ausência tratada nos dois sentidos: sem `data_alvo` não há sugestão; sem `aporte_mensal` não há
      status. `None` nos dois, e a tela então não exibe selo em vez de exibir palpite
- [ ] `GET /v1/metas/{id}` — não existe de propósito: a coleção cabe numa resposta, e a tela de
      edição lê do cache que a aba já buscou (ADR 0002). Entra se algum dia houver deep link direto

### Bloco 13 — M11 · respiro e marcos (ADR 0019)

*Destrava: a intervenção anti-desistência. Sem ela, o teto que o produto propõe pressupõe que a
pessoa parou de viver — e o mês 4 é onde ela desiste.*

- [ ] `respiro` — tabela com `valor_mensal`, `ativo`, `saldo_acumulado`, `ultimo_mes_apurado`, uma
      linha por tenant. `saldo_acumulado` no molde de `provisao_anual`; `ultimo_mes_apurado` é o que
      torna a rolagem da virada do mês idempotente sem job
- [ ] `respiro_uso` e `respiro_destinacao` — lançamentos datados, com `tenant_id`. Entram sozinhas na
      exclusão de conta por `tabelas_do_tenant()`
- [ ] `marco` — evento persistido com `tipo`, `atingido_em`, `celebrado_em`. **Nunca um predicado
      recalculado**: marco que se desfaz quando o usuário cadastra dívida nova é o modo de falha mais
      cruel desta feature
- [ ] `domain/caixa.py` — `respiro` em `EntradaCaixa` e em `Caixa`, subtraído **antes** de
      `capacidade_maxima`. O docstring precisa declarar que o valor **não é regra financeira: é dado
      do usuário** — é a distinção que autoriza o módulo a existir sem fonte legal
- [~] Validação de piso: `422` quando `renda_liquida − essenciais − respiro < minimo_existencial`,
      no registro de `_validar_aporte`. Implementado em `PUT /v1/caixa/respiro` (T2); sem caixa
      preenchido a checagem não roda, pela mesma limitação declarada de `_validar_aporte`
- [~] `PUT /v1/caixa/respiro` com `custoEmMeses` pela mesma `domain/simulacao.py` do M4 — nenhuma
      conta nova, a existente rodada duas vezes (`domain/simulacao.custo_em_meses`). Implementado e
      coberto por teste (T2); falta ver no app
- [~] `POST`/`DELETE /v1/caixa/respiro/uso` e `POST /v1/caixa/respiro/destinacao`, mais a rolagem
      idempotente do saldo na virada do mês. Implementados e cobertos por teste (T2); falta ver no
      app
- [ ] `GET /v1/marcos` e `POST /v1/marcos/{tipo}/celebracao`
- [~] `saldoInicialDaRota` e `rotaPercorridaBps` em `GET /v1/dividas/resumo` — tira do
      `CardSaldo.tsx` a única conta derivada que o app ainda faz, e troca a linha de base móvel pelo
      maior saldo já registrado. Implementado e coberto por teste (T3); o consumo pelo app
      (`CardSaldo.tsx`) é T6 e ainda não foi exercitado em device
- [x] Teste que cruza respiro declarado × teto do simulador. É o gêmeo do teste de M7.2 que ligou
      fonte de renda a painel preenchido — e que faltava justamente quando o defeito passou por
      quatro gates verdes. Em `tests/test_caixa_integracao.py::TestRespiroNoSimulador`, com
      `custoEmMeses` conferido contra as duas simulações feitas pela rota pública
- [ ] Teste que cadastra dívida nova depois de um marco e prova que o marco **não se desfaz**
- [ ] Teste de regressão: tenant sem respiro declarado tem cascata byte a byte idêntica à de hoje

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

> **Um emulador Android rodou** (commit `e0f1def`) e produziu cinco correções de UI que nenhum
> gate pegaria — inclusive um rótulo que perdia uma palavra em silêncio. Foi **olhar telas, não
> exercitar fluxo**: nenhuma linha desta tabela mudou por causa dele, e nenhum `[~]` da fila virou
> `[x]`. Ver a tela renderizar e ver o fluxo funcionar são afirmações diferentes.

Suíte do backend: **370 testes**, verdes em SQLite e em Postgres, **sem tocar a rede**.

Nenhum endpoint da fila continua sem implementação. O que falta em todos é a mesma coisa:
**ver funcionando no aplicativo, em aparelho**.
