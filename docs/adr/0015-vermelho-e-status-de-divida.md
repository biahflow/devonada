# ADR 0015 — Vermelho é status de dívida, e a interface é escura

**Status:** aceito
**Data:** 2026-08-10
**Supersede:** ADR 0011 (a forma do Budgi a partir das telas)

## Contexto

A ADR 0011 fixou a forma do produto a partir das telas do Budgi: card branco sem borda sobre base
clara, teal de ação, violeta de conquista, tipografia Nunito Sans. E o `guardrails.md`, seção 4,
escreveu a regra que a sustentava, com todas as letras:

> **Vermelho é exceção.** `colors.danger` existe para ação destrutiva e erro real. Não é a cor de
> "você está devendo". Saldo devedor não é vermelho; é `ink` com contexto.

A marca devo.nada chega dizendo o contrário. O conceito central dela é o ponto — vermelho enquanto
há dívida, âmbar enquanto se negocia a última, verde quando acabou. O ícone do app conta a
história do usuário, e a jornada do produto é literalmente **ver o vermelho desaparecer da
interface**. Sem vermelho marcando dívida, não há o que sumir, e a marca perde o mecanismo que a
torna uma marca e não um logotipo.

As duas regras não se conciliam por negociação. Uma delas tem de ceder.

O que não está em disputa é o **motivo** da regra antiga, e ele continua correto: quem chega neste
app já está com medo do próprio extrato, e uma interface que grita agrava a ansiedade que o
produto existe para reduzir. O erro seria tratar "vermelho marca dívida" e "a interface é
agressiva" como a mesma afirmação.

## Decisão

**Vermelho é status, nunca cenário — e a interface é escura e calma.**

1. **A marca vence na semântica.** `colors.debt` existe, aponta para o mesmo `#E5352B` de
   `danger`, e é o nome que código novo usa para marcar saldo devedor e criticidade. Um dia um dos
   dois pode mudar de valor sem arrastar o outro.

2. **A regra antiga vence na dosagem.** Vermelho ocupa no máximo ~10% de qualquer tela e **nunca**
   é fundo de tela, de seção ou de botão. **Não existe botão vermelho neste app**, nem para ação
   destrutiva — ali se usa ghost mais confirmação. O fundo é grafite (`#101216`); o vermelho
   aparece em pill, em número e no ponto do logo.

3. **Verde é a cor da ação e a cor da conquista.** Toda ação neste produto é um passo para fora da
   dívida, então o CTA primário é verde. `accent` (conquista, economia, marco) fica um passo mais
   claro que `primary` de propósito: se fossem o mesmo verde, a vitória sumiria dentro da barra de
   ação.

4. **Os proibidos do guardrail 4 continuam proibidos, sem exceção.** Contador de juros correndo em
   tempo real, badge de urgência artificial, notificação fora do horário combinado, gamificação
   que trata atraso como derrota moral e comparação com outros usuários seguem fora. Progresso é
   celebrado; atraso é fato de calendário, em tom neutro. **É aqui que a tese anti-ansiedade
   sobrevive à troca de paleta** — ela nunca foi sobre a cor, era sobre a postura.

5. **O tema escuro é identidade, não preferência.** Não há light mode no MVP. O grafite é o que
   torna o ponto vermelho visível como status.

## Consequências

+ A marca funciona: o ponto do logo, o ícone do app e a interface contam a mesma história, e a
  recompensa visual da jornada é a **ausência progressiva** do vermelho.
+ A tese anti-ansiedade fica preservada onde ela de fato morava — nos comportamentos proibidos —,
  em vez de num token de cor.
+ Os nomes dos tokens não mudaram, então a troca custou um arquivo (`src/theme/theme.ts`) e uma
  borda no `Card`. Zero hex fora do theme é o que tornou isso possível; a regra se pagou.

− **Todas as medições de contraste da ADR 0011 foram invalidadas.** Cada par texto/fundo estava
  medido em WCAG 2.1, cada anel de categoria em 3:1 e cada dupla semântica em CIEDE2000. Virar o
  tema descarta as três tabelas. Remedir é item de pré-lançamento e está anotado no topo do
  `theme.ts` — não é polimento, é acessibilidade.
− A garantia de dígito tabular caiu junto. Nunito Sans foi escolhida por medição, não por gosto:
  os dígitos dela são de largura fixa, e por isso coluna de reais não dança. Inter precisa ser
  medida; até lá, `numeric` (o número em coluna) fica em Inter e só `display`/`displaySm` usam
  Archivo Black.
− No escuro a sombra não separa nada, então o `Card` ganhou borda — exatamente o que a ADR 0011
  tinha removido por ser o que "mais denunciava o desenho anterior". A hierarquia agora é cor de
  superfície mais linha de 1px.
