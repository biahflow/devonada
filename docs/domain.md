# Domínio — linguagem ubíqua

> Documento vivo. Cada termo é definido **uma vez** aqui, e esse nome é usado no código, no
> contrato de API e na copy da interface. Divergência de vocabulário entre camadas é como bug
> de negócio nasce.

Convenção de idioma: **infraestrutura em inglês** (`request`, `client`, `ApiError`),
**domínio em português** (`Divida`, `valorCobrado`, `CriticidadeTipo`). É o padrão já
estabelecido em `src/api/types.ts` — mantenha.

---

## 1. Dívida

### Divida
Uma obrigação financeira do usuário com um terceiro. Unidade central do produto.
Tipo em `src/api/types.ts`.

### credor
Quem cobra. String livre, informada pelo usuário ou extraída pelo backend. Na UI, sempre o
nome como o usuário reconhece ("Nubank", "Banco Teste S/A"), não a razão social completa.

### valorCobrado
O que o credor está pedindo hoje, **em centavos**. É o número que aparece na cobrança. Informado
pelo usuário.

### valorCorrigido
O que o valor original vira depois da correção legítima aplicada pelo backend, **em centavos**.
Opcional — pode não ter sido calculado ainda. **Nunca calculado no cliente.**

### valorJusto
**Não é estimativa.** É `valorCobrado` menos a soma dos [achados](#achado) que têm valor, cada um
com fonte legal própria. **Em centavos**, calculado no backend (`domain/revisao.py`).

A leitura antiga — "quanto o backend estima que a dívida deveria custar" — foi abandonada na
**ADR 0008**: não existe lei que diga quanto uma dívida deveria custar, e produzir esse número
seria inventar regra financeira. Hoje o campo só existe quando há do que subtrair.

**Ausente (`null`) quando nenhum achado tem valor** — nunca igual a `valorCobrado`, porque isso
afirmaria "conferimos e está tudo certo". Aparece no `ValorJustoCard` e na tela de revisão, sempre
com o disclaimer de estimativa educacional. Continua não sendo sentença: é ponto de partida para
negociar.

### achado
Um ponto concreto do contrato que **vale contestar**. Carrega sempre `fonte` (artigo, súmula ou
resolução), `comoConferir` (a pergunta de fato que só o usuário responde) e, quando veio da
leitura do contrato, `evidencia` — o trecho **literal**.

Duas classes, e a diferença é o que separa um número de um alerta:

- **com valor** (`valorContestavel`): o montante é direto no contrato — a multa em excesso, a
  tarifa, o prêmio do seguro. Entra na subtração de `valorJusto`.
- **sem valor**: quantificá-lo exigiria reamortizar o contrato inteiro. Aparece na tela, com
  fonte, e **não** mexe no número.

**Postura obrigatória:** achado é convite a investigar, jamais sentença — mesmo regime de
`possivelPrescricao`. Copy correta: "vale contestar". Copy proibida: "é ilegal", "é abusivo",
"você tem direito a receber de volta".

### modalidade
Que **produto de crédito** o contrato é: `consignado_inss`, `consignado_privado`,
`cartao_consignado`, `pessoal`, `rotativo` ou `financiamento`. Coisa diferente de
[`CriticidadeTipo`](#criticidade), que classifica pela consequência de não pagar. A revisão
precisa da modalidade: teto de juros de consignado só se aplica a consignado.

### economia
`valorCobrado − valorJusto`. A única subtração que o front faz, porque é a diferença literal
entre dois números que o backend já enviou — não é regra de negócio.

### dataOrigem
Quando a dívida nasceu (`IsoDate`). Base do cálculo de prescrição, feito no backend.

### possivelPrescricao
Booleano opcional. **Um alerta para investigar, jamais uma afirmação de que prescreveu.**
Copy correta: "pode ter prescrito — vale checar". Copy proibida: "esta dívida prescreveu".

### saldoDevedor
Quanto ainda falta pagar de uma dívida, **em centavos**, considerando o que já foi quitado.
Vem do backend.

---

## 2. Criticidade

`CriticidadeTipo` classifica a dívida por consequência de não pagar. É o que define a ordem de
ataque e o tom da interface. Quatro valores, definidos em `src/api/types.ts`:

| Valor | Significado | Postura do produto |
|---|---|---|
| `essencial` | água, luz, gás, aluguel | Nunca sacrificar. Perder isso é perder o básico da vida. |
| `com_garantia` | financiamento de casa ou carro | Risco de perder o bem. Prioridade alta, mas negociável. |
| `juros_abusivos` | rotativo do cartão, cheque especial | Atacar primeiro. É o que cresce mais rápido. |
| `consumo` | varejo, cartão comum, parcelamento | Menor urgência. Espaço para negociar desconto. |

A criticidade não é uma nota de julgamento moral sobre o gasto. É uma medida de consequência.
A copy nunca sugere que o usuário errou ao contrair a dívida.

### mínimo existencial
A parcela da renda que não pode ser comprometida com dívida porque cobre necessidades básicas.
O backend calcula; o painel exibe como limite. Nenhuma sugestão do assistente pode propor um
plano que invada esse mínimo.

### comprometimento de renda
Percentual da renda mensal já destinado a pagamento de dívida. Calculado no backend.

---

## 3. Pagamento

### parcela
Uma prestação de uma dívida: número da parcela, valor em centavos, vencimento e situação.

### situação da parcela
`pendente` · `paga` · `atrasada`. "Atrasada" é um fato de calendário, não um juízo — a UI usa
tom neutro, nunca alarme vermelho.

### plano de pagamento
O cronograma de parcelas de uma dívida, com o que já foi pago e o que falta. É a tela de M3.

### aporte extra
Valor que o usuário consegue destinar por mês **além** das parcelas mínimas. É o insumo
principal do simulador: sem aporte extra, a única variável é a ordem de pagamento.

### renegociação
Registro de que a dívida mudou de condições — novo valor, novo prazo, novo número de parcelas.
Não apaga o histórico anterior; substitui as condições vigentes.

### quitação
Encerramento da dívida. Ação explícita do usuário, irreversível na prática — exige confirmação
(ver `guardrails.md`, seção 7.2).

---

## 4. Estratégias de quitação

Ambas as simulações são calculadas no backend (`POST /v1/dividas/simulacoes`). O front só
compara os dois resultados lado a lado.

### avalanche
Paga primeiro a dívida de **maior taxa de juros**. Matematicamente ótima: é a que gera a maior
economia total de juros.

### bola de neve
Paga primeiro a dívida de **menor saldo**. Matematicamente pior, psicologicamente melhor: cada
dívida encerrada é uma vitória visível, e isso sustenta a aderência ao plano.

O produto não impõe uma das duas. Apresenta as duas, mostra a diferença em reais e em meses, e
deixa o usuário escolher — a estratégia que ele não abandona vale mais que a ótima no papel.

### data de liberdade
O mês em que, mantido o plano, a última dívida é quitada. Vem do backend. É o número emocional
central do simulador — trate-o com destaque de acento dourado, não com alarme.

---

## 5. Chat

### ActionCardData
União discriminada por `kind` (`src/api/types.ts`). É o mecanismo pelo qual dado estruturado
entra na conversa. **Todo número que o assistente comunica vai num card**, nunca no texto livre
da mensagem.

Cards existentes: `valor_justo` (os pontos contestáveis de uma dívida, M6), `info`,
`divida_resumo`, `plano_sugerido` e `divida_proposta` — o rascunho que abre o formulário para o
usuário confirmar, nunca uma gravação.

### script
Mensagem pronta de negociação, gerada no backend. Apresentada como sugestão copiável e
editável, nunca como algo que o app envia sozinho.

### fundamentos
Lista de embasamentos curados (por exemplo, artigos do CDC) que sustentam o valor justo. São as
`fonte` dos [achados](#achado), deduplicadas. Texto vindo do backend — o front nunca compõe
citação legal localmente.
