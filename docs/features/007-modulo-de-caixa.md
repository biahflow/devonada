# FDD — Módulo de caixa

| | |
|---|---|
| Feature | Módulo de caixa |
| Slug | `007-modulo-de-caixa` |
| Milestone | M7 (ver `roadmap.md`) |
| Telas | quarta aba: `app/(tabs)/caixa/index` · `renda` · `gastos` · `provisoes` · `metas`. Entradas em `dividas/simulador` e no Painel |
| Endpoints | `GET /v1/caixa`, `/v1/caixa/fontes`, `/v1/caixa/gastos`, `/v1/caixa/provisoes`, `PUT /v1/caixa/metas`, `GET /v1/caixa/historico` (todos novos) |
| Depende de | M1 (dívida persistida), M3 (parcelas reais), M4 (simulador), ADR 0009 |

## Objetivo e não objetivos

Saber quanto o usuário **ganha e gasta**, para que todo plano de pagamento que o produto propõe
caiba na vida real dele — e, no caminho, organizar o dinheiro dele: suavizar renda variável,
reservar imposto, provisionar as despesas anuais, construir reserva e separar aposentadoria.

O módulo existe para produzir **um número**: a capacidade de pagamento mensal sustentável. Todo
campo capturado só se justifica se melhora esse número.

**Não objetivos:**

- **Não é app de orçamento.** Não há categorização automática de extrato, nem gráfico de gastos
  por mês, nem meta de consumo. Se um campo não muda a capacidade, ele não entra.
- **Não recomenda investimento.** O app não projeta rendimento nem elege aplicação. Ele compara
  a taxa da dívida com o rendimento que o **usuário** informou, e só quando ele informou
  (ADR 0009).
- **Não decide a ordem dos potes.** Ver ADR 0009.
- **Não diagnostica superendividamento.** Ver a seção "O que a leitura da lei mudou".
- **Não corta gasto por conta própria.** Não essencial é exibido, nunca descontado por
  iniciativa do app.
- **Não faz Open Finance.** O modelo de dados o comporta; a integração é pós-MVP
  (`docs/data-ingestion.md`).

## Recorrência: por que não há lançamento mês a mês

Digitar os mesmos gastos todo mês é o que faz as pessoas abandonarem app de finanças na terceira
semana. O desenho evita isso pela **forma do modelo**, não por uma função de cópia:

**`gasto` é um registro permanente, não um lançamento mensal.** Ele guarda `valorMensal` e vale
até ser alterado ou desativado (`ativo: false`). Aluguel de R$ 2.500 é digitado **uma vez**;
nos meses seguintes ele já está lá. Não existe "replicar para o mês seguinte" porque não existe
mês nenhum no registro. O mesmo vale para `fonte_renda` e `provisao_anual`.

`ativo` é justamente a chave de liga/desliga: gasto que acabou é desativado, e some da conta
sem apagar o histórico — mesma disciplina da exclusão lógica de dívida.

**Onde a fricção sobra de verdade:** o `recebimento` do PJ, que é por definição mensal, e o
gasto variável que muda de valor. Para esses, a solução **não** é replicar automaticamente:
número que o usuário nunca confirmou entrando na capacidade é o mesmo erro de o LLM gravar dado
sem revisão (guardrail 8.1). A solução é o **fechamento do mês** — a tela abre pré-preenchida
com o mês anterior e o usuário confirma ou ajusta. Está no roadmap como próximo passo do M7,
fora deste milestone.

## O que a leitura da lei mudou neste desenho

Conferido no Planalto antes do código, como manda o `agent-guidelines.md`. A leitura mudou três
coisas — e a primeira delas era um erro que já estava rodando.

### 1. O mínimo existencial no código estava na redação revogada

`domain/minimo_existencial.py` calculava **25% do salário mínimo** citando o Decreto
11.150/2022, art. 3º. Essa era a redação **original**. O **Decreto 11.567, de 19/06/2023**
substituiu o percentual por um valor fixo de **R$ 600,00** e revogou o § 2º que congelava o
número.

