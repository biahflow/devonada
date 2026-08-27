# ADR 0022 — Documento lido dentro da fila multi-dívida, sem sair do onboarding

**Status:** aceito
**Data:** 2026-08-27

## Contexto

A ADR 0016, ponto 5, decidiu que **com fila de várias dívidas o upload de documento não aparece no
passo 2**. O raciocínio era mecânico e correto para o desenho de então: `/dividas/contrato` vive
fora do grupo `(onboarding)`, e um `router.push` para lá abandonaria o resto da fila no meio. Com
**uma** dívida marcada, o comportamento continuava intocado — documento primeiro, valor como
alternativa.

O custo dessa decisão está escrito na própria ADR 0016, nas consequências: *"Quem marca várias
dívidas manda documento depois, não durante, e recebe uma triagem mais pobre na primeira sessão."*
É a limitação #15 do `docs/inventario.md`. E ela dói justamente onde o produto promete mais: só
documento lido produz achado, e sem achado não há `valorJusto` nem script de contestação
(`backend/routers/revisao.py`; `montar_script` só carrega o mínimo de segurança sem achados). Quem
tem cartão **e** empréstimo — o caso comum, não a exceção — recebia a triagem incompleta em todas
as dívidas.

Havia um segundo problema, anterior e independente, que esta feature também conserta: **a ligação
dívida→extração estava quebrada no cliente**. O backend sempre aceitou e gravou `extracaoId`
(`schemas.NovaDivida`, `routers/dividas.py`), mas nenhum código do app o enviava — o tipo
`NovaDivida` nem tinha o campo, `extracaoParaProposta` não o carregava e o `DividaForm` o
descartava no submit. Dívida criada de contrato não ligava a extração, e a revisão dela nunca
mostrava achado. Sem esse conserto, mandar o documento na fila não teria efeito nenhum.

## Decisão

**Esta ADR revoga o ponto 5 da ADR 0016.** A ADR 0016 permanece aceita e não é reescrita — uma ADR
aceita é registro histórico; a nova é que revoga o ponto. Os demais pontos da ADR 0016 (a volta em
toda tela empilhada, a escolha múltipla, a fila, e sobretudo o ponto 4 — *nada gravado antes do
fim*) continuam vigentes e **preservados** por esta decisão.

**Caminho escolhido: (a) upload inline dentro do grupo `(onboarding)`.** Na variante de fila, cada
dívida ganha um "Mandar o documento" **opcional**. Ao escolher o arquivo, a extração roda **ali
mesmo** — reusando `SeletorDeArquivo`, `useEnviarContrato` e `useExtracao` com o polling que já
existe (teto de 2 min) —, sem nenhum `router.push` para fora de `(onboarding)`. Os quatro estados
(enviando, lendo, falhou/erro, lido) são tratados inline. Quem não tem o documento de uma dívida
segue só pelo valor, como antes.

**Por que não (b), a fila persistida entre rotas.** A alternativa seria gravar a fila num estado
que sobrevivesse à ida a `/dividas/contrato` e à volta. Ela foi descartada porque atravessa o
invariante mais caro do onboarding: hoje a fila mora inteira na tela (estado local de
`entrada.tsx`), e *nada é gravado antes do fim*. Persistir a fila entre rotas cria uma segunda
fonte da verdade sobre dados reais do usuário — com todas as perguntas de ciclo de vida, expiração
e reconciliação que a ADR 0016 ponto 4 existe para não ter. O caminho (a) não move a fila; ele traz
a leitura para dentro dela.

**Como o invariante "nada gravado antes do fim" sobrevive.** A extração **não é criação de dívida**.
Rodar a leitura grava uma linha `extracao` (arquivo lido e descartado — ADR 0005), nunca uma
`divida`. Quando a pessoa confirma a revisão, os campos propostos e o `extracaoId` entram apenas no
**estado local** da `Resposta` daquela dívida — nada vai ao servidor como dívida. O POST de todas
as dívidas continua saindo junto, uma vez, no `enviarTudo()` do último passo. Voltar na fila,
corrigir, trocar o documento: tudo continua reversível e local.

**Como o guardrail 8.1 é honrado na fila.** A revisão inline não mostra só os dois campos: ela
espelha a tela `contrato/[id].tsx` — `linhasDeRevisao` + `CampoRevisao`, **campo a campo com o
trecho de origem à vista**, como texto puro (guardrails 8.1 e 8.2). Só depois de a pessoa confirmar
é que a `Resposta` recebe os campos, e recebe **via `extracaoParaProposta`**: campo sem trecho é
descartado, mesmo trazendo valor. O `extracaoId` é a exceção declarada — não é campo lido, é a
chave da leitura —, e por isso viaja sempre que houver leitura. O aviso de descarte do arquivo
aparece **antes** do toque que abre o seletor (guardrail 8.3).

## Consequências

+ A limitação #15 do `docs/inventario.md` **fica resolvida**: quem marca várias dívidas pode mandar
  o documento de cada uma na primeira sessão e receber a triagem inteira — valor justo, achados com
  fonte, script — em vez da versão pobre. (A consolidação do inventário é do orquestrador; esta ADR
  apenas aponta o item como resolvido.)
+ A ligação dívida→extração passa a valer para **os dois** caminhos que nascem de documento: a tela
  de revisão e a fila do onboarding. O conserto do `extracaoId` no cliente (o tipo `NovaDivida`, o
  `extracaoParaProposta`, o `DividaForm`) beneficia inclusive o fluxo de uma dívida, que antes
  também não ligava.
− **O passo da fila fica mais longo** para quem manda documento. A leitura é assíncrona, então a
  fila **espera/polla** — os quatro estados existem justamente para essa espera não parecer
  travamento. É o mesmo teto de 2 min do fluxo de contrato, com a mesma saída ("seguir só pelo
  valor") quando demora.
− A leitura inline assume o documento como **contrato** (o tipo que produz os achados que motivam a
  decisão). Um seletor de tipo de documento dentro da fila — como o da tela cheia — fica como não
  objetivo: a variante de uma dívida, que empurra para `/dividas/contrato`, continua sendo o
  caminho com escolha de tipo completa.
− A `Resposta` da fila deixou de ser só `{ credor, valor, dataOrigem }`: ganhou `extracaoId` e a
  taxa lida, carregados por fora do formulário. É estado local a mais, mitigado por continuar sendo
  local e descartável.
