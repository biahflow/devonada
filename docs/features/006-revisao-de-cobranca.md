# FDD — Revisão de cobrança

| | |
|---|---|
| Feature | Revisão de cobrança |
| Slug | `006-revisao-de-cobranca` |
| Milestone | M6 (ver `roadmap.md`) |
| Telas | `app/(tabs)/dividas/[id]/revisao.tsx`; entrada em `app/(tabs)/dividas/[id]/index.tsx`; card `valor_justo` no chat |
| Endpoints | `GET /v1/dividas/{id}/revisao` (novo); `POST /v1/chat/messages` (card novo); `GET /v1/contratos/{id}` (campos novos) |
| Depende de | M1 (dívida persistida), M1.5 (extração de contrato), ADR 0008 |

## Objetivo e não objetivos

Mostrar ao usuário quais pontos concretos do contrato dele valem contestar, com a fonte legal de
cada um e o trecho do contrato que o sustenta — e quanto a dívida ficaria se esses pontos fossem
acolhidos.

**Não objetivos:**

- **Não é revisional.** O produto não recalcula o contrato, não expurga encargos e não emite
  parecer. Ele aponta e cita.
- **Não afirma ilegalidade.** Todo achado é um convite a conferir, no tom de
  `possivelPrescricao` (`guardrails.md`, seção 3).
- **Margem consignável fica fora.** O limite da Lei 10.820/2003 incide sobre a soma de **todas**
  as consignações do benefício, não sobre uma dívida, e o remédio é reduzir o desconto — não o
  débito. Não pertence a `valorJusto` (ADR 0008).
- **Não quantifica excesso de juros.** Achado de taxa acima do teto nomeia as duas taxas e não
  produz número: quantificar exigiria reamortizar o contrato, o que é estimativa disfarçada.
- **Não redige petição** nem instrui a não pagar (`guardrails.md`, seção 3).
- **Nenhuma rota de escrita.** A revisão é leitura pura; nada é gravado.

## Jornada e interface

O usuário abre uma dívida, toca em **"Revisar cobrança"** e cai numa tela que lista os achados,
um cartão por achado, com a mensagem de negociação pronta para copiar ao final. Pelo chat, o
caminho é o mesmo: ao perguntar sobre uma dívida, ele pode receber o card `valor_justo`, que faz
deep link para essa tela.

**Os quatro estados de `dividas/[id]/revisao`:**

| Estado | O que aparece |
|---|---|
| Carregando | `LoadingState` |
| Erro | `ErrorState` com a frase do backend e ação de tentar de novo |
| Vazio | **O estado mais importante.** Nunca "nada encontrado" — isso soa como "está tudo certo". Diz que sem o contrato lido não há o que conferir e leva ao envio do contrato (M1.5). Se o contrato **foi** lido e mesmo assim não houve achado, diz isso com todas as letras: não encontramos pontos a contestar **nos itens que sabemos conferir**, e lista quais são. |
| Conteúdo | Comparativo cobrado → justo, um `Card` por achado, script copiável, disclaimer |

## Contrato

