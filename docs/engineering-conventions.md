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

Jest + React Native Testing Library, a configurar em M0.

- Arquivo ao lado do código: `money.test.ts` junto de `money.ts`.
- Nome do teste descreve comportamento em pt-BR: `it('formata centavos negativos com sinal')`.
- Prioridade de cobertura: `src/util/money.ts` → `src/api/client.ts` → hooks de mutação →
  os quatro estados das telas.
- Ao corrigir um defeito, **escreva primeiro o teste que reproduz**. Bug sem teste de regressão
  volta.
- Não teste implementação (chamou tal função); teste o que o usuário observa.

---

## 8. Qualidade

Antes de entregar:

```bash
npm run typecheck
npm run lint        # a partir de M0
npm test            # a partir de M0
```

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
