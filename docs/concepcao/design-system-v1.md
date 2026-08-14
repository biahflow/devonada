# devo.nada — Design System v1

> Assistente financeiro pessoal focado em fuga de dívidas. Este documento é a fonte de verdade para design e implementação (React Native + Expo).

---

## 1. Fundamento da marca

**Conceito central:** o ponto. `devo.nada` lê-se como duas frases — "Devo. Nada." — pergunta e resposta. O ponto é o único elemento da marca que carrega cor de status.

**Princípio nº 1 — Vermelho é status, nunca cenário.**
O usuário chega ansioso. A interface é calma (grafite). Vermelho aparece apenas onde há dívida, e a jornada do produto é vê-lo desaparecer. Verde é a única cor que celebra.

**Princípio nº 2 — Voz em primeira pessoa.**
"Devo nada" é fala do usuário, não slogan da empresa. Toda comunicação de vitória é escrita como se o usuário dissesse.

**Princípio nº 3 — Ação, não retrovisor.**
Cada tela responde "o que eu faço agora?". Dashboards existem para sustentar a próxima ação, nunca como fim.

**Princípio nº 4 — Respiro: lazer é linha do plano, não desvio.**
Austeridade total é a principal causa de desistência: meses só pagando dívida, sem nenhum ganho visível, viram "perda total" — e gastos pequenos (um sorvete, uma unha) viram fonte de culpa e conflito no casal. Por isso, todo plano de quitação reserva desde o dia 1 uma fatia pequena (5–8% da capacidade de pagamento) para lazer e autocuidado — o **Respiro**. Quando o app diz "tá no plano", a culpa morre e o buddy vira o terceiro que dá a permissão. Em marcos da jornada (primeira negociação fechada, primeira dívida quitada, 25%, 50%, 75%), o respiro escala: sorvete → jantar a dois → bate-volta de fim de semana. O sistema nunca trata um gasto de respiro como erro.

---

## 2. Cores (tokens)

| Token | Hex | Uso |
|---|---|---|
| `color.bg` | `#101216` | Fundo padrão do app (grafite) |
| `color.bg.elevated` | `#181B21` | Cards, superfícies elevadas |
| `color.bg.subtle` | `#1F232B` | Inputs, barras vazias, avatares |
| `color.paper` | `#F2F2ED` | Fundo claro (marketing/social); texto principal no app |
| `color.text.secondary` | `#8A8F98` | Texto de apoio, labels |
| `color.border` | `#262A31` | Bordas e divisores |
| `color.debt` | `#E5352B` | **Só status de dívida.** Saldo devedor, badge "crítica", ponto do logo |
| `color.debt.bg` | `rgba(229,53,43,.12)` | Fundo de pills/badges vermelhos |
| `color.negotiating` | `#F0A31C` | Acordo em andamento |
| `color.negotiating.bg` | `rgba(240,163,28,.12)` | Fundo de pills âmbar |
| `color.success` | `#1FC16B` | Progresso, quitação, CTA primário |
| `color.success.bg` | `rgba(31,193,107,.12)` | Fundo de pills verdes |

### Regras de cor
- `color.debt` **nunca** como fundo de tela, seção ou botão. Máximo ~10% de qualquer tela.
- CTA primário é **verde** (a ação é sempre um passo pra fora da dívida).
- Estados do ponto do logo: vermelho (há dívida) → âmbar (negociando a última) → verde (devo nada). O ícone do app pode refletir isso via ícone alternativo.
- Fundo vermelho é permitido em **um único lugar** do universo da marca: exemplos de "não faça" em material interno.

---

## 3. Tipografia

| Papel | Fonte | Pesos | Uso |
|---|---|---|---|
| Display | **Archivo Black** | 400 (único) | Wordmark, valores em R$, números grandes, títulos de impacto |
| Corpo/UI | **Inter** | 400 / 500 / 600 / 700 | Todo o resto |

### Escala (mobile)
| Token | Fonte | Tamanho | Uso |
|---|---|---|---|
| `type.display.xl` | Archivo Black | 36px | Saldo devedor na home |
| `type.display.lg` | Archivo Black | 28px | Números de destaque |
| `type.display.md` | Archivo Black | 20px | Valores em cards comparativos |
| `type.title` | Inter 700 | 17px | Título de tela |
| `type.body` | Inter 400 | 14px | Texto corrido, chat |
| `type.body.strong` | Inter 600–700 | 14px | Ênfase inline |
| `type.caption` | Inter 500 | 12px | Apoio, metadados |
| `type.microlabel` | Inter 600 | 10px, uppercase, letter-spacing 0.12em | Labels de seção em cards |

### Regras de tipo
- Archivo Black **nunca** em texto corrido — só números e display curto (máx. ~2 linhas).
- Wordmark: caixa baixa, tracking -3%, sem espaço (`devo.nada`).
- Valores monetários sempre em Archivo Black — dinheiro é o protagonista visual.

