# ADR 0008 — `valorJusto` é soma de achados citáveis, não estimativa

**Status:** aceito
**Data:** 2026-08-06

## Contexto

O card `valor_justo` existe em `src/api/types.ts`, tem componente pronto
(`src/components/cards/ValorJustoCard.tsx`), exemplo em `docs/api-contract.md` e verbete em
`docs/domain.md` **desde o primeiro commit do projeto**. Nenhum endpoint jamais o produziu.

A ausência estava declarada em dois documentos canônicos, com a mesma justificativa:

> "Não há regra de valor justo com fonte citável ainda, e inventá-la seria o oposto do que este
> produto faz." — `docs/api-contract.md`, seção 1.2

A justificativa é correta **para a leitura original do campo**. `docs/domain.md` definia
`valorJusto` como "quanto o backend **estima** que a dívida deveria custar". Estimativa é
exatamente o que não tem fonte: não existe lei, súmula ou resolução que diga quanto uma dívida
deveria custar. Produzir esse número seria o `valorCobrado * 1.1` de novo — o erro fundador que
este backend existe para não repetir — só que num campo que o usuário levaria a uma negociação
real como argumento.

Ao mesmo tempo, o M1.5 foi construído declarando que serviria justamente a este campo:

> "Também é o que torna o `valorJusto` defensável — contrato de consignado carrega CET, IOF,
> tarifa de cadastro e seguro prestamista embutido, que é exatamente onde mora a cobrança
> indevida." — `roadmap.md`, M1.5

Ou seja: o insumo defensável existe. O que faltava era parar de tratar o número como estimativa.

## Decisão

`valorJusto` deixa de ser estimativa e passa a ser **subtração**:

```
valorJusto = valorCobrado − Σ (achados com valor)
```

Um **achado** é um ponto concreto do contrato que vale contestar. Cada achado carrega,
obrigatoriamente:

- a **fonte** — artigo de lei, súmula ou tema repetitivo, nomeado;
- a **evidência** — o trecho literal do contrato, quando o achado nasceu da extração (M1.5);
- o **como conferir** — a pergunta de fato que só o usuário pode responder.

Disso decorrem quatro regras que não são negociáveis:

1. **Nenhum achado ⇒ nenhum número.** `valorJusto` é `null`, a rota não emite card, e a tela diz
   que não há o que conferir. Mesma disciplina de `valorCorrigido` (nulo sem taxa).
2. **Duas classes de achado.** Só entra na subtração o achado cujo valor é **um montante direto
   do contrato**. Achado cujo valor exigiria reamortizar o contrato inteiro entra na tela **sem
   valor** e não mexe no número. Arbitrar esse valor seria reintroduzir a estimativa pela porta
   dos fundos.
3. **Achado é convite a investigar, nunca sentença.** É `guardrails.md`, seção 3, a mesma regra
   que já governa `possivelPrescricao`. "Vale contestar", jamais "é ilegal".
4. **Teto que muda por resolução vive em config datada, sem default.** Teto não configurado faz a
   regra devolver `None`. O código nunca chuta um teto.

`economia` continua sendo `valorCobrado − valorJusto` no cliente — a subtração que
`guardrails.md` 1.2 já abençoa nominalmente.

## O que a verificação das fontes mudou

As citações foram conferidas no texto primário **antes** do código, e três decisões do plano
original caíram:

- **Margem consignável saiu.** Lei 10.820/2003 confirmada (art. 6º, §5º, redação da Lei
  14.601/2023: 45% para aposentadoria e pensão do RGPS; art. 2º, §2º, I, redação da Lei
  14.431/2022: 40% para CLT). Mas o limite incide sobre **a soma de todas as consignações** do
  benefício, não sobre uma dívida, e o remédio é reduzir o desconto — não reduzir o débito.
  Não pertence a `valorJusto`. Fica como não objetivo declarado.
- **Juros acima do teto virou achado sem valor.** Quantificar o excesso exigiria reamortizar o
  contrato a duas taxas. O achado nomeia a taxa contratada, o teto e a data de vigência dele —
  que é o que se leva para a negociação — e não produz número.
- **O teto do consignado não entra com valor default.** O texto do CDC e da Lei 10.820 foi obtido
  na íntegra no Planalto. O teto do CNPS **não** foi confirmável em fonte oficial (o portal exige
  autenticação), e o portal do STJ bloqueia acesso automatizado. Um teto não confirmado não vira
  constante no código: vai para `.env` vazio, e sem ele o achado não existe.

## Consequências

+ O card que estava vazio desde o commit inicial passa a ter produtor, sem que nenhuma regra
  financeira tenha sido inventada.
+ Todo número da subtração é rastreável a um montante que está escrito no contrato do usuário, com
  o trecho citado ao lado. Numa negociação, ele consegue apontar a linha.
+ A restrição vale para o futuro: regra nova só entra em `domain/revisao.py` com fonte no
  docstring, e só entra na subtração se o valor for direto.
+ `limpar_campos_sem_evidencia()` já garante que campo sem trecho é zerado no servidor — então
  achado derivado da extração **nasce** com evidência, sem código novo.
− O usuário que cadastrou a dívida à mão não recebe achado nenhum. É verdade, não defeito: sem o
  contrato lido não há o que conferir. A tela leva ao envio do contrato.
− O conjunto de regras é pequeno e vai parecer tímido perto do que um escritório de revisional
  promete. É a diferença entre o que dá para sustentar e o que dá para alegar.
− Teto desatualizado no `.env` produz achado errado. Mitigação: a data de vigência viaja na
  resposta e aparece na tela, então o usuário vê a idade do teto que embasou o achado.
