# Evidência — F-018 Termos e Política de Privacidade

**Data:** 2026-09-01 · **Issue:** #10 · **Branch:** `f-018-termos-e-privacidade`

## Baseline

Partindo da `main` em `6349a9d`, já com o F-016 e o F-017 integrados: **654 testes Jest em 52
suítes** e **800 pytest**, todos verdes. Nenhuma falha pré-existente, nenhuma introduzida.

## Gates locais — todos verdes em 01/09/2026

| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | passa |
| lint | `npm run lint` | passa |
| test | `npm test -- --forceExit` | **657 testes em 52 suítes** (era 654/52) |
| bundle | `npm run bundle:check` | passa |
| palette | `npm run palette:check` | passa — o link legal usa `primary` sobre `background`, par já declarado |
| digits | `npm run digits:check` | passa |
| pytest | `pytest backend -q` | **819 testes** (era 800) |

## Testes novos

**Backend, +15** — `backend/tests/test_paginas_publicas.py`:

- **Acesso:** as três abrem **sem sessão** (é o revisor da loja em navegador anônimo, e quem
  perdeu o acesso à conta), a folha responde como `text/css`, e nenhuma delas entra no OpenAPI.
- **Navegação:** as três usam a folha compartilhada, termos e política se apontam, as duas apontam
  para a exclusão, e — o teste que mais protege — **todo `href` interno é varrido e precisa
  responder `200`**. Derivado, não lista à mão: página nova com link morto quebra aqui em vez de
  na frente do revisor.
- **Minuta:** termos e política ainda a carregam; a `/exclusao` não. Tirar a faixa passa a ser uma
  decisão que quebra um teste, em vez de um esquecimento silencioso.
- **Conteúdo que as lojas cobram:** o envio do documento ao provedor de IA está dito, a ausência de
  telemetria e de localização também, "ver e apagar nunca é recurso pago" também, os termos negam
  as quatro coisas que o produto não é, nenhuma página afirma ilegalidade, e nenhuma cita a marca
  anterior (ADR 0020, item 3).

**App, +2** — em `src/test/screens/autenticacao.test.tsx`: o toque em cada link abre a URL
configurada, e a frase legal continua legível inteira depois de fatiada em três pedaços.

## Decisões tomadas no caminho

**A folha de estilo foi extraída.** Com uma página, o `<style>` embutido era o certo; com três,
seriam três cópias dos mesmos tokens, e a que ninguém atualizasse ficaria com outra cor que as
irmãs. Páginas legais com aparências diferentes levantam pergunta em revisão de loja. A
`/exclusao` foi alterada só para apontar para a folha — o CSS é byte a byte o que estava nela.

**O link degrada para texto.** `EXPO_PUBLIC_URL_TERMOS` e `EXPO_PUBLIC_URL_PRIVACIDADE` vazias
devolvem a frase ao que ela era. É o mesmo desenho dos botões sociais do F-016, e pelo mesmo
motivo: um caminho que não leva a lugar nenhum é pior que a ausência dele.

**A URL é variável, não `apiBaseUrl + '/termos'`.** As páginas são servidas pelo backend hoje, mas
o destino delas é um domínio público; derivar a URL da base da API amarraria um link que vai para o
site ao endereço do servidor, que muda.

## O que NÃO foi validado

- **Nada em aparelho.** O toque no link e a abertura do navegador do sistema.
- **As páginas não foram renderizadas em navegador por mim.** O que os testes provam é que elas
  respondem, se apontam e dizem o que precisam dizer — não que estão bonitas ou bem quebradas em
  telas estreitas.
- **O texto não foi revisado por advogado**, e é por isso que a faixa de minuta existe.

## Passada de conferência de citação — e os três erros que ela achou

Antes de declarar o item pronto para o advogado, cada uma das 15 citações do corpus foi conferida
**contra a fonte que ela alega**, com busca na web. Não é revisão jurídica — quem conferiu não é
advogado, e o que foi checado é se a citação corresponde à norma, não se o uso dela está correto.

**Três erros confirmados e corrigidos, todos travados por teste:**

1. **A ementa da Súmula 566/STJ citava a MP 1.963-17/2000.** Essa é a norma da **Súmula 539**
   (capitalização de juros); a 566 trata da **Resolução-CMN 3.518/2007**, vigente desde 30/04/2008.
   Era informação jurídica errada exibida na tela.
2. **Os dispositivos originais do CDC declaravam vigência 11/09/1990** — a data da *lei*. O CDC só
   entrou em vigor em **11/03/1991**, porque o art. 118 lhe deu 180 dias de vacatio. A tela dizia
   "vigente desde 1990" para um código que ainda não valia naquela data.
3. **As seis entradas da Lei 14.181/2021 traziam 01/07/2021**, de novo a data da lei; a publicação
   no DOU foi em **02/07/2021**.

**Uma armadilha de renderização, corrigida junto:** `cnps-teto-consignado` tem uma *frase* no campo
de vigência — o teto vem de config datada, não do texto da norma —, e a tela concatenava "vigente
desde " com ela. Hoje nenhuma trilha a cita, então não aparecia; era defeito esperando. A tela
passou a usar o prefixo só quando o valor é data (e a formatar a data em BR), e o backend declara a
exceção em `SEM_DATA_FIXA`, com teste dos dois lados.

**Dois pontos não puderam ser verificados** e viraram pergunta objetiva no pacote: o número do
artigo do Decreto 11.150 que trata das exclusões, e a tese do Tema 972/STJ. O Planalto recusou as
requisições, e nenhuma fonte alternativa trouxe o texto literal.

## O pacote de revisão

`docs/legal/pacote-de-revisao-juridica.md` é a tarefa inteira para quem for revisar: todo o texto
jurídico que o produto exibe — 15 normas com a paráfrase que o usuário lê, 4 trilhas com as
limitações declaradas, e as duas páginas —, onde cada trecho aparece, e **sete perguntas de
resposta curta**. Não é preciso ler código.

## Aprovações humanas ainda necessárias

1. **Revisão por advogado** dos dois textos. Depois dela: apagar o bloco marcado com
   `<!-- APAGUE ESTE BLOCO DEPOIS DA REVISÃO JURÍDICA -->` nas duas páginas, atualizar a data do
   rodapé, e ajustar o teste `TestMinuta` — ele existe para a remoção ser deliberada.
2. **Hospedar em `devonada.com.br` e apontar o DNS**, e então preencher as duas variáveis
   `EXPO_PUBLIC_URL_*` com as URLs públicas. É a mesma pendência que a `/exclusao` já tinha.
3. **A caixa `contato@devonada.com.br` existir e ser lida.** As três páginas prometem resposta em
   até 30 dias, e endereço que não recebe é tão ruim quanto endereço errado.
4. **Preencher o *App Privacy* e o *Data safety*** no console de cada loja, com a seção 6 de
   `docs/legal/inventario-de-dados.md` ao lado. O guia é leitura do código, não decisão jurídica:
   quem responde no console assume a declaração.
5. **Nomear o controlador com CNPJ** na política, quando a publicação sob CNPJ acontecer.
6. **Merge do PR.**
