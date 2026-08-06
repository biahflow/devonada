# Buddy Financeiro — app (Expo / React Native / TypeScript)

Esqueleto do front da **Fase 0**. Cliente mobile "burro": renderiza o chat +
cards de ação e conversa **só** com o seu backend FastAPI. Toda a inteligência
(cálculo determinístico, LLM, base do CDC) vive no servidor.

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
| `roadmap.md` | Sequência de construção (M0–M5). |
| `docs/adr/` | Decisões técnicas duradouras. |

## Princípios que o esqueleto já impõe

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

> As versões em `package.json` são indicativas. Gere o shell com o Expo atual e
> alinhe as libs nativas com `expo install` em vez de fixar na mão.

```bash
cd buddy-financeiro-app
npm install
npx expo install expo-clipboard expo-secure-store expo-status-bar   # alinha ao SDK atual
cp .env.example .env        # ajuste EXPO_PUBLIC_API_BASE_URL para o seu FastAPI
npm start                   # abre o Expo; leia o QR no Expo Go ou rode em simulador
npm run typecheck           # tsc --noEmit
```

Sem backend de pé ainda? O chat sobe e mostra a saudação; ao enviar, cai no erro
tratado de conexão (`ApiError`) — o que já valida a UI de erro.

## Estrutura

```
App.tsx                      entrada — SafeAreaView + ChatScreen
src/
  config/env.ts              lê EXPO_PUBLIC_API_BASE_URL (seam de config)
  theme/theme.ts             tokens: cores calmas, espaçamento, tipografia
  util/money.ts              formatação BRL a partir de centavos
  api/
    types.ts                 domínio compartilhado com o backend
    client.ts                fetch tipado: token, JSON, ApiError (único egress)
    chat.ts                  POST /v1/chat/messages
    debts.ts                 GET/POST /v1/dividas (Fase 1)
  hooks/useChat.ts           estado do chat em memória (fonte da verdade: backend)
  components/
    ui/Button.tsx
    chat/                    MessageBubble · MessageList · ChatComposer
    cards/                   ActionCard (dispatcher) · ValorJustoCard · InfoCard
  screens/ChatScreen.tsx     compõe lista + composer
```

## Contrato esperado do backend (Fase 0/1)

- `POST /v1/chat/messages` → `{ message: ChatMessage }`
  A mensagem do assistente pode trazer `cards: ActionCardData[]`. É assim que o
  card de valor justo (com o script pronto) chega embutido na conversa.
- `GET /v1/dividas` → `{ dividas: Divida[] }`
- `POST /v1/dividas` → `{ divida: Divida }`

Auth por `Authorization: Bearer <token>` — token guardado no `SecureStore`.

## Onde cada fase pluga

> **Superseded por `roadmap.md`.** A numeração de fases abaixo é histórica e ficou defasada;
> a sequência canônica de construção do front é a de milestones M0–M5 em `roadmap.md`.

- **Fase 1 (raio-x das dívidas):** telas de cadastro/lista usando `api/debts.ts`;
  card de triagem por criticidade + calculadora de mínimo existencial.
- **Fase 2 (IA):** já suportada pelo fluxo de chat — o extrator e o gerador de
  script são do backend; o app só renderiza `cards`.
- **Fase 3 (estado de negociação):** novos `kind` de card + telas de acompanhamento.
- **Fase 5 (SaaS):** signup/billing/onboarding entram aqui; o cliente já está
  multi-tenant, então não há retrofit de isolamento.

## Notas / próximos passos

- Navegação: single-screen de propósito. Quando crescer, `expo-router` (file-based)
  é o caminho — a estrutura `src/` continua válida.
- `SafeAreaView` do `react-native` serve no MVP; troque por
  `react-native-safe-area-context` quando quiser controle fino de notch.
- Camada de dados: `useState`/hooks bastam no MVP. Se o cache server-state pesar,
  TanStack Query encaixa sem mexer no `api/`.
