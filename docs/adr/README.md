# ADRs — Architecture Decision Records

Registro das decisões técnicas duradouras do front. Uma ADR existe para responder, meses
depois, à pergunta "por que isso é assim?" sem depender da memória de ninguém.

## Quando escrever

Escreva uma ADR quando a decisão:

- muda a arquitetura (navegação, estado, camadas, fronteira com o backend);
- adiciona uma dependência que fica difícil de remover depois;
- estabelece uma restrição que outras pessoas ou agentes vão querer violar;
- foi tomada contra a alternativa aparentemente óbvia.

Não escreva ADR para escolha de nome de variável, refatoração local ou correção de bug.

## Formato

Arquivo `NNNN-slug-em-kebab-case.md`, numeração sequencial que nunca é reaproveitada.

```markdown
# ADR NNNN — Título afirmativo

**Status:** aceito | proposto | superseded por ADR NNNN
**Data:** AAAA-MM-DD

## Contexto
O que era verdade quando a decisão foi tomada. As forças em jogo.

## Decisão
O que foi decidido, em voz ativa.

## Consequências
+ o que melhora
+ o que passa a ser possível
− o que piora
− o que passa a ser proibido
```

## Regra de imutabilidade

**ADR aceita nunca é reescrita.** Se a decisão mudar, escreva uma nova ADR que a substitui e
marque a antiga como `superseded por ADR NNNN`. O histórico de decisões erradas é tão útil
quanto o das certas — ele impede que o mesmo caminho seja tentado duas vezes.

## Índice

| # | Título | Status |
|---|---|---|
| [0001](0001-expo-router-como-navegacao.md) | expo-router como camada de navegação | aceito |
| [0002](0002-tanstack-query-para-server-state.md) | TanStack Query para estado de servidor | aceito |
| [0003](0003-calculo-financeiro-fica-no-backend.md) | Todo cálculo financeiro fica no backend | aceito |
| [0004](0004-paleta-hibrida-pine-e-dourado.md) | Paleta híbrida: pine primário, dourado acento | aceito |
