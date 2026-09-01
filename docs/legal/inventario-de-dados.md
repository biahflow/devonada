# Inventário de dados — o que o devo.nada guarda, e quem mais vê

> **Este documento é derivado do código.** Cada linha aponta para a tabela, a rota ou o guardrail
> que a sustenta. Ele existe para três consumidores: a **Política de Privacidade**
> (`backend/web/privacidade.html`), o **App Privacy** da Apple e o **Data safety** do Google.
>
> **Quando uma coluna nova guardar dado do usuário, ou um provedor novo passar a receber alguma
> coisa, os três mudam juntos.** Uma política que descreve um sistema que não existe mais é pior
> que nenhuma — divergência entre o que a loja lê e o que o app faz é motivo comum de remoção.
>
> Levantado em 01/09/2026, contra a `main` em `6349a9d`.

---

## 1. O que é coletado

Tudo abaixo é ligado ao `tenant_id`, que vem do token e **nunca** do cliente (guardrail 6).

### Conta e acesso — `usuario`, `sessao`, `codigo_recuperacao`

| Dado | Coluna | Por quê |
|---|---|---|
| E-mail | `usuario.email` | identifica a conta; recebe o código de recuperação |
| Senha (hash bcrypt) | `usuario.senha_hash` | autenticação. Nulo em conta só-social (ADR 0023) |
| Provedor social e identificador | `usuario.provedor`, `provedor_sub` | reconhecer quem entra pela Apple ou pelo Google |
| Tentativas falhas e bloqueio | `usuario.falhas_login`, `bloqueado_ate` | trava de força bruta |
| Sessões | `sessao.refresh_hash`, `expira_em`, `revogada_em` | manter e revogar acesso. **Guardamos o hash**, nunca o token |
| Código de recuperação | `codigo_recuperacao.codigo_hash` | redefinir senha. Também hash |

### Dívida — `divida`, `parcela`, `renegociacao`, `resultado_negociacao`

Credor, valor cobrado, data de origem, tipo, taxa, parcelas, situação, valor pago, data de
quitação; o cronograma de parcelas e o que já foi pago; o antes e o depois de cada acordo; e o
desfecho de cada conversa com credor, inclusive **sem** acordo, com `observacao` em **texto livre**.

> **Atenção do revisor jurídico:** `renegociacao.observacao` e `resultado_negociacao.observacao`
> são campos livres. A pessoa pode escrever ali qualquer coisa, inclusive dado de terceiro. Nada
> no produto a induz a isso, e nada valida o conteúdo.

### Caixa — `perfil`, `fonte_renda`, `recebimento`, `evento_previsivel`, `gasto`, `provisao_anual`, `meta`, `fechamento_mes`, `caixa_snapshot`, `saldo_snapshot`, `respiro*`, `marco`

Renda por fonte (nome, tipo, valor típico, alíquota reservada), recebimentos reais, gastos
essenciais e não essenciais, provisões anuais, metas nomeadas, fechamentos mensais, o histórico de
saldo e de capacidade, o respiro declarado e as conquistas atingidas. Mais **número de
dependentes** (`perfil.dependentes`).

### Conversa — `mensagem_chat`

**A conversa inteira**, texto do usuário e resposta do assistente, mais o JSON dos cards exibidos.

### Leitura de documento — `extracao`

Tipo, status, erro, **campos extraídos e os trechos literais que os comprovam** (JSON), nome do
arquivo e mime type. **O arquivo NÃO é guardado** — ver a seção 3.

### Assinatura — `assinatura`

Plataforma, id do produto, id da transação original, chave de consulta, expiração, ambiente e se a
renovação está ligada. **Nenhum dado de cartão** passa pelo servidor.

---

## 2. O que NÃO é coletado

Verificável, e cada item tem onde conferir:

| Não coletamos | Como se confere |
|---|---|
| Nome, CPF, telefone, foto | não há coluna; o login social pede só o escopo de e-mail (`src/social/`) |
| Localização | nenhuma permissão de localização em `app.json` |
| Contatos, agenda, SMS | idem |
| Analytics, telemetria, relatório de falha | nenhuma dessas dependências em `package.json` |
| Identificador de publicidade | não há SDK de anúncio; o app não tem anúncios |
| Dados bancários por Open Finance | fora do MVP (`roadmap.md`) — tudo vem do que a pessoa digita |

Guardrail 5 proíbe valor, credor, e-mail e senha em log, analytics ou mensagem de erro.

---

## 3. O documento enviado é lido e descartado

`POST /v1/contratos` recebe o arquivo, que vive **em memória** durante o processamento em
background e é descartado quando a função retorna (`routers/contratos._processar`, ADR 0005).
**Nada é gravado em disco em momento nenhum**, e `extracao.arquivo_descartado` registra isso.

O que permanece é o resultado da leitura, e nele **campo sem trecho literal é zerado no servidor**
(`limpar_campos_sem_evidencia`, guardrail 8.1).

