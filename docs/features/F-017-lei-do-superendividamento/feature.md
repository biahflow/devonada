# FDD — Lei do Superendividamento no corpus, e a trilha "como calculamos"

## Cabeçalho

| | |
|---|---|
| Feature | O corpus jurídico ganha a Lei 14.181/2021, a repactuação é nomeada, e o usuário vê a conta |
| Slug | F-017-lei-do-superendividamento |
| Milestone | M14 (ver `roadmap.md`) |
| Issues | #13 (corpus), #14 (triagem nomeia o caminho), #15 (trilha na tela) |
| Telas | `app/(tabs)/caixa/index.tsx`; `app/(tabs)/painel/index.tsx`; `app/(tabs)/dividas/[id]/revisao.tsx`; `app/(onboarding)/triagem.tsx` |
| Endpoints | `GET /v1/juridico/fontes` (novo); `GET /v1/caixa`, `GET /v1/dividas/{id}/revisao` e `GET /v1/dividas/resumo` (alterados) |
| Depende de | ADR 0008 (`valorJusto` é soma de achados), guardrail 3 (postura jurídica), guardrail 9.1 (leitura nunca bloqueada) |
| Decide | ADR 0024 |

## Objetivo e não objetivos

As três issues do M14 são a mesma feature vista de três ângulos. A #13 pede a Lei 14.181/2021 no
corpus; a #15 pede o campo na API e o disclosure na tela; e nenhuma das duas se resolve bem sem a
outra, porque **não havia corpus** — havia fonte em string solta, escrita uma vez dentro de cada
regra. A #14 pede que a triagem nomeie a repactuação, e esbarra num fato: ali a renda ainda não foi
informada.

**Não objetivos:**

- **Não** construir busca vetorial sobre texto de lei. O guardrail 3 proíbe o assistente de gerar
  fundamento jurídico, então recuperação semântica não teria consumidor legítimo (ADR 0024).
- **Não** criar limiar por número de credores. A lei não define quantidade, e um "a partir de três
  dívidas" seria número inventado numa tela que manda a pessoa procurar o Procon.
- **Não** afirmar que alguém se enquadra na lei. A definição legal exige boa-fé e dívida de
  consumo, apuradas caso a caso — o produto **nomeia o caminho**, nunca o diagnóstico.
- **Não** dar trilha a todo número derivado do produto. Quatro, escolhidas por consequência:
  `capacidadeHoje`, `naoFecha`, `valorJusto` e `possivelPrescricao`.
- **Não** substituir a revisão por advogado. Ela continua sendo gate de pré-lançamento; o que esta
  feature faz é dar a ela um alvo delimitado — quinze entradas num arquivo.

## Jornada e interface

### Caixa

A cascata ganha, **dentro do próprio card**, um disclosure "Como calculamos" fechado. Aberto,
mostra a fórmula em palavras, os passos, **o que a conta não faz** e as normas — cada uma com
ementa, texto literal quando existe, vigência e link.

Quando `naoFecha` é verdadeiro, o aviso que já existia ganha o mesmo disclosure ao lado. Sem ele,
"é um caminho previsto em lei" seria exatamente o tipo de afirmação sem procedência que o produto
recusa no resto da tela.

### Rota

`naoFecha` passa a chegar em `GET /v1/dividas/resumo`, e a tela de abertura nomeia o caminho com a
mesma frase. Quem está nessa situação não deveria precisar procurar a informação numa aba adiante.

**Ausente é "não sabemos", nunca "está tudo bem"** — a tela testa `=== true`, e um `?` trataria os
dois como iguais.

### Revisão

O disclosure entra **depois** dos achados e **antes** do script: a pessoa já viu o número e os
pontos que o sustentam, e ainda não levou o roteiro ao credor. Aparece nos três estados da tela,
inclusive **sem achado nenhum** — é aí que explicar importa mais.

### Triagem do onboarding

Quem marcou **duas ou mais** dívidas recebe um convite: negociar uma de cada vez costuma não
resolver, existe um caminho para renegociar todas de uma vez, e **informar a renda no Caixa** é o
que mostra se as parcelas cabem. Nenhuma afirmação sobre a situação de quem acabou de cadastrar.

### Os quatro estados

| Estado | Disclosure | Corpus |
|---|---|---|
| Carregando | não aparece — a tela ainda não tem trilha | a tela não espera por ele |
| Erro | idem; o erro é da tela que hospeda | falha silenciosa: a fonte não aparece, o número fica |
| Vazio | trilha sem fontes renderiza fórmula, passos e limitações | corpus vazio esconde só o bloco das normas |
| Conteúdo | fórmula, passos, limitações e normas resolvidas | ementa, texto, vigência e link |

## Regras

1. **A trilha não carrega valor nenhum.** Teste falha se qualquer dígito aparecer no texto dela.
2. **`limitacoes` nunca é vazio**, e a tela nunca o esconde.
3. **O registro é exatamente o que alguma regra cita.** Teste falha com fonte órfã.
4. **Id citado sempre existe.** Conferido no import de `trilhas.py` e por teste.
5. **`fonte` e `fonteIds` viajam juntos** — tirar o primeiro quebraria app instalado.
6. **A palavra que nomeia o instituto não aparece na copy, nem negada.** Ela existe apenas nas
   ementas das quatro normas cujo assunto é o instituto, e há teste com a lista fechada.
7. **`GET /v1/juridico/fontes` exige sessão**, e não custa assinatura.
8. **O corpus não bloqueia tela nenhuma.** O número vem da resposta que o hospeda.

## Critérios de aceite

- [x] Lei 14.181/2021 no corpus: art. 54-A § 1º e § 3º, 104-A e § 1º, 104-C, e art. 6º, XI.
- [x] Os ids são `cdc-*`, não `lei-14181-*` — quem confere procura o artigo no Código.
- [x] `Achado` manda `fonteIds` além de `fonte`, e o do seguro prestamista manda **duas**.
- [x] `GET /v1/juridico/fontes` devolve o corpus inteiro, com ordem estável, e exige sessão.
- [x] Caixa manda as duas trilhas **sempre**, inclusive com `naoFecha: false`.
- [x] Revisão manda a trilha **sempre**, inclusive sem achado.
- [x] `naoFecha` chega à Rota, e ausente não é renderizado como tranquilidade.
- [x] A triagem convida quem marcou 2+ e não afirma nada; quem marcou uma não recebe o convite.
- [x] Nenhuma copy nova diagnostica o usuário — teste sobre a árvore renderizada.
- [x] O disclosure nasce fechado e sempre mostra o bloco de limitações.
- [x] Sem corpus, o número continua na tela e só a fonte não aparece.
- [ ] **Validação em aparelho** — legibilidade do bloco aberto, alvo de toque, safe area. Humano.
- [ ] **Revisão da copy jurídica por advogado** — gate de pré-lançamento do `roadmap.md`. Humano.

## Riscos e limitações aceitas

- **As ementas são paráfrase nossa e ainda não foram revisadas por advogado.** O `texto` literal
  ficou `None` nas entradas da Lei 14.181/2021 exatamente por isso: `None` significa "leia na
  fonte", e o link do Planalto vai junto.
- **Trilha é convenção, não obrigação.** Nada no código força uma regra nova de domínio a ganhar a
  sua; o teste cobre as quatro que existem.
- **`fonte` e `fonteIds` são redundantes** enquanto houver app instalado sem o segundo.
- **A numeração da ADR assume que a 0023 (F-016) entra antes.** As duas branches tocam
  `docs/adr/README.md`, `roadmap.md`, `docs/inventario.md` e `docs/api-contract.md`.
