# FDD — Simulador de quitação

## Cabeçalho

| | |
|---|---|
| Feature | Simulador de quitação |
| Slug | `simulador-de-quitacao` |
| Milestone | M4 (ver `roadmap.md`) |
| Telas | `app/(tabs)/dividas/simulador.tsx` |
| Endpoints | `POST /v1/dividas/simulacoes` |
| Backend | `backend/domain/simulacao.py`, `backend/routers/simulacoes.py` |
| Depende de | M1 (dívidas cadastradas) e M3 (parcelas reais, de onde saem saldo e mínimo) |

## Objetivo e não objetivos

Responder à pergunta que vem depois do painel: **"e se eu pagar um pouco a mais?"**. O usuário
informa quanto consegue destinar por mês além das parcelas mínimas e vê, lado a lado, o que
acontece com cada uma das duas estratégias de quitação — em meses, em juros e numa data.

É também o milestone que **prova o ADR 0003**: amortização é a maior tentação de cálculo local do
produto, e o guardrail 1.2 a proíbe pelo nome.

**Não objetivos:**

- **Eleger uma estratégia.** O produto apresenta as duas e mostra a diferença. A que o usuário não
  abandona vale mais que a ótima no papel (`docs/domain.md`, seção 4).
- **Rodar qualquer amortização no cliente.** Nem a diferença entre as duas simulações é subtraída
  no app: ela vem em `comparacao`.
- **Prometer.** Uma simulação é um cenário, não um compromisso do credor.
- **Sugerir plano que invada o mínimo existencial.** O backend recusa com `422` e uma explicação.

## Jornada e interface

O usuário chega pelo Painel ou pelo rodapé da lista de dívidas. Escolhe o aporte extra — pelo
slider, pelo campo ou por um dos atalhos — e a tela responde com:

1. a **data de liberdade** em dourado, o número emocional da tela;
2. dois cartões, avalanche e bola de neve, com meses, juros totais e economia contra o mínimo;
3. a **diferença entre as duas**, em reais e em meses, vinda pronta de `comparacao`;
4. a ordem sugerida de pagamento, dívida a dívida, com o mês em que cada uma fecha;
5. a curva de queda do saldo da estratégia selecionada;
6. o aviso, quando houver, de quais dívidas entraram **sem taxa conhecida**.

Tocar num cartão troca a estratégia exibida na data de liberdade, na ordem e no gráfico.

**Os quatro estados:**

| Estado | O que a tela mostra |
|---|---|
| Carregando | `LoadingState` "Montando o plano", com o controle de aporte já visível |
| Erro | `ErrorState` com retry — **exceto `4xx`**, que vira `Feedback` `warning` com a frase do backend |
| Vazio | `EmptyState` "Nada para simular ainda", com ação para a lista de dívidas |
| Conteúdo | cartões, comparação, ordem e gráfico |

## Contrato

- **Endpoint:** `docs/api-contract.md`, seção M4.
- **Tipos:** `Simulacao`, `ComparacaoEstrategias`, `ItemOrdemPagamento`, `DividaSemTaxa`,
  `SimulacaoParams` em `src/api/types.ts`; espelhados em `backend/schemas.py`.
- **Chave de cache:** `['dividas', 'simulacao', { aporteExtraMensal }]` — dentro do prefixo
  `['dividas']`, então pagar uma parcela já revalida a simulação.
- **Unidades:** centavos para dinheiro, basis points para taxa, `YYYY-MM` para mês.

## Requisitos funcionais

- **RF-001** — O aporte extra é mantido em **centavos inteiros**, tanto no slider (passo de
  R$ 10,00) quanto no campo. Nenhum caminho produz fracionário.
- **RF-002** — O aporte só vira requisição depois de **400 ms** sem alteração.
- **RF-003** — As duas estratégias são sempre pedidas juntas.
- **RF-004** — A diferença entre elas é lida de `comparacao`; o app **não subtrai** as simulações.
- **RF-005** — Nenhuma estratégia é rotulada como "a certa" ou "recomendada".
- **RF-006** — A data de liberdade é exibida em `display` + `accent`. Nunca em `danger`.
- **RF-007** — `economiaVsMinimo` ausente exibe "ainda não calculado", **nunca R$ 0,00**.
- **RF-008** — `422` é exibido com a `message` do backend, sem virar erro genérico.
- **RF-009** — Dívidas sem taxa conhecida são **nomeadas** na tela, com o efeito explicado.
- **RF-010** — O resultado anterior permanece na tela enquanto o novo carrega
  (`keepPreviousData`).