Com salário mínimo de R$ 1.518,00, o app usava R$ 379,50 onde a lei manda R$ 600,00 — um piso
**R$ 220,50 mais baixo** que o legal. Consequência prática: `_validar_aporte` aceitava planos de
pagamento que invadem a proteção que o decreto garante. Corrigido antes de qualquer código do
M7, com o valor em **config datada** (`minimo_existencial_centavos` +
`minimo_existencial_vigente_em`) e `None` quando não configurado.

### 2. O mínimo existencial não é custo de vida — e é por isso que este módulo existe

O art. 3º define um **piso legal de proteção contra o credor**. Ele não tem relação com o que
uma pessoa precisa para viver: quem tem aluguel, carro e moto gasta muitas vezes R$ 600,00 por
mês. Usar o piso como proxy de custo de vida — que é o que o produto fazia — produz margem
otimista e plano inexequível.

O módulo de caixa substitui o proxy pelo número real. **O piso continua valendo como limite
inferior intransponível**; o custo de vida real passa a ser o que determina a capacidade.

### 3. O sinal de superendividamento é muito mais estreito do que parecia

O plano original previa: soma das parcelas mínimas > capacidade ⇒ "suas dívidas não cabem no
orçamento" ⇒ caminho da Lei 14.181/2021. A leitura do texto derrubou a versão simples.

**CDC art. 54-A, § 1º** (incluído pela Lei 14.181/2021): superendividamento é "a impossibilidade
manifesta de o consumidor pessoa natural, **de boa-fé**, pagar a totalidade de suas **dívidas de
consumo**, exigíveis e vincendas, sem comprometer seu mínimo existencial".

Três recortes que o app **não consegue** aplicar sozinho:

- **Boa-fé** não é apurável por software. O § 3º exclui dívida contraída mediante fraude ou
  má-fé, contrato doloso sem propósito de pagar, e produtos de luxo de alto valor.
- **Dívida de consumo** exclui o que não é consumo. O Decreto 11.150, art. 2º, parágrafo único,
  define: compromisso assumido "para a aquisição ou a utilização de produto ou serviço como
  destinatário final". Dívida da atividade produtiva do PJ, por exemplo, fica fora.
- **Art. 4º do decreto** exclui da aferição as parcelas de financiamento imobiliário, crédito
  com garantia real, crédito com fiança ou aval, crédito rural, financiamento de atividade
  produtiva, dívida já renegociada na forma do CDC, tributos e condomínio, **crédito consignado
  regido por lei específica** e operações de antecipação/desconto/cessão. O app só conhece a
  modalidade quando o contrato foi lido.

**Decisão:** o produto não afirma que o usuário está superendividado. Ele diz que **os números
que ele informou não fecham** — que é um fato aritmético sobre os dados dele — e nomeia o
caminho de repactuação como algo a **investigar** com Procon, defensoria ou advogado. Mesmo tom
de `possivelPrescricao` (guardrail 3).

**O que a lei também deu de concreto:** o art. 104-A fixa que o plano de pagamento apresentado
em repactuação tem prazo máximo de **5 anos**, preservado o mínimo existencial. Isso é um número
com fonte e vira uma informação da tela quando o plano simulado passa de 60 meses.

## Jornada e interface

Quem está endividado e com medo não preenche formulário. A captura é progressiva e **nenhum
passo é obrigatório**.

**Nível 0 — 20 segundos.** Dois campos: renda e total de essenciais. A capacidade aparece na
hora. O valor vem **antes** do esforço, e é isso que compra o Nível 1.

**Nível 1.** Essenciais quebrados por categoria, fontes de renda separadas, provisões anuais,
metas. A capacidade fica mais precisa e a proposta de negociação, mais afiada.

**Nível 2.** Open Finance preenche sozinho — fora deste milestone.

### As telas e seus quatro estados

