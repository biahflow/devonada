# F-011 — Renda tipada e compromisso percentual

## Status

`READY_FOR_BUILD`

O plano de execução em [`plan.md`](plan.md), de 20/08/2026, tem **seis tarefas** e resultado
`PLAN_VALID`. Ele foi **congelado em 20/08/2026**, quando o último gate caiu.

O `ARCHITECTURE_DECISION_REQUIRED` que o segurava era o `PF-4`: a ADR 0021 dizia que o compromisso
percentual "incide sobre a renda típica" e **não desempatava entre bruta e líquida**. Decidido pelo
usuário em 20/08/2026 — **incide sobre a renda LÍQUIDA típica**, a mesma base sobre a qual o piso
legal já é medido —, e registrado na **Nota de desempate** no fim da ADR 0021.

Execução autorizada **em paralelo com F-012**, com uma coordenação registrada como
`PLAN_DEVIATION` nos dois planos: só T1 escreve a primeira migração do milestone, e a de F-012
encadeia depois dela.

As quatro decisões de produto de 20/08/2026 estão em *Decisions*, e as quatro incógnitas que
faltavam foram fechadas pela [**ADR 0021**](../../adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md),
aceita no mesmo dia — ver *Unknowns*, que agora registra a decisão de cada uma.

É o mesmo caminho que o F-010 percorreu: contrato escrito, incógnitas nomeadas, ADR fechando o
gate humano, e só então o Planner.

**O planejamento acrescentou um fato que o contrato não trazia:** existe um **quarto** consumidor
de `leitura.capacidade_atual` — `revisao._capacidade_para_oferta` (`backend/routers/revisao.py:176`),
que monta a oferta do script de negociação. Compromisso percentual declarado derruba também **a
oferta que o usuário faz ao credor**. Aceito por decisão humana em 20/08/2026; ver `PF-1` do plano.

## Priority

`M12, primeira das duas features (paralela a F-012)`

## Problem

`fonte_renda.tipo` **já existe e não faz nada.** É coluna `String(20)` desde a migração do M7
(`backend/orm.py:258`), validada por
`TipoFonteRenda = Literal["pj_hora", "clt", "autonomo", "beneficio", "aluguel", "outro"]`
(`backend/schemas.py:519`), gravada e devolvida pelo CRUD de `/v1/caixa/fontes`. E
`grep -rn "pj_hora\|autonomo" backend/domain/ backend/leitura.py` retorna **zero linhas**: nenhuma
regra de domínio consulta o campo.

Ou seja: o usuário já escolheu o tipo, o banco já guardou, e o plano trata CLT e autônomo
exatamente igual. `docs/domain.md:142-154` descreve há tempos um comportamento por tipo que o
código nunca teve — o documento vive à frente do código nesta área específica.

O custo disso é o que o verbete diz: *"praticamente todo app financeiro brasileiro assume salário
fixo no dia 5, e metade deste público não tem isso."* Quem ganha por hora tem mês fraco, e um
compromisso de valor fixo quebra nele.

## Desired Outcome

O tipo de renda passa a mudar o que o app pergunta, o que ele reserva e o que ele promete. E quem
tem renda variável compromete **percentual do que entra**, não um valor fixo que o mês fraco
derruba.

## Decisions

Tomadas pelo usuário em 20/08/2026. **Precisam subir para ADR 0021** antes de planejamento — este
contrato as registra, não as substitui.

1. **O M12 vira duas features.** Renda tipada (esta) e negociação por canal ([F-012](../F-012-negociacao-por-canal/feature.md))
   não têm interseção de código: uma mora em `domain/caixa.py` e `leitura.py`, a outra em
   `routers/revisao.py` e `orm.Renegociacao`. Executáveis em paralelo, sem `PARALLELISM_RISK`.
2. **Compromisso percentual incide sobre a renda típica**, e é subtraído na mesma posição de
   `aporte_reserva` e `aporte_aposentadoria` — antes de `capacidade_maxima`. Mantém o plano
   dimensionado pelo pior mês, coerente com `domain/caixa.renda_tipica`.
3. **Os seis tipos ganham UX própria.** `beneficio`, `aluguel` e `outro` não caem no genérico.
4. **Nenhum tipo introduz coeficiente sem fonte.** Onde a regra tem lei (13º, férias), a lei entra
   no docstring; onde é aritmética sobre dado do usuário (taxa × horas, percentual declarado), o
   docstring diz que é dado do usuário — como `domain/caixa.py` já faz para o respiro.

## Scope

- Dar efeito de domínio a `fonte_renda.tipo`, hoje inerte, para os seis valores do `Literal`.
- **`clt`** — líquido mensal fixo mais os eventos previsíveis do calendário: 13º e férias com o
  terço constitucional. O app reconhece que eles **existem e quando caem**; o valor continua vindo
  do que o usuário declara.
- **`pj_hora`** — taxa × horas, menos o imposto que o usuário informou. Sem alíquota informada,
  **nada é reservado e a tela diz que não está reservando** (ADR 0009, já em `domain.md:148`).
