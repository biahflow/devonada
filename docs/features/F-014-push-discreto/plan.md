# F-014 — Execution Plan

Plano enxuto: uma feature de correção de guardrail, de superfície pequena e sem tela. O usuário
autorizou não travar em gate humano — o contrato é escrito e construído no mesmo passo.

---

## FEATURE EXECUTION PLAN

```text
feature_id: F-014

goal: O lembrete de parcela para de delatar credor e valor na tela de bloqueio. Hoje o texto nasce
  no backend (`routers/lembretes.py`, `_texto`) como `titulo = f"{credor} {quando}"` →
  "Nubank vence amanhã" e `corpo = f"Parcela {n} de {total} — {brl(valor)}"` →
  "Parcela 3 de 12 — R$ 450,00". Passa a nascer genérico — "Você tem um passo hoje" — sem credor,
  valor, parcela, vencimento nem a palavra "dívida", cumprindo o guardrail 4, seção 4.

assumptions:
  - O texto do lembrete vem PRONTO do backend; o front (`src/notificacoes.ts:93-104`) só repassa
    `titulo`/`corpo`. Corrigir na origem corrige nas duas pontas.
  - O deep link do card depende de `dividaId`/`parcelaId` no `data` da notificação — payload de
    dados, não texto visível. Isso é OK e é PRESERVADO.
  - O lembrete de fechamento (M7.1, `notificacoes.ts:148-153`) já é discreto e hardcoded — não se
    toca.
  - Não há push remoto: só notificação local. Nenhuma mudança de forma de contrato.
  - Baseline MEDIDA na worktree: 721 pytest, 606 Jest / 50 suítes, verdes.

risks:
  - Deep link quebrado se o identificador sair junto com o texto delator. Mitigado por T1-AC3.
  - Regressão silenciosa: alguém reintroduz credor/valor "para ser útil". Mitigado pelo teste-gêmeo
    com injeção (T1-AC4), que quebra a suíte se qualquer delator voltar.

tasks:
  - id: T1
    role: builder
    goal: O texto do lembrete nasce genérico no backend; os testes que cimentavam o vazamento passam
      a provar a discrição; o guardrail e o contrato dizem a verdade.
    scope: |
      `backend/routers/lembretes.py` — `_texto` deixa de receber credor/parcela/dias e passa a
        devolver um par constante e genérico (`_TITULO`/`_CORPO`). `_formatar_brl` é REMOVIDO do
        módulo: sem formatação de moeda no arquivo, valor não tem por onde vazar (garantia
        estrutural). O identificador continua sendo montado em `dividaId`/`parcelaId`, fora do texto.
      `backend/tests/test_parcelas_api.py` — os testes que afirmavam o vazamento
        (`test_parcela_dentro_da_janela_gera_lembrete:181`, `test_texto_vem_pronto_com_moeda_formatada:206`)
        são reescritos para afirmar a discrição. Novo teste-gêmeo
        `test_notificacao_nao_delata_credor_valor_nem_divida` planta credor "Nubank" e valor reais e
        falha se qualquer delator aparecer, provando que o identificador sobrevive fora do texto.
      `docs/api-contract.md:463,476` — exemplo de `GET /v1/lembretes` e a nota passam a mostrar o
        texto genérico e a regra de discrição.
      `docs/guardrails.md` — o bullet de discrição (seção 4) é explicitado: enumera os cinco
        delatores e aponta onde o teste-gêmeo mora. Mesma regra, forma testável.
      `roadmap.md` — o item "Notificações discretas" do M13 (~linha 920) marcado, com o que mudou.
    out_of_scope: |
      Lembrete de fechamento do mês (já discreto).
      Push remoto, notificação de respiro/marco.
      Mudar a forma do contrato de `GET /v1/lembretes` ou os tipos de `src/api/types.ts`.
      `docs/inventario.md` — consolidação é do orquestrador.
    acceptance_criteria: |
      T1-AC1 `titulo`+`corpo` do lembrete de parcela não contêm credor, valor, número de parcela,
        vencimento nem "dívida". Há teste que falha se qualquer um aparecer.
      T1-AC2 O texto segue o padrão aprovado do guardrail 4 e o tom neutro que
        `test_tom_neutro_sem_linguagem_de_cobranca` exige.
      T1-AC3 `dividaId`/`parcelaId` continuam presentes no lembrete (e no `data` da notificação, via
        `src/notificacoes.ts`, intocado), fora do texto visível.
      T1-AC4 O teste-gêmeo planta credor e valor REAIS e quebra por injeção — provado revertendo
        `_CORPO` para um texto delator e vendo dois testes falharem.
      T1-AC5 `cd backend && venv/bin/pytest` passa inteiro; os seis gates do front passam como
        regressão (o front não é tocado).
    depends_on: []
    validation: cd backend && venv/bin/pytest ; npm run typecheck ; npm run lint ; npm test ;
      npm run bundle:check ; npm run palette:check ; npm run digits:check
    required_capabilities: READ, WRITE (backend/routers/lembretes.py, backend/tests/test_parcelas_api.py,
      docs/api-contract.md, docs/guardrails.md, roadmap.md), VALIDATE (pytest, npm scripts)
    risk: Baixo. Superfície pequena, sem tela, sem mudança de forma de contrato. O modo de falha é
      esquecer o deep link — travado por T1-AC3.
    relative_effort: S

parallel_groups:
  - onda_1: [T1]

critical_path: T1

integration_strategy: |
  Tarefa única, um commit. A correção nasce no backend, e o front (que só repassa) fica intocado —
  roda como regressão.

human_gates:
  - Não travar em gate humano: AUTORIZADO pelo usuário para esta feature. O contrato é escrito e
    construído no mesmo passo.
  - ABERTO, de device: ver a notificação real tocar em iOS e Android e confirmar o texto genérico na
    tela de bloqueio. Nenhum agente o declara satisfeito.
```

---

## Resultado da validação do plano

```text
PLAN_VALID
```

Tarefa única, dependências vazias, critérios de aceite cobrindo os quatro requisitos funcionais do
`feature.md`. Sem `ARCHITECTURE_DECISION_REQUIRED`: a regra já existe no guardrail 4; esta feature a
cumpre e a torna testável, sem criar exceção.