---

## 4. Espaçamento, raio e elevação

- **Grid de espaçamento:** base 4px. Escala: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48.
- **Padding padrão de card:** 16px. Gap entre cards: 12px. Margem lateral de tela: 18px.
- **Raio:** `radius.card` 16px · `radius.input` 14px · `radius.pill` 99px · `radius.appicon` 24px · bolha de chat 16px (4px no canto de origem).
- **Elevação:** sem sombras no dark theme — hierarquia por cor de superfície (`bg` → `bg.elevated` → `bg.subtle`) + borda `color.border`. Exceção: glow verde na tela de vitória (`0 0 60px rgba(31,193,107,.35)`).

---

## 5. Componentes

### Botões
| Variante | Fundo | Texto | Uso |
|---|---|---|---|
| `button.primary` | `color.success` | `#08120C` | Ação principal da tela (uma por tela) |
| `button.ghost` | `color.bg.elevated` + borda | `color.paper` | Ações secundárias |

Altura mínima 48px, raio 14px, Inter 700 14px. **Não existe botão vermelho** — nem para destruição; usar ghost + confirmação.

### Pills de status
Fundo translúcido da cor + texto na cor + dot de 7px. Três variantes: `red` (crítica), `amber` (negociando), `green` (sob controle/quitada). Inter 600 11px, raio 99px.

### Card de dívida (`DebtCard`)
- Linha 1: credor (Inter 700 14px) + banco (caption) | pill de status à direita
- Linha 2: "Cobrado: R$ X" vs "Justo: R$ Y" (justo sempre em verde)
- Linha 3: barra de progresso 6px na cor do status
- Dívida crítica: borda `rgba(229,53,43,.4)`
- Ordenação padrão da lista: **criticidade, nunca valor**

### Card do buddy (`BuddyCard`)
Dot de status 10px + texto com "Próxima ação:" em bold + CTA verde em texto. É o primeiro elemento acionável da home.

### Script de negociação (`ScriptCard`)
- Fala entre aspas, Inter 400 13px, line-height 1.65
- Bloco "Por que você pode falar isso" abaixo: fundo `color.bg`, borda esquerda 2px verde, citação do CDC em caption. **Todo script exibe sua base legal** — é o diferencial de confiança.

**Três variantes de canal** (seletor no topo do card — mesmo motor de valor justo, formatos diferentes):

| Canal | Formato |
|---|---|
| **Telefone** | Fala corrida + objeções comuns (modo teleprompter). Pressão em tempo real. |
| **Chat / WhatsApp** | Mensagens curtas, uma ideia por bloco, com botão *copiar* por mensagem. Nunca revela o teto na 1ª mensagem. Sempre pede proposta por escrito + protocolo. |
| **E-mail formal** | Texto estruturado para registrar contraproposta — insumo do dossiê Procon/juizado. |

Regras da variante escrita:
- Abre **sempre** com o alerta de canal: validar o número no site oficial do credor; nunca usar número que ligou/mandou mensagem primeiro.
- Fecha **sempre** com a regra de pagamento: boleto ou Pix **em nome do credor** (CNPJ), nunca CPF de pessoa física.
- CTA ao final: "colar print da resposta" → alimenta o analisador de propostas.

### Barra de progresso
6–7px, raio 99px, trilha `bg.subtle`, preenchimento na cor do status. Progresso de quitação é sempre "quanto já percorri" (enche em verde), nunca "quanto falta".

### Chat (buddy)
Bolhas bot: `bg.elevated` + borda, alinhadas à esquerda. Bolhas do usuário: `bg.subtle`, à direita. Máx. 82% de largura. Números importantes em bold dentro da fala.

### Respiro (`RespiroCard`)
- Card na home e na tela de gastos: "Respiro deste mês: R$ 150 · usados R$ 80"
- Barra de progresso do respiro enche em **verde** (usar respiro é positivo, nunca vermelho)
- Copy sempre de permissão: "Sobram R$ 70 pra usar sem culpa" — nunca "você já gastou R$ 80"
- Respiro não usado pode: acumular pro próximo marco OU virar aporte extra na dívida (escolha do usuário, buddy pergunta)

### Marco (`MarcoScreen` / celebração)
- Tela cheia disparada em marcos: 1ª negociação fechada, 1ª dívida quitada, 25% / 50% / 75% da rota
- Glow verde (mesmo tratamento da tela de vitória, intensidade menor)
- Estrutura: conquista em Archivo Black + respiro desbloqueado com valor concreto + CTA de permissão ("Aproveita. Tá no plano.")
- Sugestões contextuais por tamanho do marco: sorvete/café → unha/cabelo/jantar → viagem rápida
- Compartilhável (formato story) — marcos são o conteúdo orgânico da marca antes do "devo nada" final