| Tela | Carregando | Erro | Vazio | Conteúdo |
|---|---|---|---|---|
| `caixa/index` | `LoadingState` | `ErrorState` + tentar de novo | **Convida ao Nível 0**, com o argumento do valor imediato, não com "cadastre seus dados" | A cascata em degraus, as duas capacidades e os sinais |
| `caixa/renda` | idem | idem | Convida à primeira fonte; explica por que mês magro e não média | Fontes + histórico de recebimento |
| `caixa/gastos` | idem | idem | Convida ao total único do Nível 0 antes de pedir categoria | Lista por categoria, com `essencial` e `fixo` |
| `caixa/provisoes` | idem | idem | Nomeia o caso concreto: "IPVA, seguro, licenciamento" | Cada provisão com quanto falta e quantos meses |
| `caixa/metas` | idem | idem | Explica cada meta antes de pedir número | Reserva, aposentadoria, imposto, rendimento |

## Contrato

### `GET /v1/caixa`

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

- `origemRenda` é `"informada"` ou `"pior_mes_registrado"` — o usuário vê de onde saiu o número.
- Todo campo monetário é **centavo inteiro**; `impostoBps` e `rendimentoEsperadoBps` são
  **basis points**.
- `capacidadeHoje` e `capacidadeMaxima` **podem ser negativas**. O negativo é a informação.
- `minimoExistencial` é `null` se o piso não estiver configurado, e aí `abaixoDoPiso` também é
  `null` — ausência, nunca `false` otimista.
- `naoFecha` é o sinal aritmético descrito acima. **Nunca** se chama `superendividado`.

### Demais rotas

`GET · POST · PATCH · DELETE` em `/v1/caixa/fontes[/{id}]`, `/v1/caixa/gastos[/{id}]` e
`/v1/caixa/provisoes[/{id}]`; `POST /v1/caixa/fontes/{id}/recebimentos`;
`PUT /v1/caixa/metas`; `GET /v1/caixa/historico`. Detalhe campo a campo em
`docs/api-contract.md`. Erro no formato da seção 1.1. Id de outro tenant devolve **404, nunca
403**.

### Tipos e cache

- `src/api/types.ts`: `Caixa`, `FonteRenda`, `Gasto`, `ProvisaoAnual`, `MetasCaixa`,
  `Recebimento`.
- Chave `['caixa']`. Toda mutação de caixa invalida **também** `['dividas']`: mudar a renda muda
  a simulação, e duas telas com margens diferentes destroem a confiança no número.

## Requisitos funcionais

- **RF-001** — `GET /v1/caixa` devolve a cascata completa, com as duas capacidades.
- **RF-002** — Toda a aritmética da cascata acontece no servidor (ADR 0003). O cliente formata.
- **RF-003** — Renda típica é a **menor** dos últimos recebimentos registrados; sem histórico
  suficiente, é o valor informado, e a resposta diz qual origem usou.
- **RF-004** — Provisão mensal divide o valor anual pelos **meses restantes até o vencimento**,
  nunca por 12 fixo.
- **RF-005** — Sem `impostoBps` informado, nada é reservado e a tela **diz** que não está
  reservando.
- **RF-006** — Capacidade negativa é exibida como número negativo, em `warning`, nunca escondida
  nem zerada.
- **RF-007** — `abaixoDoPiso` compara a sobra depois dos essenciais com o mínimo existencial
  legal; quando verdadeiro, nenhum plano é proposto.
- **RF-008** — `naoFecha` é verdadeiro quando a soma das parcelas mínimas excede
  `capacidadeMaxima`. A copy é aritmética e convida a investigar; **não** afirma
  superendividamento nem direito.
- **RF-009** — `aporteMaximo` (= `capacidadeHoje − comprometidoDividas`) vira o default do aporte
  no simulador e o teto de `_validar_aporte`. **Não** é `capacidadeHoje`: as parcelas atuais já
  são dívida, e usar a capacidade cheia como teto do aporte **extra** as contaria duas vezes.
- **RF-010** — O script de negociação ganha a frase ancorada no caixa por **template
  determinístico**; sem caixa preenchido, a frase não aparece.
- **RF-011** — Plano simulado acima de 60 meses exibe o prazo máximo do art. 104-A como
  informação, sem afirmar direito à repactuação.
