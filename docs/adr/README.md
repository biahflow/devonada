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
| [0004](0004-paleta-hibrida-pine-e-dourado.md) | Paleta híbrida: pine primário, dourado acento | superseded por ADR 0010 |
| [0005](0005-descarte-do-arquivo-de-contrato.md) | O arquivo do contrato é descartado após a extração | aceito |
| [0006](0006-postgres-token-fixo-e-extrator-plugavel.md) | Postgres, token fixo e extrator plugável | aceito (extrator plugável substituído pela 0007; token fixo, pela 0012) |
| [0007](0007-camada-de-provedor-de-llm.md) | Camada de provedor de LLM, e OpenAI como padrão | aceito |
| [0008](0008-valor-justo-e-soma-de-achados.md) | `valorJusto` é soma de achados citáveis, não estimativa | aceito |
| [0009](0009-o-usuario-decide-a-ordem-dos-potes.md) | O usuário decide a ordem dos potes; o app mostra a aritmética | aceito |
| [0010](0010-paleta-derivada-de-pierre-e-budgi.md) | Paleta derivada de Pierre e Budgi; lime é preenchimento, nunca texto | superseded por ADR 0011 |
| [0011](0011-forma-do-budgi-a-partir-das-telas.md) | A forma vem das telas do produto, não do CSS da landing | superseded por ADR 0015 |
| [0012](0012-conta-de-usuario.md) | Conta de usuário: JWT curto, refresh rotacionado e a sessão como único estado global | aceito |
| [0013](0013-assinatura-e-paywall.md) | Assinatura in-app: teste de 7 dias, somente leitura depois, e validação no servidor | aceito |
| [0014](0014-fork-e-marca-devonada.md) | devo.nada nasce como fork, não como projeto novo | aceito |
| [0015](0015-vermelho-e-status-de-divida.md) | Vermelho é status de dívida, e a interface é escura | aceito |
| [0016](0016-voltar-e-entrada-multi-divida.md) | Toda tela empilhada tem volta, e o onboarding aceita mais de uma dívida | aceito |
| [0017](0017-entidade-meta-e-fase-verde.md) | `Meta` é entidade nova, e a fase verde troca a aba sem esconder as dívidas | aceito |
| [0018](0018-medicao-de-contraste-e-gate-e-o-vermelho-ganha-token-de-texto.md) | A medição de contraste volta para dentro do repositório e vira gate; e o vermelho ganha um token de texto | aceito (supersede a decisão da 0010 de manter o validador fora do repo) |
| [0019](0019-respiro-e-linha-da-cascata-e-quem-diz-o-valor-e-o-usuario.md) | O respiro é o piso do corte, e quem diz o valor dele é o usuário | aceito |
| [0020](0020-o-assistente-se-chama-tino.md) | O assistente se chama Tino, e a marca antiga sai da página pública | aceito (supersede o item 3 da 0014) |
| [0021](0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md) | O tipo da renda ganha efeito por adição, e o canal decide quando a oferta é dita | aceito |
| [0022](0022-documento-inline-na-fila-multi-divida.md) | Documento lido inline na fila multi-dívida do onboarding, sem sair do grupo | aceito (revoga o ponto 5 da 0016) |
| [0023](0023-login-social-apple-e-google.md) | Login social: a conta é o `sub` do provedor, e conta sem senha exclui pelo provedor | aceito |
