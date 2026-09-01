# FDD — Login social: Sign in with Apple e Google Sign-In

## Cabeçalho

| | |
|---|---|
| Feature | Entrar pela Apple ou pelo Google, e excluir a conta que nasceu assim |
| Slug | F-016-login-social |
| Milestone | M13 (ver `roadmap.md`) |
| Issue | #9 |
| Telas | `app/(auth)/login.tsx`; `app/(tabs)/painel/excluir-conta.tsx` |
| Endpoints | `POST /v1/auth/social` (novo), `DELETE /v1/conta` (alterado) |
| Depende de | ADR 0012 (conta e sessão), ADR 0007 (camada plugável), ADR 0013 (o padrão de `loja/`), guardrails 5 e 6 |
| Decide | ADR 0023 |

## Objetivo e não objetivos

A tela 11 da concepção mostra "Continuar com Apple" e "Continuar com Google" acima do divisor. Os
dois existem no app desde o M8, **desligados**, com legenda dizendo quando chegam — limitação #16
do inventário. Esta feature os liga: troca de ID token no servidor, vínculo de provedor na conta, e
os dois SDKs no app.

**Sign in with Apple é exigência da Apple** (diretriz 4.8) para qualquer app que ofereça login
social. Os dois andam juntos — não há entrega parcial "só Google".

**Não objetivos:**

- **Não** obter as credenciais reais. Conta na Apple Developer e projeto no Google Cloud são gate
  humano; o código nasce recusando com frase útil enquanto elas não existirem.
- **Não** ligar mais de um provedor à mesma conta. Uma conta guarda um provedor; a alternativa
  (tabela `identidade_social`) está descartada com motivo na ADR 0023.
- **Não** verificar e-mail no cadastro por senha. É o que permitiria ligar login social a conta
  existente com senha; enquanto não houver, essa ligação é recusada com `409`.
- **Não** emitir nonce anti-replay. Exige estado no servidor; descartado com motivo na ADR 0023.
- **Não** coletar nome nem foto. Os dois SDKs oferecem; nenhuma tela mostra.
- **Não** mexer na tela de registro. A tela 11 é a de entrada.

## Jornada e interface

### Entrar

1. A tela de entrada pergunta ao aparelho e à configuração quais provedores existem
   (`src/social/provedoresDisponiveis()`). Enquanto a resposta não vem, o bloco social **não
   desenha nada** — desenhar o par desligado faria a tela afirmar por um instante o contrário do
   que vai mostrar.
2. **Nenhum disponível** → o par desligado com a legenda de sempre, que é o estado do Expo Go e o
   de antes das credenciais.
3. **Algum disponível** → só os disponíveis, ligados. Botão apagado ao lado de um aceso parece
   defeito.
4. Toque → folha do provedor → ID token → `POST /v1/auth/social` → sessão → `replace('/')`.

### Excluir a conta

A tela lê por onde **este aparelho** entrou (`provedorDaSessao()`), e só então desenha:

- **entrou por senha** → campo de senha, como sempre;
- **entrou por provedor** → botão "Confirmar com a Apple/Google e excluir".

Nos dois caminhos, o alerta nativo vem **antes** — ele é sobre a decisão; a credencial é sobre a
identidade.

### Os quatro estados

| Estado | Entrada | Exclusão |
|---|---|---|
| Carregando | botão desligado enquanto o fluxo está em voo | idem |
| Erro | frase do provedor (`ErroSocial`) ou do servidor (`ApiError`), num lugar só | idem |
| Vazio | nenhum provedor disponível → par desligado + legenda | não se aplica: sempre há um caminho |
| Conteúdo | botões dos provedores disponíveis | campo de senha **ou** botão do provedor |

**Cancelar não é nenhum dos quatro.** Fechar a folha do provedor não navega, não chama a API e não
mostra mensagem — é gesto normal, e acusá-lo de falha seria o app culpar quem mudou de ideia.

## Regras

1. **A conta é `(provedor, sub)`.** Nunca o e-mail. Unicidade no banco (`uq_usuario_provedor_sub`).
2. **E-mail verificado reconhece; conta com senha não é ligada.** `409` — fecha o *pre-hijacking*.
3. **Sem e-mail verificado não nasce conta.** `usuario.email` é por onde o código de recuperação
   chega.
4. **Audiência vazia recusa** (`503`), nunca aceita qualquer uma.
5. **Conta sem senha exclui pelo provedor**, com o `sub` conferido contra o da conta.
6. **Serve qualquer credencial que a conta tem**, e só ela: conta sem provedor não exclui por
   token social, conta sem senha não exclui por senha. Quem tem as duas usa qualquer uma — aceitar
   só uma criaria beco sem saída para quem entrou pela Apple e depois ganhou senha.
7. **O app manda o token e nada mais.**
8. **A trava de força bruta não se aplica à rota social**, e entrar por ela zera o contador.
9. **Entrar pela Apple ou pelo Google não custa assinatura** — entrar é entrar (a rota está
   declarada em `LIVRES`, e há teste que falha se alguém ampliar essa lista sem decidir).

## Critérios de aceite

- [x] Primeiro login cria conta **sem senha** e devolve sessão utilizável.
- [x] O primeiro login de um banco vazio adota o tenant do beta, como o registro por e-mail.
- [x] O mesmo `sub` volta para a mesma conta, mesmo com o e-mail diferente.
- [x] O mesmo `sub` em provedores diferentes são contas diferentes.
- [x] Conta com senha + token social do mesmo e-mail → `409`.
- [x] Conta só-social + outro provedor com o mesmo e-mail verificado → religa, não duplica.
- [x] E-mail não verificado, ou ausente, não cria nem reconhece.
- [x] Conta social não entra por senha, e com a **mesma frase** do e-mail inexistente.
- [x] Quem entrou pela Apple ganha senha pela recuperação por e-mail, e o vínculo social sobrevive.
- [x] Conta só-social exclui reapresentando o provedor; token de outro `sub` não exclui.
- [x] Conta sem provedor não exclui por token social; quem tem as duas credenciais usa qualquer uma.
- [x] Audiência vazia recusa; `aud` de outro app recusa; `iss` errado recusa; expirado recusa.
- [x] `email_verified` como string `"false"` **não** vira `true`.
- [x] A tela mostra só os provedores disponíveis, e o par desligado quando não há nenhum.
- [x] Cancelar no provedor não entra, não navega e não acusa erro.
- [ ] **Validação em aparelho** — folha da Apple, biometria, Google Play Services. Gate humano.
- [ ] **Credenciais reais** nas duas plataformas. Gate humano.

## Riscos e limitações aceitas

- **Uma conta, um provedor.** Religação substitui o vínculo anterior; e-mails diferentes produzem
  duas contas. Declarado na ADR 0023.
- **Atrito para quem tem conta com senha** e toca no botão social: `409` e a instrução de entrar
  pela senha. Some quando houver verificação de e-mail no cadastro.
- **A tela de exclusão depende de um dado local** (`auth_provedor`). Perdê-lo faz pedir senha, que é
  o comportamento conservador certo.
- **Nada foi validado em aparelho**, e nenhum gate deste repositório prova folha de provedor,
  biometria ou entitlement assinado.
