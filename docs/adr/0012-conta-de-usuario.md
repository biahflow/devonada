# ADR 0012 — Conta de usuário: JWT curto, refresh rotacionado e a sessão como único estado global

**Status:** aceito
**Data:** 2026-08-07
**Supera em parte:** ADR 0006 (o token fixo; Postgres e extrator plugável continuam de pé)

## Contexto

O acesso ao app hoje é um token fixo em variável de ambiente, colado no aparelho por QR code. A
ADR 0006 aceitou isso e escreveu, na mesma página, por que não duraria: "não distingue
dispositivos e não tem revogação granular. Aceito enquanto o usuário é um; inaceitável no
primeiro convidado."

O primeiro convidado é agora. A seção de pré-lançamento do `roadmap.md` tem três itens que só
existem porque não há conta: autenticação real, exclusão de conta dentro do app (Apple, diretriz
5.1.1(v)) e página web de solicitação de exclusão (Google). Os dois últimos são obrigações de
loja e **nenhum deles é satisfazível sem o primeiro** — não se exclui uma conta que não existe.

O dado em jogo é o mais sensível do produto: renda, gasto, dívida, contrato de empréstimo com CPF
dentro. Isso muda o peso de três decisões que, num app de lista de tarefas, seriam preferência de
gosto.

## Decisão

### 1. Sessão é JWT de acesso curto mais refresh opaco rotacionado

O *access token* é um JWT HS256 de **15 minutos**, verificado por assinatura, sem consulta ao
banco. O *refresh* é um valor aleatório opaco, guardado **como hash SHA-256** na tabela `sessao`,
válido por 30 dias e **rotacionado a cada uso**: usar um refresh revoga a linha e cria outra.

O que cada metade compra:

- O JWT curto tira uma consulta ao banco de toda requisição autenticada, que é a maioria delas.
- O refresh em tabela é o que dá **revogação de verdade** — a falta que a ADR 0006 nomeou.
  Logout, troca de senha e exclusão de conta derrubam a sessão no servidor, não só no aparelho.
- A rotação transforma refresh roubado em incidente **detectável**: um refresh reapresentado
  depois de rotacionado é sinal de cópia, e a rota responde `401`.
- Os 15 minutos são o preço do JWT sem consulta: durante essa janela, um access token de conta
  já excluída continua válido. Aceitável para leitura; **não** para a exclusão em si, e é por
  isso que ela reconfirma a senha em vez de confiar só no Bearer.

**JWT longo e stateless foi recusado.** Era o que a ADR 0006 imaginou ("trocar o token fixo por
JWT depois não muda o cliente"), e é a opção mais simples de escrever. Mas sem tabela não há
revogação, e conta excluída seguiria acessível até o token expirar — o que colide de frente com a
obrigação que motivou o milestone.

**Token opaco único, sem JWT, também foi recusado**, por motivo mais fraco: funcionaria e seria
mais simples, ao custo de uma consulta ao banco por requisição. A rotação já exige a tabela; o
JWT curto é o que evita pagar o banco em toda leitura.

### 2. O primeiro cadastro adota o tenant do beta

`POST /v1/auth/registro` num banco **sem nenhum usuário** cria a conta apontando para
`settings.tenant_id` — o tenant do beta. Qualquer cadastro posterior recebe um `uuid4()`.

Sem isso, as dívidas, o caixa e os contratos já cadastrados ficariam órfãos no banco: alcançáveis
por nenhum login, apagáveis por nenhuma exclusão de conta. Um script de linha de comando
resolveria o mesmo problema sem regra especial no caminho de cadastro, e foi considerado; a regra
condicional venceu por ser uma ferramenta a menos para manter, ao custo de uma condição que
existe para sempre e serve uma vez. A condição é `count(usuario) == 0` — ela deixa de ser
verdadeira no instante em que é usada, e não há caminho de volta.

### 3. A sessão é o único estado global do app

`docs/architecture.md`, seção 4, declara: "Não há store global. Se um dia surgir necessidade real
de estado compartilhado que não seja de servidor, ela vira ADR antes de virar dependência." Esta
é essa ADR, e a resposta é **sim, com escopo mínimo**.

`src/api/sessao.ts` é um store assinável de trinta linhas sobre `useSyncExternalStore`, sem
biblioteca nova. Ele guarda um valor de três estados — `carregando`, `anonimo`, `autenticado` — e
nada mais. Não guarda dado do usuário, não guarda e-mail, não guarda token: os tokens continuam
no `expo-secure-store`, que é onde credencial mora.

Ele é necessário porque a expiração de sessão é **assíncrona e vinda de baixo**: uma renovação
que falha no meio de uma requisição precisa levar o app inteiro para o login, e não há prop para
descer isso. Alternativas foram descartadas — ler o SecureStore a cada render é I/O em caminho
quente, e `useState` no `_layout` não é alcançável de dentro de `client.ts`.

**O limite é explícito:** dado de servidor continua sendo do TanStack Query, e a próxima
necessidade de estado global precisa da própria ADR. "Já existe um store" não é argumento.

### 4. O que a autenticação nunca revela

Três decisões de comportamento que valem tanto quanto a criptografia:

- **`POST /senha/recuperacao` responde `202` sempre**, exista o e-mail ou não. Responder `404`
  transformaria a rota num verificador de cadastro — dado que interessa a quem monta lista para
  phishing de app financeiro.
- **Login errado tem uma mensagem só** para senha incorreta e e-mail inexistente, e o `bcrypt`
  roda contra um hash falso quando o usuário não existe. Sem isso, o tempo de resposta responde a
  pergunta que a mensagem se recusou a responder.
- **Redefinir senha revoga todas as sessões.** Quem troca a senha em geral está trocando porque
  perdeu o aparelho. Uma troca que não derruba o aparelho perdido não protege de nada.

## Consequências

+ Os três itens de "Conta de usuário" do pré-lançamento passam a ser satisfazíveis, e dois deles
  são fechados neste milestone.
+ O isolamento por tenant, que era cerimônia com um usuário só, passa a valer de verdade — e não
  houve rota para auditar, porque toda query já filtrava desde o Bloco 0. Foi exatamente o
  investimento que a ADR 0006 justificou.
+ A troca custa **uma fixture**: os 370 testes do backend autenticam por `auth` em
  `conftest.py`, e nenhum deles conhece o mecanismo.
+ A revogação existe, então "sair de todos os aparelhos" e a exclusão de conta são operações reais
  no servidor, não teatro no cliente.

− O `client.ts` deixa de ser um repassador de requisição e ganha renovação silenciosa, com o
  cuidado de disparar **um** refresh para N requisições concorrentes. É a peça mais fácil de
  quebrar do milestone, e nenhum gate automático a exercita como o app a exercita: só volta do
  background com token expirado prova que funciona.
− Recuperação de senha passa a exigir envio de e-mail, que é infraestrutura nova (SMTP) e um modo
  de falha novo. Fica atrás do mesmo padrão de provedor plugável do LLM (ADR 0007), e sem SMTP
  configurado a rota responde com frase útil em vez de derrubar o resto do produto.
− Senha esquecida com SMTP fora do ar é dado financeiro inacessível. O caminho existe; a
  dependência é real e está declarada em `docs/backend.md`.
− Um access token sobrevive até 15 minutos à exclusão da conta. Mitigado onde importa: a exclusão
  reconfirma a senha, e as sessões são apagadas junto.
