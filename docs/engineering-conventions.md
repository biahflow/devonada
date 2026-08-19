# Convenções de engenharia

> Documento vivo. Complementa `architecture.md` (o que vai onde) com o **como se escreve**.

---

## 1. TypeScript

- `strict` e `noUncheckedIndexedAccess` estão ligados em `tsconfig.json`. Não afrouxe.
- Proibido `any` e `@ts-ignore` para fechar uma tarefa. Se o tipo do backend mudou, atualize
  `src/api/types.ts` e `docs/api-contract.md` juntos. Se o tipo é genuinamente desconhecido,
  use `unknown` e estreite.
- Interface para forma de dado (`Divida`, `ChatMessage`); `type` para união, alias e utilitário
  (`CriticidadeTipo`, `NovaDivida`).
- União discriminada em vez de campos opcionais mutuamente exclusivos. `ActionCardData` é o
  modelo: discriminada por `kind`, com `switch` exaustivo no dispatcher. Um `kind` novo que não
  foi tratado vira erro de compilação, não tela em branco.
- `as const` em objeto de tokens e tabela de constantes.
- Derive tipo em vez de duplicar: `Pick<Divida, 'credor' | 'valorCobrado'>`, como já faz
  `NovaDivida` em `src/api/debts.ts`.

---

## 2. Organização

| Pasta | O que mora | Nomenclatura |
|---|---|---|
| `app/` | rotas do expo-router | kebab-case; `[id].tsx` para dinâmica |
| `src/api/` | funções de rede puras | camelCase por recurso (`debts.ts`) |
| `src/hooks/` | `use*` — única camada que chama `api/` | `useDividas.ts`, `useQuitarDivida.ts` |
| `src/screens/` | composição de tela | `DividasScreen.tsx` |
| `src/components/ui/` | primitivos reusáveis | `Button.tsx`, `Card.tsx` |
| `src/components/<feature>/` | componentes de uma feature | `dividas/DividaListItem.tsx` |
| `src/util/` | puro, sem React | `money.ts` |

Um arquivo, um componente, export nomeado. `export default` só onde o expo-router exige (arquivos
de rota).

**Idioma:** infraestrutura em inglês (`request`, `client`, `ApiError`, `listDebts`), domínio em
português (`Divida`, `valorCobrado`, `useDividas`). O repo já mistura os dois de propósito —
a fronteira é "isso é conceito de negócio do usuário brasileiro?".

---

## 3. Componentes

- Props tipadas por interface `Props` local. Sem `React.FC`.
- Componente burro: dado por prop, evento por callback. Se ele importa de `src/api/`, a lógica
  está na camada errada.
- Nada de estilo inline. `StyleSheet.create` no fim do arquivo, consumindo tokens de
  `src/theme/theme.ts` por spread (`...typography.body`) — padrão já usado no repo.
- Cor literal em hex dentro de componente é bug de revisão. Toda cor vem de `colors`.

---

## 4. Os quatro estados

Toda tela que carrega dado remoto implementa **carregando, erro, vazio e conteúdo**. Não é
sugestão: é item da Definition of Done. O padrão:

```tsx
const { data, isPending, error, refetch } = useDividas();

if (isPending) return <LoadingState label="Carregando suas dívidas" />;
if (error)     return <ErrorState error={error} onRetry={refetch} />;
if (!data.dividas.length) return <EmptyState ... />;
return <DividaList dividas={data.dividas} />;
```

Erro nunca é `console.error` silencioso — o usuário precisa ver e ter uma saída.

---

## 5. Dados e hooks

- Um hook por operação. `useDividas()` lê, `useCriarDivida()` escreve. Não misture.
- Chave de cache hierárquica, conforme `architecture.md`, seção 4.1.
- Mutação declara sua invalidação no próprio hook, não na tela. A tela não deve saber quais
  outras telas precisam revalidar.
- Atualização otimista só onde o rollback é trivial (marcar parcela paga). Nunca em criação.
- Retry: nunca em `4xx`; até duas vezes em `0` e `5xx`.

---

## 6. Dinheiro

Repetido aqui porque é a regra mais violada por descuido:

- `number` inteiro em centavos, do input ao render.
- Formatação só por `formatBRL` (`src/util/money.ts`), nunca `Intl.NumberFormat`, nunca
  `toFixed`.
- Entrada só por `CurrencyInput`, que mantém centavos internamente.
- Taxa de juros em basis points inteiros (`250` = 2,50%), pelo mesmo motivo.
- Nenhum cálculo derivado no cliente. Ver `guardrails.md`, seção 1.

---

## 7. Testes

Jest + React Native Testing Library.

**Duas camadas, dois lugares:**

| Camada | Onde | O que prova |
|---|---|---|
| Unidade | ao lado do código (`money.test.ts` junto de `money.ts`) | função pura e componente isolado |
| Tela | `src/test/screens/` | a rota inteira: quatro estados, com a API mockada |
| Ferramenta | ao lado do script (`scripts/contraste.test.js`) | a matemática dos gates, contra dado de referência publicado |

> **`scripts/` é o único lugar do repo em CommonJS e com teste em `.js`.** São ferramentas de
> linha de comando rodadas por `node` puro, fora do alcance do `tsconfig.json` e sem
> transpilador; testar a mesma implementação que o gate executa exige falar a língua dela.
> Fórmula de gate se confere contra **valor de referência publicado**, não contra a própria
> saída: um CIEDE2000 com o termo de rotação errado aprova em silêncio, e viria com número e
> tabela — pior que não medir.

> **Teste de tela NÃO fica dentro de `app/`.** Todo arquivo ali é uma rota para o expo-router.
> Os testes importam a rota por caminho relativo — parêntese em import é inofensivo.

