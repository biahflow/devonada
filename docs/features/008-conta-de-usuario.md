# FDD — Conta de usuário

## Cabeçalho

| | |
|---|---|
| Feature | Conta de usuário: cadastro, login, sessão revogável, recuperação de senha e exclusão |
| Slug | `008-conta-de-usuario` |
| Milestone | M8 (ver `roadmap.md`) |
| Telas | `app/(auth)/login` · `registro` · `esqueci-senha` · `redefinir-senha` · `app/(tabs)/painel/excluir-conta` · alterações em `painel/preferencias` e `app/_layout` |
| Endpoints | `POST /v1/auth/registro` · `/login` · `/refresh` · `/logout` · `/senha/recuperacao` · `/senha/redefinicao` · `DELETE /v1/conta` · `GET /exclusao` (público, web) |
| Depende de | ADR 0012; ADR 0006 (superada na parte do token fixo); guardrails 5 e 6 |

## Objetivo e não objetivos

O usuário passa a ter uma conta sua: entra com e-mail e senha em qualquer aparelho, recupera o
acesso se esquecer a senha, e consegue apagar tudo o que é dele sem pedir a ninguém.

**Não objetivos:**

- Login social (Google, Apple). Adotar um deles obriga a oferecer *Sign in with Apple* (diretriz
  4.8), e nada no produto pede isso hoje.
- Verificação de e-mail no cadastro. O e-mail é provado no primeiro uso da recuperação; exigir
  confirmação antes do primeiro acesso põe uma parede entre a pessoa e o produto.
- Segundo fator. Entra quando houver base de usuários que justifique o atrito.
- Conta compartilhada (casal, família). O modelo suporta — `tenant_id` é separado de `usuario.id`
  exatamente para isso —, mas nenhuma rota expõe convite.
- Política de privacidade, formulários de loja e IAP. Continuam pendentes no pré-lançamento.

## Jornada e interface

### Abertura do app

`app/_layout.tsx` segura a splash enquanto lê o `expo-secure-store`.

- **Carregando** — splash. Ninguém vê uma tela piscar antes de saber para onde ir.
- **Sem sessão** — `<Redirect href="/login" />`.
- **Com sessão** — as quatro abas, como hoje.

O grupo `(auth)/` fica **fora** de `(tabs)/`: login com a barra de abas embaixo é convite a tocar
numa aba que vai `401`ar.

### Entrar (`(auth)/login`)

E-mail, senha, "Entrar", e dois caminhos secundários: "Criar conta" e "Esqueci minha senha".

- **Carregando** — botão em `loading`, campos desabilitados.
- **Erro** — `Feedback` com a frase do backend. Credencial errada e e-mail inexistente produzem
  **a mesma** frase (ADR 0012, item 4).
- **Vazio** — não existe: o formulário é o conteúdo.
- **Conteúdo** — sessão gravada, `router.replace('/')`.

### Criar conta (`(auth)/registro`)

E-mail, senha e confirmação de senha. Senha com menos de 8 caracteres é barrada **no cliente e no
servidor** — a validação local é conveniência, a do servidor é a regra. E-mail já cadastrado
volta `409`, com a mensagem apontando para o login.

### Esqueci minha senha (`(auth)/esqueci-senha`)

Pede o e-mail e responde **sempre** a mesma coisa: "Se esse e-mail estiver cadastrado, o código
chega em instantes." Confirmar cadastro aqui entregaria a lista de usuários a quem pede.

Segue para `redefinir-senha`, que recebe o e-mail por parâmetro de rota.

### Redefinir senha (`(auth)/redefinir-senha`)

Código de 6 dígitos, senha nova e confirmação. Código errado, expirado ou já usado devolve `400`
com frases distintas entre si — aqui a distinção **ajuda o usuário e não vaza nada**, porque
quem chegou até aqui já provou ter o e-mail.

Sucesso derruba todas as sessões e leva ao login.

### Sair e excluir (`(tabs)/painel/preferencias` → `painel/excluir-conta`)

"Sair" chama `POST /v1/auth/logout`, limpa o SecureStore e volta ao login. Falha de rede **não**
impede a saída local: o refresh expira em 30 dias de qualquer forma, e um logout que trava porque
o servidor não respondeu é pior que um refresh órfão.

"Excluir minha conta" abre uma tela que, antes de perguntar qualquer coisa, **lista o que será
apagado**: dívidas e parcelas, caixa, contratos lidos, histórico do chat, conta. Depois pede a
senha e, só então, um `Alert` nativo de confirmação (guardrail 7.2).

## Contrato

- **Endpoints:** especificados em `docs/api-contract.md`, seção 2 (rotas) e seção 4 (Bloco 10).
- **Tipos:** `src/api/types.ts` ganha `Sessao { acesso, refresh, expiraEm }`. Nenhum tipo de
  domínio muda — a conta não altera dívida, caixa nem resumo.
- **Chaves de cache:** nenhuma nova. Sair e excluir chamam `queryClient.clear()`: dado de um
  usuário no cache depois de outro entrar é vazamento cross-tenant no cliente.
