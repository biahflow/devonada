# Evidência — F-017 Lei do Superendividamento no corpus

**Data:** 2026-09-01 · **Issues:** #13, #14, #15 · **ADR:** 0024 · **Branch:** `m14-superendividamento`

## Baseline

Partindo da `main` em `653224d`: **620 testes Jest em 50 suítes** e **733 pytest**, todos verdes.
Nenhuma falha pré-existente encontrada, nenhuma introduzida.

**Esta branch NÃO contém o F-016** (login social, PR #18), que estava em curso na mesma árvore. As
duas features foram separadas antes de o M14 começar, justamente para os diffs não se misturarem.

## Gates locais — todos verdes em 01/09/2026

| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | passa |
| lint | `npm run lint` | passa |
| test | `npm test -- --forceExit` | **631 testes em 51 suítes** (era 620/50) |
| bundle | `npm run bundle:check` | passa |
| palette | `npm run palette:check` | passa — **par novo medido**: `primaryDeep` sobre `neutralSurface` = **10,51:1** (piso 4,5:1) |
| digits | `npm run digits:check` | passa (nenhuma fonte tocada) |
| pytest | `pytest backend -q` | **760 testes** (era 733) |

`pytest` em Python 3.12 via `uv`. **Contra Postgres não foi executado** — não há migration nesta
feature, mas a regra de release continua valendo.

## Testes novos

**Backend, +27:**

- `backend/tests/test_juridico.py` (13) — o registro e as trilhas: **nenhuma fonte órfã** (derivado
  do código-fonte dos produtores de achado, não de lista à mão), todo id citado existe, id
  desconhecido **estoura** em vez de devolver nada, toda trilha declara limitações, **nenhuma
  trilha carrega dígito**, e a fronteira da palavra proibida — lista fechada de quatro normas que
  podem nomear o instituto, e nenhuma copy que possa.
- `backend/tests/test_juridico_api.py` (14) — o corpus atravessando a API: rota autenticada, ordem
  estável, todo id de achado e de trilha **resolvível** em `GET /v1/juridico/fontes`, a trilha da
  revisão presente **sem achado nenhum**, `naoFecha` ausente na Rota sem caixa, e Rota e Caixa
  dizendo a mesma coisa.

**App, +11:**

- `src/test/screens/como-calculamos.test.tsx` — o disclosure nasce fechado, abre com fórmula/passos
  /limitações, resolve o id em norma-ementa-vigência, **degrada sem o corpus** (o número fica, a
  fonte não aparece), a triagem **convida** quem marcou várias sem afirmar, quem marcou uma não
  recebe o convite, e a árvore renderizada não contém nenhuma das quatro palavras proibidas.

## Quatro defeitos que os próprios testes pegaram

1. **Três fontes nasceram órfãs** — as exclusões do art. 104-A § 1º, do art. 54-A § 3º e do art. 4º
   do Decreto 11.150. O teste de fonte órfã as apontou; em vez de removê-las, viraram **limitações
   declaradas** da trilha do `naoFecha`, que é onde elas de fato pertencem.
2. **A trilha da prescrição carregava um dígito** (`> 5 anos`). Reescrita por extenso: o gate contra
   valor na trilha é cego de propósito, e um prazo de lei escrito "cinco" não o obriga a ficar
   esperto.
3. **A copy usava a palavra proibida, negando-a.** A primeira redação dizia "isto NÃO diz que você
   está superendividado", e o teste de copy do M7 (`test_o_campo_nunca_se_chama_superendividado`)
   quebrou. Ele estava certo: negar um diagnóstico ainda o planta em quem lê. Mesmo caso com
   "ilegal" na trilha do valor justo.
4. **`GET /v1/juridico/fontes` estava pública** — o docstring afirmava exigir sessão e a
   dependência nunca foi ligada. O teste `test_exige_sessao` pegou a mentira do próprio comentário.

## Divergência de documentação corrigida no caminho

A tabela de ADRs de `docs/inventario.md` estava parada no **0018** desde o M11: 0019, 0020, 0021 e
0022 existiam em `docs/adr/README.md` e não constavam ali. Corrigidas neste commit, com a nota de
que o inventário é visão derivada e o `README.md` das ADRs é a fonte canônica.

## O que NÃO foi validado

- **Nada em aparelho.** Legibilidade do bloco aberto, alvo de toque do gatilho, safe area, e o
  comportamento do `Linking.openURL` para o Planalto.
- **A copy jurídica não foi revisada por advogado.** É gate de pré-lançamento que o `roadmap.md` já
  exigia; as ementas da Lei 14.181/2021 são paráfrase nossa, e o `texto` literal ficou `None` nelas
  exatamente por isso.

## Aprovações humanas ainda necessárias

1. **Revisão da copy jurídica por advogado** — quinze entradas em `backend/juridico/fontes.py` e
   quatro trilhas em `trilhas.py`. É o único item do roadmap que pode **encerrar** o produto em vez
   de atrasar um release, e agora ele tem alvo delimitado.
2. **Validação em aparelho** das quatro telas alteradas.
3. **Merge do PR** — e, na integração com o F-016, resolver `docs/adr/README.md`, `roadmap.md`,
   `docs/inventario.md` e `docs/api-contract.md`, que as duas branches tocam.
