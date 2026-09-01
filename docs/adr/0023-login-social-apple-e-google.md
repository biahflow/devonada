# ADR 0023 — Login social: a conta é o `sub` do provedor, e conta sem senha exclui pelo provedor

**Status:** aceito
**Data:** 2026-09-01

## Contexto

A tela 11 da concepção mostra "Continuar com Apple" e "Continuar com Google" acima do divisor,
antes do e-mail. Os dois botões existem no app desde o M8, **desligados**, com a legenda dizendo
quando chegam — é a limitação #16 do `docs/inventario.md` e o item aberto do M13 no `roadmap.md`.
Não havia nada no servidor: o que `backend/` conhecia sobre Apple e Google era compra in-app
(ADR 0013) e a página pública de exclusão, coisas diferentes.

Três decisões precisavam ser tomadas juntas, porque errar qualquer uma delas produz um buraco que
não aparece em teste feliz:

1. **O que identifica a pessoa** — o `sub` do provedor ou o e-mail.
2. **O que fazer quando o e-mail já tem conta** — ligar automaticamente ou recusar.
3. **Como quem entra pela Apple exclui a conta**, já que `DELETE /v1/conta` reconfirmava a senha e
   quem entra por provedor nunca escolheu uma.

A terceira não é detalhe de implementação: *Sign in with Apple* é **exigência** da Apple para
qualquer app que ofereça login social (diretriz 4.8), e a exclusão de conta dentro do app é
exigência da diretriz 5.1.1(v). Um app que oferecesse os dois botões e travasse a exclusão de quem
os usou reprovaria por uma diretriz enquanto cumpria a outra.

## Decisão

**1. A conta é identificada por `(provedor, sub)`, nunca pelo e-mail.** O e-mail muda: quem usa
"Ocultar meu e-mail" da Apple pode desligar o encaminhamento, e conta corporativa troca de domínio.
O `sub` é estável enquanto a pessoa não revogar o acesso ao app. A unicidade é do banco
(`uq_usuario_provedor_sub`), não de um `SELECT` antes do `INSERT` — dois toques simultâneos no
botão passariam os dois pelo mesmo `SELECT` sem achar nada, e a pessoa acabaria com duas contas,
cada uma com metade da vida financeira dela.

**2. O e-mail verificado RECONHECE, mas não liga a conta que tem senha.** Quando o `sub` é
desconhecido e o provedor entrega um e-mail que ele afirma ter verificado:

- conta existente **com senha** → `409`, com a frase mandando entrar por e-mail e senha;
- conta existente **sem senha** (só-social de outro provedor) → **religa** ao novo provedor;
- nenhuma conta → cria, sem senha.

O `409` fecha o *pre-hijacking*: este servidor **não verifica e-mail no cadastro**, então nada
impede alguém de registrar hoje uma conta com o e-mail de outra pessoa. Ligar o login social a ela
por coincidência de e-mail entregaria ao dono da conta plantada tudo o que a vítima cadastrasse
depois. Enquanto não houver verificação de e-mail no cadastro, ligar automaticamente é inseguro, e
a ADR prefere o atrito honesto.

Esse `409` **não é o verificador de cadastro** que a ADR 0012 recusa ser. Lá, qualquer pessoa
digita qualquer e-mail e lê a resposta; aqui é preciso apresentar um token assinado pelo provedor
para aquele e-mail — quem consegue isso já é dono dele, e está descobrindo sobre a própria conta.

**Sem e-mail verificado não há conta.** `usuario.email` é por onde o código de recuperação chega;
inventar um endereço para preencher a coluna seria gravar um dado que não existe.

**3. Conta só-social exclui reapresentando o provedor.** `senha_hash` passa a aceitar nulo, e
`DELETE /v1/conta` reconfirma por **qualquer credencial que aquela conta comprovadamente tem**: a
senha, se ela tem senha; o provedor, se ela tem provedor — com o `sub` do token conferido contra o
gravado na conta. Aceitar só uma das duas cria beco sem saída pelo caminho normal, porque quem
entra pela Apple e depois ganha senha pela recuperação passa a ter as duas: a tela ofereceria o
botão do provedor contra um servidor que só aceita senha. Não é afrouxamento — as duas exigem um
ato deliberado além do Bearer, e reapresentar o provedor custa biometria ou senha do sistema. O que
a rota recusa é reconfirmar com credencial que aquela conta **não** tem.
Sem essa comparação, alguém com o aparelho desbloqueado entraria na própria Apple ID e apagaria a
conta de outra pessoa: o token seria válido, só que de outra pessoa. O gesto preserva a intenção do
guardrail original (um celular esquecido na mesa não apaga a vida financeira de ninguém em dois
toques): reapresentar o provedor é um toque com biometria ou senha do sistema.

**Quem entra por provedor pode ganhar senha depois**, pela recuperação por e-mail que já existe: o
código chega na caixa que o provedor confirmou ser dela. A partir daí os dois caminhos entram na
mesma conta, e a exclusão volta a pedir a senha.

