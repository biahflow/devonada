# ADR 0001 — expo-router como camada de navegação

**Status:** aceito
**Data:** 2026-08-06

## Contexto

O app nasceu single-screen de propósito: `App.tsx` renderiza `ChatScreen` direto, sem nenhuma
biblioteca de navegação. Isso serviu bem à Fase 0, em que a única superfície era o chat.

A partir de M1 o produto precisa de pelo menos oito rotas — lista, detalhe e formulário de
dívidas, painel, plano de pagamento, simulador, além do chat. E M5 exige que um card dentro da
conversa aponte para uma tela específica de dívida, o que significa **deep link**.

As alternativas eram `@react-navigation` clássico (navegação imperativa, rotas declaradas em
código) e `expo-router` (file-based, construído sobre o próprio React Navigation).

## Decisão

Adotar **expo-router** em M0, com a estrutura de rotas descrita em `architecture.md`, seção 3.
A entrada deixa de ser `App.tsx` e passa a ser `app/_layout.tsx`.

## Consequências

+ Deep link funciona por construção: um card do chat aponta para `dividas/[id]` sem conhecer a
  pilha de navegação. É o que viabiliza M5 sem gambiarra de navegação global.
+ A estrutura de arquivos vira a documentação das rotas — não existe rota registrada em um lugar
  e implementada em outro.
+ Layouts aninhados resolvem o `QueryClientProvider`, o `SafeAreaProvider` e o carregamento de
  fonte num só ponto.
+ É o caminho que o próprio `README.md` já apontava.
− `package.json` deixa de usar `node_modules/expo/AppEntry.js` como `main`; a migração toca a
  raiz do projeto. Por isso ela acontece em M0, antes de existirem telas.
− Acrescenta `expo-router`, `react-native-screens`, `react-native-safe-area-context` e
  `expo-linking` às dependências.
− Navegação file-based é menos flexível para fluxos dinâmicos gerados em runtime. Não é o caso
  aqui: as rotas do produto são conhecidas em tempo de build.
