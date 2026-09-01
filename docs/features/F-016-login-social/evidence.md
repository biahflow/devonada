# Evidência — F-016 login social

**Data:** 2026-09-01 · **Issue:** #9 · **ADR:** 0023 · **Branch:** ver PR

## Baseline

Antes desta tarefa, na `main` em `653224d`: **620 testes Jest em 50 suítes** e **733 pytest**,
todos verdes. Nenhuma falha pré-existente foi encontrada, e nenhuma foi introduzida.

`node_modules/` não existia no checkout; `npm install` rodou limpo (1149 pacotes). O
`npx expo install --check` reporta quatro pacotes fora da versão esperada pelo SDK 54
(`expo`, `expo-constants`, `eslint-config-expo`, `jest-expo`) — **divergência pré-existente**, fora
do escopo desta tarefa e não tocada.

## Gates locais — todos verdes em 01/09/2026

| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | passa |
| lint | `npm run lint` | passa |
| test | `npm test -- --forceExit` | **643 testes em 51 suítes**, verdes (era 620/50) |
| bundle | `npm run bundle:check` | passa — bundle iOS de 4,83 MB |
| palette | `npm run palette:check` | passa (nenhum token de cor tocado) |
| digits | `npm run digits:check` | passa (nenhuma fonte tocada) |
| pytest | `pytest backend -q` | **773 testes**, verdes em SQLite (era 733) |

`pytest` rodado em Python 3.12 via `uv` (o `python3` do sistema é 3.9). **Contra Postgres não foi
executado** — continua obrigatório antes de release, e a migration nova entra nessa conta.

## Testes novos

**Backend, +40:**

- `backend/tests/test_identidade.py` (17) — a conferência do ID token **sem rede**: a chave RSA é
  gerada na suíte e o JWKS é substituído por ela, então o token é assinado de verdade e o
  `jwt.decode` roda de verdade. Cobre audiência vazia recusando, `aud` de outro app, os dois
  emissores do Google, expirado, claim obrigatória faltando, `email_verified` em string, e o
  adaptador de memória.
- `backend/tests/test_auth_social.py` (23) — o que a rota faz com uma identidade já conferida:
  primeiro login, adoção do tenant do beta, `sub` mandando mais que o e-mail, contas distintas,
  `409` do *pre-hijacking*, religação de conta só-social, e-mail não verificado, senha não entrando
  em conta social, recuperação por e-mail dando senha a quem entrou pela Apple, e os seis casos da
  exclusão de conta — incluindo o beco sem saída de quem entrou pela Apple e depois ganhou senha.

**App, +23:**

- `src/test/social.test.ts` (13) — a fronteira com os SDKs: disponibilidade por plataforma e por
  configuração, token, cancelamento nos dois provedores, token ausente, e falha do SDK virando
  frase de gente em vez de `AuthorizationError code=1000`.
- `src/test/screens/autenticacao.test.tsx` (+5) — entrada pelo provedor, só o disponível
  aparecendo, cancelamento sem erro, frase do provedor, frase do servidor.
- `src/test/screens/excluir-conta.test.tsx` (+5) — provedor em vez de senha, exclusão pelo
  provedor, confirmação nativa, desistência na folha, e token de outra conta recusado.

## Dois defeitos encontrados pelos próprios testes durante a execução

1. **`IdentidadeMemoria` gravava o rótulo em pt-BR na coluna `provedor`.** A fábrica passava
   `"a Apple"` onde o modelo espera `"apple"`, e o login seguinte não reconhecia mais a conta. O
   teste `test_a_conta_nasce_sem_senha` pegou. Corrigido separando `provedor` (nome de máquina) de
   `rotulo` (frase).
2. **A tela piscava o estado errado enquanto perguntava.** `provedoresDisponiveis()` é assíncrona,
   e o estado inicial `[]` fazia a tela de entrada mostrar o par desligado com a legenda "chega com
   a publicação nas lojas" para quem TEM Apple disponível, antes de trocar pelo botão de verdade —
   e a de exclusão mostrar o campo de senha para quem não tem senha. O teste falhou com "Unable to
   find node on an unmounted component", que é o sintoma exato. Corrigido separando "ainda
   perguntando" (`null`/`undefined`) de "não tem" (`[]`/`null`): perguntando, não se desenha nada.

Um terceiro item foi pego pelo gate de varredura de rotas: `POST /v1/auth/social` nasceria gratuita
sob a trava de assinatura **em silêncio**. A rota foi declarada em `LIVRES` explicitamente, com o
motivo escrito — entrar não pode custar assinatura, e uma trava aqui seria o mesmo deadlock do
login.

## Migration

`b6d4e0f37a29_login_social`, encadeada em `c7e2b8a4d016` (cabeça conferida no início da tarefa).
Aditiva: afrouxa `usuario.senha_hash` para nulável, adiciona `provedor` e `provedor_sub` nulos, e
cria `uq_usuario_provedor_sub`. Nulo não colide com nulo no Postgres, então toda conta por e-mail e
senha — todas com `(NULL, NULL)` — convive sob a constraint.

**Não foi aplicada contra Postgres.** É gate humano, e o `downgrade` falha de propósito se houver
conta só-social no banco: ele não pode inventar senha para quem nunca teve.

## O que NÃO foi validado

- **Nada em aparelho.** Folha do Sign in with Apple, biometria, Google Play Services, entitlement
  assinado, safe area e teclado nas duas telas alteradas. Nenhum gate deste repositório prova isso,
  e um agente não consegue fazê-lo.
- **Nenhum token real foi conferido.** A suíte assina os próprios tokens; que a Apple e o Google
  aceitem nosso `client_id` só se prova com credencial real.
- **`alembic upgrade head` contra Postgres.**

## Aprovações humanas ainda necessárias

1. **Credenciais nas duas plataformas** — `DEVONADA_APPLE_CLIENT_IDS` (bundle id, em
   `Certificates, Identifiers & Profiles` com a capacidade *Sign in with Apple* ligada),
   `DEVONADA_GOOGLE_CLIENT_IDS` e `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Google Cloud Console, um
   client id por plataforma). Vazias, os botões continuam desligados e a rota recusa com `503` — o
   app não quebra, só não oferece o caminho.
2. **Development build** com os dois módulos nativos, para a validação em aparelho.
3. **Migration contra Postgres.**
4. **Merge do PR** — a Engineering OS mantém o merge como gate humano.