- **`autonomo`** — trabalha com a renda típica e compromete percentual, nunca valor fixo.
- **`beneficio`** — valor fixo com data de pagamento própria, que não é o dia 5 de ninguém.
- **`aluguel`** — renda variável cuja queda característica é a vacância.
- **`outro`** — permanece com o comportamento genérico de hoje, e a tela diz que é genérico.
- Compromisso percentual como forma de aporte, ao lado do valor absoluto que já existe em
  `Perfil.reserva_aporte` e `Perfil.aposentadoria_aporte` (`backend/orm.py:154-155`).
- Atualizar `docs/api-contract.md` com o bloco novo do M12, no mesmo commit da mudança de contrato.

## Out of Scope

- **Projetar reajuste de benefício.** O índice varia por ano e por espécie; projetá-lo seria
  inventar regra financeira. O usuário atualiza o valor quando ele muda.
- **Estimar alíquota de imposto de qualquer tipo.** `Perfil.imposto_bps:148` já declara: *"é
  informado pelo usuário, jamais estimado"*.
- **Estimar taxa de vacância de aluguel.** Vacância é fato do histórico do usuário, não
  coeficiente de fábrica.
- **Calcular FGTS.** `domain.md:146` o cita como evento do CLT; ele não é renda disponível para
  quitação e não entra na cascata.
- Alterar a definição de renda típica (`min()` sobre a janela de 6, mínimo de 3 amostras) — a
  ADR 0009 e `domain.md:136-140` já a fixaram, e a concepção pedia mediana justamente onde o
  canônico decidiu contra.
- Alterar o piso do mínimo existencial ou a posição do respiro na cascata.
- Qualquer item de [F-012](../F-012-negociacao-por-canal/feature.md), M13 ou M14.

## Acceptance Criteria

- Uma fonte de cada um dos seis tipos produz comportamento de domínio distinto e verificável — há
  teste por tipo, e ele falha se o tipo voltar a ser rótulo inerte.
- Toda regra nova em `backend/domain/` declara FONTE no docstring, ou declara explicitamente que o
  valor é **dado do usuário e não regra financeira**. Regra sem uma das duas coisas não existe.
- Sem alíquota informada em fonte `pj_hora`, nada é reservado e a resposta da API expõe essa
  ausência de forma tipada — a tela diz "não está reservando", nunca exibe zero como se fosse
  reserva.
- Compromisso percentual declarado é subtraído antes de `capacidade_maxima`, junto aos potes, e há
  teste que prova a posição.
- **Teste cruzado obrigatório**, gêmeo do `TestRespiroNosTresConsumidores` do M11: compromisso
  percentual declarado muda o teto do simulador, a `margemDisponivel` do painel e o aporte do card
  `plano_sugerido` — os três leem `leitura.capacidade_atual` e nenhum dos três arquivos é tocado.
- Tenant que não declarou compromisso percentual tem cascata **idêntica** à de hoje, campo a campo.
  Há teste de regressão dos dois lados, no molde de `TestRegressaoSemRespiro`.
- Compromisso percentual que faça a capacidade invadir o mínimo existencial é recusado com `422` e
  mensagem em pt-BR **sem valor no corpo** — renda não vaza em mensagem de erro (guardrail 5),
  no padrão de `_validar_aporte`.
- Nenhum valor derivado é calculado no cliente (guardrail 1.2): percentual aplicado, renda típica e
  capacidade chegam prontos do servidor.
- Todo estado remoto de tela nova trata carregando, erro, vazio e conteúdo.
- Controles novos têm alvo de toque de 48pt e `accessibilityLabel` quando não houver texto visível.

## Constraints

- Dinheiro em centavos inteiros; percentual em **bps**, como `imposto_bps` e `rendimento_esperado_bps`
  já fazem. A única função de percentual do domínio é `aplicar_percentual(centavos, bps)`
  (`backend/domain/dinheiro.py:39-40`).
- `EntradaCaixa` e `Caixa` (`backend/domain/caixa.py:80-137`) são dataclasses congeladas; o M11
  acabou de acrescentar cinco campos a cada uma. Campo novo é aditivo.
- Migrações forward-only. **A cabeça da cadeia é `116f2181bdda`** (marco `UNIQUE`), não a do
  respiro — o M11 entregou duas migrações.
- Tabela nova precisa de `tenant_id`, que é o que a faz entrar sozinha na exclusão de conta por
  `tabelas_do_tenant()`.
- Chamadas HTTP permanecem exclusivamente em `src/api/client.ts`; o cliente não envia `tenant_id`.
- `backend/tests/conftest.py` monta o schema com `Base.metadata.create_all`, **não pelo Alembic** —
  uma migração divergente do ORM passa a suíte inteira verde. O M11 fechou isso com conferência
  manual. Este contrato traz migração nova e herda o buraco.

## Dependencies

- M7 / módulo de caixa e a cascata de `backend/domain/caixa.py`.
- M11 / respiro, que ocupa a posição imediatamente anterior a `capacidade_maxima` na cascata.
- `docs/domain.md`, verbetes `tipo de renda`, `renda típica`, `capacidade` e `comprometimento de
  renda`.
