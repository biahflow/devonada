# Plano de execução — F-019

```text
FEATURE EXECUTION PLAN

feature_id: F-019-contrato-em-divida-existente
goal: Levar um documento a uma dívida que já existe, conciliando campo a campo, para a revisão
      daquela dívida passar a produzir achado com fonte.
assumptions:
  - divida.extracao_id já existe (8864a227fc79_inicial.py:38) — nenhuma migração nesta feature.
  - O contrato de API está congelado em docs/api-contract.md, seção 3.16, escrito ANTES do código.
  - Os dois caminhos que hoje enviam extracaoId só o fazem com extração própria e concluída, então
    a validação nova em POST /v1/dividas não quebra cliente legítimo.
risks:
  - O refactor do PainelDeDocumento pode regredir contrato/[id].tsx.
  - A conciliação pode virar formulário longo demais e fazer a pessoa desistir no meio.

tasks:
  - id: T1
    role: builder
    goal: Rota POST /v1/dividas/{id}/documento, validador de vínculo compartilhado, extracaoId na
          resposta de Divida.
    scope: backend/routers/dividas.py, backend/schemas.py, backend/tests/
    out_of_scope: qualquer arquivo de app/ ou src/; migração Alembic; backend/routers/revisao.py;
                  backend/routers/contratos.py
    expected_areas: rota nova, schema LigarDocumento, schema Divida, validador de extração
    acceptance_criteria: RF-001 a RF-008
    depends_on: []
    validation: pytest (baseline 819)
    required_capabilities: READ, WRITE, VALIDATE
    risk: baixo — escopo fechado, oráculo de teste forte
    relative_effort: S

  - id: T2
    role: builder
    goal: Tela de documento na dívida, conciliação campo a campo, PainelDeDocumento extraído e as
          duas entradas que faltavam.
    scope: app/(tabs)/dividas/[id]/, app/(tabs)/dividas/contrato/[id].tsx, src/api/,
           src/hooks/useDividas.ts, src/components/dividas/, src/util/conciliacao.ts, src/test/
    out_of_scope: backend/ inteiro; app/(onboarding)/entrada.tsx; docs/
    expected_areas: tela nova, componente novo, util novo, dois CTAs, refactor de uma tela
    acceptance_criteria: RF-009 a RF-014, mais RF-003 e RF-012 do lado do cliente
    depends_on: []
    validation: npm run typecheck, npm run lint, npx jest (baseline 52 suítes / 657)
    required_capabilities: READ, WRITE, VALIDATE
    risk: médio — refactor de tela viva com teste existente que é o oráculo
    relative_effort: M

parallel_groups: [T1, T2]
critical_path: T2 (esforço M, refactor com regressão a preservar). T1 não a bloqueia porque o
               contrato está congelado no documento e os testes do front mockam a rede.
integration_strategy: T1 e T2 têm interseção de arquivo ZERO — backend/ contra app/ + src/.
                      Executam no mesmo worktree em paralelo. A documentação canônica
                      (inventario.md, roadmap.md, evidence.md) é escrita pelo modelo principal
                      depois da revisão, e por isso não está no escopo de nenhuma das duas.
human_gates: nenhum novo. Continua valendo a validação em device e, para o texto jurídico já
             existente, a revisão por advogado — nada nesta feature os altera.
planning_findings:
  - PLAN_DEVIATION nenhum até aqui.
  - O buraco pré-existente de POST /v1/dividas (extracaoId gravado cru) entra no escopo do T1 por
    decisão explícita do usuário em 03/09/2026, e não como conserto silencioso: escrever o
    validador para a rota nova e deixar a criação sem ele seria incoerência dentro do mesmo commit.
```
