# ADR 0013 — Assinatura in-app: teste de 7 dias, somente leitura depois, e validação no servidor

**Status:** aceito
**Data:** 2026-08-07

## Contexto

A seção de pré-lançamento do `roadmap.md` tem um item que é código de produto e nenhum outro é:
"Assinatura por **in-app purchase** (StoreKit / Play Billing). Para conteúdo digital as duas lojas
obrigam o meio de pagamento delas — Pix ou Stripe direto não passa."

O M8 entregou a conta: quem é o dono do dado. Falta a outra metade — **até quando ele pode
escrever nela**. Sem isso não há como publicar cobrando, e o produto fica de graça por omissão.

O que torna a decisão diferente de um paywall comum é o público. Este app é usado por quem está
endividado, e a alavanca óbvia de conversão — trancar o acesso — é justamente a que transformaria
o produto no tipo de credor que ele existe para ajudar a enfrentar.

## Decisão

### 1. Sete dias de teste, contados da criação da conta; depois, somente leitura

Escrita exige teste em curso ou assinatura ativa. **Leitura é livre para sempre.** Quem parou de
pagar continua vendo as próprias dívidas, o próprio caixa e o próprio histórico; o que ele perde é
registrar e alterar.

Trancar alguém endividado para fora da lista das dívidas dele seria o oposto do que este produto
faz. Também não sobreviveria ao art. 18 do LGPD: acesso do titular ao próprio dado não é um recurso
pago. Somente leitura resolve os dois — e continua sendo um paywall de verdade, porque o valor do
produto está em manter o retrato atualizado.

**Sete dias é escolha comercial, e o docstring de `domain/assinatura.py` diz isso por escrito.** A
regra do repositório é que nenhuma **regra financeira** é inventada: multa, juros e mínimo
existencial levam artigo de lei porque descrevem dinheiro que a lei define. Período de teste não é
dessa classe — é da classe do preço, nosso para escolher. Declarar a diferença impede que um leitor
futuro conclua que a fonte foi esquecida, e impede que o arquivo vire precedente para o próximo
`* 1.1`.

### 2. A trava é derivada do método HTTP, não de uma lista de rotas

`GET` passa; `POST`, `PUT`, `PATCH` e `DELETE` exigem situação válida. Uma dependência global em
`main.py`, e nada rota a rota.

Uma lista escrita à mão envelheceria na primeira rota de escrita criada sem lembrar dela — e o
buraco não apareceria em teste nenhum, porque a rota funcionaria. Ele apareceria como receita que
não entra, que é o modo de falha mais silencioso que existe. É o mesmo raciocínio de
`routers/conta.tabelas_do_tenant()`, que deriva a exclusão de conta do metadata: **rota nova nasce
travada, sem ninguém fazer nada.**

Três grupos ficam fora, e não são exceções de recurso — são as rotas que existem para começar,
gerenciar e encerrar a relação, e nenhuma pode depender de estar em dia:

| Grupo | Por quê |
|---|---|
| `/v1/auth` | Cobrar de quem não conseguiu nem fazer login. E o login é `POST`. |
| `/v1/assinatura` | Exigir assinatura para assinar é deadlock, e só apareceria no primeiro pagante. |
| `/v1/conta` | A exclusão é `DELETE` e a Apple a exige (5.1.1(v)). Travá-la reprova na revisão. |

O código é **`402 Payment Required`**, que estava livre no servidor inteiro. `403` está descartado
por outro motivo já registrado: ele é reservado a nunca ser usado, porque confirmaria a existência
de recurso de outro tenant.

Um teste varre `app.openapi()` e falha se `LIVRES` crescer sem decisão explícita.

### 3. Validação direta com as duas lojas, em provedor plugável — sem intermediário

`backend/loja/`, no desenho da ADR 0007 e do `correio/`: um `Protocol`, o adaptador da Apple, o do
Google e um de memória que é o que a suíte usa. A regra "nenhum teste toca a rede" passa a valer
para cobrança.

RevenueCat resolveria renovação, período de graça e reembolso de graça, e foi recusado por um custo
que não é técnico: ele receberia identificador de usuário e histórico de compra, virando um operador
terceiro a declarar na política de privacidade e no App Privacy — dois itens que **ainda não foram
escritos**. Adicionar um processador a um produto que ainda não declarou os que tem é a ordem errada.

**O recibo do aparelho nunca é fonte da verdade.** Ele é chave de busca: extraímos o identificador,
perguntamos à loja por TLS autenticado com a nossa chave, e é a resposta dela que grava. Um app
modificado pode forjar o recibo; o que ele consegue com isso é apontar para a assinatura de um
estranho, nunca inventar uma que não existe.

### 4. Reconferência sob demanda no lugar de webhook

`GET /v1/assinatura` reconsulta a loja quando o registro local já passou de `expira_em`.

*App Store Server Notifications V2* e o RTDN do Google exigem **URL pública** — que o `roadmap.md`
lista como pendente na mesma linha da página de exclusão — e o RTDN exige ainda um projeto GCP com
Pub/Sub. Reconferir sob demanda dá o mesmo resultado com a latência de uma abertura do app, e é
código que roda hoje. Webhook entra quando houver domínio, e substitui isto sem mudar o contrato.

Falha de rede na reconferência **não derruba ninguém**: respondemos com o que está gravado. Tirar
acesso de quem pagou porque a Apple teve instabilidade é o erro caro; dar algumas horas a mais é o
barato.

### 5. O preço vem da loja, nunca do servidor nem do bundle

O backend não devolve preço e o app não o formata. Ele chega pelo SDK, já localizado em moeda e
formato. É exigência das duas lojas, e preço servido por nós mentiria para quem está em outro país e
envelheceria na primeira promoção. O que viaja em `EXPO_PUBLIC_` é só o **id do produto**, que não é
segredo — ele está impresso na página pública da assinatura na App Store.

## Consequências

**Ganhamos**

- Uma condição de publicação a menos, e a única da lista que era código de produto.
- Rota de escrita nova nasce cobrada, por construção.
- Nenhum processador de dados novo a declarar quando a política de privacidade for escrita.
- `assinatura` entrou na exclusão de conta sem uma linha a mais, porque tem `tenant_id`.

**Perdemos ou adiamos**

- **O Expo Go deixa de bastar.** IAP exige *development build*; `app.json` ganhou
  `bundleIdentifier` e `package`, e entrou `eas.json`.
- Renovação e cancelamento só chegam na próxima abertura do app, não em tempo real.
- Uma dependência nova no backend (`cryptography`), que o PyJWT exige para ES256 e RS256.
- Nada disto é exercitável sem conta de desenvolvedor nas duas lojas. A suíte prova o ciclo contra
  o adaptador de memória; **compra real, restauração em aparelho novo e sandbox continuam por
  validar.**

**Passa a ser proibido**

- Bloquear leitura, seja qual for a situação da assinatura.
- Bloquear a exclusão de conta.
- Servir, formatar ou cravar preço no cliente ou no backend.
- Aceitar do app qualquer afirmação sobre a própria validade — só o recibo sobe.
- Chamar `finishTransaction` antes de o backend confirmar.