- **RF-012** — `caixa_snapshot` é **append-only**; nenhuma rota faz `UPDATE` nele. Toda mutação
  grava uma linha; a leitura de `GET /v1/caixa` **não** grava.
- **RF-014** — Reenviar um recebimento do mesmo mês **sobrescreve** em vez de duplicar: corrigir
  valor digitado errado é o caso comum, e duas linhas do mesmo mês fariam o pior mês ser
  calculado sobre um dado fantasma.
- **RF-015** — A renda típica é apurada **por fonte**, não sobre o total: uma fonte fixa não pode
  ser puxada para baixo pelo pior mês de uma fonte variável.
- **RF-013** — O LLM não calcula nenhum valor deste módulo. Ele só ajuda a estimar um gasto que
  o usuário não sabe, e explica o que já foi calculado.

## Guardrails desta feature

| Guardrail | Como esta feature o respeita |
|---|---|
| 1.2 — o app não calcula valor derivado | Toda a cascata vem pronta de `GET /v1/caixa`; o cliente não soma potes |
| 1.3 — números têm procedência | Piso vem de decreto citado e datado; o resto vem do usuário. Nenhum coeficiente inventado (ADR 0009) |
| 3 — postura jurídica | `naoFecha` é fato aritmético, não diagnóstico. Repactuação é caminho a investigar, nunca direito afirmado |
| 4 — anti-ansiedade | Capacidade negativa é `warning` com texto, nunca `danger`. Quem chega aqui já está com medo |
| 5 — privacidade | Renda e gasto são os dados mais sensíveis do produto: não vão para log nem para mensagem de erro, e não entram no prompt do LLM |
| 6 — multi-tenant | `tenant_id` em toda linha e em toda query; 404 para id alheio |
| 7.1 — sem fonte, sem afirmação | O schema do assistente não ganha campo para valor de caixa |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Endpoints especificados em `docs/api-contract.md`.
- [x] Estados de erro e de vazio definidos, com o vazio convidando ao Nível 0.
- [x] Guardrails aplicáveis identificados.
- [x] Copy revisada contra `docs/domain.md`.
- [x] **Citações conferidas no texto primário** — CDC art. 54-A e 104-A, Decretos 11.150/2022 e
      11.567/2023, lidos no Planalto. A conferência achou a redação revogada em produção.

## Definition of Done

- [x] `typecheck`, `lint`, `test` (242) e `bundle:check` passam.
- [x] `pytest` (342) passa em SQLite **e** em Postgres, sem tocar a rede.
- [x] Os quatro estados implementados em cada tela, com o vazio convidando ao Nível 0.
- [x] Nenhum valor monetário calculado no cliente.
- [x] Teste de copy que falha em "recomendada", "superendividado", "você tem direito".
- [x] `caixa_snapshot` provado append-only por teste.
- [ ] **Exercitado por request real** contra Postgres, com o caso do dono do produto: PJ por
      hora com meses desiguais, carro e moto, IPVA e seguro em janeiro, reserva a construir.
- [ ] Documentos canônicos atualizados no mesmo commit.
- [ ] **Validação em device.**

## Riscos e modos de falha

| Risco | O que o produto faz |
|---|---|
| **O usuário subestima os gastos** e a capacidade sai alta demais | A renda típica usa o pior mês, e a provisão anual entra na conta. Erra-se para o lado conservador de propósito |
| **Renda variável com pouco histórico** | Enquanto não há recebimentos, usa o valor informado e **diz** que está usando o informado. Precedente do `evolucaoSaldo`, que nasce vazio |
| **`naoFecha` lido como diagnóstico jurídico** | Copy aritmética, sem a palavra "superendividado", e teste que quebra se ela aparecer |
| **Piso legal desatualizado no `.env`** | A data de vigência viaja na resposta e aparece na tela. Piso ausente ⇒ sinal ausente, nunca piso chutado |
| **O módulo virar app de orçamento** | Campo que não muda a capacidade não entra. É o critério de corte declarado no objetivo |
| **Dado mais sensível do produto** | Renda e gasto ficam fora de log, de erro e de prompt (guardrail 5) |
