# ADR 0021 — O tipo da renda ganha efeito por adição, e o canal decide quando a oferta é dita

**Status:** aceito
**Data:** 2026-08-20

## Contexto

O M12 foi partido em duas Feature Contracts — [F-011](../features/F-011-renda-tipada/feature.md),
renda tipada e compromisso percentual, e [F-012](../features/F-012-negociacao-por-canal/feature.md),
negociação por canal e registro de resultado. As duas ficaram em `SPEC_IN_PROGRESS` com **sete
incógnitas de modelagem** nomeadas e nenhuma respondida, porque quatro delas mexem na cascata de
`domain/caixa.py` que o M11 acabou de tocar, e uma é um conflito entre o `domain.md` e o código
**que já está no ar**.

Esta ADR fecha as sete. Ela não decide como implementar: decide o que é verdade sobre o modelo,
que é o que faltava para o Planner poder entrar.

### Três coisas que a leitura do código corrigiu antes de decidir

Os contratos foram escritos a partir do que os documentos dizem. O código diz três coisas
diferentes, e as três mudam a decisão:

**1. A renda típica já é apurada por fonte, não sobre o total.** `leitura.montar_entrada_caixa`
roda `renda_tipica()` fonte a fonte e soma os resultados, com o comentário explicando por quê:
*"uma fonte fixa não pode ser puxada para baixo pelo pior mês de uma fonte variável"*. Metade do
que a incógnita do "mês zerado" descreve como problema já está resolvido — um mês zerado derruba
**só a fonte dele**. Quem tem uma fonte só continua exposto.

**2. O `imposto_bps`, esse sim, é global de verdade.** Ele vive em `Perfil`, uma linha por tenant,
e `calcular_caixa` o aplica sobre a renda bruta **somada**. Não é detalhe de implementação: é a
única coisa da cascata que não sabe de qual fonte o dinheiro veio.

**3. O conflito do F-012 é literal, e é de uma linha.** `montar_script` faz
`linhas.insert(-1, "…consigo comprometer até R$ X por mês…")` para qualquer destino, e o verbete
`canal` do `domain.md` diz que o script escrito *"nunca revela na primeira mensagem quanto o
usuário pode pagar"*. O mesmo texto vai para a tela de revisão e para o card `valor_justo` do
chat. Não é pergunta em aberto: é comportamento em produção contra o documento canônico.

### A força que atravessa as sete

`fonte_renda.tipo` **já existe e não faz nada**. É coluna desde o M7, validada em seis valores,
gravada e devolvida pelo CRUD — e `grep -rn "pj_hora\|autonomo" backend/domain/ backend/leitura.py`
volta vazio. O usuário já escolheu, o banco já guardou, e o plano trata CLT e autônomo igual.

Isso torna o M12 diferente do M11 em um ponto que decide quase tudo o que vem abaixo: **o respiro
nasceu vazio, e o tipo de renda nasce preenchido**. Dar efeito a este campo muda o plano de quem
já usa o app, retroativamente. Toda decisão desta ADR é tomada sob essa restrição.

## Decisão

### 1. A alíquota desce para a fonte por adição, com o `Perfil` como fallback

`fonte_renda` ganha `imposto_bps` **nullable**. Sem valor na fonte, aplica-se o `Perfil.imposto_bps`
de hoje, exatamente como hoje.

Nenhum dado migra e ninguém muda de número em silêncio: quem tem uma alíquota só continua com o
resultado idêntico, campo a campo. Quem tem CLT mais contrato PJ passa a poder dizer as duas —
que é o que a UX do `pj_hora` promete e o modelo não entregava.

A consequência aritmética é que o imposto deixa de ser uma multiplicação sobre a soma e passa a
ser somatório por fonte. Onde a fonte não declara, a parcela dela usa a alíquota global; a conta
antiga é o caso particular em que nenhuma fonte declarou.

Mover de vez — apagar `Perfil.imposto_bps` e copiar o valor para as fontes na migração — foi
recusado por ser mudança de propriedade de dado com migração de valor em produção, custo que a
feature não precisa pagar para entregar o que promete. Fica como caminho aberto se a coluna global
virar peso morto depois.

### 2. 13º e férias são evento previsível, e não encostam na cascata

