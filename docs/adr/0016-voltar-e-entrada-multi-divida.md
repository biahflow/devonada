# ADR 0016 — Toda tela empilhada tem volta, e o onboarding aceita mais de uma dívida

**Status:** aceito
**Data:** 2026-08-10

## Contexto

Duas coisas apareceram no mesmo teste em device, e elas têm a mesma raiz: o app foi desenhado tela
por tela, e ninguém percorreu o caminho inteiro de quem chega.

**Nenhuma tela tinha afordância de voltar.** Os seis `_layout.tsx` usam `headerShown: false`, o que
é decisão de marca — o header nativo do react-navigation não combina com nada do desenho. Só que
nunca houve substituto. O que existia era um `Button variant="ghost"` no fim do scroll, presente em
oito telas e ausente em onze, entre elas detalhe de dívida, plano, revisão, renegociar, editar,
nova, simulador, contrato, metas, fechamento e preferências. No iOS o gesto de swipe salvava o
usuário; no Android não havia nada. Pior: os ramos de `LoadingState` e `ErrorState` de várias telas
não renderizavam nem o `PageHeader` — quando a rede caía, a tela ficava literalmente sem saída, e é
justamente aí que a pessoa quer sair.

**O onboarding só aceitava uma dívida.** A concepção (`docs/concepcao/telas-v3.html`, tela 12) pede
escolha única, com o texto de ajuda dizendo *"Começa por uma só. A gente resolve essa primeiro e
depois cuida do resto"*, e o `roadmap.md` M13 repetia: *"Cinco escolhas que já classificam **a
dívida** por criticidade"*. O código implementava isso com `accessibilityRole="radio"` e um
`useState<Opcao | undefined>`.

A intenção era boa e continua correta: não afogar em formulário quem chega em pânico às 23h. Mas a
carteira real não é assim — cartão **e** empréstimo é o caso comum, não a exceção. E o "depois cuida
do resto" nunca virou caminho: quem terminava a triagem caía no painel, e a lista de dívidas só
oferecia cadastro no estado vazio, que desaparece na primeira dívida. O alívio prometido entregava
trabalho pela metade.

O modelo de domínio nunca impediu N dívidas: `docs/domain.md` §4 (avalanche, bola de neve, data de
liberdade) só existe sobre carteira. Era decisão de sequência, não de dados.

## Decisão

**1. `PageHeader` ganha `onBack`, e ele é a saída padrão de toda tela empilhada.**

Um `Pressable` de 48×48 com `chevron-left` do `Feather`, `accessibilityLabel="Voltar"`, acima do
bloco de textos — o slot `action`, que fica à direita, segue intacto. Regra:

- toda tela alcançada por `push` recebe a seta, **inclusive nos ramos de carregando e de erro**;
- raiz de aba não recebe: não há para onde voltar;
- `(onboarding)/divida` não recebe: é o destino do `<Redirect>` de `app/_layout.tsx`;
- **uma afordância de saída por tela.** Os ghost de rodapé cuja única função era voltar saíram
  ("Voltar", "Voltar ao caixa"). Ghost com significado próprio fica — "Cancelar" de formulário,
  "Já tenho conta".

`Passos` ganha `onVoltar` equivalente, porque as telas do onboarding não usam `PageHeader`: o título
delas é chamada de impacto em `display` de 28pt, e o `Passos` é o elemento mais alto das três.

**2. A triagem trava o gesto.** Ela é alcançada por `replace`, então a pilha fica
`[divida, triagem]` e o swipe-back cairia em "Qual dívida tira seu sono?" — com a dívida já
cadastrada, o que lê como "o app me mandou cadastrar de novo". `gestureEnabled: false` faz o gesto
respeitar o que todas as saídas da tela já diziam.

**3. O passo 1 do onboarding aceita várias dívidas, e o passo 2 vira uma fila.**

Escolha múltipla com `accessibilityRole="checkbox"`, marcada também por um `check` — só a borda era
fraca demais para várias linhas ativas. A **ordem da marcação é a ordem da fila**, e a primeira é a
que recebe a triagem: quem marca primeiro marca o que dói mais.

O passo 2 pede dois campos por dívida, uma por vez, com a contagem à vista ("1 de 2"). O que segura
o susto não é limitar a marcação, é a fila ser curta e visível.

**4. Nada é gravado antes do fim da fila.** As respostas moram na tela; o POST de todas sai junto,
no último passo. Criar dívida a cada passo faria o botão de voltar produzir dívida duplicada ou
valor desatualizado — e é dado real do usuário, não rascunho. Falha parcial no envio preserva o que
já foi criado e a nova tentativa pula essas.

**5. Com fila de várias, o upload de documento não aparece no passo 2.** `/dividas/contrato` vive
fora do grupo `(onboarding)`, e sair para lá abandonaria o resto da fila. Com **uma** dívida
marcada, o comportamento anterior fica intocado — documento primeiro, manual como alternativa —,
porque só contrato lido produz achado (`montar_script` devolve `None` sem achados) e essa é a tela
que decide se a triagem terá valor justo.

**6. A lista de dívidas passa a oferecer cadastro com a lista cheia**, como CTA primário no pé.
"Ler contrato" segue no cabeçalho, então continua havendo um só primário por tela.

## Consequências

+ Nenhuma tela do app fica sem saída, inclusive quando o backend está fora — e no Android isso deixa
  de depender do botão de sistema.
+ A afordância de voltar fica num lugar só: mudar o desenho da seta é um arquivo.
+ Quem tem cartão e empréstimo cadastra os dois na primeira sessão, e a triagem nomeia as outras
  ("As outras 2 que você marcou já estão na sua rota") em vez de parecer ter perdido o que a pessoa
  digitou.
+ Voltar dentro da fila preserva o que foi digitado, porque nada foi gravado ainda.

− **A concepção fica contrariada em dois pontos**, e `docs/concepcao/` não é reescrito — ele é o
  registro do que a concepção imaginou. Quem passa a valer é esta ADR: o texto *"Começa por uma
  só"* e o `radio` da tela 12 estão revogados. O `roadmap.md` M13 foi corrigido.
− **Quem marca várias dívidas manda documento depois, não durante**, e recebe uma triagem mais
  pobre na primeira sessão. A triagem oferece "Mandar a fatura" logo em seguida, mas o "aha"
  completo fica adiado para quem escolheu o caminho de várias.
− O onboarding de várias dívidas é mais longo que o de uma. A contagem visível é o que evita que
  isso leia como formulário sem fim, e é a única mitigação: não há como cadastrar três dívidas em
  menos de três passos sem inventar valor.
− `gestureEnabled` e o `href: null` da ADR 0017 não são cobertos por teste: `jest-expo` mocka
  `Stack` e `Tabs` como `View`. São configuração de navegação, e a verificação é em device.
