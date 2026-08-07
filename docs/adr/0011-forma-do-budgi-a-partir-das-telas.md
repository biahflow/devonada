# ADR 0011 — A forma vem das telas do produto, não do CSS da landing

**Status:** aceito
**Data:** 2026-08-07
**Substitui:** ADR 0010 (paleta derivada de Pierre e Budgi)

## Contexto

A ADR 0010 derivou o design system de **duas landing pages**. Os valores estavam certos — foram
lidos do CSS servido, não estimados — mas o material estava errado.

**Landing page não tem anatomia de componente.** Dela saem cor, fonte, raio e sombra. Não saem
linha de lista, hierarquia de número, densidade, comportamento de card, forma de bolha de chat,
nem o que o produto faz com ausência de dado. Foi exatamente esse vazio que a 0010 preencheu com
o Pierre — porque a direção "forma do Pierre" tinha sido escolhida antes de se saber que a
referência de verdade era o Budgi. O resultado foi Pierre com teal.

Agora existe o material certo: **os screenshots das listagens de loja** do Budgi (App Store e
Google Play), que mostram a UI real. E ela contradiz a 0010 em quase tudo que não é cor:

| | Budgi de verdade | o que a 0010 produziu |
|---|---|---|
| superfície | branco flutuando, sombra difusa, **sem borda** | branco com borda de 1px |
| painel escuro | **nenhum na UI inteira** | `HeroPanel` `#18181B` |
| raio | ~16–20 | 28 no card, 36 no painel |
| número | moderado, `R$` menor que os dígitos | display 40px, tracking −1,2 |
| título | peso misto na mesma linha: "Seu **extrato**" | eyebrow + título bold |
| ícone | traço fino em anel colorido, uma cor por categoria | Feather monocromático |
| linha de lista | ponto + ícone + duas linhas + valor + legenda | credor + badge + valor |
| acento | violeta (insight, conquista) | lime `#CFFF04`, que é do Pierre |

## Decisão

Rederivar a forma a partir das telas, e não da landing.

- **Sai o `HeroPanel`** e, com ele, superfície escura de conteúdo. O único elemento escuro que
  fica é o botão circular de enviar do chat — que o Budgi também tem.
- **Card sem borda**, separado do fundo pela sombra difusa. Raio desce para 20.
- **Acento passa a ser violeta `#7C3AED`** (5,70:1 sobre branco). Some o lime e, com ele, toda a
  acrobacia de "pastilha porque a cor não pode ser texto".
- **Anatomia de lista** vira componente: `ListRow` e `GrupoDeLista`, com `CategoriaIcon`.
- **Tipografia**: escala menor (`display` 32, título de tela 26) e `PageHeader` com `titleLead`
  para o peso misto.
- `primary`, `warning`, `danger` e os neutros **não mudam**: já foram medidos e passam.

### O que a medição decidiu no lugar do gosto

1. **A fonte foi escolhida por dígito, não por desenho.** Figtree era a primeira escolha por
   parecer com o Proxima Nova das telas. Ela **não tem `tnum` nem dígitos tabulares**: o "1" mede
   16,5px onde o "0" mede 25,6px, e uma coluna de reais dançaria. Nunito Sans tem **largura fixa
   por padrão** — variação de 0,00px entre 0 e 9 —, o que dispensa
   `fontVariant: ['tabular-nums']`, cujo suporte com fonte customizada é justamente o que não dá
   para garantir entre iOS e Android. O `fontVariant` foi **removido** de todos os componentes:
   pedir um recurso OpenType que a família não declara é caminho conhecido para cair em fonte de
   sistema no Android.
2. **A paleta de categoria tem quatro matizes, não seis.** Coral fica a ΔE 11,9 do âmbar e
   violeta a ΔE 12,4 do azul (OKLab, validador de dataviz). Dois anéis que se confundem não
   acrescentam nada. O conjunto final — teal, azul, magenta, âmbar — passa com pior par ΔE 17,9
   em deuteranopia. O violeta ficou de fora também por ser o `accent` do sistema: cor semântica
   reservada não vira "categoria 5".
3. **Duas métricas de distância discordaram, e a mais rigorosa venceu.** CIEDE2000 aprovava o par
   azul × violeta; o validador de dataviz, em OKLab e simulando deuteranopia, reprovou. Quando as
   duas divergem, vale a que simula visão de cores.

## Consequências

+ O produto passa a se parecer com a referência que o dono do repositório escolheu, e não com uma
  mistura das duas que ninguém pediu.
+ Sem lime, `MoneyText` e `Badge` ficam mais simples: progresso volta a ser texto direto.
+ A anatomia de lista vira um componente em vez de três variações copiadas.
− **Isto desfaz trabalho recém-entregue.** É o custo de ter derivado da landing, e a lição fica
  registrada: **antes de portar um design system, consiga as telas do produto.** CSS de marketing
  descreve uma página de venda, não um app.
− `docs/design-system.md` §4b muda de argumento: com a paleta nova, quatro séries categóricas
  finalmente **passam** no validador. O que mantém as barras num tom só deixa de ser contraste e
  passa a ser redundância — o `CriticidadeBadge` ao lado já nomeia a categoria.
− Duas trocas de fonte em um dia (Inter → Geist → Nunito Sans) aparecem no histórico. A primeira
  veio da premissa errada; a segunda, de uma medição que a premissa certa exigiu.
