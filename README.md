# devo.nada — app Expo / React Native / TypeScript

O **devo.nada** é um assistente financeiro pessoal para dívidas. O cliente mobile renderiza
telas, chat e cards; o backend FastAPI é a fonte de verdade para cálculos, regras determinísticas,
LLM e dados do usuário.

O produto está além do esqueleto inicial: M0–M10 foram entregues, M12 tem metas nomeadas
entregues e M13 tem o fluxo central de entrada pelo alívio entregue. Os itens ainda pendentes e a
sequência de produto estão no [roadmap.md](roadmap.md).

## Documentação

| Documento | Para quê |
|---|---|
| `docs/agent-guidelines.md` | Rulebook canônico. Leitura obrigatória antes de mexer no código. |
| `docs/guardrails.md` | Regras de dinheiro, segurança, postura jurídica e IA. |
| `docs/architecture.md` | Camadas, navegação, estado, erro. |
| `docs/api-contract.md` | O que o front espera do backend, endpoint a endpoint. |
| `docs/domain.md` | Linguagem ubíqua. |
| `docs/design-system.md` | Tokens e componentes. |
| `docs/engineering-conventions.md` | Como se escreve o código. |
| `roadmap.md` | Fonte canônica da sequência do produto e do front (M0–M14). |
| `docs/api-contract.md`, seção 4 | Fila canônica de trabalho do backend. |
| `docs/features/` | Feature Contracts (FDDs) históricos e em preparação. |
| `docs/adr/` | Decisões técnicas duradouras. |
| `docs/inventario.md` | Retrato datado do que existe: stack, versões, endpoints, telas, limitações. **Derivado** — não é fonte de regra. |
| `/Users/danielcampos/workspace/engineeringOS/` | Contexto global, gates humanos e lifecycle de trabalho. |

## Princípios do produto

- **Nenhuma chave de LLM no app.** O cliente só fala com a sua API autenticada
  (`src/api/client.ts`). `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` ficam no backend.
  Nada com prefixo `EXPO_PUBLIC_` deve ser segredo — vai embutido no bundle.
- **Multi-tenant desde já.** Os tipos espelham o modelo do Postgres; o `tenant_id`
  vem do token (`SecureStore`), o cliente nunca o envia. Trocar de "só você" para
  N usuários não exige refatorar o cliente.
- **Determinístico vs. LLM separados.** Valores (`valorJusto`, `valorCorrigido`)
  vêm calculados do backend. O app só formata e exibe — nunca faz conta de dinheiro.
- **Dinheiro é centavo inteiro** em todo lugar (`src/util/money.ts`), nunca float.
- **Postura "não é aconselhamento jurídico"** embutida no card (`ValorJustoCard`),
  não espalhada solta — vira uma camada só quando entrar parceria jurídica.
- **Tom anti-ansiedade** nos tokens de design (`src/theme/theme.ts`): primário
  verde sereno, não o vermelho de alarme dos apps tradicionais.

## Rodar

```bash
npm install
cp .env.example .env        # ajuste EXPO_PUBLIC_API_BASE_URL para o backend FastAPI
npm start                   # abre o Expo; leia o QR no Expo Go ou rode em simulador
npm run typecheck           # tsc --noEmit
npm run lint
npm test -- --watchman=false
npm run bundle:check
```

Para o backend, siga [docs/backend.md](docs/backend.md). Não aplique migrações, altere produção ou
declare validação em device sem a aprovação humana aplicável.

## Estrutura

```
app/                          rotas Expo Router: autenticação, onboarding e abas
src/
  api/                       único egress de rede e tipos de contrato
  hooks/                     estado de tela e wrappers de query
  components/                UI, chat, rota, dívidas, caixa, metas e onboarding
  screens/                   composição de telas
backend/                      FastAPI, Postgres, domínio, routers e migrations
docs/                         documentos canônicos e FDDs
```

## Trabalho e aprovação

Antes de executar uma feature, leia `docs/agent-guidelines.md`: o roadmap identifica o trabalho,
o Feature Contract fixa o comportamento e a aprovação humana continua obrigatória para produção,
migrações destrutivas, exceções de segurança e decisões arquiteturais consequentes.

As descrições do esqueleto da Fase 0 foram substituídas por este contexto atual. A evolução e as
decisões que as motivaram estão preservadas no histórico Git, no roadmap e nos ADRs.
