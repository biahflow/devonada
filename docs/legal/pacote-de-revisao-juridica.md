# Pacote de revisão jurídica

> **Para quem for revisar:** este documento é a tarefa inteira. Ele traz **todo** o texto jurídico
> que o produto exibe ao usuário, onde cada trecho aparece, e a pergunta objetiva a responder em
> cada um. Não é preciso ler o código.
>
> **Montado em 01/09/2026.** Regenerável: a seção 3 sai de `backend/juridico/fontes.py` e a 4 de
> `trilhas.py`.

## Por que esta revisão é o item mais caro do roadmap

Consultoria jurídica e postulação são privativas de advogado (Lei 8.906/94, art. 1º). **Informar
sobre a lei não é** — e é só isso que o produto faz. Mas a fronteira entre informar e aconselhar é
onde este produto vive, e é o único item do `roadmap.md` que pode **encerrar** o produto em vez de
atrasar um release.

O que reduz o custo desta revisão: o texto jurídico não está espalhado pelo app. Ele vive em
**dois arquivos** e **duas páginas HTML**, e nada é gerado por modelo de linguagem — o guardrail 3
proíbe. Tudo o que está aqui foi escrito à mão e é o que o usuário lê.

---

## 1. Uma passada de conferência já foi feita, e achou erro

Antes de mandar para revisão, cada citação foi conferida contra a fonte que ela alega. **Três
achados foram confirmados e corrigidos**; **dois não puderam ser verificados** e estão marcados
abaixo como pergunta.

Isso **não substitui** a revisão jurídica — quem fez a conferência não é advogado, e o que foi
checado é se a citação corresponde à norma, não se o uso dela está correto.

| # | Achado | Situação |
|---|---|---|
| **F1** | A ementa da **Súmula 566/STJ** citava a **MP 1.963-17/2000**. Essa é a norma da **Súmula 539** (capitalização de juros). A 566 trata da **Resolução-CMN 3.518/2007**, vigente desde 30/04/2008. | **Corrigido.** Teste `test_a_sumula_566_nao_cita_a_norma_da_sumula_539` impede a volta. |
| **F2** | Dispositivos originais do CDC declaravam vigência **11/09/1990** — a data da *lei*. O CDC só entrou em vigor em **11/03/1991**, porque o art. 118 lhe deu 180 dias de vacatio. A tela dizia "vigente desde 1990" para um código que ainda não valia. | **Corrigido** para `1991-03-11`. Teste impede a volta. |
| **F3** | As seis entradas da **Lei 14.181/2021** declaravam **01/07/2021** — de novo a data da lei. A publicação no DOU foi em **02/07/2021** (confirmado na Câmara). | **Corrigido** para `2021-07-02`, **mas ver a pergunta P1 abaixo.** |
| **F4** | `cnps-teto-consignado` tem, no campo de vigência, uma **frase** em vez de data — e a tela renderizava "vigente desde " + frase. Hoje nenhuma trilha a cita, então não aparecia; era armadilha esperando. | **Corrigido:** a tela só usa o prefixo quando o valor é data, e o backend declara a exceção em `SEM_DATA_FIXA`, com teste. |
| **F5** | `decreto-11150-4` (art. 4º do Decreto 11.150/2022) foi herdado de um comentário do próprio repositório, **sem conferência na fonte**. | **Não verificado. Ver P2.** |
| **F6** | `stj-tema-972` — a tese e a data (12/12/2018) não puderam ser confirmadas na fonte. | **Não verificado. Ver P3.** |

---

## 2. As perguntas objetivas

Cada uma tem resposta curta e fecha um item.

| # | Pergunta | Onde impacta |
|---|---|---|
| **P1** | Qual é a **cláusula de vigência** da Lei 14.181/2021? Se ela entrou em vigor na publicação, `2021-07-02` está certo; se houve vacatio, precisamos da data. | 6 entradas do corpus, exibidas na tela |
| **P2** | O **art. 4º do Decreto 11.150/2022** é mesmo o que exclui da aferição do mínimo existencial as dívidas com garantia real, financiamento imobiliário, crédito rural e consignado? Se for outro artigo, qual? | `decreto-11150-4`, citado na trilha do "não fecham" |
| **P3** | A tese do **Tema 972/STJ** é a que está na ementa (o consumidor não pode ser compelido a contratar seguro com a seguradora indicada pelo banco)? A data 12/12/2018 está correta? | `stj-tema-972`, citado no achado do seguro prestamista |
| **P4** | As ADPFs 1005, 1006 e 1097 no STF, que discutem o Decreto 11.150, **mudam alguma coisa** que o produto afirma hoje? O produto aplica o texto vigente e não toma partido. | mínimo existencial em todo o app |
| **P5** | Alguma ementa da seção 3 **ultrapassa "informar sobre a lei"** e entra em aconselhamento? | o corpus inteiro |
| **P6** | As **limitações** da seção 4 são suficientes? Falta alguma ressalva que a lei exija? | trilhas "como calculamos" |
| **P7** | Os **Termos** e a **Política** (seção 5) precisam de cláusula que não está lá? Em especial: campos de texto livre onde o usuário pode escrever dado de terceiro, e a ausência de CNPJ nomeado. | as duas páginas públicas |

