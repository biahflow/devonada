# ADR 0006 — Postgres, token fixo e extrator plugável

**Status:** aceito
**Data:** 2026-08-06

## Contexto

O backend existia como esqueleto: lista em memória que sumia a cada reload, header
`Authorization` recebido e ignorado, CORS em `*`, e um `valorCorrigido` calculado como
`valorCobrado * 1.1` — um número sem origem, que o app exibia como se fosse dado.

O dono do repositório quer usar o sistema como primeiro beta tester. Isso muda o cálculo de três
decisões que, num projeto sem usuário, poderiam esperar.

## Decisão

**Postgres em Docker, via SQLAlchemy e Alembic.** Porta 5433, porque a 5432 é do stack do
`biahflow-portal-cliente`. A API sobe na 8001 pelo mesmo motivo.

**Auth por token fixo em variável de ambiente**, resolvendo um `tenant_id` único. Comparação em
tempo constante. Toda query filtra por tenant desde já.

**Extrator de contrato atrás de um `Protocol`**, com a implementação Anthropic escolhida por
`BUDDY_EXTRATOR` e o modelo por `BUDDY_LLM_MODEL`.

## Consequências

+ O dado sobrevive ao reload — que era o bloqueio prático para qualquer uso real.
+ SQLAlchemy torna a troca por outro banco uma mudança de URL, e Alembic dá caminho de migração
  em vez de `create_all` destrutivo.
+ O caminho de 401 do front, escrito no M0 e nunca exercitado, passa a ser real. Trocar o token
  fixo por JWT depois **não muda o cliente**: ele já manda `Bearer` e já trata 401.
+ Filtrar por tenant com um usuário só é cerimônia hoje e é o que evita auditar rota por rota no
  dia em que houver dois. Vazamento cross-tenant é o incidente número um de produto financeiro.
+ O extrator plugável permite testar modelos, ou plugar um parser determinístico para um banco
  específico, sem tocar nas rotas.
− Mais um container para subir antes de usar o app. Para um beta local, é atrito real.
− Token único não distingue dispositivos e não tem revogação granular. Aceito enquanto o
  usuário é um; inaceitável no primeiro convidado.
− O SDK da Anthropic vira dependência do backend mesmo para quem nunca usar a leitura de
  contrato. Mitigado com import preguiçoso na factory.
− A suíte roda em SQLite e a produção é Postgres — divergência registrada em `docs/backend.md`,
  a ser fechada rodando os testes contra Postgres antes de release.