- **Unidades:** nenhum valor monetário nesta feature. `expiraEm` é ISO 8601.

## Requisitos funcionais

- **RF-001** — O app não exibe nenhuma tela de dado financeiro sem sessão válida.
- **RF-002** — Cadastro exige e-mail válido e senha de no mínimo 8 caracteres, validados no
  servidor.
- **RF-003** — O primeiro cadastro num banco sem usuários adota `settings.tenant_id`, e os dados
  do beta continuam alcançáveis (ADR 0012, item 2).
- **RF-004** — Access token expirado é renovado **sem o usuário perceber**, e a requisição
  original é repetida uma vez.
- **RF-005** — N requisições concorrentes com o access expirado disparam **um** refresh.
- **RF-006** — Refresh reapresentado após rotação devolve `401` e leva ao login.
- **RF-007** — Login com e-mail inexistente e login com senha errada são indistinguíveis por
  mensagem e por tempo de resposta.
- **RF-008** — `POST /senha/recuperacao` responde `202` para qualquer e-mail.
- **RF-009** — Redefinir a senha revoga todas as sessões do usuário.
- **RF-010** — Após N falhas de login o acesso àquela conta é bloqueado temporariamente.
- **RF-011** — `DELETE /v1/conta` exige a senha no corpo, além do Bearer.
- **RF-012** — A exclusão apaga fisicamente todas as linhas do tenant, numa transação.
- **RF-013** — A exclusão não dispara sem a confirmação nativa.
- **RF-014** — `GET /exclusao` responde sem autenticação e explica o que é apagado.
- **RF-015** — Sair ou excluir limpa o cache do TanStack Query.

## Guardrails desta feature

| Guardrail | Como esta feature o respeita |
|---|---|
| 2 — egress único | A renovação vive **dentro** de `src/api/client.ts`. Nenhuma tela chama `fetch`. |
| 5 — privacidade | Senha nunca vai para log, nem volta em resposta, nem entra em mensagem de erro. O e-mail de recuperação leva **o código e nada mais**: nome, valor ou saldo trafegando em texto plano por um canal que não controlamos seria o vazamento mais barato do produto. |
| 6 — multi-tenant | O `tenant_id` continua vindo do token, agora do `sub` do JWT. Nenhuma rota nova aceita tenant do cliente. O `queryClient.clear()` na troca de sessão fecha a versão-cliente do mesmo risco. |
| 7.2 — confirmação | Exclusão de conta é a ação mais destrutiva do produto e pede senha **mais** `Alert` nativo. |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Todos os endpoints consumidos estão especificados em `docs/api-contract.md`.
- [x] Estados de erro e de vazio definidos, não só o caminho feliz.
- [x] Guardrails aplicáveis identificados.
- [x] Copy em pt-BR revisada contra o vocabulário de `docs/domain.md`.

## Definition of Done

- [ ] `npm run typecheck`, `npm run lint`, `npm test` e `npm run bundle:check` passam.
- [ ] `pytest` passa em SQLite e em Postgres.
- [ ] Os quatro estados implementados e verificáveis.
- [ ] Nenhum valor monetário calculado no cliente.
- [ ] Nenhum dado financeiro ou pessoal em log, analytics ou mensagem de erro.
- [ ] Alvo de toque de 48pt e `accessibilityLabel` em controle sem texto.
- [ ] Documentos canônicos afetados atualizados no mesmo commit.
- [ ] Validado em device — **pendente, e só o dono do repositório consegue**.

## Riscos e modos de falha

| Risco | O que o produto faz |
|---|---|
| **Renovação concorrente.** Dez telas montam juntas com o access expirado e cada uma rotaciona o mesmo refresh; nove ficam com token revogado e a sessão morre no boot. | Promise de módulo compartilhada: o primeiro `401` cria a renovação, os outros esperam nela. É o ponto mais frágil do milestone e o mais coberto por teste. |
| **SMTP fora do ar.** Sem envio, não há recuperação — e senha esquecida vira dado financeiro inacessível. | O correio é plugável (mesmo padrão da ADR 0007). Sem SMTP configurado, a rota responde com frase útil e o resto do produto segue. Limitação declarada em `docs/backend.md`. |
| **Tabela nova sem exclusão.** A próxima migration cria uma tabela com `tenant_id` e ninguém lembra da exclusão de conta; o dado fica órfão e o buraco só aparece numa auditoria de loja. | Teste que varre `orm.Base.metadata.tables` e falha se alguma tabela com `tenant_id` estiver fora da lista de exclusão. |
| **Access sobrevivendo à exclusão** por até 15 minutos. | A exclusão reconfirma a senha e apaga as sessões junto. Nenhuma rota de escrita depende só do Bearer para operação destrutiva. |
| **Perda do acesso ao beta.** O primeiro cadastro erra o tenant e os dados existentes ficam órfãos. | A condição é `count(usuario) == 0`, verificada em transação, e há teste que cadastra num banco com dado semeado e confere que `GET /v1/dividas` devolve o que já existia. |
