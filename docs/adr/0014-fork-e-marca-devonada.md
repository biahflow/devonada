# ADR 0014 — devo.nada nasce como fork, não como projeto novo

**Status:** aceito
**Data:** 2026-08-10

## Contexto

O produto ganhou marca. `devo.nada` lê-se como duas frases — "Devo. Nada." —, pergunta e
resposta, e o ponto é o elemento que carrega cor de status. A concepção completa (posicionamento,
13 telas, princípios de marca, roadmap em quatro fases) está em `docs/concepcao/` e não é
descartável: ela define coisas que o código não sabia, como o Respiro e o onboarding pelo alívio.

E existe uma data. O lançamento é em **dezembro de 2026**, no curso de finanças de fim de ano de
uma igreja — audiência cativa, no momento do ano em que o brasileiro mais se endivida, e com o
13º recém-caído na mão de quem vai negociar. São ~16 semanas, com o dono atendendo clientes em
paralelo.

Contra isso, o que já existia: M0 a M9 entregues. CRUD de dívidas, ingestão de contrato por LLM,
painel de endividamento, plano de parcelas, simulador de quitação, chat sobre os dados reais,
revisão de cobrança com fonte legal, módulo de caixa, conta de usuário e assinatura in-app.
291 testes Jest e 452 pytest, verdes. Multi-tenant desde o primeiro commit.

Comparando a concepção do devo.nada com o inventário do que estava construído, documento a
documento, sobrou pouca coisa: **o devo.nada é este produto com outra marca, mais um punhado de
funcionalidades que ele não tem.** A concepção descrevia como novidade uma dúzia de coisas que já
eram código verde — cronograma de parcelas, avalanche × bola de neve, mínimo existencial,
achados com fonte legal, cascata da capacidade, provisões anuais.

A tentação era começar limpo. Repo novo, sem herança, com a marca desde o primeiro commit.

## Decisão

**O devo.nada é um fork deste repositório, com o histórico preservado.**

1. **A identidade muda; o domínio não.** `app.json`, `package.json`, o prefixo de ambiente
   (`DEVONADA_*`), o bundle id (`br.com.devonada.app`) e a copy de marca são renomeados. Os nomes
   de domínio — `divida`, `valorCobrado`, `CriticidadeTipo`, `caixa`, `capacidade` — ficam. Eles
   são a linguagem ubíqua de `docs/domain.md`, e renomear por estética quebraria 743 testes sem
   entregar nada ao usuário.

2. **O histórico vem junto.** Os commits dos M0–M9 são o registro de por que cada decisão existe —
   incluindo as três que a leitura do texto primário derrubou no M6 e o mínimo existencial errado
   que o M7 encontrou em produção. Um repo novo começaria sem esse registro, e a primeira
   pergunta "por que isso é assim?" não teria resposta.

3. **"Buddy" sobrevive como nome do assistente, não do produto.** A concepção do devo.nada já
   chama o assistente de buddy em toda a copy. A palavra sai da marca e fica na persona.

4. **A numeração de milestone continua.** O próximo é M10, não M1. A obra é a mesma.

5. **As ADRs anteriores não são reescritas, nem para corrigir o nome de uma variável.** A varredura
   do rename chegou a trocar `BUDDY_*` por `DEVONADA_*` dentro das ADR 0006 e 0007, e foi
   revertida. A regra de imutabilidade não abre exceção para renomeação cosmética: quem lê uma ADR
   quer saber o que era verdade quando a decisão foi tomada. **Esta ADR é o lugar onde se descobre
   que o prefixo mudou** — as anteriores continuam dizendo `BUDDY_*` porque era isso que existia.

## Consequências

+ O MVP de dezembro começa com a maior parte pronta e testada. O que sobra para as 16 semanas é o
  que a concepção trouxe de novo, não a reconstrução do que já funciona.
+ As decisões que teriam custado reescrita na véspera já estão certas: multi-tenant desde o
  primeiro commit, nenhum segredo no bundle, todo cálculo no servidor, conta e assinatura
  entregues.
+ A postura jurídica — achado com fonte, nunca afirmação de ilegalidade, testes de copy que
  quebram em "ilegal" e "é seu direito" — vem junto de graça, e é justamente o que mantém o
  produto do lado certo da linha do art. 1º da Lei 8.906/94.

− O repositório carrega, para sempre, commits com o nome de um produto que não existe mais. É
  ruído de leitura, e é barato perto de perder o porquê das decisões.
− Quem chegar ao projeto vai encontrar documentação escrita para outra marca até que cada
  documento seja revisado. A varredura é mecânica, mas não é instantânea.
− O `docs/inventario.md` nasceu datado e agora está mais datado ainda. Ele mesmo avisa que é o
  último a saber.
