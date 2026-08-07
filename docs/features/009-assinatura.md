# 009 — Assinatura in-app

**Milestone:** M9 · **Decisões:** ADR 0013 · **Contrato:** `api-contract.md`, Bloco 11

## Problema

O produto é bom o bastante para cobrar e não tem como cobrar. As duas lojas obrigam o meio de
pagamento delas para conteúdo digital — Pix ou Stripe direto reprova na revisão —, e nada no app
sabe quem pagou.

O M8 entregou a conta: quem é o dono do dado. Falta a outra metade: **até quando ele pode escrever
nela**.

## O que torna isto diferente de um paywall comum

O usuário deste app está endividado. A alavanca óbvia de conversão — trancar o acesso — é
exatamente a que faria o produto se comportar como o tipo de credor que ele existe para ajudar a
enfrentar. Uma pessoa que atrasou a assinatura e perde a lista das próprias dívidas perde a
ferramenta no mês em que mais precisa dela.

Por isso a fronteira não é *acesso*, é *escrita*.

## Comportamento

### A fronteira

| | Sem assinatura, teste vencido |
|---|---|
| Ver dívidas, parcelas, caixa, painel, revisões, histórico do chat | **livre** |
| Cadastrar, editar, quitar, marcar parcela paga | bloqueado |
| Registrar renda, gasto, provisão, fechar o mês | bloqueado |
| Enviar contrato, conversar com o assistente, simular | bloqueado |
| Entrar, sair, trocar senha, **excluir a conta** | **livre** |

Sete dias de teste, contados da criação da conta. Depois: **somente leitura**.

### Os dois sinais, e por que os dois

- **Faixa de somente leitura**, acima da barra de abas, nas quatro abas. É o sinal honesto: a
  pessoa entende antes de tentar. Um app que aceita o toque, abre o formulário, deixa preencher e
  só então recusa desperdiça o trabalho de quem já está sem dinheiro.
- **`402` do servidor**, tratado por `ErroDeMutacao`. É a garantia. A faixa pode ser esquecida numa
  tela nova; a trava do servidor não, porque é derivada do método HTTP.

A faixa é `warning`, nunca `danger` (guardrail 4). Assinatura vencida não é emergência financeira
do usuário, e pintar de vermelho a barra do app de alguém endividado é a ansiedade que este produto
existe para não produzir.

### A tela

`painel/assinatura`, alcançável de Preferências, acima de "Sair" e "Excluir minha conta" — é a
ação que a pessoa vem procurar com mais frequência, e enterrá-la abaixo das duas destrutivas faria
a loja considerá-la escondida.

Ela mostra a situação, o que a assinatura destrava, **o preço que a loja informou** e três ações:
assinar, restaurar e (quando ativa) gerenciar no sistema. Sem plano carregado, o botão diz
"Assinar" e não inventa preço nenhum.

Ela também diz, na própria tela de venda, que ver o que já está cadastrado é livre. A promessa que
sustenta o paywall precisa estar onde ela é cobrada — na hora de decidir pagar —, e não só na
documentação. Há teste que quebra se essa frase sumir.

## Não objetivos

- **Webhook de renovação.** Exige URL pública e, no Google, projeto GCP com Pub/Sub. A
  reconferência sob demanda dá o mesmo resultado com a latência de uma abertura do app.
- **Plano anual, familiar ou trial estendido.** Um produto, um preço, até haver dado de uso.
- **Cupom, código promocional e paywall com teste A/B.** Nada disso antes do primeiro pagante.
- **Bloquear leitura em qualquer hipótese.** Está proibido pelo guardrail 9.1, não adiado.

## Estados de tela

| Estado | O que aparece |
|---|---|
| Carregando | "Carregando sua assinatura" |
| Erro | `ErrorState` com repetir |
| Em teste | "Faltam N dias", e o que acontece depois |
| Ativa | "Renova em N dias", sem oferecer assinar de novo |
| Expirada | "Somente leitura", o que a assinatura destrava, e o botão com o preço |
| Loja indisponível | aviso `warning`; o resto da tela continua utilizável |

## O que só o aparelho prova

Nenhum gate exercita a loja de verdade. Continuam por validar:

- A folha de compra abrindo, com o preço localizado.
- Compra em sandbox nas duas lojas, com produto cadastrado.
- **Restaurar compras num aparelho novo** — o caminho que a revisão da Apple testa primeiro.
- O app voltando destravado depois da compra, sem logout.
- A faixa de somente leitura em tela pequena, sobre a barra de abas.
