# Plano de execução — F-016 login social

feature_id: F-016
goal: ligar os dois botões da tela 11 de ponta a ponta, deixando como pendência apenas o que exige
credencial real nas lojas.
assumptions:
- A cabeça da cadeia de migrations é `c7e2b8a4d016` (conferida no início da tarefa).
- O app já exige *development build* por causa da compra in-app, então módulo nativo novo não muda
  a natureza do build.
- Os dois provedores emitem ID token OIDC (JWT RS256 com JWKS), então uma conferência serve aos
  dois.
risks:
- Conferência de audiência frouxa entrega conta de qualquer usuário a outro app do mesmo provedor.
- Ligar login social a conta existente por e-mail, sem verificação de e-mail no cadastro, é
  *pre-hijacking*.
- `senha_hash` nulável atravessa o login por senha e a exclusão de conta; deixar qualquer um dos
  dois sem tratar produz `500` ou, pior, um caminho aberto.

## Tarefas

- id: T1 — camada de identidade
  scope: `backend/identidade/` (`base` · `openid` · `apple` · `google` · `memoria` · `__init__`),
    `backend/config.py`
  out_of_scope: rota, ORM, migration
  acceptance: audiência vazia levanta `IdentidadeNaoConfigurada`; `aud`/`iss`/`exp` errados
    recusam; `email_verified` string normalizada; adaptador de memória lê token que descreve a si
    mesmo
  validation: `pytest backend/tests/test_identidade.py`
  depends_on: []

- id: T2 — modelo e migration
  scope: `backend/orm.py`, `backend/alembic/versions/b6d4e0f37a29_login_social.py`
  out_of_scope: qualquer rota
  acceptance: `senha_hash` nulável; `provedor`/`provedor_sub`; `uq_usuario_provedor_sub`; downgrade
    escrito e honesto sobre falhar com conta só-social no banco
  validation: `pytest` (a suíte cria o schema por `metadata`); migration contra Postgres é gate
    humano
  depends_on: []

- id: T3 — rota social e login tolerante a conta sem senha
  scope: `backend/schemas.py`, `backend/routers/auth.py`
  acceptance: os nove itens de "Regras" do `feature.md` que tocam entrada
  validation: `pytest backend/tests/test_auth_social.py`
  depends_on: [T1, T2]

- id: T4 — exclusão de conta pelos dois caminhos
  scope: `backend/routers/conta.py`, `backend/schemas.py`
  acceptance: senha para quem tem senha (token recusado), provedor com `sub` conferido para quem
    não tem
  validation: `pytest backend/tests/test_auth_social.py::TestExclusaoDeContaSocial`
  depends_on: [T1, T2, T3]

- id: T5 — fronteira com os SDKs no app
  scope: `src/social/index.ts`, `src/config/env.ts`, `package.json`, `app.json`, `jest.setup.js`
  acceptance: disponibilidade perguntada ao aparelho (Apple) e à configuração (Google);
    cancelamento vira `CANCELADO`; falha vira `ErroSocial` em pt-BR
  validation: `npx jest src/test/social.test.ts`
  depends_on: []

- id: T6 — telas
  scope: `app/(auth)/login.tsx`, `app/(tabs)/painel/excluir-conta.tsx`, `src/api/auth.ts`,
    `src/api/sessao.ts`, `src/api/types.ts`, `src/hooks/useConta.ts`,
    `src/components/auth/BotaoSocial.tsx`
  acceptance: os quatro estados das duas telas; cancelar não navega nem acusa erro
  validation: `npx jest src/test/screens/autenticacao.test.tsx src/test/screens/excluir-conta.test.tsx`
  depends_on: [T3, T4, T5]

- id: T7 — documentação canônica
  scope: `docs/api-contract.md`, `docs/guardrails.md`, `docs/architecture.md`, `docs/backend.md`,
    `docs/adr/0023-*`, `docs/adr/README.md`, `roadmap.md`, `docs/inventario.md`, os dois
    `.env.example`
  acceptance: contrato, guardrails e inventário refletem o código; a pendência de credencial está
    escrita como gate humano, não como trabalho pendente
  depends_on: [T1..T6]

critical_path: T1 → T2 → T3 → T4 → T6 → T7. T5 corre em paralelo com T1..T4.
human_gates:
- credenciais na Apple Developer e no Google Cloud;
- validação em aparelho (folha do provedor, biometria, Play Services);
- `alembic upgrade head` contra Postgres;
- merge do PR.
