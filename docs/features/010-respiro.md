# F-010 — Respiro

## Status

`SPEC_IN_PROGRESS`

## Priority

`Próximo na sequência aprovada do roadmap (M11)`

## Problem

Uma quitação que pede austeridade total transforma meses sem ganho visível em culpa e desistência.
Hoje a cascata não reserva uma parcela explícita para lazer e autocuidado, portanto o plano pode
parecer exigir que a pessoa pare de viver para conseguir pagar as dívidas.

## Desired Outcome

O plano passa a reservar e comunicar um respiro mensal como parte legítima da capacidade, e
celebra marcos de progresso sem transformar lazer em prêmio condicionado ao bom comportamento.

## Scope

- Incluir `respiro` como linha de primeira classe na cascata do backend, sem invadir o mínimo
  existencial.
- Registrar o respiro do mês e seu uso, sem alertas, avisos ou contabilização negativa.
- Reconhecer os marcos de primeira negociação fechada, primeira dívida quitada e 25%, 50% e 75%
  da rota.
- Exibir `RespiroCard` e `MarcoScreen` com copy de permissão em pt-BR.
- Permitir que o respiro não usado seja guardado para o próximo marco ou destinado a aporte extra,
  sempre por escolha explícita do usuário.
- Cobrir a copy contra termos de culpa, desvio ou recompensa condicionada.

## Out of Scope

- Definir valores, percentuais ou fórmula de escala sem decisão e fonte de produto explícitas.
- Alterar o piso legal do mínimo existencial.
- Criar notificações de uso de respiro ou expor a palavra “dívida” em push.
- Implementar funcionalidades futuras de M12, M13 ou M14.

## Acceptance Criteria

- A capacidade retorna um respiro separado, calculado no backend, e nunca abaixo do mínimo
  existencial.
- O frontend apenas formata e exibe valores recebidos; não calcula valor de respiro, marco ou
  capacidade.
- Um gasto de respiro não gera alerta, tom negativo ou progresso vermelho.
- Todo estado remoto de nova tela trata carregando, erro, vazio e conteúdo.
- A UI usa copy de permissão, como “está no plano” e “sem culpa”; os testes falham para copy que
  condicione ou moralize o respiro.
- Controles novos têm alvo de toque de 48pt e `accessibilityLabel` quando não houver texto visível.
- Nenhuma escrita é disparada pelo Buddy sem confirmação explícita.

## Constraints

- Dinheiro permanece em centavos inteiros; nenhum valor derivado é calculado no cliente.
- Toda regra em `backend/domain/` precisa declarar a fonte ou devolver ausência quando ela não
  existir. Uma escolha de produto sobre valor do respiro não pode ser apresentada como regra
  financeira do usuário.
- Chamadas HTTP permanecem exclusivamente em `src/api/client.ts`; o cliente não envia
  `tenant_id`.
- Vermelho é exceção visual; o respiro e seus marcos usam a progressão verde prevista pelo design
  system.
- Migrações devem ser forward-only; não modificar migrações já aplicadas.

## Dependencies

- M7 / caixa e a cascata de `backend/domain/caixa.py`.
- M3 / parcelas e M1 / dívidas persistidas, para os marcos relacionados à rota.
- `docs/api-contract.md` precisa especificar os novos endpoints, payloads, unidades e erros antes
  de implementação.
- `docs/design-system.md`, seção “Ainda só especificação”, para `RespiroCard` e `MarcoScreen`.

## Unknowns

- Qual regra de produto define o valor ou a escala do respiro por marco e como ela será justificada
  sem inventar regra financeira.
- Qual modelo de persistência representa saldo disponível, uso mensal e decisão sobre saldo não
  usado.
- Quais endpoints, tipos, chaves de cache e permissões de escrita serão necessários.
- Se o compartilhamento em formato story permanece dentro do escopo de lançamento e quais dados
  podem ser expostos com segurança.

## Risks

- Um valor ou fórmula arbitrária pode ser entendido como orientação financeira e violar o princípio
  de não inventar regras.
- Uma implementação que trate o respiro como sobra pode reduzir a capacidade de modo inconsistente
  ou invadir o mínimo existencial.
- Copy moralizante ou alertas de gasto contradizem a finalidade anti-desistência da feature.
- Persistência de uso sem tenant isolation ou sem migração forward-only compromete dados pessoais.

## Human Gates

- Aprovar a regra de produto, fonte e valores do respiro antes de código de domínio.
- Aprovar qualquer decisão arquitetural nova de persistência, API pública ou propriedade de dados.
- Revisar em device a leitura, safe area, teclado e acessibilidade de `RespiroCard` e
  `MarcoScreen`.

## References

- `roadmap.md`, M11 — Respiro.
- `docs/domain.md`, verbetes `respiro` e `marco`.
- `docs/guardrails.md`, seção 4.1.
- `docs/design-system.md`, `RespiroCard` e `MarcoScreen`.
- `docs/architecture.md`, `docs/backend.md` e ADRs 0003, 0009 e 0015.