---

## 4. Quem mais recebe dado

| Terceiro | O que recebe | Quando | Onde no código |
|---|---|---|---|
| **Provedor de LLM** (OpenAI por padrão; Anthropic suportado) | o **arquivo inteiro** (PDF ou imagem) | a cada envio de documento | `backend/extracao/extrator_llm.py` |
| **Provedor de LLM** | o texto que a pessoa escreve no chat, mais a **identificação** das dívidas: id, credor, tipo e situação | a cada mensagem | `assistente/regras.montar_contexto` |
| **Apple / Google (lojas)** | o recibo e o identificador da transação | ao comprar e ao reconferir | `backend/loja/` |
| **Serviço de SMTP** | e-mail do usuário e um código de 6 dígitos | ao pedir recuperação de senha | `backend/correio/` |

**O contexto do chat NÃO leva valores** — é decisão de produto com docstring própria: "o que o
modelo não recebe, ele não repete errado".

**Apple e Google NÃO recebem nada no login social.** A conferência do token é local, contra a
chave pública que baixamos do provedor (JWKS). O que sai daqui nesse fluxo é uma requisição de
chave pública, sem dado de usuário.

---

## 5. Retenção e exclusão

| Situação | O que acontece |
|---|---|
| Dívida apagada no app | exclusão **lógica** (`divida.excluido_em`) — o histórico dos meses anteriores não muda |
| Conta excluída | exclusão **física**, em transação, de **todas** as linhas do tenant em todas as tabelas, mais usuário, sessões e códigos (`routers/conta.py`) |
| Arquivo do documento | nunca gravado; descartado na mesma requisição |

A varredura da exclusão é **derivada de `orm.Base.metadata`**, e há teste que falha se uma tabela
com `tenant_id` ficar de fora. Tabela nova entra na exclusão no commit em que nasce.

---

## 6. Guia de preenchimento — *App Privacy* (Apple) e *Data safety* (Google)

> **Declarar errado é motivo comum de remoção**, e declarar a mais também gera pergunta. As
> respostas abaixo são as que o código sustenta hoje.

### O que declarar como **coletado e vinculado à identidade**

| Categoria (Apple) | Categoria (Google) | Nosso dado | Finalidade | Vinculado? | Rastreia? |
|---|---|---|---|---|---|
| Contact Info → Email Address | Personal info → Email address | `usuario.email` | funcionalidade do app; autenticação | **Sim** | **Não** |
| Financial Info → Other Financial Info | Financial info → Other financial info | dívidas, renda, gastos, metas, fechamentos | funcionalidade do app | **Sim** | **Não** |
| User Content → Other User Content | Messages → Other in-app messages | conversa com o assistente | funcionalidade do app | **Sim** | **Não** |
| User Content → Other User Content | Photos and videos / Files and docs | o documento enviado para leitura | funcionalidade do app | **Sim** | **Não** |
| Purchases | Financial info → Purchase history | id da transação da assinatura | funcionalidade do app | **Sim** | **Não** |
| Identifiers → User ID | — | id da conta e o `sub` do provedor social | autenticação | **Sim** | **Não** |

### O que declarar como **não coletado**

Localização · Contatos · Histórico de navegação · Histórico de busca · Saúde · Dados de
diagnóstico · Dados de uso · Identificadores de publicidade · Informações de contato além do
e-mail · Informações financeiras de pagamento (cartão).

### Respostas que costumam ser esquecidas

- **"Os dados são criptografados em trânsito?"** → **Sim** (HTTPS).
- **"O usuário pode pedir a exclusão dos dados?"** → **Sim**, dentro do app, e há URL pública:
  `/exclusao`.
- **"Você compartilha dados com terceiros?"** → **Sim** — o provedor de IA que lê o documento e
  conduz a conversa. Esta é a resposta que **não pode** ser omitida.
- **"Os dados são usados para rastrear o usuário?"** (App Tracking Transparency) → **Não**. Não há
  SDK de publicidade, e nada é combinado com dado de terceiros para segmentação.

### Declaração de recursos financeiros no Play Console

O app **administra dívida** mas **não é** produto de crédito: não empresta, não intermedeia e não
custodia dinheiro. Essa seção do formulário deve ser lida com atenção e respondida com essa
distinção — está escrita nos Termos de Uso e no rodapé das três páginas públicas.

---

## 7. O que ainda depende de decisão humana

1. **Revisão jurídica** dos Termos e da Política. As duas páginas carregam faixa de **minuta** até
   lá, e há teste que confirma que a faixa continua ali.
2. **Hospedar em `devonada.com.br`** e apontar o DNS. Hoje as páginas só existem onde a API existe.
3. **A caixa `contato@devonada.com.br` precisa existir e ser lida** — as três páginas prometem
   resposta em até 30 dias.
4. **Nomear o controlador com CNPJ** na Política, quando a publicação sob CNPJ acontecer
   (`roadmap.md`, pré-lançamento).
