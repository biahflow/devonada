# ADR 0019 — O respiro é o piso do corte, e quem diz o valor dele é o usuário

**Status:** aceito
**Data:** 2026-08-19

## Contexto

O `domain.md` decidiu, desde o vocabulário, que o respiro **é linha da cascata, no mesmo nível do
aluguel — não é sobra** (verbete `respiro`), e o `guardrails.md`, seção 4.1, escreveu por quê:
austeridade total é a principal causa de desistência, e um sorvete que vira fonte de culpa é o que
transforma uma quitação de dezoito meses em "perda total" aos olhos de quem a vive.

Faltava responder duas perguntas que nenhum documento respondia: **onde exatamente ele entra na
cascata** e **de onde sai o número**.

### O que a cascata já fazia

`domain/caixa.py` produz dois números, e o segundo é o problema:

```
capacidade_hoje  = ... − nao_essenciais     (sem mudar nada de vida)
capacidade_maxima = liquida − essenciais − provisao − reserva − aposentadoria
```

`capacidade_maxima` é, literalmente, o cenário em que **todo o não-essencial foi cortado**. Ou
seja: a cascata já continha a austeridade total que o Respiro existe para impedir, e a exibia como
o teto do que a pessoa "pode" pagar. `aporte_maximo` sai dali, e com ele o teto do simulador
(`routers/simulacoes.py`), a sobra do painel (`routers/resumo.py`) e o aporte do card
`plano_sugerido` do chat (`routers/chat.py`).

Isso reenquadra a feature. O trabalho do respiro não é reservar uma sobra — é **pôr um piso sob
esse corte**.

### O número que a concepção trazia

`docs/concepcao/roadmap-v1.md` e `telas-v1.html` especificavam "uma fatia pequena **(5–8% da
capacidade de pagamento)**", e os mockups usavam R$ 150 por mês e R$ 120 por marco. Nada disso foi
promovido a documento canônico em momento algum.

E não podia ser, porque a **ADR 0009 proíbe pelo nome**: *"fica proibido, daqui em diante,
introduzir qualquer coeficiente de alocação sem fonte, mesmo que apareça em toda a literatura de
finanças pessoais"*. Ela deixa uma saída — *"entra citado, ou entra como ADR nova que substitua
esta"* — e a tentação era usá-la aqui.

Não há fonte para 5%, nem para 8%, nem para a escala "sorvete → jantar → bate-volta". São
convenções, e boas; mas o produto inteiro existe para não emitir número que ele mesmo escolheu.

## Decisão

**O respiro é subtraído antes de `capacidade_maxima`, e o valor é declarado pelo usuário.**

Em concreto:

**1. Uma linha nova, e ela entra antes do corte — é isso que a torna imune a ele.**

```
capacidade_maxima = liquida − essenciais − provisao − reserva − aposentadoria − respiro
capacidade_hoje   = capacidade_maxima − nao_essenciais
aporte_maximo     = capacidade_hoje − comprometido_dividas
```

Descontar depois faria do respiro exatamente o que o vocabulário proíbe que ele seja: a sobra que
some quando aperta.

**2. Nenhum coeficiente entra. O usuário declara o valor, e o app mostra o que ele custa.**

O respiro é um campo declarado, como um gasto ou um pote, e o app responde com a única coisa que
sabe de verdade: **quantos meses a mais de quitação aquele valor representa**. Isso não é
estimativa — é a mesma `domain/simulacao.py` do M4 rodando com um aporte menor.

Esta ADR **não substitui a 0009: ela a aplica.** "O usuário decide a ordem dos potes; o app mostra
a aritmética" é a frase inteira, e o respiro é mais um pote — o primeiro que a austeridade não
pode cortar. A faixa 5–8% fica em `docs/concepcao/`, que é fonte histórica, e não sobe.

Consequência direta: **quem não declarar respiro não tem respiro**, e a cascata dele não muda.
Um default de fábrica seria o coeficiente entrando pela porta dos fundos.

**3. O marco celebra; ele não mexe no valor.**

Os cinco marcos — primeira negociação fechada, primeira dívida quitada, 25%, 50% e 75% da rota —
disparam a `MarcoScreen` e liberam o saldo acumulado. Nenhum deles altera a linha da cascata.

