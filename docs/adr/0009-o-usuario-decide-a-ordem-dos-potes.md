# ADR 0009 — O usuário decide a ordem dos potes; o app mostra a aritmética

**Status:** aceito
**Data:** 2026-08-07

## Contexto

O M7 introduz o módulo de caixa: renda, gastos, provisões anuais, reserva de emergência e
aposentadoria. Ele existe para produzir a **capacidade de pagamento mensal sustentável**, que
vira restrição de tudo que o módulo de dívida propõe.

Assim que o módulo passa a conhecer os potes, aparece a pergunta que todo usuário faz — e que o
dono deste produto fez, textualmente: *"não sei o que é prioritário, se separo sempre um pouco
para cada um."*

A resposta de mercado é conhecida e soa razoável: reserva mínima primeiro, depois dívida cara,
depois reserva completa, depois aposentadoria. Ela aparece em qualquer livro de finanças
pessoais, e o desenho que originou este milestone a trazia com coeficientes prontos —
`conservador/realista/agressivo = capacidade × 0,5 / 0,7 / 0,9`.

O problema é que **nada disso tem fonte**. Não há lei, decreto, súmula ou contrato que diga que
a reserva vem antes da aposentadoria, nem que 0,7 é "realista". São convenções — boas, mas
convenções. E este produto foi construído inteiro sobre a regra de que número sem procedência
não é exibido: foi ela que matou o `valorCobrado * 1.1`, que fez `valorCorrigido` devolver
`None` sem taxa contratual, e que no M6 derrubou três decisões de plano depois da leitura do
texto primário.

A tentação aqui é maior que nas anteriores, porque o conselho é **bom**. Um número inventado que
por acaso ajuda continua sendo um número inventado — e o usuário levaria "o app disse para eu
priorizar X" para uma decisão real sobre o dinheiro dele.

Há ainda um segundo problema, específico da comparação dívida × aposentadoria: ela depende do
**rendimento** do investimento, que é um número que não temos e não podemos estimar. Projetar
retorno de investimento é a fronteira onde este produto deixaria de dar informação e passaria a
dar recomendação financeira.

## Decisão

**O app não decide a ordem dos potes. Ele mostra a aritmética e o usuário decide.**

Em concreto:

1. **Os coeficientes 0,5 / 0,7 / 0,9 não entram.** A capacidade é um **teto**, e quanto dela vai
   para dívida é escolha explícita do usuário, no `AporteExtra` que o M4 já construiu (slider +
   `CurrencyInput` sobre centavos inteiros). O default é a capacidade calculada, não uma fração
   dela.

2. **A comparação dívida × investimento usa só números que o usuário forneceu.** De um lado, a
   taxa contratual da dívida, que já está no banco. Do outro, o rendimento que ele informou em
   `rendimento_esperado_bps`. **Sem rendimento informado, não há comparação** — os dois números
   não aparecem lado a lado e nenhuma ordem é sugerida. É o mesmo `None` de `valorCorrigido`.

3. **A ordem sugerida existe, e é rotulada como escolha de método.** Ela aparece na tela
   nomeada como convenção — no mesmo registro em que o simulador apresenta avalanche e bola de
   neve sem eleger vencedora. O teste de copy do M4, que quebra a suíte se alguém escrever
   "recomendada" na tela, passa a cobrir também as telas do caixa.

4. **Percentual de imposto do PJ é informado, nunca estimado.** As alíquotas variam por
   enquadramento, anexo e faixa de receita, e errar para menos faz o usuário gastar dinheiro que
   é do governo. Sem percentual informado, o app **não reserva imposto e diz que não está
   reservando** — a ausência aparece na tela como ausência.

5. **O piso legal continua sendo intransponível.** Nenhum arranjo de potes escolhido pelo usuário
   faz o app propor plano que invada o mínimo existencial (Decreto 11.150/2022, art. 3º, na
   redação do Decreto 11.567/2023). A escolha é do usuário; o piso é da lei.

## Consequências

+ O módulo de caixa herda, sem exceção, a regra que sustenta o resto do produto: todo número
  exibido tem procedência — lei, contrato do usuário, ou o próprio usuário.
+ A distinção entre "o que a lei garante", "o que a sua conta diz" e "o que é convenção de
  mercado" fica visível na interface, em vez de dissolvida num conselho único.
+ O produto não passa a dar recomendação de investimento, o que o manteria longe de território
  regulatório que ele não está preparado para ocupar.
+ A comparação, quando aparece, é forte justamente porque usa a taxa real do contrato do usuário
  contra o rendimento real que ele conhece.

− O app responde "depende, e aqui estão os números" a uma pergunta que o usuário faz esperando
  uma resposta direta. Isso é menos satisfatório do que um conselho seguro de si.
− Quem não informar o rendimento esperado não recebe a comparação. Perde-se orientação para
  quem talvez mais precise dela.
− Fica proibido, daqui em diante, introduzir qualquer coeficiente de alocação sem fonte, mesmo
  que apareça em toda a literatura de finanças pessoais. Se um dia houver base para um, ele entra
  citado — ou entra como ADR nova que substitua esta.