### `GET /v1/dividas/{id}/revisao`

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
        "explicacao": "O contrato prevê multa de 5% por atraso. O CDC limita a multa de mora a 2% do valor da prestação. Vale contestar a diferença.",
        "fonte": "Código de Defesa do Consumidor, art. 52, §1º",
        "comoConferir": "Procure no contrato a cláusula de multa por atraso e confira o percentual.",
        "valorContestavel": 18000,
        "evidencia": "Multa por atraso: 5% sobre o valor da parcela"
      }
    ],
    "script": "Olá. Sobre o contrato …",
    "fundamentos": ["Código de Defesa do Consumidor, art. 52, §1º"],
    "baseLegalVigenteEm": "2026-01-15"
  }
}
```

- `valorJusto` é **`null`** quando nenhum achado tem valor. Nunca igual a `valorCobrado`.
- `valorContestavel` é `null` no achado que não produz número (ADR 0008, regra 2).
- `evidencia` é `null` no achado que não veio da extração.
- `baseLegalVigenteEm` é `null` quando nenhum achado dependeu de teto configurado.
- `economia` **não** viaja: o cliente já a calcula (`guardrails.md` 1.2).
- Dívida de outro tenant: **404, nunca 403**.

### Campos novos em `CamposContrato` (M1.5)

`modalidade`, `tarifaCadastro`, `seguroPrestamista`, `iof`, `multaMoratoriaMensal` — todos
`CampoExtraido`, portanto sujeitos a `limpar_campos_sem_evidencia()`: sem trecho literal, o campo
é zerado no servidor e o achado correspondente não existe.

### Tipos, cache e unidades

- `src/api/types.ts`: `Achado`, `RevisaoCobranca`; `ValorJustoCardData` ganha `dividaId`.
- Chave de cache `['dividas', 'revisao', id]` — **dentro do prefixo `['dividas']`**, para as
  mutações de M1 e M3 revalidarem sem código novo, como `useResumo` já faz.
- Dinheiro em centavos inteiros; taxa e multa em basis points. `valorContestavel` é centavo.

## Requisitos funcionais

- **RF-001** — `GET /v1/dividas/{id}/revisao` devolve os achados da dívida, cada um com fonte.
- **RF-002** — `valorJusto = valorCobrado − Σ valorContestavel`, calculado **no servidor**.
- **RF-003** — Nenhum achado com valor ⇒ `valorJusto: null` e nenhum card no chat.
- **RF-004** — Achado derivado do contrato carrega o trecho literal em `evidencia`.
- **RF-005** — Achado que dependa de teto não configurado **não é produzido**.
- **RF-006** — `script` é montado por template determinístico no servidor, nunca por LLM.
- **RF-007** — A tela trata os quatro estados, com o vazio distinguindo "sem contrato lido" de
  "contrato lido, sem achado".
- **RF-008** — O card `valor_justo` tem os números preenchidos **pela rota**, a partir do banco;
  o assistente só escolhe a dívida.
- **RF-009** — O card faz deep link para `dividas/[id]/revisao` por campo tipado (`dividaId`).
- **RF-010** — Copy de achado e de script nunca afirma ilegalidade.
- **RF-011** — A tela exibe a data de vigência do teto ao lado do achado que dependeu dele.

## As regras e suas fontes

Conferidas no texto primário antes do código. Detalhe da verificação na ADR 0008.

### Achados com valor — entram na subtração

| Achado | Fonte | Valor |
|---|---|---|
| Multa de atraso acima de 2% | CDC, art. 52, §1º (redação da Lei 9.298/1996) | Excesso sobre as parcelas em atraso |
| Tarifa de cadastro fora do início do relacionamento | STJ, Súmula 566 | A tarifa cobrada |
| Seguro prestamista embutido | CDC, art. 39, I; STJ, Tema 972 (REsp 1.639.320/SP) | O prêmio |

### Achados sem valor — aparecem, não somam

| Achado | Fonte |
|---|---|
| Juros acima do teto do consignado | Resolução do CNPS vigente (config datada) |
| Capitalização sem pactuação expressa | STJ, Súmula 539 |
| Comissão de permanência cumulada | STJ, Súmula 472 |
| Taxa efetiva anual / CET não informada | CDC, art. 52, II |

## Guardrails desta feature

| Guardrail | Como esta feature o respeita |
|---|---|
| 1.2 — o app não calcula valor derivado | `valorJusto` vem pronto; o cliente só faz a subtração de `economia`, nominalmente permitida |
| 1.3 — números têm procedência | Achado sem fonte não existe; teto não configurado não vira número |
| 3 — postura jurídica | Todo achado é investigação; fundamentos são curados no backend; script é sugestão editável; disclaimer é propriedade do componente |
| 4 — anti-ansiedade | `warning`, nunca `danger`. O assunto já assusta sozinho |
| 6 — multi-tenant | Query filtra tenant; id alheio devolve 404 |
| 7.1 — sem fonte, sem afirmação | O schema do assistente não tem campo para os valores do card; a rota os preenche do banco |
| 8.1 — extração é proposta | Campo sem trecho é zerado no servidor, logo não vira achado |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Endpoints especificados em `docs/api-contract.md`.
- [x] Estados de erro e de vazio definidos — inclusive os **dois** vazios.
- [x] Guardrails aplicáveis identificados.
- [x] Copy revisada contra `docs/domain.md`.
- [x] Toda citação legal conferida no texto primário (ADR 0008).

## Definition of Done

- [x] `typecheck`, `lint`, `test` (225) e `bundle:check` passam.
- [x] `pytest` passa (260) em SQLite **e** em Postgres, **sem tocar a rede**.
- [x] Os quatro estados implementados e verificáveis — com os **dois** vazios distintos.
- [x] Nenhum valor monetário calculado no cliente além da `economia` permitida.
- [x] Teste de copy nos dois lados, que falha em "ilegal", "abusiv" e "é seu direito".
- [x] Alvo de toque de 48pt e `accessibilityLabel` no deep link do card.
- [x] Documentos canônicos atualizados no mesmo commit.
- [x] **Exercitado por request real**, contra Postgres, com contrato sintético de consignado: as
      cinco regras conferidas à mão, o teto ausente derrubando o achado sem deixar número
      residual, e o achado sem valor não entrando na soma.
- [ ] **Não validado em device.** Nenhum gate prova que a tela cabe no aparelho.

## Riscos e modos de falha

| Risco | O que o produto faz |
|---|---|
| **Teto desatualizado no `.env`** produz achado errado | A data de vigência viaja na resposta e aparece na tela. Teto ausente ⇒ sem achado, nunca um teto chutado |
| **Falso positivo do seguro:** nem todo seguro embutido é venda casada | O achado nomeia o valor e devolve a pergunta de fato ao usuário ("você pôde escolher a seguradora?"). Não afirma |
| **Falso positivo da tarifa:** "relacionamento" é mais amplo que "dívida anterior no app" | O achado declara o indício que o gerou (outra dívida do mesmo credor, mais antiga) e condiciona: "se este não foi seu primeiro contrato com esse credor" |
| **O usuário lê o achado como sentença** e vai ao credor afirmando ilegalidade | Copy em tom de investigação, disclaimer junto do número, e teste automatizado que quebra em "ilegal" / "abusiv" / "é seu direito" |
| **Extração erra o valor de um encargo** | O trecho literal aparece ao lado do número. O usuário confere contra o próprio contrato antes de usar |
| **O conjunto de regras parece pequeno** perto do que se promete no mercado | É a diferença entre o que se sustenta e o que se alega. O vazio nomeia quais itens sabemos conferir |