Entram como **entidade própria**: tipo, mês previsto e valor **declarado pelo usuário**. Não somam
à renda mensal, não entram na cascata e não ocupam vaga na janela do `min()`.

O que o app faz com eles é o que `domain.md` já diz que eles são — **munição de negociação à
vista**: o app reconhece que existem e quando caem, e o valor continua vindo do que o usuário
declara. Nenhum coeficiente de projeção entra aqui.

Reusar `Recebimento` era a saída barata e foi recusada por um detalhe do modelo: ele é único por
fonte e por mês, e a janela do `min()` tem seis posições. O 13º lançado como recebimento de
dezembro não muda o `min()` — é o maior valor, não o menor — mas **consome uma vaga da janela** e
deixa no histórico um dezembro que não se repete. Corrompe o dado que a renda típica lê para
economizar uma tabela.

Diluir por doze foi recusado sem discussão: contradiz frontalmente a razão de a renda típica ser
o pior mês.

### 3. O mês zerado continua zerando, e a tela passa a dizer qual mês foi

`renda_tipica` não muda: `min()` sobre a janela de seis, mínimo de três amostras. A vacância do
aluguel e o mês sem trabalho do autônomo entram como o que são — um recebimento zero —, e a renda
típica daquela fonte vai a zero.

O que muda é o que o app **conta** sobre o número: a origem já viaja para a tela, e passa a viajar
com ela o mês que ancorou o valor. Ver "seu plano está dimensionado pelo seu pior mês, que foi
março" é informação; ver a capacidade despencar sem explicação é o app quebrando na cara de quem
teve um mês ruim.

Ignorar zeros na janela foi recusado por dois motivos independentes. É alteração da definição de
renda típica, que o próprio F-011 declara **fora de escopo**; e "ignorar" é o app decidindo que um
fato do usuário não conta — a mesma classe de coisa que a ADR 0009 proíbe, com outra roupa. Se a
prática mostrar que o conservadorismo aqui é excessivo, isso vira ADR própria, com o dado de uso
na mão.

`nao_fecha` continua sendo fato aritmético e nunca diagnóstico de superendividamento. O teste de
copy que quebra na palavra continua valendo.

### 4. Compromisso percentual é pote novo, aditivo, e não converte os que existem

Campo novo em **bps**, ao lado de `reserva_aporte` e `aposentadoria_aporte`, subtraído na **mesma
posição** da cascata — antes de `capacidade_maxima`, junto aos potes e ao respiro:

```
capacidade_maxima = liquida − essenciais − provisao − reserva − aposentadoria − respiro − percentual
```

Incide sobre a **renda típica**, e é isso que mantém o plano dimensionado pelo pior mês. Percentual
sobre o recebimento do mês faria o compromisso oscilar dentro do mês, e a capacidade com ele.

Converter os dois potes existentes em "valor OU percentual" foi recusado: mexe em coluna com dado
em produção e dá dois estados a cada pote, que é dobro de UX e dobro de teste para a mesma
entrega. Vale a mesma regra da 0019 — **quem não declarar não tem**, e a cascata de quem não
declarou é idêntica à de hoje.

### 5. O canal decide **quando** a oferta é dita — o número é o mesmo nos três

O código e o `domain.md` param de discordar, e quem cede é o código:

- **`telefone`** — a oferta continua na fala, onde ela sempre esteve. Conversa em tempo real não
  tem segunda mensagem.
- **`chat`** — a oferta sai do bloco de abertura e vira **bloco separado**, marcado para uso
  depois de receber a proposta do credor.
- **`email`** — o primeiro e-mail vai sem oferta, e ao lado dele fica pronto o texto do segundo,
  para quando a contraproposta chegar.

O motivo é o do verbete, e é de negociação, não de estilo: quem diz primeiro quanto pode pagar
entrega a âncora da conversa. No canal escrito isso fica registrado contra quem escreveu.

O `valorJusto` e os achados são **idênticos nos três canais** — muda o formato e o momento, nunca
o número. E os três abrem com a validação de canal e fecham com a regra de pagamento.

Isto **altera comportamento que está no ar** hoje, nas duas superfícies que o `montar_script`
alimenta: a tela de revisão e o card `valor_justo` do chat. É mudança deliberada, e é o item desta
ADR com efeito imediato sobre usuário existente.

### 6. Resultado de negociação é entidade nova; `Renegociacao` continua sendo só o acordo

