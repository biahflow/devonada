# ADR 0024 — O corpus jurídico é registro curado com id estável, e a trilha não carrega valor

**Status:** aceito
**Data:** 2026-09-01

## Contexto

O M14 pedia três coisas que pareciam independentes: colocar a **Lei 14.181/2021** no "RAG
jurídico" (issue #13), fazer a triagem **nomear a repactuação** (issue #14), e expor a trilha
**"como calculamos"** na tela (issue #15). Elas não são independentes — as três esbarram no mesmo
buraco.

**Não existe RAG neste repositório**, e o roadmap usa a palavra no sentido de "corpus". O que
existia era fonte em string solta, escrita uma vez no lugar onde cada regra vive:
`fonte="Código de Defesa do Consumidor, art. 52, §1º"` dentro de `domain/revisao.py`, `# FONTE:` em
docstring de `domain/prescricao.py` e `domain/minimo_existencial.py`, `fundamentos` montado à mão
na rota. Cinco achados carregavam cinco strings independentes, e nada garantia que a citação de um
batesse com a do outro nem com a docstring da regra logo acima.

Acrescentar uma norma a um conjunto assim é como a divergência começa. E a issue #15 —
"o backend já tem a fonte no docstring; falta o campo na API" — é literalmente impossível de
cumprir bem sem um lugar de onde ler as fontes: um `comoCalculamos` que repetisse o texto da lei em
cada resposta engordaria todo payload que o app pede o tempo todo, e um que mandasse só a string
solta não daria à tela como abrir a norma.

Havia ainda uma armadilha específica da issue #14. A triagem do onboarding acontece **antes de a
renda ser informada** — a renda mora no Caixa, depois. "Os números não fecham" é
`comprometido > capacidadeMáxima`, e ali a conta não tem os dois lados.

## Decisão

**1. `backend/juridico/` é um registro curado, com id estável — e não um índice vetorial.** Cada
`Fonte` tem `id`, `norma`, `dispositivo`, `ementa` (nossa paráfrase), `texto` (o dispositivo
literal, ou `None`), `vigencia` e `url`. `Achado.fonte` passou a ser **derivado** do registro, e
`Achado.fonte_ids` é uma **tupla** — porque o achado do seguro prestamista sempre se apoiou em
duas normas, que viviam concatenadas numa string que nenhum código conseguia separar de novo.

**Por que não busca semântica.** O guardrail 3 proíbe o assistente de gerar fundamento jurídico:
toda citação que chega ao usuário é escrita à mão e passa pelo gate de revisão por advogado que o
`roadmap.md` lista como pré-lançamento. Recuperar parágrafo de lei por similaridade para um modelo
parafrasear é exatamente o que esse guardrail existe para impedir — a máquina existiria sem ter
consumidor legítimo.

**2. O registro é exatamente o que alguma regra cita.** Fonte guardada "porque um dia serve" é
convite a citá-la sem que ninguém tenha decidido que ela se aplica, e há teste que falha quando
alguma fica órfã. Três entradas que nasceram órfãs nesta própria tarefa — as exclusões do art.
104-A, § 1º, do art. 54-A, § 3º e do art. 4º do Decreto 11.150 — foram **usadas** (viraram
limitações declaradas da trilha), não mantidas por precaução.

**3. A trilha "como calculamos" não carrega valor nenhum.** Ela tem `formula`, `passos`,
`fonteIds` e `limitacoes`; os números continuam no campo que a resposta já traz ao lado. Se a
trilha repetisse os valores, existiriam duas cópias do mesmo dado, e um dia a tela mostraria uma
sobra na cascata e outra na explicação da cascata. Há teste que falha se qualquer dígito aparecer
no texto de uma trilha.

**`limitacoes` é obrigatório, e é a metade que importa.** É ali que o app diz o que a conta **não**
faz: que o mínimo existencial não cresce por dependente, que a prescrição depende de interrupção
que ninguém aqui conhece, que achado sem valor não entra na subtração. Sem esse campo, "como
calculamos" viraria propaganda da própria conta — e o disclosure na tela nunca o esconde.

**4. A repactuação é NOMEADA onde o fato aritmético existe; onde ele não existe, o app convida.**
Caixa e Rota mostram `naoFecha` com a mesma frase — o que a subtração deu, e o caminho. Na triagem
do onboarding, onde a renda ainda não foi informada, a tela **convida** quem marcou duas ou mais
dívidas: "informe sua renda no Caixa e eu mostro se as parcelas cabem". Nada é afirmado.

**Por que não um limiar por número de credores.** Seria o gatilho óbvio para "reconhecer o perfil"
sem depender da renda — e seria um limiar **inventado**. A lei não define quantidade de credores; o
que ela define (CDC, art. 54-A, § 1º) exige boa-fé e dívida de consumo, apuradas caso a caso. Um
"a partir de três dívidas" seria o `valorCobrado * 1.1` de novo, numa tela que manda a pessoa
procurar o Procon.

**5. A palavra que nomeia o instituto não aparece na copy — nem negada.** O teste que quebra em
"superendividado" foi mantido e estendido às trilhas. A primeira redação desta feature escrevia
"isto NÃO diz que você está superendividado", e o gate a recusou com razão: negar um diagnóstico
ainda o planta na cabeça de quem lê. A fronteira é explícita e tem teste próprio: o termo existe
**apenas** nas ementas das quatro normas cujo assunto é o instituto, em `GET /v1/juridico/fontes`,
que descreve a **lei** — não o usuário.

## Alternativas descartadas

**`GET /v1/auditoria/{chave}` sob demanda.** Manteria as respostas magras. Descartada porque cada
abertura do disclosure custaria uma ida à rede, e o app deixaria de mostrar a explicação logo
depois de já ter mostrado o número que ela sustenta — inclusive offline.

**Texto completo das normas embutido em toda resposta.** Mais simples, sem endpoint novo.
Descartada porque repetiria os mesmos parágrafos de lei em todo payload que o app pede o tempo
todo, para um conteúdo que muda uma vez por ano.

**Trilha carregando os valores de cada passo.** Renderizaria uma cascata autoexplicativa sem a tela
precisar cruzar dados. Descartada pela duplicação descrita na decisão 3.

## Consequências

+ As limitações #13, #14 e #15 do M14 ficam fechadas no código: a Lei 14.181/2021 está no corpus,
  a repactuação é nomeada onde o fato existe, e a trilha chega à tela.
+ Existe **um** lugar onde cada norma está escrita, e ele é o mesmo que a tela lê para mostrar
  ementa, vigência e link. A citação parou de ser cinco strings independentes.
+ O usuário passa a ver a **idade** do fundamento junto do link. Era informação que o backend tinha
  e nunca saía do repositório.
− **`Achado` mudou de forma.** `fonte` continua existindo (derivado), mas quem construía um
  `Achado` passando `fonte=` quebra — foi o caso de `tests/test_script.py`, corrigido no mesmo
  commit. É o preço de a citação ter dono.
− **`fonte` e `fonteIds` viajam juntos**, e isso é redundância deliberada: tirar o primeiro
  quebraria app instalado que não conhece o segundo. Ela sai quando não houver mais cliente antigo.
− **O corpus é revisado por humano, e ainda não foi.** As ementas da Lei 14.181/2021 são paráfrase
  nossa, e o `texto` literal ficou `None` nelas justamente por isso. A revisão por advogado que o
  `roadmap.md` já exigia passa a ter um alvo concreto e delimitado: quinze entradas num arquivo.
− A trilha é **texto curado**, então toda regra nova de domínio que produza número exposto deveria
  ganhar a sua. Nada no código obriga isso hoje — é convenção, e o teste só cobre as quatro que
  existem.