### Setup de renda (`IncomeSetup`)
- Seletor de tipo: **CLT · PJ por hora · Autônomo** (cards, não dropdown)
- CLT: líquido mensal + toggles de 13º/férias (o buddy sugere usá-los como bala de prata em negociações à vista)
- PJ por hora: taxa × horas/mês − impostos → projeção com margem de segurança
- Autônomo: entradas dos últimos meses → app calcula **renda conservadora (mediana, não média)** e explica o porquê
- Para renda variável, compromissos viram **percentual do que cai**, nunca valor fixo ("caiu dinheiro? X% vai pra dívida antes de tudo")

### Gastos (`ExpenseSetup` / envelope)
- Fixos: lista de compromissos recorrentes (moradia, contas, escola) com dia de vencimento
- Variáveis: envelope mensal estimado (mercado, transporte, farmácia)
- Resultado sempre visível: **Renda − Fixos − Variáveis − Respiro = Capacidade de ataque** (o que vai pra dívida)
- A capacidade de ataque alimenta o cálculo de proposta do módulo de negociação

### Meta (`MetaCard`) — pós-quitação
- Mesmo layout do DebtCard, semântica invertida: a barra **enche de verde rumo ao objetivo** (Rota de Chegada)
- Linha 1: nome da meta + ícone | prazo à direita
- Linha 2: "Guardado: R$ X de R$ Y" + aporte mensal necessário (motor determinístico: valor + prazo → aporte)
- Tipos guiados: viagem, carro, reserva de emergência, aposentadoria, carreira/estudo
- Reserva de emergência é sempre a primeira meta sugerida pelo buddy

### Tab bar
4 abas: **Rota · Dívidas · Buddy · Extrato**. Ativa: ícone vermelho + label `color.paper` (única exceção decorativa do vermelho — indica "onde estou"). Inativa: cinza. Pós-quitação, a aba "Dívidas" vira "Metas" e o ícone ativo passa a ser **verde** — o app inteiro muda de fase.

---

## 6. Motion

- Transições de cor de status (vermelho→verde): 1.2s ease. É a animação-assinatura — quitar uma dívida deve ser *visto*.
- Demais transições: 150–250ms.
- Tela de vitória: única tela com celebração (glow + entrada escalonada dos stats).
- Respeitar `prefers-reduced-motion` / configuração de acessibilidade do OS.

---

## 7. Voz e tom

- **Buddy, não banco.** Fala como amigo que entende de dinheiro: direto, caloroso, sem juridiquês. Termos legais aparecem traduzidos ("Por que você pode falar isso").
- Frases curtas, voz ativa. "Liga hoje", "Registra o resultado" — nunca "É recomendável que...".
- Números sempre concretos: "cresce R$ 41 por dia" > "juros altos".
- Firme contra o credor, nunca contra o usuário. Zero culpa: proibido "você gastou demais"; permitido "essa dívida cresce rápido, vamos atacá-la primeiro".
- Vitórias na voz do usuário: "devo nada", "quitei", "fechei por 5.900".
- Nunca prometer resultado de negociação — o app prepara, quem fecha é o usuário.
- **Respiro é permissão ativa:** o buddy oferece o lazer, o usuário não precisa pedir. "Você fechou sua primeira negociação. Tem R$ 120 de respiro te esperando — jantar a dois?" Nunca condicionar respiro a desempenho ("se você economizar, aí pode") — ele já está no plano.
- Gasto de respiro nunca gera alerta, aviso ou contabilização negativa. O único acompanhamento é quanto ainda há disponível.
- Renda variável: o buddy celebra meses bons sugerindo aporte extra, e em meses ruins **reduz a meta sem drama** ("mês mais fraco, tudo bem — o plano se ajusta, não quebra").

---

## 8. Implementação (React Native + Expo)

- Tokens em um `theme.ts` único exportando `colors`, `typography`, `spacing`, `radius` — nada de hex hardcoded em componente.
- Fontes via `expo-font` / `@expo-google-fonts/archivo-black` e `@expo-google-fonts/inter`.
- Dark theme é o único tema no MVP (não há light mode — o grafite é identidade, não preferência).
- Ícone do app dinâmico (estados do ponto) via alternate icons — nice-to-have pós-MVP.
- Status bar: `light-content` sobre `#101216`.

---

## 9. Checklist de revisão de tela

Antes de aprovar qualquer tela nova:

1. O vermelho ocupa menos de ~10% e só marca dívida?
2. Existe UMA próxima ação clara (um `button.primary` no máximo)?
3. Números em Archivo Black, texto em Inter?
4. O texto fala como buddy (ativo, concreto, sem culpa)?
5. Se algo foi quitado/melhorou, o verde aparece — a vitória está visível?

---

*v1 · agosto 2026 · gerado a partir do brand board devo.nada*