`orm.Renegociacao` grava `valor_anterior` e `novo_valor` e **reescreve as parcelas**. Ela é o
registro de um acordo fechado, e faz isso bem.

Recusa, contraproposta e silêncio do credor não cabem nela — e são metade da informação que
constrói o benchmark. Entra **entidade nova** de resultado: `tenant_id`, dívida, **canal**,
desfecho (`acordo` · `recusa` · `contraproposta` · `sem_resposta`), valores opcionais, referência
opcional à `Renegociacao` quando houve acordo.

Afrouxar os `NOT NULL` da tabela atual para caber uma recusa foi recusado: mexe em dado em
produção e mistura duas coisas diferentes numa tabela só — o que aconteceu na conversa e o que
mudou no contrato.

A entidade nova carrega `tenant_id`, que é o que a faz entrar sozinha na exclusão de conta por
`tabelas_do_tenant()`, derivada do metadata.

O marco `primeira_negociacao` continua nascendo do acordo fechado, ao lado do INSERT que o produz,
e continua não se desfazendo.

### 7. O canal existe nos dois lados, com papéis distintos

- **Na leitura do script**, o canal é **parâmetro, e não persiste**. É escolha de visualização: a
  mesma dívida pode ser lida em três formatos, e nenhum deles é um fato sobre o mundo.
- **No resultado registrado**, o canal é **coluna, e persiste**. Aí ele é fato: a negociação
  aconteceu por telefone, e isso é o que o benchmark precisa saber.

Hoje o canal só aparece como placeholder de texto livre no campo de observação da tela de
renegociar, o que não sustenta benchmark nenhum.

## Consequências

+ **O campo mais antigo e mais inerte do modelo passa a valer alguma coisa.** `fonte_renda.tipo`
  deixa de ser rótulo que o banco guarda e ninguém lê.
+ **Nenhuma das sete decisões mexe em coluna com dado em produção.** Alíquota por fonte, evento
  previsível, pote percentual e resultado de negociação são todos aditivos — o mesmo caminho que a
  `Meta` (0017) e o `Respiro` (0019) seguiram, e pelo mesmo motivo.
+ **O alerta anti-golpe deixa de depender de haver achado.** Combinado com a decisão do F-012 de
  `montar_script` não devolver mais `None`, ele alcança quem cadastrou a dívida na mão — que é
  quem não tem documento, e é o alvo preferencial do golpe.
+ **O benchmark passa a ter as duas metades.** Quem recusou é informação tão boa quanto quem
  fechou, e hoje ela é jogada fora.
+ A proibição de coeficiente sem fonte da ADR 0009 sai **reforçada** em quatro pontos: reajuste de
  benefício, alíquota de imposto, vacância de aluguel e valor de 13º são todos dado do usuário,
  nenhum é estimado.

− **A oferta muda de lugar para quem já usa o app.** É a única decisão desta ADR com efeito
  imediato sobre comportamento em produção, e ela atinge as duas superfícies que o `montar_script`
  alimenta. Quem copiou o script na semana passada vai encontrar outro texto.
− **A cascata ganha a sétima linha, e a ação a distância se repete.** Compromisso percentual
  declarado derruba `capacidade_maxima`, e com ela o teto do simulador, a `margemDisponivel` do
  painel e o aporte do card `plano_sugerido` — **sem que nenhum dos três arquivos seja tocado**.
  É exatamente o defeito que passou por quatro gates verdes no M7.2, e a mitigação é a mesma do
  M11: o teste cruzado que torna a mudança visível é obrigatório, não opcional.
− **`nao_fecha` dispara mais uma vez.** Continua correto e continua sendo aritmética.
− **O imposto fica com dois lugares para morar** enquanto o fallback existir. Duas fontes de
  verdade para a mesma pergunta é dívida técnica assumida com data de vencimento em aberto.
− **Seis tipos de renda são seis fluxos de tela**, e nenhum tem desenho pronto: o
  `design-system.md` não tem verbete de renda tipada. É o item do M12 que mais pode inchar.
− **A copy de negociação triplica** — três variantes, cada uma com abertura de segurança e
  fechamento de pagamento. O gate de revisão por advogado, que o roadmap marca como o único item
  capaz de encerrar o produto, passa a ter três vezes mais superfície a cobrir.
