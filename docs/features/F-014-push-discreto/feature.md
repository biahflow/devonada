# F-014 — Notificação discreta (o lembrete não delata)

## Cabeçalho

| | |
|---|---|
| Feature | Notificação discreta do lembrete de parcela |
| Slug | F-014-push-discreto |
| Milestone | M13 (ver `roadmap.md`, item "Notificações discretas") |
| Telas | Nenhuma tela nova. O lembrete é notificação local, agendada por `src/notificacoes.ts` |
| Endpoints | `GET /v1/lembretes` (`docs/api-contract.md:455`) — forma preservada, texto mudado |
| Depende de | M3 (lembretes de parcela); guardrail 4 (`docs/guardrails.md`, seção 4) |

## Objetivo e não objetivos

O lembrete de parcela para de **delatar** o usuário na tela de bloqueio. Hoje o texto nasce no
backend expondo credor e valor — "Nubank vence amanhã" / "Parcela 3 de 12 — R$ 450,00" —, e a tela
de bloqueio é pública: qualquer pessoa ao lado lê que aquela pessoa deve ao Nubank. O objetivo é que
a notificação chegue **genérica** — "Você tem um passo hoje" —, sem credor, valor, número de parcela,
vencimento nem a palavra "dívida", mantendo o deep link do card intacto.

**Não objetivos**

- **Push remoto.** Não existe servidor de push e o Expo Go não o suporta desde o SDK 53
  (`src/notificacoes.ts:6-9`). Continua sendo só notificação local.
- **Mexer no lembrete de fechamento do mês** (M7.1, `src/notificacoes.ts:148-153`). Já é hardcoded
  discreto ("Hora de fechar o mês"), não delata, e sai de escopo.
- **Notificação de respiro ou de marco.** Não existe hoje, e a 4.1 manda o respiro acumular em
  silêncio (`docs/guardrails.md:199-202`). Fora de escopo.
- **Mudar a forma do contrato** de `GET /v1/lembretes`. `titulo` e `corpo` continuam strings prontas
  do backend; muda o conteúdo, não o formato.

## Jornada e interface

Não há tela. O caminho é: o app chama `GET /v1/lembretes`, recebe `titulo`/`corpo` prontos e a data,
e `reagendar()` (`src/notificacoes.ts:80-109`) agenda uma notificação local por parcela na hora
combinada (`horaLembrete` do perfil). No dia e hora marcados, a notificação toca. Ao tocar, o
`data` da notificação (`dividaId`/`parcelaId`) leva o deep link ao card da dívida.

O que muda para o usuário: o **texto visível** na barra e na tela de bloqueio passa a ser genérico.
O momento (dia/hora combinados) e o destino do toque (o card certo) não mudam.

## Contrato

- **Endpoint:** `GET /v1/lembretes` — response inalterada em forma. `titulo` e `corpo` passam a ser
  genéricos e constantes; `dividaId`/`parcelaId`/`dataLembrete`/`horaLembrete` inalterados.
  Exemplo atualizado em `docs/api-contract.md:463` no mesmo commit.
- **Tipos:** nada muda em `src/api/types.ts` — `Lembrete.titulo`/`corpo` seguem `string`.
- **Chaves de cache:** nenhuma mudança.
- **Unidades:** não se aplica — não há valor monetário no texto. A remoção de `_formatar_brl` do
  módulo é justamente o que garante que valor não tenha por onde vazar.

## Requisitos funcionais

- **RF-001** — O `titulo` e o `corpo` do lembrete de parcela não contêm nome de credor, valor
  monetário, número de parcela, vencimento identificável nem a palavra "dívida".
- **RF-002** — O texto segue o padrão aprovado do guardrail 4 ("Você tem um passo hoje") e o tom
  neutro que `test_tom_neutro_sem_linguagem_de_cobranca` já exige (sem "atenção", "urgente",
  "atraso", "!", "pendência", "regularize").
- **RF-003** — `dividaId` e `parcelaId` continuam presentes no lembrete e no `data` da notificação
  agendada, para o deep link do card não quebrar. Eles nunca entram no texto visível.
- **RF-004** — Existe um teste-gêmeo que planta credor ("Nubank") e valor reais e **falha** se
  qualquer um dos delatores aparecer no `titulo`+`corpo`.

## Guardrails desta feature

- **Guardrail 4, seção 4 — discrição por padrão** (`docs/guardrails.md:177-179`). É o guardrail que
  esta feature existe para cumprir. O bullet foi **explicitado no mesmo commit** para enumerar os
  cinco delatores (dívida, credor, valor, parcela, vencimento) em vez de citar só a palavra "dívida",
  e para apontar onde o teste-gêmeo mora. Não é exceção nem afrouxamento: é a regra escrita de forma
  testável.
- **Guardrail 4 — tom anti-ansiedade** (`:164-166`). Nada de contagem regressiva ou linguagem de
  cobrança; o texto genérico reforça isso.
- **Guardrail 5 — privacidade** (`:216-217`). Nada sensível em log nem em notificação. Esta feature
  fecha o vazamento na notificação, que é a superfície pública.
- **Não pressiona** a 4.1 (respiro em silêncio): esta feature não adiciona notificação nenhuma.

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] O endpoint consumido (`GET /v1/lembretes`) já existe e está especificado em
  `docs/api-contract.md`; só o exemplo de texto muda.
- [x] Não há tela nova — estados de erro/vazio não se aplicam; o comportamento sem parcelas
  (lista vazia) já é coberto por `test_sem_parcelas_nao_ha_lembrete`.
- [x] Guardrail aplicável identificado (seção 4).
- [x] Copy em pt-BR revisada contra o tom neutro e o vocabulário de `docs/domain.md`.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint`, `npm test` passam (front não é tocado; roda como
  regressão).
- [x] `cd backend && venv/bin/pytest` passa.
- [x] Nenhum valor monetário no texto da notificação; `_formatar_brl` removido do módulo.
- [x] Nenhum dado financeiro ou pessoal em notificação — provado por teste-gêmeo com injeção.
- [x] Documentos canônicos afetados (`api-contract.md`, `guardrails.md`, `roadmap.md`) atualizados no
  mesmo commit.
- [ ] **Device.** Ver notificação real tocar em iOS e Android e confirmar o texto genérico na tela de
  bloqueio. Pendência de aparelho — nenhum agente a declara satisfeita.

## Riscos e modos de falha

- **Deep link quebrado.** Se, ao remover o texto delator, o `dividaId`/`parcelaId` saísse do payload,
  o toque na notificação deixaria de abrir o card certo. RF-003 e o teste-gêmeo travam isso: os
  identificadores continuam no `data`, e o teste afirma que sobrevivem.
- **Lembretes idênticos.** Com o texto constante, duas parcelas na janela geram duas notificações de
  texto igual. É aceito: a discrição vale mais que a diferenciação, e cada uma leva seu próprio deep
  link no `data`. Diferenciar exigiria expor algo — exatamente o que a regra proíbe.
- **Regressão silenciosa.** Alguém poderia reintroduzir credor/valor no texto "para ficar útil". O
  teste-gêmeo com injeção é a trava: reintroduzir o vazamento quebra a suíte.
