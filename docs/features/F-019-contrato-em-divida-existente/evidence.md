# Evidência — F-019

## Estado

`READY_FOR_REVIEW` — código completo, portões locais verdes, **device pendente**.
Branch: `f-019-contrato-em-divida-existente`. Sem commit até autorização.

## Baseline de entrada (medido em `main`, 03/09/2026, antes da feature)

| Portão | Baseline |
|---|---|
| `npm run typecheck` | limpo |
| `npm run lint` | limpo |
| Jest | 52 suítes / 657 testes |
| pytest (SQLite, `uv` + Python 3.12) | 819 testes |
| `npm run palette:check` · `npm run digits:check` | exit 0 |

Nenhuma falha pré-existente. Ambiente: não há `backend/venv/` nem `pytest` no PATH, e o `python3`
do sistema é 3.9. A suíte roda de `backend/` com
`uv run --python 3.12 --with-requirements requirements.txt --with pytest pytest`.

## Saída medida (03/09/2026)

| Portão | Saída |
|---|---|
| `npm run typecheck` | limpo |
| `npm run lint` | limpo |
| Jest | **54 suítes / 711 testes** (+2 suítes, +54 testes) |
| pytest | **858 testes** (+39) |
| `npm run palette:check` · `npm run digits:check` | exit 0 |

Nenhum par de cor novo foi introduzido: a tela usa `primary`/`inkSoft`/`ink` sobre `surface` e
borda `border`, todos já declarados em `scripts/paleta-check.mjs`.

## Arquivos alterados

**Backend (T1)** — `backend/routers/dividas.py`, `backend/schemas.py`, `backend/tests/test_api.py`.

**Front (T2)** — novos: `src/util/conciliacao.ts`, `src/components/dividas/PainelDeDocumento.tsx`,
`app/(tabs)/dividas/[id]/documento.tsx`, `src/util/conciliacao.test.ts`,
`src/test/screens/documento-divida.test.tsx`. Alterados: `src/api/types.ts`, `src/api/debts.ts`,
`src/hooks/useDividas.ts`, `app/(tabs)/dividas/contrato/[id].tsx`,
`app/(tabs)/dividas/[id]/index.tsx`, `app/(tabs)/dividas/[id]/revisao.tsx`,
`app/(tabs)/dividas/[id]/editar.tsx`, `src/test/screens/detalhe-divida.test.tsx`,
`src/test/screens/revisao.test.tsx`.

**Documentação** — `docs/adr/0025-…`, `docs/api-contract.md` (seção 3.16 e três referências
cruzadas), `docs/inventario.md`, `roadmap.md`, esta pasta.

**Não tocados, de propósito:** `app/(onboarding)/entrada.tsx`, `backend/alembic/`, `backend/orm.py`,
`src/test/screens/contrato.test.tsx` (o oráculo do refactor, zero linhas alteradas — verificado por
`git diff --stat`).

## Achados da revisão do modelo principal

A revisão do diff devolvido pelos subagentes encontrou e corrigiu quatro coisas:

1. **O oráculo de atomicidade não existia.** Os 16 testes do T1 cobriam os códigos de status, mas
   nenhum cobria "extração recusada deixa a dívida intacta" (RF-002). Acrescentado.
2. **Nenhum teste cobria a `message` em pt-BR** dos dois erros novos, que o contrato torna
   obrigatória e o app exibe direto ao usuário. Acrescentado — e a primeira versão do teste estava
   errada (`detail.message`): o handler de `backend/main.py:58` desembrulha o `detail` para
   `message` no topo.
3. **Afirmação minha, corrigida por experimento.** Escrevi que o teste de atomicidade travaria uma
   reordenação do código. Injetei o defeito para conferir: **o teste passa** com a ordem invertida,
   porque a exceção impede o commit e a sessão descarta a alteração. Quem garante a atomicidade é a
   transação, não a ordem das linhas. O que o teste **pega** (também verificado por injeção) é um
   `commit()` prematuro. O docstring do teste diz exatamente isso, incluindo o que ele não pega.
4. **O vazio da revisão mentiria para quem já mandou documento.** O botão novo foi para o ramo
   "nenhum achado", que também recebe quem tem contrato lido e **limpo** — "sem achado" não
   distingue "não conferimos" de "conferimos e estava certo". Como estava, a tela mandaria a pessoa
   enviar de novo o documento que ela já enviou, agora com um botão levando lá. Corrigido: a tela lê
   `Divida.extracaoId` (a query do detalhe, quase sempre em cache), troca a copy e o rótulo vira
   "Trocar o documento". Com teste.

## Desvio de plano registrado

**`app/(tabs)/dividas/[id]/editar.tsx` não estava no mapa de arquivos e teve de entrar.** Ele fazia
`inicial={{ ...divida, ...proposta }}`, e `DividaForm` repassa `inicial.extracaoId` para o corpo da
submissão. Com `Divida` passando a devolver `extracaoId` (RF-008), o spread colocaria o campo dentro
de um **PATCH** — que o servidor ignora em silêncio (ADR 0025, decisão 1). O `typecheck` pegou. O
conserto foi listar os campos do formulário em vez de espalhar a dívida inteira. Verificado que
`paramsParaProposta` (a outra fonte do spread) nunca carrega `extracaoId`, então o conserto é
completo.

Classificação: consequência direta da mudança de tipo que o contrato pediu, não ampliação de escopo.

## Ampliação de escopo aceita

