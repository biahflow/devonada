# FDD — Dívidas dentro do chat

## Cabeçalho

| | |
|---|---|
| Feature | Dívidas dentro do chat |
| Slug | `dividas-no-chat` |
| Milestone | M5 (ver `roadmap.md`) |
| Telas | `src/screens/ChatScreen.tsx` (aba Chat) |
| Endpoints | `POST /v1/chat/messages`, `GET /v1/chat/messages` |
| Backend | `backend/assistente/`, `backend/llm/`, `backend/routers/chat.py` |
| Depende de | M1 (dívidas), M3 (parcelas, de onde sai o saldo) e M4 (a simulação do plano) |

## Objetivo e não objetivos

Fechar a tese do produto: o assistente deixa de ser um oráculo genérico e passa a falar sobre os
dados reais do usuário. Pergunta sobre um credor devolve o retrato daquela dívida; pedido de
plano devolve a simulação — ambos em card tipado, com deep link para a tela correspondente.

**Não objetivos:**

- **Deixar o modelo emitir número.** Ele escolhe qual card mostrar; o backend preenche os valores
  lendo o banco. O schema da resposta não tem campo para valor monetário.
- **Executar ação por conversa.** O assistente não cria, não altera e não quita dívida
  (`guardrails.md`, 7.2). Card que sugere escrita fica para depois do M5.
- **Dar parecer jurídico.** Prescrição e abusividade são "vale investigar", nunca afirmação.
- **Substituir as telas.** O card é ponto de entrada, não versão reduzida da tela.

## Jornada e interface

A aba Chat abre carregando a conversa anterior — desde o M5 ela sobrevive ao fechamento do app.
Conversa nova começa com a saudação; conversa existente, não (repeti-la faria o app parecer que
esqueceu a pessoa).

O usuário pergunta pelo credor e recebe `divida_resumo`: saldo, próximo vencimento, criticidade,
e um toque que leva a `dividas/[id]`. Pede um plano e recebe `plano_sugerido`: data de liberdade
em dourado, prazo, economia, e um toque que leva ao simulador.

**Os quatro estados:**

| Estado | O que a tela mostra |
|---|---|
| Carregando | `LoadingState` "Retomando a conversa" |
| Erro | falha ao carregar histórico **não impede conversar**: saudação + aviso |
| Vazio | a saudação, que convida a contar a primeira dívida |
| Conteúdo | as mensagens com seus cards |

## Contrato

- **Endpoints:** `docs/api-contract.md`, seção M5.
- **Tipos:** `DividaResumoCardData` e `PlanoSugeridoCardData` na união `ActionCardData`
  (`src/api/types.ts`), espelhados em `backend/schemas.py`.
- **Estado:** o chat continua em `useState` com `AbortController`, não no TanStack Query — a
  conversa é fluxo, não coleção cacheável (ADR 0002). O que mudou é que ela é carregada do
  servidor no mount.

## Requisitos funcionais

- **RF-001** — Todo número que o assistente comunica chega em card tipado, nunca no `content`.
- **RF-002** — Os valores de todo card são preenchidos pelo backend a partir do banco.
- **RF-003** — Pedido de card com id que não é do tenant não vira card — nem card vazio.
- **RF-004** — Número no texto sem card correspondente é **cortado no servidor**, e a resposta
  vira uma frase que admite não saber.
- **RF-005** — O `switch` do dispatcher `ActionCard` é exaustivo: `kind` novo sem tratamento é
  erro de compilação, não card invisível.
- **RF-006** — Deep link usa campo tipado do card, nunca id extraído de texto (guardrail 7.3).
- **RF-007** — O histórico sobrevive entre sessões e volta em ordem cronológica.
- **RF-008** — Os cards do histórico são **remontados** a cada leitura, com o dado de hoje.
- **RF-009** — Falha do assistente devolve `503` com frase em pt-BR, e a pergunta do usuário
  **já foi gravada** — o que ele escreveu não se perde por falha nossa.
- **RF-010** — `economia` ausente exibe "ainda não calculado", nunca R$ 0,00.
- **RF-011** — O plano do chat e o simulador dão o mesmo número: mesma função de domínio.

## Como o guardrail 7.1 é sustentado

Três camadas independentes, porque prompt não é guardrail:

| Camada | Onde | O que impede |
|---|---|---|
| Estrutural | `assistente/regras.py` | O schema não tem campo para valor. O modelo não consegue emitir número. |
| Contexto | `routers/chat.py::_contexto` | O prompt recebe identificação, nunca valores. O que o modelo não vê, não repete errado. |
| Varredura | `assistente/assistente_llm.py` | Número no texto sem card derruba o texto, no servidor. |

E a montagem (`routers/chat.py::montar_cards`) lê o banco para preencher cada card — é ela que
faz "o modelo escolhe o quê, o backend diz quanto" ser verdade em código, não em intenção.

## Guardrails desta feature

| Guardrail | Como é respeitado |
|---|---|
| 1.2 Sem valor derivado | O plano do card usa `domain/simulacao.py`, a mesma do M4 |
| 1.3 Procedência | Todo número exibido veio de campo tipado preenchido pelo banco |
| 2 Egress único | `src/api/chat.ts` sobre `request` |
| 3 Postura jurídica | Regra 4 do system prompt: nunca parecer jurídico |
| 5 LGPD | A `message` de erro não carrega valor nem credor |
| 6 Multi-tenant | O contexto só tem dívidas do tenant, e id fora dele é descartado duas vezes |
| 7.2 Autonomia | O assistente não executa escrita nenhuma |
| 7.3 Entrada não confiável | O system prompt declara que a mensagem é dado, não instrução |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Endpoints especificados em `docs/api-contract.md`.
- [x] Estratégia sem chave de LLM decidida com o dono do repositório.
- [x] Estados de erro, vazio e de recusa definidos.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint`, `npm test` (191) e `npm run bundle:check` passam.
- [x] `pytest` passa (202) em SQLite e em Postgres, **sem tocar a rede**.
- [x] Os quatro estados implementados e cobertos por teste.
- [x] Nenhum valor calculado no cliente.
- [x] Nenhum dado financeiro em log ou mensagem de erro.
- [x] `accessibilityLabel` em todo controle — incluindo o campo do composer, que não tinha.
- [x] Exercitado com **chamada real** à OpenAI: pergunta por credor, pedido de plano, pergunta
      fora do domínio e conferência de que o plano do chat bate com o simulador.
- [ ] **Não validado em device.** Rolagem do chat com card, teclado sobre o composer e
      legibilidade dos cards em tela pequena exigem aparelho.
- [x] Documentos canônicos atualizados no mesmo commit.

## Riscos e modos de falha

- **O modelo inventa navegação, não número.** Na primeira chamada real ele mandou o usuário a uma
  "seção de indicadores econômicos" que não existe. O prompt passou a enumerar as três abas reais
  e a proibir inventar tela. Vale reexaminar isso a cada mudança de modelo.
- **A varredura de número é heurística.** Ela pega dígitos; não pega "mil e quinhentos reais" por
  extenso. A defesa estrutural (schema sem campo de valor) é a que sustenta o caso; a varredura é
  a segunda camada, não a primeira.
- **O assistente determinístico reconhece pouca coisa.** É de propósito — e é ele que roda quando
  não há chave. Fora das intenções que conhece, admite não saber.
- **Custo por mensagem.** Toda mensagem é uma chamada paga. Não há cache nem limite por usuário
  neste milestone.
- **O histórico cresce sem poda.** O teto é de leitura (50 mensagens); nada apaga mensagem antiga
  do banco ainda.
