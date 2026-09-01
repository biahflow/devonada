# Plano de execução — F-017 Lei do Superendividamento no corpus

feature_id: F-017
goal: fechar as três issues do M14 (#13, #14, #15) com uma decisão só — o corpus jurídico curado
que as três precisam.
assumptions:
- "RAG jurídico" no roadmap significa **corpus**; não há índice vetorial no repositório e o
  guardrail 3 impede que houvesse consumidor legítimo para um.
- `naoFecha` já existe em `domain/caixa.py` com a definição certa desde o M7; o M14 o expõe em mais
  um lugar e o explica, sem recalcular nada.
- A triagem do onboarding roda antes de a renda existir.
risks:
- Fonte em string solta multiplicada por regra: acrescentar uma norma a esse conjunto é como a
  divergência começa.
- Trilha que carregue valores cria segunda cópia dos números e diverge da resposta ao lado.
- Copy nova sobre superendividamento é a superfície de maior risco jurídico do produto.

## Tarefas

- id: T1 — registro de fontes
  scope: `backend/juridico/fontes.py`, `__init__.py`
  acceptance: id estável; `citar()` legível; sem fonte órfã; Lei 14.181/2021 com ids `cdc-*`
  validation: `pytest backend/tests/test_juridico.py`
  depends_on: []

- id: T2 — trilhas curadas
  scope: `backend/juridico/trilhas.py`
  acceptance: quatro trilhas; `limitacoes` obrigatório; nenhum dígito no texto; ids conferidos no
    import
  depends_on: [T1]

- id: T3 — achados apontam para o registro
  scope: `backend/domain/revisao.py`, `backend/tests/test_script.py`
  acceptance: `fonte_ids` tupla; `fonte` derivado; o achado do seguro mantém as DUAS normas
  depends_on: [T1]

- id: T4 — contrato e rotas
  scope: `backend/schemas.py`, `backend/routers/juridico.py`, `routers/revisao.py`,
    `routers/caixa.py`, `routers/resumo.py`, `backend/main.py`
  acceptance: `GET /v1/juridico/fontes` autenticada e de ordem estável; trilha em caixa e revisão;
    `naoFecha` na Rota com `None` = não sabemos
  validation: `pytest backend/tests/test_juridico_api.py`
  depends_on: [T1, T2, T3]

- id: T5 — o disclosure
  scope: `src/components/ui/ComoCalculamos.tsx`, `src/api/juridico.ts`, `src/hooks/useJuridico.ts`,
    `src/api/types.ts`, `scripts/paleta-check.mjs`
  acceptance: nasce fechado; nunca esconde `limitacoes`; ementa e texto com pesos distintos; par de
    cor novo declarado e medido
  validation: `npm run palette:check`
  depends_on: [T4]

- id: T6 — telas
  scope: `app/(tabs)/caixa/index.tsx`, `app/(tabs)/painel/index.tsx`,
    `app/(tabs)/dividas/[id]/revisao.tsx`, `app/(onboarding)/triagem.tsx`
  acceptance: os critérios de aceite do `feature.md`
  validation: `npx jest src/test/screens/como-calculamos.test.tsx`
  depends_on: [T5]

- id: T7 — documentação canônica
  scope: `docs/api-contract.md`, `docs/domain.md`, `docs/design-system.md`, `docs/backend.md`,
    `docs/adr/0024-*`, `docs/adr/README.md`, `roadmap.md`, `docs/inventario.md`
  depends_on: [T1..T6]

critical_path: T1 → T2 → T4 → T5 → T6 → T7.
human_gates:
- revisão da copy jurídica por advogado (gate de pré-lançamento do roadmap);
- validação em aparelho;
- merge do PR.