`POST /v1/dividas` passou a validar `extracaoId` (RF-007). Decidido pelo usuário em 03/09/2026, e
registrado como decisão explícita — não conserto silencioso. Declarada na ADR 0025 e em
`api-contract.md`. Nenhum teste pré-existente quebrou.

## Suposições

- Os dois caminhos que já enviavam `extracaoId` só o fazem com extração do próprio tenant e
  `status === "concluida"` — verificado na leitura do código antes de especificar.
- A conciliação cobre os cinco campos que `Divida` tem coluna para. Os encargos ficam com o vínculo.

## Riscos remanescentes

- **Device.** Layout da lista de conciliação em tela pequena, contraste percebido, safe area e
  seletor nativo de arquivo **não foram validados em aparelho**. Nenhum portão prova isso.
- **Limitação 22** (`docs/inventario.md`): aceitar `valorCobrado` do documento numa dívida com
  cronograma deixa as parcelas com o total antigo. Pré-existente do PATCH; ganhou um segundo
  caminho de chegada.
- **Limitação 23**: o mapa campo→trecho vive em dois módulos e pode divergir em silêncio.
- Duas cópias da máquina de quatro estados seguem de pé (`PainelDeDocumento` e `entrada.tsx`),
  declaradas na ADR 0025.
- Rótulos de criticidade agora em quatro lugares (`Badge.tsx`, `DividaForm.tsx`,
  `onboarding/tiposDeDivida.ts`, `conciliacao.ts`) — candidato a divergir.

## Segunda rodada — limitações 22 e 23 fechadas (03/09/2026)

Pedido do usuário depois da entrega da F-019. As duas nasceram como limitação declarada desta
feature e foram fechadas na mesma branch.

### Limitação 23 — o mapa campo→trecho tinha duas cópias

`camposDaDivida` (`src/util/extracao.ts`) virou a definição única, tipada campo a campo.
`extracaoParaProposta` monta a proposta a partir dela; `linhasDeConciliacao` a indexa para achar o
trecho. O segundo `switch` deixou de existir.

O teste que trava o invariante **não olha para o mapa** — percorre as duas funções públicas, como a
tela faz: para os quatro tipos de documento, todo campo proposto tem de virar linha com `trecho` à
vista. Sobrevive a alguém reseparar os mapas no futuro.

`linhasDeRevisao` (`src/util/revisaoExtracao.ts`) **não** foi unificado: monta as linhas de todos os
campos do documento, encargos inclusive, e não é o mesmo mapa.

### Limitação 22 — carnê defasado ao mudar o valor cobrado

`ajustar_parcelas_pendentes` (`backend/routers/parcelas.py`), chamada por `atualizar()` e por
`ligar_documento()`. As pendentes passam a somar `novo valor − já pago`, mantendo datas, quantidade
e **ids** — decisão tomada porque `routers/lembretes.py` manda `parcelaId` no payload do push, e
recriar parcela quebraria deep link em voo. Cancelar-e-recriar é semântica de renegociação, que é
outro evento.

O método de divisão ganhou fonte única: `dividir_valor` (`backend/domain/parcelas.py`), usada
também por `gerar_cronograma` — mesma disciplina da 23, aplicada à aritmética.

**Onde a implementação se recusa a decidir:** novo valor abaixo do já pago → `409`, nada alterado.
E carnê inteiramente pago não é ajustado, porque mexer em parcela paga falsificaria histórico —
limitação residual declarada, não buraco escondido.

O aviso ao usuário existe nas duas telas (edição e conciliação) e **não traz número**: o valor novo
de cada parcela é conta do servidor.

### Achados da revisão desta rodada

1. **Cinco referências a uma feature inexistente.** O código veio comentado com "F-020" em
   `domain/parcelas.py`, `routers/parcelas.py`, `routers/dividas.py` (duas) e
   `tests/test_parcelas_api.py`. Não existe F-020: isto é a limitação 22 dentro da F-019.
   Corrigidas — referência fantasma em comentário vira alucinação de quem for ler depois.
2. **Filtro de tenant ausente** na query de `ja_pago`, apontado por revisão e corrigido antes de eu
   ler o diff. Conferido na fonte (`backend/routers/parcelas.py:96`), não no relato.
3. **Vocabulário.** Instruí a copy a usar "carnê" afirmando que era palavra do produto. A conferência
   com `grep` truncado disse que não era; a conferência completa mostrou que **é** — `plano.tsx:54`
   já dizia "Sem carnê para esta dívida", em 9 ocorrências no app. O termo não estava no glossário,
   e entrou em `docs/domain.md` com o registro de que "carnê" é a palavra da interface e "plano de
   pagamento" a do código.

### Dois bugs pré-existentes, registrados e não consertados

Achados ao mapear o domínio de parcelas, ambos anteriores à F-019. Viraram as limitações **24** e
**25** do `docs/inventario.md`, por decisão do usuário de não misturá-los a este diff:

- `divida.parcelas_pagas` **nunca é escrito** por nenhuma linha do backend. A tela de detalhe mostra
  "0 de 12 pagas" mesmo com o carnê quitado. É bug visível ao usuário.
- `divida.proximo_vencimento` **não avança** quando uma parcela é paga.

## Decisões humanas pendentes

- Autorização para commit e abertura de PR (nada foi commitado).
- Validação em aparelho.
- Nenhum gate jurídico novo: esta feature não acrescenta texto de norma nem afirmação legal.