- **RF-011** — O gráfico reusa `LinhaEvolucao`: eixo na base, série única, sem curva suavizada.
- **RF-012** — Slider e campo têm `accessibilityLabel` **distintos** e alvo de toque de 48pt.

## Regras do backend

Todas em `backend/domain/simulacao.py`, com o porquê no docstring:

| Regra | Decisão | Por quê |
|---|---|---|
| Ordem da avalanche | maior taxa primeiro; **sem taxa por último** | taxa desconhecida não justifica prioridade |
| Ordem da bola de neve | menor saldo primeiro | encerrar uma dívida sustenta a aderência ao plano |
| Orçamento | mínimos iniciais + aporte, **com rolagem** | sem rolagem as duas estratégias empatam |
| Dívida sem taxa | amortiza, **sem juros projetados** | inventar taxa é o `valorCobrado * 1.1` de novo |
| Dívida sem cronograma | parcela mínima **zero** | nenhum valor de prestação é inventado |
| Juros | incidem **antes** do pagamento do mês | é a ordem do mundo real |
| Teto | 600 meses, ou saldo que não cai | plano que não quita não recebe prazo fictício |
| Mínimo existencial | recusa aporte acima da margem | Decreto 11.150/2022, art. 3º |

## Guardrails desta feature

| Guardrail | Como é respeitado |
|---|---|
| 1.1 Centavo inteiro | slider em passos de 1000 centavos; `CurrencyInput` no campo |
| 1.2 Sem valor derivado | zero aritmética de amortização no app; nem a diferença é subtraída |
| 1.3 Procedência | todo número da tela é campo do contrato |
| 2 Egress único | `src/api/simulacoes.ts` sobre `request` |
| 3 Postura jurídica | a tela apresenta cenário, não promessa de acordo |
| 4 Tom anti-ansiedade | `danger` não aparece; a data de liberdade é acento, não alarme |
| 5 LGPD | a `message` do `422` não carrega valor nem credor |
| 6 Multi-tenant | nenhum parâmetro de tenant; `dividasIds` de outro tenant devolve 404 |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Endpoint especificado em `docs/api-contract.md` antes do código.
- [x] Tratamento de dívida sem taxa decidido com o dono do repositório.
- [x] Estados de erro, vazio e de recusa (`422`) definidos.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint`, `npm test` (180) e `npm run bundle:check` passam.
- [x] `pytest` passa (156) em SQLite **e** em Postgres.
- [x] Os quatro estados implementados e cobertos por teste.
- [x] Nenhum valor calculado no cliente.
- [x] Nenhum dado financeiro em log ou em mensagem de erro.
- [x] Alvo de 48pt e `accessibilityLabel` em todo controle.
- [x] Endpoint exercitado por request real contra Postgres.
- [ ] **Não validado em device.** Conforto do slider, legibilidade dos dois cartões lado a lado
      em tela pequena e o comportamento do teclado sobre o campo exigem aparelho.
- [x] Documentos canônicos atualizados no mesmo commit.

## Riscos e modos de falha

- **A simulação é otimista quando falta taxa.** Uma dívida sem taxa entra sem juros projetados, e
  o prazo real fica maior que o exibido. Mitigação: a tela nomeia essas dívidas e pede a taxa.
- **Dívida sem cronograma entra com mínimo zero.** Ela só recebe pagamento quando chega à frente
  da fila. É consistente com não inventar prestação, mas pode surpreender quem cadastrou tudo
  sem parcelas.
- **`economiaVsMinimo` some quando o cenário mínimo não quita.** Acontece de verdade com juros
  altos: pagar só o mínimo nunca fecha a dívida. A tela exibe "ainda não calculado" — que é a
  verdade — mas a ausência pode ser lida como bug.
- **Sem renda informada, não há checagem de mínimo existencial.** A simulação aceita qualquer
  aporte. O painel já convida a informar a renda.
- **O slider é a primeira dependência nativa nova desde `react-native-svg`.**