---

## 3. O corpus — 15 normas, como o usuário as lê

Cada entrada aparece na tela dentro do disclosure **"Como calculamos"**, e a **ementa é nossa
paráfrase** — é ela que o leigo lê. O `texto literal` só está preenchido onde a citação já estava
conferida; onde está vazio, a tela manda ler na fonte, com o link.

### `cdc-52-1` — Código de Defesa do Consumidor, art. 52, § 1º

- **Vigência declarada:** 1996-08-02
- **Ementa (nossa paráfrase, exibida ao usuário):** A multa por atraso não pode passar de 2% do valor da prestação.
- **Texto literal exibido:** As multas de mora decorrentes do inadimplemento de obrigações no seu termo não poderão ser superiores a dois por cento do valor da prestação.
- **Fonte:** https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm

### `cdc-52-ii` — Código de Defesa do Consumidor, art. 52, II

- **Vigência declarada:** 1991-03-11
- **Ementa (nossa paráfrase, exibida ao usuário):** No fornecimento de crédito, o consumidor tem de ser informado antes da contratação sobre os juros de mora e a taxa efetiva anual — o CET.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm

### `cdc-39-i` — Código de Defesa do Consumidor, art. 39, I

- **Vigência declarada:** 1991-03-11
- **Ementa (nossa paráfrase, exibida ao usuário):** Condicionar a venda de um produto ou serviço à compra de outro é prática abusiva — é a chamada venda casada.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm

### `stj-sumula-566` — Superior Tribunal de Justiça, Súmula 566

- **Vigência declarada:** 2016-02-24
- **Ementa (nossa paráfrase, exibida ao usuário):** Nos contratos bancários posteriores a 30/04/2008 (início da vigência da Resolução-CMN 3.518/2007), a tarifa de cadastro pode ser cobrada no INÍCIO do relacionamento entre o consumidor e a instituição financeira.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.stj.jus.br/sites/portalp/Jurisprudencia/Sumulas

### `stj-tema-972` — Superior Tribunal de Justiça, Tema 972

- **Vigência declarada:** 2018-12-12
- **Ementa (nossa paráfrase, exibida ao usuário):** Na contratação de seguro junto com o financiamento, o consumidor precisa poder escolher a seguradora — impor a do banco é venda casada.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://processo.stj.jus.br/repetitivos/temas_repetitivos/

### `cnps-teto-consignado` — Conselho Nacional de Previdência Social, Resolução vigente sobre o teto de juros do consignado do INSS

- **Vigência declarada:** ver `tetosVigentesEm` na resposta da revisão
- **Ementa (nossa paráfrase, exibida ao usuário):** O CNPS fixa o teto de juros do empréstimo e do cartão consignados de beneficiário do INSS, e o revê periodicamente.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/conselhos-e-orgaos-colegiados/cnps

### `cc-206-5-i` — Código Civil, art. 206, § 5º, I

- **Vigência declarada:** 2003-01-11
- **Ementa (nossa paráfrase, exibida ao usuário):** Prescreve em cinco anos a cobrança de dívidas líquidas constantes de instrumento público ou particular.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm

### `decreto-11150-3` — Decreto 11.150/2022, art. 3º (redação do Decreto 11.567/2023)

- **Vigência declarada:** 2023-06-19
- **Ementa (nossa paráfrase, exibida ao usuário):** O mínimo existencial é a renda mensal de R$ 600,00 — valor fixo, que deixou de ser um percentual do salário mínimo.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11150.htm

### `decreto-11150-4` — Decreto 11.150/2022, art. 4º

- **Vigência declarada:** 2022-07-27
- **Ementa (nossa paráfrase, exibida ao usuário):** A aferição do mínimo existencial não alcança dívidas de crédito com garantia real, de financiamento imobiliário, de crédito rural e de crédito consignado.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11150.htm

### `cdc-54a-1` — Código de Defesa do Consumidor, art. 54-A, § 1º (incluído pela Lei 14.181/2021)

- **Vigência declarada:** 2021-07-02
- **Ementa (nossa paráfrase, exibida ao usuário):** Superendividamento é a impossibilidade manifesta de a pessoa natural de boa-fé pagar a totalidade das suas dívidas de consumo sem comprometer o mínimo existencial. Boa-fé e natureza de consumo são apuradas caso a caso — não por software.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm

### `cdc-54a-3` — Código de Defesa do Consumidor, art. 54-A, § 3º (incluído pela Lei 14.181/2021)

- **Vigência declarada:** 2021-07-02
- **Ementa (nossa paráfrase, exibida ao usuário):** O tratamento do superendividamento não alcança dívidas contraídas com fraude ou má-fé, nem as de produtos e serviços de luxo de alto valor.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm

### `cdc-104a` — Código de Defesa do Consumidor, art. 104-A (incluído pela Lei 14.181/2021)

- **Vigência declarada:** 2021-07-02
- **Ementa (nossa paráfrase, exibida ao usuário):** A pessoa superendividada pode pedir a repactuação das dívidas: uma audiência com TODOS os credores de uma vez, em que ela apresenta um plano de pagamento de até cinco anos, preservado o mínimo existencial.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm

### `cdc-104a-1` — Código de Defesa do Consumidor, art. 104-A, § 1º (incluído pela Lei 14.181/2021)

- **Vigência declarada:** 2021-07-02
- **Ementa (nossa paráfrase, exibida ao usuário):** Ficam de fora da repactuação as dívidas de crédito com garantia real, de financiamento imobiliário e de crédito rural.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm

### `cdc-104c` — Código de Defesa do Consumidor, art. 104-C (incluído pela Lei 14.181/2021)

- **Vigência declarada:** 2021-07-02
- **Ementa (nossa paráfrase, exibida ao usuário):** A fase conciliatória da repactuação também corre nos órgãos públicos de defesa do consumidor, como o Procon — não é preciso começar pelo Judiciário.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm

### `cdc-6-xi` — Código de Defesa do Consumidor, art. 6º, XI (incluído pela Lei 14.181/2021)

- **Vigência declarada:** 2021-07-02
- **Ementa (nossa paráfrase, exibida ao usuário):** É direito básico do consumidor a prevenção e o tratamento do superendividamento, preservado o mínimo existencial, inclusive pela revisão e repactuação da dívida.
- **Texto literal exibido:** — (nenhum; a tela manda ler na fonte)
- **Fonte:** https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm


---

## 4. As trilhas "como calculamos" — o texto que explica cada número

Aparecem na tela do Caixa, na Rota e na revisão de cobrança. **`limitações` é a parte que mais
importa juridicamente:** é onde o produto declara o que a conta *não* faz.

### `capacidadeHoje` — Como chegamos na sua sobra por mês

**Fórmula exibida:** renda típica − impostos e reservas − mínimo existencial − respiro − gastos essenciais − gastos não essenciais

**Passos:**

- Partimos da sua renda típica, não da do melhor mês.
- Tiramos o que você reserva de imposto em cada fonte, quando declarou a alíquota.
- Tiramos o mínimo existencial: o piso que a lei protege de qualquer plano de pagamento.
- Tiramos o respiro que você mesmo declarou, se declarou.
- Tiramos os gastos essenciais e depois os não essenciais.
- O que sobra é a sobra por mês — e é ela, não a renda, que cabe num acordo.

**Limitações declaradas:**

- O mínimo existencial da lei é um valor único e NÃO cresce por dependente. Guardamos quantos dependentes você tem, mas inventar um multiplicador seria criar regra sem fonte.
- Os gastos são os que você informou. O que não foi informado não entra — e por isso a sobra pode parecer maior do que é.
- O piso vem de configuração datada. A data ao lado dele diz a idade do número.

**Normas citadas:** decreto-11150-3, cdc-6-xi

### `naoFecha` — Por que dissemos que os números não fecham

**Fórmula exibida:** soma das parcelas mínimas > renda típica − impostos − mínimo existencial

**Passos:**

- Somamos as parcelas mínimas de todas as suas dívidas ativas.
- Comparamos com o máximo que sobraria cortando TODO gasto não essencial.
- Quando a soma é maior, os números não fecham — é uma subtração, não um diagnóstico.

**Limitações declaradas:**

- Isto é uma subtração, não um diagnóstico. A lei trata o caso de quem não consegue pagar tudo sem comprometer o mínimo existencial, e exige boa-fé e dívida de consumo para reconhecê-lo — nenhuma das duas é apurável por um aplicativo. Quem apura é a conciliação, com você presente.
- A repactuação de que a lei fala não alcança dívida com garantia real, financiamento imobiliário nem crédito rural — e o piso protegido também não considera essas, nem o consignado.
- O caminho também não alcança dívida contraída com fraude ou má-fé, nem compra de luxo de alto valor. Quem verifica isso é a conciliação.
- A conta usa os números que você informou. Renda ou gasto desatualizado muda o resultado.

