# F-010 — Respiro

## Status

`READY_FOR_BUILD`

As quatro incógnitas que mantinham este contrato em `SPEC_IN_PROGRESS` foram decididas em
19/08/2026 e registradas na **ADR 0019**. O gate humano de regra de produto está satisfeito; o de
device permanece, como em todo milestone.

O plano de execução está em [`plan.md`](plan.md), com oito Task Contracts em [`tasks/`](tasks/).
Ele é `PLAN_VALID` e está **congelado para execução** desde 19/08/2026: as duas decisões humanas
que faltavam foram tomadas na mesma data e estão escritas em `planning_findings`.

- **PF-1** — `POST /v1/caixa/respiro/destinacao` só debita `saldo_acumulado` e grava o lançamento
  em `respiro_destinacao`. Não escreve em parcela, pagamento nem dívida.
- **PF-2** — `caixa_snapshot` ganha a coluna `respiro`, aditiva e `nullable`, na migração de T1.

O que ainda separa esta feature de `DONE` é execução e, no fim, a **validação em device** de
`RespiroCard` e `MarcoScreen` — gate humano que nenhum agente pode declarar.

## Priority

`Próximo na sequência aprovada do roadmap (M11)`

## Problem

Uma quitação que pede austeridade total transforma meses sem ganho visível em culpa e desistência.

E o problema não é só de copy: a cascata **já produz o número da austeridade total**.
`capacidade_maxima` é, hoje, `renda líquida − essenciais − provisões − potes`, ou seja, o cenário
em que todo o não essencial foi cortado — e é dele que saem o teto do simulador, a sobra do painel
e o aporte do card `plano_sugerido`. O produto vinha propondo planos calculados sobre a hipótese
de que a pessoa para de viver.

## Desired Outcome

O plano passa a reservar e comunicar um respiro mensal como parte legítima da capacidade, e
celebra marcos de progresso sem transformar lazer em prêmio condicionado ao bom comportamento.

## Decisions

Todas em **ADR 0019**. Resumidas aqui porque um contrato precisa ser legível sozinho:

1. **O respiro entra antes de `capacidade_maxima`.** É o que o torna imune ao corte:
   `capacidade_maxima = líquida − essenciais − provisão − reserva − aposentadoria − respiro`.
2. **O valor é declarado pelo usuário.** Nenhum coeficiente, nenhum default de fábrica. O app
   responde com o que sabe: quantos meses a mais de quitação aquele valor custa, pela mesma
   `domain/simulacao.py` do M4. A faixa "5–8%" da concepção **não sobe** para documento canônico —
   a ADR 0009 proíbe coeficiente de alocação sem fonte, e esta ADR a aplica em vez de substituí-la.
3. **O marco celebra e libera o acumulado; ele não altera o valor.** "Escalar com o marco"
   acontece por acúmulo, não por fórmula.
4. **Marco é evento persistido, atingido uma vez e para sempre.** Nunca predicado recalculado
   sobre o estado atual.
5. **Respiro não usado acumula em silêncio.** Destinar a aporte extra é botão, nunca pergunta
   mensal.
6. **Sem declaração não há respiro**, e a cascata de quem não declarou não muda.

## Scope

- Incluir `respiro` como linha de primeira classe na cascata do backend, subtraído antes de
  `capacidade_maxima`, sem invadir o mínimo existencial.
- Declarar, alterar e desativar o valor mensal de respiro, com o custo em meses de quitação à
  vista no momento da decisão.
- Registrar o uso do respiro no mês e acumular o não usado, sem alertas, avisos ou contabilização
  negativa.
- Destinar saldo acumulado a aporte extra, sempre por ação explícita do usuário.
- Reconhecer os cinco marcos — primeira negociação fechada, primeira dívida quitada, 25%, 50% e
  75% da rota — como eventos persistidos.
- Mover para o servidor o cálculo da porcentagem da rota, hoje feito em
  `src/components/rota/CardSaldo.tsx`, e corrigir sua linha de base móvel.
- Exibir `RespiroCard` e `MarcoScreen` com copy de permissão em pt-BR.
- Cobrir a copy contra termos de culpa, desvio ou recompensa condicionada.

## Out of Scope

- **Tabela de escala do respiro por marco.** Decidido: não existe (ADR 0019, item 3).
- **Qualquer valor ou percentual default**, inclusive a faixa 5–8% da concepção.
- **Reconciliação automática entre respiro e `gasto` não essencial.** A dupla contagem é nomeada
  na tela e resolvida pelo usuário (ADR 0019, item 7).
- Alterar o piso legal do mínimo existencial.
- Criar notificações de uso de respiro ou expor a palavra "dívida" em push.
- Compartilhamento da `MarcoScreen` em formato story — ver *Open questions*.
- Implementar funcionalidades futuras de M12, M13 ou M14.

## Acceptance Criteria

- `calcular_caixa` subtrai o respiro antes de `capacidade_maxima`, e há teste que prova que cortar
  todo o não essencial **não** zera o respiro.
- Respiro declarado que faça `renda_líquida − essenciais − respiro` cair abaixo do mínimo
  existencial é recusado com `422` e mensagem em pt-BR, no padrão de `_validar_aporte`.
