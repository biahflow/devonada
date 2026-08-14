# ADR 0017 — `Meta` é entidade nova, e a fase verde troca a aba sem esconder as dívidas

**Status:** aceito
**Data:** 2026-08-10

## Contexto

A tela 09 da concepção (`docs/concepcao/telas-v2.html`) desenha a **Rota de Chegada**: pós-quitação,
a aba "Dívidas" vira "Metas", a barra de abas fica verde, e a tela lista metas nomeadas — "🛟 Reserva
de emergência · 6× seus fixos · meta R$ 13.400", "✈️ Viagem em família · julho 2027", "🚗 Trocar de
carro · 2028" — cada uma com selo de situação, guardado, aporte e barra de progresso.

O `docs/design-system.md` já registrava a pendência: *"pós-quitação, a aba 'Dívidas' vira 'Metas'.
A troca de cor da barra já é código; a troca de aba depende do módulo de metas, que é do M12."*

O problema é que **o módulo de metas que existe não é uma lista de metas.** `backend/orm.py` guarda
seis colunas fixas no `Perfil` — `imposto_bps`, `reserva_aporte`, `reserva_saldo`,
`reserva_meta_meses`, `aposentadoria_aporte`, `rendimento_esperado_bps` — e elas alimentam a
**cascata** de `domain/caixa`: decidem quanto sai do mês antes de sobrar capacidade. Não há nome,
emoji, valor-alvo, data-alvo nem situação por meta. Dos três cards da tela 09, só a reserva de
emergência tem dado real, e o `Sugerido: R$ 1.150/mês` do terceiro é derivado de campos que não
existem.

Havia ainda uma armadilha no desenho: se a aba Metas **substitui** a aba Dívidas, quem zera tudo e
contrai uma dívida nova não tem por onde cadastrá-la. A comemoração viraria beco sem saída.

## Decisão

**1. `Meta` é entidade nova e aditiva. Os seis potes do `Perfil` não são migrados.**

Tabela `meta` por tenant: `nome`, `emoji`, `valor_alvo`, `saldo`, `data_alvo` (`AAAA-MM`),
`aporte_mensal`, `ativa`. CRUD em `/v1/metas`, no formato de `FonteRenda`/`Gasto`/`ProvisaoAnual`.

Mover a reserva do `Perfil` para uma linha desta tabela faria a capacidade de todo mundo mudar em
silêncio no primeiro deploy, porque a cascata lê aquelas colunas. O custo de conviver com as duas
coisas é um parágrafo de documentação; o de unificar seria recalcular a cascata.

**Consequência assumida: o produto passa a ter dois sentidos de "meta".** `/v1/caixa/metas` são os
potes que entram na cascata; `/v1/metas` são as metas nomeadas. Na tela os dois já se separam —
"Seus potes" e "Suas metas" — e os tipos levam o aviso no docstring.

**2. `aporteSugerido` e `status` são derivados no servidor, e nunca persistidos.**

`domain/metas.py` divide o que falta pelos meses que faltam, arredondando para cima — **o mesmo
método de `caixa.aporte_de_provisao`**, que divide o que falta de um IPVA pelos meses até janeiro.

Isto merece ser dito com precisão, porque o `CLAUDE.md` proíbe regra financeira inventada e este
módulo **não tem fonte legal**: dividir o que a pessoa disse que falta pelo prazo que ela mesma
escolheu não é afirmação sobre o mundo, é a conta que ela faria no papel. Seria invenção afirmar
quanto ela *deveria* guardar, ou projetar rendimento que ninguém informou — e nada aqui faz isso.

Não persistir é regra, não preferência: o sugerido depende do mês em que a pergunta é feita. A mesma
meta pede um valor em agosto e outro em novembro; gravar deixaria a tela mostrando o número de
quando a meta foi criada.

**3. Sem prazo não há sugestão. Sem aporte declarado não há situação.**

`aporteSugerido` devolve `null` sem `data_alvo`: não existe divisor, e inventar um horizonte
("dois anos, vai") produziria número que a pessoa levaria a sério. `status` devolve `null` quando
falta prazo **ou** falta aporte declarado — nos dois casos o app não tem base para dizer que alguém
está atrasado, então não diz. A tela então **não mostra selo**, em vez de mostrar palpite.

`aporte_baixo` é **âmbar, nunca vermelho**. O vermelho deste app é status de dívida (ADR 0015);
gastá-lo em "você está guardando pouco para a viagem" apagaria o significado de que a marca depende,
e transformaria a tela de conquista em repreensão.

**4. A troca de aba usa `href: null`, que tira da barra sem tirar da rota.**

`(tabs)/_layout.tsx` declara cinco `Tabs.Screen` e lê `useEstadoDaRota()` — a mesma leitura que o
`TabBar` já faz para escolher entre vermelho e verde, servida do cache do resumo, sem requisição
nova (ADR 0002). Na fase verde, `dividas` recebe `href: null` e `metas` entra; fora dela, o inverso.

**`/dividas` continua alcançável por `push` e por deep link na fase verde**, e a tela de Metas
oferece o caminho explicitamente ("Ver minhas dívidas", presente também no estado vazio). Esconder a
rota, e não só a aba, é o que produziria o beco sem saída.

## Consequências

+ A tela 09 pode existir com dado real, sem um único número inventado — que era a única forma de
  entregá-la sem violar o `CLAUDE.md`.
+ A cascata do caixa não é tocada: nenhum fechamento de mês muda de valor por causa desta entrega.
+ Quem quita tudo encontra a mesma mecânica apontada para frente — a barra cresce em vez de
  encolher — em vez de abrir o app numa lista vazia do que já resolveu.
+ Meta sem prazo é meta legítima e o produto a acomoda sem forçar a pessoa a chutar uma data.

− **Duas coisas chamadas "metas"** no contrato, nos tipos e nas rotas. É o custo direto de não
  migrar, e ele fica pago em documentação: `docs/api-contract.md`, `docs/domain.md`, `src/api/types.ts`
  e os dois módulos carregam o aviso.
− `MetaCard` calcula a largura da barra a partir de `saldo / valorAlvo`. É proporção visual, não
  dinheiro exibido, mas é a única aritmética de tela nesta entrega — e é onde alguém vai se sentir
  autorizado a colocar a segunda. Não é o precedente: `aporteSugerido` ao lado dela vem do servidor
  justamente por isso.
− A troca de aba **não é coberta por teste**: `jest-expo` mocka `Tabs` como `View`, então `href: null`
  é invisível para a suíte. É configuração de navegação, e a verificação é em device — nos dois
  sistemas, porque a barra é custom.
− O módulo não tem tela de "quanto separar no total". As metas nomeadas não somam para lugar nenhum,
  de propósito: somar aporte de meta com aporte de pote seria a unificação que esta ADR recusou.