O `domain.md` diz que "o respiro escala com o marco", e ele continua verdadeiro — mas por
**acúmulo, não por fórmula**: quem chega ao terceiro marco tem três meses de respiro guardado, e é
isso que faz o sorvete virar jantar. A tabela de escala marco a marco seria o coeficiente que o
item 2 recusou, com outro nome.

**4. Marco é evento persistido, atingido uma vez e para sempre — nunca predicado recalculado.**

Hoje a porcentagem da rota é calculada no cliente, em `src/components/rota/CardSaldo.tsx`, a
partir de `evolucaoSaldo[0]` contra `totalDevido`. Como largura de barra isso passou. Como gatilho
de evento não passa, por duas razões independentes: o guardrail 1.2 manda todo valor derivado vir
do servidor, e a linha de base é móvel — **cadastrar uma dívida nova faz a porcentagem andar para
trás**, e um marco já comemorado deixaria de estar atingido.

Um marco que se desfaz é pior que marco nenhum. Ele grava, no molde append-only de
`CaixaSnapshot`.

**5. Respiro não usado acumula em silêncio. Destinar é botão, nunca pergunta.**

O guardrail 4.1 já dizia que respiro não usado não vira cobrança e que a escolha do destino é do
usuário. Fica decidido o default: **acumula, sem nenhuma ação e sem nenhuma notificação.**
Destinar o saldo a aporte extra é um botão que ele aperta se quiser.

Perguntar todo mês o que fazer com o saldo transformaria o respiro em item de prestação de contas
mensal — o tom exato que a seção 4.1 proíbe.

**6. O piso legal continua acima, e agora tem validação própria.**

Respiro declarado que faça `renda_liquida − essenciais − respiro` cair abaixo do mínimo
existencial é **recusado com `422`**, no mesmo padrão de `_validar_aporte`. A escolha é do
usuário; o piso é da lei (Decreto 11.150/2022, art. 3º, na redação do Decreto 11.567/2023).

**7. Nenhuma reconciliação automática com `gasto`.**

Quem já cadastrou "lazer" como gasto não essencial e declarar respiro terá o valor descontado duas
vezes de `capacidade_hoje`. A tela **nomeia o risco** e oferece o caminho de desativar o gasto.
Somar, subtrair ou fundir os dois em silêncio seria adivinhar qual dos dois números a pessoa quis
dizer — e ela é a única que sabe.

## Consequências

+ O produto passa a ter um teto de pagamento que **assume que a pessoa continua viva**, em vez de
  um que pressupõe austeridade total e depois se surpreende com o abandono no mês 4.
+ A feature mais valiosa da concepção entrega sem um único número inventado — que era a condição
  para ela existir dentro deste repositório.
+ O respiro sobrevive ao aperto por construção, não por disciplina de quem escreve a tela: ele
  está antes do corte na mesma função pura que todo mundo lê.
+ Nenhuma ADR precisa ser substituída, e a proibição de coeficientes da 0009 sai reforçada em vez
  de erodida.

− **Três telas mudam de número sem serem tocadas.** `aporte_maximo` cai para quem declarar
  respiro, e ele é lido pelo simulador, pelo painel e pelo card do chat. Nenhuma recalcula — todas
  passam por `leitura.capacidade_atual` —, mas a mudança é real e aparece de uma vez.
− **`nao_fecha` passa a disparar mais.** Com `capacidade_maxima` menor, mais gente vê "os números
  não fecham". Está correto — o plano de fato não fecha se a pessoa precisa viver —, e continua
  sendo fato aritmético, nunca diagnóstico de superendividamento (M7).
− **Quem não declarar fica sem respiro**, inclusive quem mais precisaria dele. É o custo aceito de
  não ter default, e a mitigação é de tela: o convite existe, o número não.
− A dupla contagem com `gasto` não essencial fica **possível e visível**, resolvida por texto em
  vez de por código. É a decisão certa e é também a que mais vai gerar pergunta de usuário.
− O produto ganha um terceiro sentido para "quanto sobra": capacidade hoje, capacidade máxima e
  agora capacidade máxima com respiro reservado. A tela do caixa precisa continuar dizendo qual é
  qual.