- ADR 0009, que proíbe coeficiente de alocação sem fonte.
- `docs/api-contract.md` — bloco novo a escrever; nenhum endpoint do M12 além de metas nomeadas
  está especificado hoje.

## Unknowns

**Fechadas pela [ADR 0021](../../adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md)**,
aceita em 20/08/2026. Ficam registradas com a decisão, porque a pergunta explica o desenho tanto
quanto a resposta. O Planner executa a decisão; não a reabre.

1. **`imposto_bps` é global, mas a alíquota é por fonte.** Ele vive em `Perfil`
   (`backend/orm.py:148`), uma linha por tenant, e é aplicado sobre a renda bruta **somada**
   (`domain/caixa.py:338`). Quem tem CLT mais um contrato PJ tem duas alíquotas e uma coluna.
   → **Decidido (0021, item 1):** `fonte_renda.imposto_bps` **nullable**, com o `Perfil.imposto_bps`
   como fallback. Nenhum dado migra; o imposto vira somatório por fonte, e a conta antiga é o caso
   em que nenhuma fonte declarou.
2. **Onde entram 13º e férias.** São recebimentos extras previsíveis, não renda mensal.
   → **Decidido (0021, item 2):** **entidade própria** de evento previsível — tipo, mês previsto e
   valor declarado pelo usuário. Não entra na cascata nem na janela do `min()`; é munição de
   negociação à vista, como `domain.md:146` já dizia. Reusar `Recebimento` foi recusado porque ele
   é único por fonte/mês e consumiria vaga da janela de seis, deixando no histórico um dezembro que
   não se repete.
3. **Um mês zerado zera a renda típica.** A vacância do aluguel e o mês sem trabalho do autônomo
   são exatamente isso: um recebimento zero.
   → **Decidido (0021, item 3):** `renda_tipica` **não muda**. O que muda é o que o app conta — a
   origem e **o mês que ancorou o valor** viajam para a tela. Nota de leitura de código que o
   contrato não trazia: a renda típica já é apurada **por fonte** (`backend/leitura.py:128-137`),
   então um mês zerado derruba só a fonte dele; quem tem uma fonte só continua exposto.
4. **Compromisso percentual é pote novo ou modo dos potes atuais.**
   → **Decidido (0021, item 4):** **pote novo, aditivo**, em bps, subtraído na mesma posição da
   cascata. Os potes existentes não viram "valor OU percentual" — a conversão mexeria em coluna com
   dado em produção. Vale a regra da 0019: quem não declarar não tem, e a cascata dele fica
   idêntica à de hoje.

## Risks

- **Ação a distância, de novo.** Três consumidores mudam de número sem que seus arquivos sejam
  tocados. O M11 documentou isso e escreveu o teste que o torna visível; repetir a feature sem
  repetir o teste é repetir o defeito que passou por quatro gates verdes no M7.2.
- **O campo já tem dado em produção.** Diferente do respiro, que nasceu vazio, `fonte_renda.tipo`
  já está preenchido por usuários que escolheram sem que a escolha tivesse consequência. Dar
  efeito ao campo **muda o plano de quem já usa o app**, retroativamente e em silêncio.
- `nao_fecha` passa a disparar mais, como no M11. Continua sendo fato aritmético, nunca diagnóstico
  de superendividamento — o teste de copy que quebra na palavra continua valendo.
- Migração nova sobre um schema cuja suíte não valida migrações (ver *Constraints*).
- UX de seis tipos é seis fluxos de tela. É o item que mais pode inchar, e o que menos tem
  desenho pronto: `docs/design-system.md` não tem verbete de renda tipada, e `IncomeSetup` existe
  só em `docs/concepcao/`, que é fonte histórica e não canônica.

## Human Gates

- ~~Aprovar a ADR 0021 com as quatro incógnitas acima resolvidas, antes de qualquer código de
  domínio.~~ **Satisfeito em 20/08/2026** — ADR 0021 aceita.
- Aprovar mudança de propriedade de dado, se `imposto_bps` sair de `Perfil` (incógnita 1).
- Aprovar a migração e sua estratégia para o dado de `tipo` já existente em produção.
- Validar em device os fluxos novos de declaração de renda — leitura, teclado sobre campo de
  valor, acessibilidade. Nenhum agente declara este gate satisfeito.

## References

- `roadmap.md`, M12 — itens de renda tipada e compromisso percentual.
- `docs/domain.md`, verbetes `tipo de renda`, `renda típica`, `capacidade`, `comprometimento de renda`.
- `docs/guardrails.md`, seções 1.2, 5 e 7.2.
- `docs/adr/0009` (coeficiente sem fonte) e `docs/adr/0019` (precedente do respiro na cascata).
- `docs/features/F-010-respiro/` — contrato, plano e evidência que servem de molde.
- `backend/domain/caixa.py`, `backend/leitura.py`, `backend/routers/caixa.py`, `backend/orm.py`.
- [ADR 0021](../../adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md) — as sete incógnitas do M12, fechadas.
