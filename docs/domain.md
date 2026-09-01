# Domínio — linguagem ubíqua

> Documento vivo. Cada termo é definido **uma vez** aqui, e esse nome é usado no código, no
> contrato de API e na copy da interface. Divergência de vocabulário entre camadas é como bug
> de negócio nasce.

Convenção de idioma: **infraestrutura em inglês** (`request`, `client`, `ApiError`),
**domínio em português** (`Divida`, `valorCobrado`, `CriticidadeTipo`). É o padrão já
estabelecido em `src/api/types.ts` — mantenha.

---

## 1. Dívida

### Divida
Uma obrigação financeira do usuário com um terceiro. Unidade central do produto.
Tipo em `src/api/types.ts`.

### credor
Quem cobra. String livre, informada pelo usuário ou extraída pelo backend. Na UI, sempre o
nome como o usuário reconhece ("Nubank", "Banco Teste S/A"), não a razão social completa.

### valorCobrado
O que o credor está pedindo hoje, **em centavos**. É o número que aparece na cobrança. Informado
pelo usuário.

### valorCorrigido
O que o valor original vira depois da correção legítima aplicada pelo backend, **em centavos**.
Opcional — pode não ter sido calculado ainda. **Nunca calculado no cliente.**

### valorJusto
**Não é estimativa.** É `valorCobrado` menos a soma dos [achados](#achado) que têm valor, cada um
com fonte legal própria. **Em centavos**, calculado no backend (`domain/revisao.py`).

A leitura antiga — "quanto o backend estima que a dívida deveria custar" — foi abandonada na
**ADR 0008**: não existe lei que diga quanto uma dívida deveria custar, e produzir esse número
seria inventar regra financeira. Hoje o campo só existe quando há do que subtrair.

**Ausente (`null`) quando nenhum achado tem valor** — nunca igual a `valorCobrado`, porque isso
afirmaria "conferimos e está tudo certo". Aparece no `ValorJustoCard` e na tela de revisão, sempre
com o disclaimer de estimativa educacional. Continua não sendo sentença: é ponto de partida para
negociar.

### achado
Um ponto concreto do contrato que **vale contestar**. Carrega sempre `fonte` (artigo, súmula ou
resolução), `comoConferir` (a pergunta de fato que só o usuário responde) e, quando veio da
leitura do contrato, `evidencia` — o trecho **literal**.

Duas classes, e a diferença é o que separa um número de um alerta:

- **com valor** (`valorContestavel`): o montante é direto no contrato — a multa em excesso, a
  tarifa, o prêmio do seguro. Entra na subtração de `valorJusto`.
- **sem valor**: quantificá-lo exigiria reamortizar o contrato inteiro. Aparece na tela, com
  fonte, e **não** mexe no número.

**Postura obrigatória:** achado é convite a investigar, jamais sentença — mesmo regime de
`possivelPrescricao`. Copy correta: "vale contestar". Copy proibida: "é ilegal", "é abusivo",
"você tem direito a receber de volta".

### modalidade
Que **produto de crédito** o contrato é: `consignado_inss`, `consignado_privado`,
`cartao_consignado`, `pessoal`, `rotativo` ou `financiamento`. Coisa diferente de
[`CriticidadeTipo`](#criticidade), que classifica pela consequência de não pagar. A revisão
precisa da modalidade: teto de juros de consignado só se aplica a consignado.

### economia
`valorCobrado − valorJusto`. A única subtração que o front faz, porque é a diferença literal
entre dois números que o backend já enviou — não é regra de negócio.

### dataOrigem
Quando a dívida nasceu (`IsoDate`). Base do cálculo de prescrição, feito no backend.

### possivelPrescricao
Booleano opcional. **Um alerta para investigar, jamais uma afirmação de que prescreveu.**
Copy correta: "pode ter prescrito — vale checar". Copy proibida: "esta dívida prescreveu".

### saldoDevedor
Quanto ainda falta pagar de uma dívida, **em centavos**, considerando o que já foi quitado.
Vem do backend.

---

## 2. Criticidade

`CriticidadeTipo` classifica a dívida por consequência de não pagar. É o que define a ordem de
ataque e o tom da interface. Quatro valores, definidos em `src/api/types.ts`:

| Valor | Significado | Postura do produto |
|---|---|---|
| `essencial` | água, luz, gás, aluguel | Nunca sacrificar. Perder isso é perder o básico da vida. |
| `com_garantia` | financiamento de casa ou carro | Risco de perder o bem. Prioridade alta, mas negociável. |
| `juros_abusivos` | rotativo do cartão, cheque especial | Atacar primeiro. É o que cresce mais rápido. |
| `consumo` | varejo, cartão comum, parcelamento | Menor urgência. Espaço para negociar desconto. |

A criticidade não é uma nota de julgamento moral sobre o gasto. É uma medida de consequência.
A copy nunca sugere que o usuário errou ao contrair a dívida.

### mínimo existencial
A parcela da renda que não pode ser comprometida com dívida porque cobre necessidades básicas.
Hoje é um **valor fixo de R$ 600,00** definido por decreto (11.150/2022, art. 3º, na redação do
11.567/2023) — não é 25% do salário mínimo, que era a redação anterior. O backend o fornece; o
painel o exibe como limite. Nenhuma sugestão do assistente pode propor um plano que o invada.

**Não confundir com custo de vida.** O mínimo existencial é um **piso legal de proteção contra
o credor**, não o quanto uma pessoa precisa para viver. Quem tem aluguel, carro e filhos gasta
muitas vezes esse valor. Usar o piso como se fosse custo de vida produz uma margem otimista e um
plano que a pessoa não consegue honrar.

### comprometimento de renda
Percentual da renda mensal já destinado a pagamento de dívida. Calculado no backend.

A renda é a **líquida do caixa** — soma das fontes ativas, menos o imposto que o usuário informou
reservar. Sem caixa preenchido, cai na renda do perfil. O limite de 30% se lê sobre o que de fato
entra: para quem é PJ, tratar o bruto como renda faz a pessoa comprometer o dinheiro que vai
faltar na apuração.

### capacidade
Quanto sobra por mês, de verdade, para pagar dívida — depois de imposto, custo de vida,
provisões e os potes que o usuário definiu. É o número que o módulo de caixa existe para
produzir, e o teto de tudo que o produto propõe. Vem em dois: **capacidade hoje** (sem mudar
nada de vida) e **capacidade máxima** (cortando o não essencial). A diferença entre as duas é a
alavanca do usuário; o app a mostra e não puxa por ele. Pode ser negativa, e o negativo é a
informação.

### essencial
Gasto que a pessoa não consegue cortar sem perder o básico — moradia, alimentação, transporte,
contas, saúde, dependentes. Não confundir com **mínimo existencial**, que é piso legal. Quem
classifica é o usuário, não o app.

### provisão
Dinheiro separado todo mês para uma despesa anual conhecida — IPVA, seguro, licenciamento. O
aporte divide o que falta pelos **meses restantes até o vencimento**, nunca por 12 fixo: quem
começa em agosto com IPVA em janeiro tem cinco meses, e dividir por doze deixa a pessoa curta
justamente no mês que a provisão existe para proteger.

### renda típica
A renda que o plano deve suportar quando o mês é ruim — a **menor** dos últimos recebimentos
registrados, não a média. Dimensionar pela média quebra o plano em todo mês fraco, e quem ganha
por hora tem mês fraco. Sem histórico, é o valor que o usuário informou, e a tela diz qual das
duas origens está em uso.

Ela é apurada **por fonte** e somada: uma fonte fixa não é puxada para baixo pelo pior mês de uma
variável, e um mês zerado derruba só a fonte dele. Quando a origem é o histórico, o **mês âncora**
— o `AAAA-MM` do recebimento que produziu o menor valor — viaja para a tela (F-011, ADR 0021), que
passa a dizer "seu plano está dimensionado pelo seu pior mês, que foi março" em vez de deixar a
capacidade despencar sem explicação. A regra do `min()` não muda; só passa a contar de onde o
número veio.

### tipo de renda
De que natureza é a fonte. Existe porque praticamente todo app financeiro brasileiro assume
salário fixo no dia 5, e metade deste público não tem isso. Desde a F-011 (ADR 0021) o tipo tem
efeito de domínio — antes era coluna gravada e nunca lida —, e cada um dos **seis** valores muda o
que o app pergunta e o que ele reserva. Nenhum coeficiente é inventado: o comportamento é decisão
de produto, e o **valor** de tudo é dado do usuário.

| Valor | O que o app faz de diferente |
|---|---|
| `clt` | Líquido mensal fixo, mais os eventos previsíveis do calendário — 13º (Lei 4.090/1962) e férias com o terço (CF art. 7º, XVII). Eles têm mês e **valor declarados pelo usuário**, e **não entram na cascata** nem na janela do `min()`: são munição de negociação à vista (ADR 0021). FGTS é evento do CLT, mas não é renda disponível para quitação e fica de fora |
| `pj_hora` | Taxa × horas, menos o imposto que o usuário informou. Sem `impostoBps` na fonte **nem** no perfil como fallback, **nada é reservado e a tela diz que não está reservando** (`impostoNaoDeclarado`, ADR 0009) — nunca `R$ 0,00` como se fosse reserva |
| `autonomo` | Trabalha com a [renda típica](#renda-típica). O compromisso mensal é **percentual do que entra**, nunca valor fixo |
| `beneficio` | Valor fixo com **dia de pagamento próprio** — que não é o dia 5 de ninguém. O reajuste **não é projetado** (varia por ano e espécie): o usuário atualiza o valor quando ele muda |
| `aluguel` | Renda variável cuja queda característica é a **vacância** — um mês vago é um recebimento zero como qualquer outro. A taxa de vacância **não é estimada**: é fato do histórico do usuário |
| `outro` | Comportamento genérico, sem regra específica — e a tela **diz** que é genérico, em vez de forçar um molde que não é o da pessoa |

**Renda variável não promete valor fixo.** Prometer "R$ 500 todo mês" a quem é autônomo é receita
de plano quebrado no primeiro mês fraco. O compromisso vira percentual do recebimento, e em mês
fraco a meta **se ajusta sem drama** — o plano se adapta, não quebra.

**A alíquota desce para a fonte** (F-011, ADR 0021): `fonte_renda.impostoBps` é opcional e, quando
ausente, aplica o `impostoBps` do perfil como fallback — nenhum dado migra, e quem tem uma alíquota
só continua com o número idêntico. O **compromisso percentual** é pote novo em bps, ao lado da
reserva e da aposentadoria, subtraído antes de `capacidadeMaxima` e incidindo sobre a renda
**líquida** típica; quem não declara não tem, e a cascata dele fica idêntica à de hoje.

### respiro
A fatia da capacidade reservada para lazer e autocuidado, desde o primeiro plano. **É linha da
cascata, no mesmo nível do aluguel — não é sobra.**

Existe por uma razão de aderência, não de generosidade: austeridade total é a principal causa de
desistência, e é o que faz uma quitação de dezoito meses virar "perda total" aos olhos de quem a
vive. Quando o app diz "está no plano", duas coisas acontecem — a culpa morre, e o Tino passa a
ser o terceiro que autoriza, o que desarma o policiamento mútuo dentro de casa.

**Quem diz o valor é o usuário** (ADR 0019). O respiro é declarado, como um gasto ou um pote, e o
app responde com a única coisa que sabe de verdade: quantos meses a mais de quitação aquele valor
custa. Não existe percentual default, nem faixa sugerida — seria coeficiente de alocação sem fonte,
proibido pela ADR 0009. Consequência aceita: **quem não declara não tem respiro**, e a cascata dele
não muda.

Ele é subtraído **antes de `capacidadeMaxima`**, que é o cenário em que todo o não essencial foi
cortado. É essa posição que o torna imune ao aperto: descontá-lo depois faria dele a sobra que some
quando aperta.

O respiro **escala com o marco**: sorvete → jantar a dois → bate-volta de fim de semana. Isso
acontece por **acúmulo, não por fórmula** — quem chega ao terceiro marco tem três meses de respiro
guardado. Não há tabela de escala, e não vai haver. Ver `guardrails.md`, seção 4.1, para as regras
de copy que o protegem.

Não confundir com `RESPIRO_EM`, em `src/components/ui/Brand.tsx`: aquilo é a área de respiro
*tipográfica* da marca, e não tem relação nenhuma com este verbete.

### marco
Um ponto da rota que dispara celebração e libera respiro: primeira negociação fechada, primeira
dívida quitada, 25%, 50% e 75% da rota. É a intervenção anti-desistência do produto — o mês 4 é
onde as pessoas param, e o marco existe para dar ganho visível antes disso.

Marco é **conquista, nunca recompensa condicionada**. A copy é de permissão ("aproveita, está no
plano"), jamais de mérito ("você mereceu").

**Marco é evento persistido, não predicado.** Ele é gravado quando o gatilho ocorre e fica gravado —
nunca recalculado sobre o estado atual. A distinção não é técnica: a porcentagem da rota anda para
trás quando o usuário cadastra uma dívida nova, e um marco recalculado se **desfaria**. A pessoa
perderia uma conquista por ter sido honesta sobre a própria situação, que é o oposto exato do que
este produto faz.

Atingir e celebrar são momentos separados. Um marco alcançado com o app fechado, ou durante o
período somente leitura da assinatura, **não se perde**: ele espera a tela.

### meta
O objeto da fase pós-quitação — a **Rota de Chegada**. Mesmo motor determinístico da rota de
fuga, com o sinal invertido: valor alvo mais prazo produzem o aporte mensal necessário, e a barra
enche de verde rumo ao objetivo em vez de esvaziar a dívida.

Uma `Meta` tem `nome`, `emoji` opcional, `valorAlvo` (centavos), `saldo`, `dataAlvo` (`AAAA-MM`) e
`aporteMensal` — o que a pessoa **declara** separar. Nome livre: reserva de emergência, viagem,
carro, estudo, aposentadoria são sugestões de copy, não um enum. **A reserva de emergência é sempre
a primeira meta sugerida** — é ela que impede a recaída de virar dívida nova.

**NÃO CONFUNDIR com os campos de `PUT /v1/caixa/metas`** (imposto, reserva, aposentadoria), que são
parâmetros da **cascata** do caixa e decidem quanto sai do mês. Uma meta é um objetivo com prazo;
aqueles são potes mensais, e metas nomeadas não entram em cálculo de capacidade nenhum. Os dois
sentidos convivem por decisão explícita (ADR 0017): unificar obrigaria a recalcular a cascata. Na
tela, um é "Seus potes" e o outro é "Suas metas".

### aporte sugerido
O que separar por mês para a meta fechar no prazo: **o que falta dividido pelos meses que faltam**,
arredondado para cima — o mesmo método de [provisão](#provisão). `domain/metas.py`.

**Não tem fonte legal, e o módulo declara isso.** Não existe norma que diga quanto alguém deveria
guardar para trocar de carro. O que o produto faz é aritmética sobre números que o usuário informou:
seria invenção afirmar quanto ele *deveria* guardar, ou projetar rendimento que ninguém informou.

**Sem `dataAlvo` o valor é ausente**, não estimado: sem prazo não existe divisor, e inventar um
horizonte produziria um número que a pessoa levaria a sério.

### situação da meta
`em_dia` quando o aporte declarado cobre o sugerido, `aporte_baixo` quando não, `atingida` quando o
saldo chega no alvo — e **ausente** quando falta prazo *ou* falta aporte declarado. Nos dois casos
de ausência o app não tem base para dizer que alguém está atrasado, então não diz, e a tela não
exibe selo em vez de exibir palpite.

`aporte_baixo` é **âmbar, nunca vermelho**: vermelho é status de dívida (ADR 0015), e gastá-lo em
"você está guardando pouco" transformaria a tela de conquista em repreensão.

### não fecha
As parcelas mínimas das dívidas excedem a capacidade máxima. É **fato aritmético sobre os
números que o usuário informou**, não diagnóstico. O produto nunca diz "você está
superendividado": a definição legal (CDC art. 54-A, § 1º) exige boa-fé e dívida de consumo, que
software não apura. A copy nomeia a repactuação como caminho a investigar, no tom de
`possivelPrescricao`.

Desde o M14 o fato aparece em **duas** telas — Caixa e Rota —, e nas duas com a mesma frase: o que
a subtração deu, e o caminho. Na **triagem do onboarding** ele não aparece, e a ausência é
deliberada: ali a renda ainda não foi informada, então o app não tem os dois lados da conta. O que
a triagem faz, para quem marcou duas ou mais dívidas, é **convidar** — "informe sua renda e eu
mostro se as parcelas cabem". Afirmar sem os dois lados seria inventar o diagnóstico que o
parágrafo acima proíbe.

### repactuação
O caminho previsto no CDC, art. 104-A (incluído pela Lei 14.181/2021): uma audiência com **todos os
credores de uma vez**, em que o consumidor apresenta um plano de pagamento de até cinco anos,
preservado o mínimo existencial. A fase conciliatória também corre nos órgãos do Sistema Nacional
de Defesa do Consumidor — Procon —, sem precisar começar pelo Judiciário (art. 104-C).

**O produto NOMEIA o caminho; ele não afirma que a pessoa se enquadra.** O enquadramento exige
boa-fé e dívida de consumo, apurados caso a caso na conciliação, e a lei exclui do tratamento
dívida com garantia real, financiamento imobiliário, crédito rural, dívida contraída com fraude ou
má-fé e compra de luxo de alto valor. Nada disso é apurável por software.

### fonte
Uma norma citável, com **id estável** no registro de `backend/juridico/fontes.py`: norma,
dispositivo, ementa (frase nossa), texto literal quando conferido, vigência e link para o Planalto.

O id é o que viaja na API; o texto vem de `GET /v1/juridico/fontes`. **O registro é exatamente o
que alguma regra cita** — fonte guardada "porque um dia serve" é convite a citá-la sem que ninguém
tenha decidido que ela se aplica, e há teste que falha se alguma ficar órfã.

### trilha ("como calculamos")
A explicação de **um** número derivado: a fórmula em palavras, os passos, os ids das fontes e — o
campo que mais importa — as **limitações**: o que aquela conta não faz.

**A trilha não carrega valor nenhum.** Os números vivem uma vez só, no campo que a resposta já traz
ao lado; duas cópias divergiriam, e a tela mostraria uma sobra na cascata e outra na explicação da
cascata.

---

## 3. Pagamento

### parcela
Uma prestação de uma dívida: número da parcela, valor em centavos, vencimento e situação.

### situação da parcela
`pendente` · `paga` · `atrasada`. "Atrasada" é um fato de calendário, não um juízo — a UI usa
tom neutro, nunca alarme vermelho.

### plano de pagamento
O cronograma de parcelas de uma dívida, com o que já foi pago e o que falta. É a tela de M3.

### aporte extra
Valor que o usuário consegue destinar por mês **além** das parcelas mínimas. É o insumo
principal do simulador: sem aporte extra, a única variável é a ordem de pagamento.

### renegociação
Registro de que a dívida mudou de condições — novo valor, novo prazo, novo número de parcelas.
Não apaga o histórico anterior; substitui as condições vigentes.

### quitação
Encerramento da dívida. Ação explícita do usuário, irreversível na prática — exige confirmação
(ver `guardrails.md`, seção 7.2).

---

## 4. Estratégias de quitação

Ambas as simulações são calculadas no backend (`POST /v1/dividas/simulacoes`). O front só
compara os dois resultados lado a lado.

### avalanche
Paga primeiro a dívida de **maior taxa de juros**. Matematicamente ótima: é a que gera a maior
economia total de juros.

### bola de neve
Paga primeiro a dívida de **menor saldo**. Matematicamente pior, psicologicamente melhor: cada
dívida encerrada é uma vitória visível, e isso sustenta a aderência ao plano.

O produto não impõe uma das duas. Apresenta as duas, mostra a diferença em reais e em meses, e
deixa o usuário escolher — a estratégia que ele não abandona vale mais que a ótima no papel.

### data de liberdade
O mês em que, mantido o plano, a última dívida é quitada. Vem do backend. É o número emocional
central do simulador — trate-o com destaque de acento violeta, não com alarme.

---

## 5. Chat

### Tino
O assistente do produto. Nome próprio — leva artigo ("o Tino sugere", "pergunte ao Tino") e
flexiona em português, ao contrário do nome anterior, que era substantivo comum em inglês (ADR
0020). Fala como um amigo que entende de dinheiro: direto, acolhedor, nunca alarmista.

Nunca afirma número que não veio de um [ActionCardData](#actioncarddata) tipado — todo valor
que ele comunica chega por card, nunca como texto livre (guardrail 7.1).

### ActionCardData
União discriminada por `kind` (`src/api/types.ts`). É o mecanismo pelo qual dado estruturado
entra na conversa. **Todo número que o assistente comunica vai num card**, nunca no texto livre
da mensagem.

Cards existentes: `valor_justo` (os pontos contestáveis de uma dívida, M6), `info`,
`divida_resumo`, `plano_sugerido` e `divida_proposta` — o rascunho que abre o formulário para o
usuário confirmar, nunca uma gravação.

### script
Mensagem pronta de negociação, gerada no backend. Apresentada como sugestão copiável e
editável, nunca como algo que o app envia sozinho.

### canal
Por onde a negociação acontece. Três valores, e o **mesmo motor de valor justo** produz os três —
muda o formato, nunca o número:

| Valor | Formato | Por que é diferente |
|---|---|---|
| `telefone` | Fala corrida, mais objeções comuns com resposta pronta | Pressão em tempo real; quem trava, perde |
| `chat` | Mensagens curtas, uma ideia por bloco, copiáveis uma a uma | O atendente não lê parágrafo. E o que se escreve fica registrado contra quem escreveu |
| `email` | Texto estruturado, formal | Serve para registrar contraproposta e vira insumo do dossiê de Procon |

Duas regras valem para os canais escritos, e elas são de segurança, não de estilo:

- **Abre sempre com a validação do canal.** Confira o número no site oficial do credor; nunca
  negocie com número que entrou em contato primeiro. Golpe de falsa negociação por WhatsApp é
  epidêmico, e o alvo preferencial é exatamente quem está endividado.
- **Fecha sempre com a regra de pagamento.** Boleto ou Pix **em nome do credor** (CNPJ), jamais
  CPF de pessoa física.

O script escrito **nunca revela na primeira mensagem quanto o usuário pode pagar** e sempre pede
a proposta por escrito com número de protocolo. No canal escrito isso é de graça, e é o que
sustenta uma reclamação depois.

### fundamentos
Lista de embasamentos curados (por exemplo, artigos do CDC) que sustentam o valor justo. São as
`fonte` dos [achados](#achado), deduplicadas. Texto vindo do backend — o front nunca compõe
citação legal localmente.

---

## 6. Conta

### conta
O registro de quem usa o app: e-mail e senha. Coisa diferente de **tenant** — a conta é quem
entra, o tenant é de quem são os dados. Hoje há uma conta por tenant; conta compartilhada seria
duas contas apontando para o mesmo tenant, e o modelo já a suporta.

Na interface, dizemos "sua conta", nunca "seu usuário": usuário é palavra de quem escreve
software.

### sessão
Um aparelho autenticado. É o que **logout, troca de senha e exclusão de conta encerram** — no
servidor, não só no aparelho. O usuário vê a palavra em duas frases: "encerra a sessão em todos
os aparelhos" e "sua sessão terminou".

### acesso · refresh
Os dois tokens (`Sessao`, em `src/api/types.ts`). Nomes de infraestrutura, e por isso **nunca
aparecem na tela**: para o usuário existe estar entrado ou não. Se um deles vazar para a copy,
é bug de texto.

### código
Os seis dígitos da recuperação de senha. Não é "token", não é "PIN", não é "chave" — a tela e o
e-mail dizem "código", nas duas pontas.

### excluir a conta
Apagar tudo, de vez. A copy nunca diz "desativar", "cancelar" ou "encerrar": as três sugerem
algo reversível, e esta operação não é. Ver `guardrails.md`, seção 6.1.