- Tenant sem respiro declarado tem cascata idêntica à de hoje — há teste de regressão que prova.
- Um marco atingido permanece atingido depois de o usuário cadastrar uma dívida nova. Há teste que
  cadastra a dívida e verifica que o marco não se desfaz.
- A porcentagem da rota vem do servidor em campo tipado; nenhum componente do app a calcula.
- Um gasto de respiro não gera alerta, tom negativo ou progresso vermelho, e a barra enche em
  verde.
- O frontend apenas formata e exibe valores recebidos; não calcula valor de respiro, saldo, marco
  ou capacidade.
- Todo estado remoto de nova tela trata carregando, erro, vazio e conteúdo.
- A UI usa copy de permissão, como "está no plano" e "sem culpa"; o teste de copy falha em
  `você já gastou`, `você mereceu`, `se você economizar`, `desvio` e `extrapolou`.
- Controles novos têm alvo de toque de 48pt e `accessibilityLabel` quando não houver texto visível.
- Nenhuma escrita é disparada pelo Buddy sem confirmação explícita.

## Constraints

- Dinheiro permanece em centavos inteiros; nenhum valor derivado é calculado no cliente.
- Toda regra em `backend/domain/` precisa declarar a fonte ou devolver ausência quando ela não
  existir. **O valor do respiro não é regra financeira: é dado do usuário**, e o docstring precisa
  dizer isso com todas as letras, porque é a distinção que autoriza o módulo a existir.
- Chamadas HTTP permanecem exclusivamente em `src/api/client.ts`; o cliente não envia `tenant_id`.
- Vermelho é exceção visual; o respiro e seus marcos usam `colors.accent` sobre
  `colors.neutralSurface`.
- Migrações devem ser forward-only; não modificar migrações já aplicadas. A última da cadeia é
  `e07b3c5d91a8` (metas nomeadas).
- Tabela nova precisa de coluna `tenant_id` — é o que a faz entrar sozinha na exclusão de conta
  por `tabelas_do_tenant()`.
- **Colisão de nome:** `RESPIRO_EM`, em `src/components/ui/Brand.tsx`, é a área de respiro
  *tipográfica* da marca. Nenhuma relação com esta feature, e nenhum código de domínio de respiro
  existe hoje.

## Dependencies

- M7 / caixa e a cascata de `backend/domain/caixa.py`.
- M1 / dívidas persistidas e M3 / parcelas, para os marcos da rota.
- Tabela `renegociacao` e `POST /v1/dividas/{id}/renegociacao`, para o marco de primeira
  negociação fechada. **Já existem** — nenhum marco depende do M12.
- `docs/api-contract.md`, Bloco 13, especifica os endpoints, payloads, unidades e erros.
- `docs/design-system.md`, `RespiroCard` e `MarcoScreen`.

## Open questions

Nenhuma bloqueia o planejamento.

- **Compartilhamento em formato story** da `MarcoScreen`: a concepção o previa. Decidir o que pode
  aparecer na imagem — valor absoluto de dívida é dado sensível e não deveria sair do aparelho por
  esse caminho. Enquanto não houver decisão, a tela não compartilha.
- **Convite ao respiro para quem não declarou.** Sem default, o produto depende de a pessoa
  descobrir a linha. Onde e quando convidar é decisão de tela, não de domínio.

## Risks

- Três consumidores mudam de número sem serem tocados — simulador, painel e card do chat, todos
  via `leitura.capacidade_atual`. Um teste que cruze respiro declarado × teto do simulador é o
  equivalente, aqui, do teste de M7.2 que ligou fonte de renda a painel preenchido e que faltava
  quando o defeito passou por quatro gates verdes.
- `nao_fecha` passa a disparar para mais gente. É correto e é mudança de comportamento visível:
  continua sendo fato aritmético, nunca diagnóstico de superendividamento.
- Dupla contagem com `gasto` não essencial fica possível por decisão. Se a tela não nomear o
  risco, o usuário vê a capacidade cair duas vezes e não entende por quê.
- Copy moralizante ou alertas de gasto contradizem a finalidade anti-desistência da feature.
- Marco implementado como predicado sobre o estado atual se desfaz quando o usuário cadastra
  dívida nova. É o modo de falha mais provável desta feature, e o mais cruel.

## Human Gates

- ~~Aprovar a regra de produto, fonte e valores do respiro antes de código de domínio.~~
  **Satisfeito em 19/08/2026** — ADR 0019.
- ~~Aprovar decisão arquitetural nova de persistência, API pública ou propriedade de dados.~~
  **Satisfeito** — ADR 0019 e `docs/api-contract.md`, Bloco 13.
- Revisar em device a leitura, safe area, teclado e acessibilidade de `RespiroCard` e
  `MarcoScreen`.

## References

- `docs/adr/0019-respiro-e-linha-da-cascata-e-quem-diz-o-valor-e-o-usuario.md`.
- `roadmap.md`, M11 — Respiro.
- `docs/domain.md`, verbetes `respiro` e `marco`.
- `docs/guardrails.md`, seções 1.2, 4.1 e 7.2.
- `docs/design-system.md`, `RespiroCard` e `MarcoScreen`.
- `docs/api-contract.md`, Bloco 13.
- `docs/architecture.md`, `docs/backend.md` e ADRs 0003, 0009 e 0015.
