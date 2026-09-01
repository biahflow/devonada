# Plano de execução — F-018 Termos e Política de Privacidade

feature_id: F-018
goal: fechar a issue #10 no que é código, e entregar ao humano o que só ele pode fazer com o
mínimo de trabalho restante.
assumptions:
- O padrão de página pública já existe desde o M8 (`GET /exclusao`), e migra de host junto.
- O conteúdo honesto de uma política de privacidade é derivável do repositório — e só de lá.
risks:
- Minuta publicada como documento final.
- Política que descreve um sistema que não existe mais.
- Link legal quebrado na frente do revisor da loja.

## Tarefas

- id: T1 — folha compartilhada
  scope: `backend/web/publico.css`, `backend/web/exclusao.html`
  acceptance: a página existente continua idêntica; os tokens ficam num lugar só
  depends_on: []

- id: T2 — as duas páginas
  scope: `backend/web/termos.html`, `backend/web/privacidade.html`
  acceptance: conteúdo derivado do código; faixa de minuta; sem afirmação de ilegalidade
  depends_on: [T1]

- id: T3 — rotas
  scope: `backend/main.py`
  acceptance: sem autenticação, fora do OpenAPI, `text/css` correto para a folha
  validation: `pytest backend/tests/test_paginas_publicas.py`
  depends_on: [T2]

- id: T4 — a linha legal vira link
  scope: `src/config/env.ts`, `.env.example`, `app/(auth)/login.tsx`, `jest.setup.js`
  acceptance: link com URL configurada, texto sem ela; a frase continua legível inteira
  validation: `npx jest src/test/screens/autenticacao.test.tsx`
  depends_on: []

- id: T5 — inventário e guia das lojas
  scope: `docs/legal/inventario-de-dados.md`
  acceptance: cada dado com a coluna que o sustenta; mapeamento para as categorias dos dois
    formulários; lista do que NÃO é coletado, com como conferir
  depends_on: [T2]

- id: T6 — documentação canônica
  scope: `docs/api-contract.md`, `docs/backend.md`, `roadmap.md`, `docs/inventario.md`
  depends_on: [T1..T5]

critical_path: T1 → T2 → T3 → T5 → T6. T4 corre em paralelo.
human_gates:
- revisão por advogado das duas páginas;
- hospedagem em `devonada.com.br` e DNS;
- a caixa de e-mail existir e ser lida;
- preenchimento dos formulários no console de cada loja;
- merge do PR.