A infraestrutura mora em `src/test/`: `render.tsx` (envolve em `QueryClientProvider` e
`SafeAreaProvider`), `mocks.ts` (fábricas de domínio) e `api.ts` (`responderPorRota`, que declara
o que cada rota devolve em vez de encadear `mockResolvedValueOnce` — sobrevive a mudança na ordem
das chamadas).

`request` e `upload` são mockados globalmente em `jest.setup.js`. Como eles são o único egress do
app, **nenhum teste consegue tocar a rede** sem alterar aquele arquivo.

- Arquivo de unidade ao lado do código.
- Nome do teste descreve comportamento em pt-BR: `it('formata centavos negativos com sinal')`.
- Prioridade de cobertura: `src/util/money.ts` → `src/api/client.ts` → hooks de mutação →
  os quatro estados das telas.
- Ao corrigir um defeito, **escreva primeiro o teste que reproduz**. Bug sem teste de regressão
  volta.

> **Ruído conhecido:** telas com `FlatList` deixam o jest imprimir *"A worker process has failed
> to exit gracefully"*. O `VirtualizedList` agenda um timer de render que dispara depois do
> unmount; não é vazamento do nosso código e não afeta o resultado. `jest.clearAllTimers()` não
> resolve — só age sobre timers falsos. Ignore o aviso; não use `--forceExit` para escondê-lo,
> porque aí um vazamento real também ficaria invisível.
- Não teste implementação (chamou tal função); teste o que o usuário observa.

---

## 8. Qualidade

Antes de entregar:

```bash
npm run typecheck
npm run lint
npm test
npm run bundle:check
npm run palette:check
npm run digits:check
```

`bundle:check` roda `expo export` e produz o bundle de produção do grafo inteiro. É o que pega
import quebrado e módulo que não resolve em arquivo que nenhum teste importa — a classe de erro
que, sem ele, só aparece ao abrir o app.

`palette:check` roda `scripts/paleta-check.mjs`: lê os hex de `src/theme/theme.ts`, mede a lista
declarada de pares em WCAG 2.1 (piso 4,5:1 para texto, 3:1 para objeto gráfico e texto grande) e
CIEDE2000 (piso ΔE 15 entre semânticas adjacentes), e sai com código 1 se algum par sem exceção
reprovar. Ele existe porque a medição já morreu uma vez em silêncio: virar o tema de claro para
escuro apagou três tabelas e nada falhou, porque o validador vivia fora do repositório
(ADR 0018).

Duas regras que vêm com ele:

- **Combinação de cor nova entra na lista no mesmo commit em que aparece na tela.** A lista é
  declarada de propósito — varrer todas as combinações produziria ruído que se aprende a ignorar.
- **Número de contraste em documentação sai de `node scripts/paleta-check.mjs --tabela`**, nunca
  digitado. As três tabelas da seção 1 do `design-system.md` são a saída literal do script.

`digits:check` roda `scripts/digitos-check.mjs`: lê os TTF das quatro famílias que
`app/_layout.tsx` carrega, parseia `head`, `hhea`, `maxp`, `cmap`, `hmtx` e `GSUB` em node puro, e
imprime a largura de avanço dos dez dígitos de cada uma. Depois confere o `typography.numeric` de
`src/theme/theme.ts` contra essa medição e sai com código 1 se a escala do número em coluna
depender de uma família de dígitos proporcionais sem pedir `fontVariant: ['tabular-nums']`.

É o segundo lado que faz dele um gate: medir os arquivos sozinho nunca reprovaria — a Inter declara
`tnum` e a Archivo Black já é tabular —, e gate que não pode falhar é decoração. O que pode
regredir é o `theme.ts`.

Duas regras que vêm com ele:

- **Família de fonte nova entra em `FONTES_DO_APP` no mesmo commit em que entra no `useFonts`.**
  Se `typography.numeric` apontar para uma família que o comando não mede, ele reprova em vez de
  aprovar por omissão.
- **Largura de dígito não é item de validação em aparelho.** Ela está gravada no TTF e é idêntica
  em todo device. Foi classificada assim uma vez e ficou meses parada; medir custa um
  `readFileSync`.

Nenhuma verificação é desativada para concluir uma tarefa. Regra de lint que atrapalha se
discute e se muda com justificativa — não se silencia com comentário pontual.

---

## 9. Commits

Formato: `<escopo>: <efeito no produto>`, imperativo, pt-BR, primeira linha até 72 caracteres.

```
dividas: adiciona formulário de cadastro com entrada em centavos
painel: trata estado vazio quando não há renda informada
docs: registra contrato do endpoint de simulação
```

O commit descreve **o efeito**, não o mecanismo. "refatora componente" não diz nada; "impede
divergência de arredondamento no card de valor justo" diz.

Um commit por unidade coerente. Mudança de doc que acompanha mudança de código vai **no mesmo
commit** — documentação desatualizada é fonte de alucinação para a IA.

---

## 10. Dependências

Adicionar dependência é decisão, não conveniência.

- Biblioteca nativa entra por `npx expo install`, nunca por `npm install` direto — é o que
  alinha a versão ao SDK do Expo.
- Antes de adicionar, pergunte: dá para resolver com o que já existe? O repo já rejeitou UI kit,
  store global e biblioteca de formatação de moeda de propósito.
- Dependência que muda arquitetura (navegação, estado, estilo) exige ADR.
- `.npmrc` tem `legacy-peer-deps=true`. Isso mascara conflito de peer dependency — ao adicionar
  algo, confira manualmente se o conflito é real.