**Normas citadas:** cdc-104a, cdc-104a-1, cdc-104c, cdc-54a-1, cdc-54a-3, decreto-11150-3, decreto-11150-4

### `valorJusto` — Como chegamos no valor justo

**Fórmula exibida:** valor cobrado − soma dos achados que têm valor

**Passos:**

- Lemos o contrato e separamos os pontos que valem contestar.
- Cada ponto só entra se tiver o trecho do documento que o sustenta.
- Somamos apenas os achados cujo valor está DIRETO no contrato.
- Subtraímos essa soma do valor cobrado.

**Limitações declaradas:**

- Não é uma estimativa de quanto a dívida deveria custar: não existe lei que diga isso, e nós não inventamos o número.
- Achado que exigiria recalcular o contrato inteiro aparece na tela e NÃO entra na subtração — arbitrar esse valor seria estimar disfarçado de apurar.
- Achado é convite a investigar, nunca uma sentença sobre a cobrança. Quem julga isso é o Judiciário, e nós não julgamos nada.

**Normas citadas:** cdc-52-1, cdc-52-ii, cdc-39-i, stj-sumula-566, stj-tema-972

### `possivelPrescricao` — Por que marcamos que pode ter prescrito

**Fórmula exibida:** hoje − data de origem > cinco anos

**Passos:**

- Contamos cinco anos completos a partir da data em que a dívida começou.
- Passou disso, marcamos como algo a investigar.

**Limitações declaradas:**

- É sinal para investigar, NUNCA afirmação de que prescreveu. A contagem reinicia se houve reconhecimento da dívida, acordo ou cobrança judicial — e nada disso o aplicativo sabe.
- A conta parte da data de origem que você informou. Data errada, sinal errado.

**Normas citadas:** cc-206-5-i

---

## 5. As duas páginas públicas

O texto integral está em `backend/web/termos.html` e `backend/web/privacidade.html`, e o mais
simples é lê-lo renderizado: suba a API e abra `/termos` e `/privacidade`.

**As duas carregam faixa visível de MINUTA**, e há teste que falha se ela sumir. Depois da revisão:

1. apagar o bloco marcado com `<!-- APAGUE ESTE BLOCO DEPOIS DA REVISÃO JURÍDICA -->` nas duas;
2. atualizar a data do rodapé;
3. ajustar `backend/tests/test_paginas_publicas.py::TestMinuta` — ele existe para a remoção ser
   deliberada.

**O que sustenta cada afirmação da Política** está em
[`inventario-de-dados.md`](inventario-de-dados.md): cada frase corresponde a uma coluna do banco,
a uma rota ou a um guardrail com teste. Se a revisão mudar uma afirmação, os dois mudam juntos.

**Três pontos que merecem atenção específica:**

1. **Texto livre.** `renegociacao.observacao` e `resultado_negociacao.observacao` aceitam qualquer
   coisa, inclusive dado de terceiro. Nada no produto induz a isso e nada valida o conteúdo. A
   Política hoje não diz nada sobre isso — é decisão da revisão se deve dizer.
2. **Controlador sem CNPJ.** A Política identifica "o devo.nada" e um e-mail. Nomear a pessoa
   jurídica depende da publicação sob CNPJ, que é item separado do roadmap.
3. **Envio do documento ao provedor de IA.** Está dito com todas as letras, com o motivo (o PDF
   pode conter CPF e dados de terceiros) e com o caminho de saída. É a afirmação de maior risco da
   Política, e a que as lojas mais cobram.

---

## 6. O que NÃO está nesta revisão

- **Copy de produto que não é jurídica** — rótulo de botão, título de tela, mensagem de erro.
- **Os números.** Nenhuma regra financeira é inventada: cada uma cita a fonte no docstring, e regra
  sem fonte devolve `None`. Isso é revisão de engenharia, e já foi feita.
- **O texto do assistente.** Ele **não gera** fundamento jurídico — o guardrail 3 o proíbe, e o
  schema não lhe dá campo para número. O que ele faz é escolher qual card mostrar.

---

## 7. Como registrar o resultado

Sugestão, para a revisão não virar uma conversa que ninguém acha depois:

- **Ementa aprovada:** nada a fazer.
- **Ementa a corrigir:** o texto novo, e este documento vira o registro de que ela foi revisada.
- **Data a corrigir:** a data certa e a fonte dela.
- **Cláusula faltando nas páginas:** o texto a acrescentar e onde.

Depois disso, três coisas mudam de uma vez: as entradas em `fontes.py`, as faixas de minuta saem, e
a linha "revisão da copy de negociação por advogado" do `roadmap.md` pode ser marcada.