**4. A camada de identidade é plugável**, no padrão da ADR 0007 (LLM), do correio e da loja
(ADR 0013): `backend/identidade/` com `apple`, `google` e `memoria`, escolhida por
`DEVONADA_IDENTIDADE`. A suíte roda no adaptador de memória, e a regra "nenhum teste toca a rede"
passa a valer para o login social também.

**5. Audiência vazia RECUSA, e não aceita qualquer uma.** `DEVONADA_APPLE_CLIENT_IDS` e
`DEVONADA_GOOGLE_CLIENT_IDS` não têm default, e vazio levanta "não configurado" (`503`). Assinatura
válida só prova que o provedor emitiu o token para **algum** app; é o `aud` que prova que foi para o
nosso. Aceitar audiência qualquer entregaria a conta de qualquer usuário a quem controle outro app
do mesmo provedor. `DEVONADA_APPLE_CLIENT_IDS` **não** cai de volta em `DEVONADA_APPLE_BUNDLE_ID`,
que é da compra in-app: são do mesmo app, e deixar uma valer pela outra é decidir por acidente.

**6. O app manda o token e nada mais.** E-mail, nome e `sub` estão dentro do token, assinados; a
versão que o aparelho leu ao lado seria o cliente afirmando quem ele é, e o servidor a ignora. Nome
e foto, que os dois SDKs oferecem, não são coletados — nenhuma tela os mostra (guardrail 5).

**7. Botão só aparece onde há para onde mandar o toque.** Quem responde por isso é
`src/social/provedoresDisponiveis()`: a Apple pergunta ao próprio aparelho (`isAvailableAsync`,
falso no Expo Go, no Android e em binário sem a capacidade assinada), o Google depende do client id
configurado. Sem nenhum dos dois, a tela volta ao par desligado com a legenda. Botão apagado ao
lado de um aceso parece defeito, então o indisponível não é desenhado.

## Alternativas descartadas

**Tabela `identidade_social` (N provedores por conta).** Resolveria a religação da decisão 2 sem
substituir o vínculo anterior. Descartada por especulação: hoje não há tela, fluxo nem pedido de
"ligar minha conta ao segundo provedor", e o custo real da coluna única está declarado abaixo. A
migração de coluna para tabela é aditiva e não perde dado — ela pode ser feita no dia em que o
pedido existir.

**`GET /v1/conta` devolvendo "tem senha?" e "qual provedor?".** Seria a forma de a tela de exclusão
saber como reconfirmar. Descartada porque existiria para uma tela e abriria a porta que
`useConta.ts` fechou de propósito: o app não busca dado da conta porque nenhuma tela mostra dado da
conta. Guardar no `expo-secure-store` por onde **este aparelho** entrou responde a mesma pergunta
sem endpoint novo.

**Nonce anti-replay emitido pelo servidor.** Os dois provedores o suportam. Descartado por ora:
proteção de verdade exige o servidor emitir e guardar o nonce, e um nonce gerado no aparelho é
teatro. O token vale minutos e trafega só por TLS até a nossa API. Entra quando houver motivo
concreto, e a mudança é aditiva no `identidade/`.

## Consequências

+ A limitação #16 do `docs/inventario.md` fica resolvida no CÓDIGO, e o item do M13 no roadmap sai
  de "falta tudo" para "falta credencial". Os dois botões da tela 11 funcionam onde há credencial.
+ A camada de identidade nasce com a mesma disciplina da loja: a suíte exercita primeiro login,
  login repetido, reconhecimento, recusa e exclusão **sem conta na Apple Developer nem projeto no
  Google Cloud**.
+ A exclusão de conta cobre os dois tipos de conta, e a diretriz 5.1.1(v) continua cumprida para
  quem entra por provedor — que é justamente quem a diretriz 4.8 obriga a existir.
− **Uma conta guarda UM provedor.** Quem entra pela Apple e depois pelo Google com o mesmo e-mail
  verificado religa a conta em vez de duplicá-la; o vínculo anterior é substituído. Com e-mails
  **diferentes** — o caso de quem oculta o e-mail na Apple — são duas contas, e isso é inerente ao
  login social, não uma escolha nossa.
− **Quem tem conta com senha e toca no botão social leva 409** em vez de entrar. É atrito real, e a
  saída documentada é entrar com a senha. Ele desaparece no dia em que houver verificação de e-mail
  no cadastro, e não antes.
− O app ganha **duas dependências nativas** (`expo-apple-authentication` e
  `@react-native-google-signin/google-signin`) e o *development build* passa a ser exigido também
  por elas — o que já valia por causa da compra in-app.
− A tela de exclusão passa a depender de um dado guardado no aparelho (`auth_provedor`). Perdê-lo
  faz a tela pedir senha, que é o comportamento conservador certo: quem entrou por senha tem senha.
− **Nada disto entra em produção sem credencial nas duas plataformas**: `DEVONADA_APPLE_CLIENT_IDS`,
  `DEVONADA_GOOGLE_CLIENT_IDS` e `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` vazios mantêm os botões
  desligados e a rota recusando com `503`. É gate humano, não trabalho de agente.
