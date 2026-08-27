# F-013 — Execution Plan

Produzido a partir do Feature Contract em [`feature.md`](feature.md). Diz **como** a feature é
decomposta. O usuário autorizou execução sem travar em gate humano de planejamento; as decisões de
schema/prompt são de método e estão registradas no contrato (*Decisões de método*) e nos docstrings.

---

## FEATURE EXECUTION PLAN

```text
feature_id: F-013

goal: Estender a extração por LLM — hoje 100% hardcoded para "contrato" — para quatro tipos de
  documento (contrato, boleto, carta, print de cobrança), cada um com prompt e schema próprios,
  sem afrouxar o guardrail 8: campo sem trecho citável é descartado, e o arquivo é lido e
  descartado.

assumptions:
  - A camada de provedor (`llm/`) é agnóstica de capacidade e de tipo; não muda.
  - A cabeça da cadeia Alembic é `a1c2e3f40b5d` (confirmada por `alembic heads`). Só T2 escreve
    migração.
  - `limpar_campos_sem_evidencia` já é genérica — varre `type(campos).model_fields` —, e alcança
    qualquer conjunto de campos `CampoExtraido` sem um ramo por tipo.
  - Nenhum teste toca a rede; a suíte pytest roda em SQLite via metadata (não via migração).
  - As escolhas de schema/prompt são método de leitura, não regra financeira: não levam fonte
    legal, mas também não produzem número — campo sem trecho é `null`.

tasks:
  - id: T1
    role: builder
    goal: A camada de extração roteia prompt+schema+modelo por TIPO, num registro único, e o
      guardrail 8.1 continua valendo para os quatro.
    scope: |
      `backend/schemas.py` — `TipoDocumento`; `CamposBoleto`, `CamposCartaCobranca`,
        `CamposPrintCobranca`; a união `CamposExtraidos`; `tipo` e `campos: CamposExtraidos` em
        `ExtracaoContrato`.
      `backend/extracao/regras.py` — refatorado de um `SYSTEM`/`SCHEMA_EXTRACAO` únicos para um
        registro `REGRAS: dict[str, RegraExtracao]`, com `montar_schema()` gerador comum. Aliases
        `SYSTEM`/`CAMPOS`/`SCHEMA_EXTRACAO` mantidos apontando para `contrato`.
      `backend/extracao/base.py` — `ArquivoContrato.tipo` (default `contrato`); tipos de
        `ResultadoExtracao.campos` e `limpar_campos_sem_evidencia` ampliados para `CamposExtraidos`.
      `backend/extracao/extrator_llm.py` — `extrair` escolhe a regra pelo tipo, generaliza a
        normalização de data para os campos de data DECLARADOS por tipo.
      `backend/extracao/__init__.py` — `TIPOS_DOCUMENTO` e `modelo_de_campos(tipo)`.
      `backend/tests/test_extracao.py` — roteamento por tipo, guardrail 8.1 no boleto, data do
        boleto normalizada, prompt "DADO, não instrução" nos quatro, tipo desconhecido rejeitado.
    acceptance_criteria: |
      T1-AC1 Cada tipo usa seu SYSTEM e seu schema; há teste que confere as chaves do schema.
      T1-AC2 `trecho` é forçado no prompt (regra nº 1) e no `required` do schema, nos quatro.
      T1-AC3 `limpar_campos_sem_evidencia` zera valor sem trecho no boleto igual ao contrato.
      T1-AC4 "DADO, não instrução" aparece nos quatro prompts (teste em loop).
      T1-AC5 Tipo desconhecido não chega ao modelo (levanta `ErroDeExtracao`).
      T1-AC6 `venv/bin/python -m pytest` passa inteiro.
    depends_on: []
    validation: cd backend && ./venv/bin/python -m pytest -q

  - id: T2
    role: builder
    goal: O tipo chega à API e é persistido; a migração é forward-only e retrocompatível.
    scope: |
      `backend/orm.py` — coluna `tipo` em `Extracao` (`String(20)`, `server_default='contrato'`).
      `backend/alembic/versions/c7e2b8a4d016_*.py` — add_column encadeado em `a1c2e3f40b5d`.
      `backend/routers/contratos.py` — `enviar` recebe `tipo: str = Form("contrato")`, valida
        contra `TIPOS_DOCUMENTO` (422 fora da lista), grava e passa ao `ArquivoContrato`;
        `_para_schema` deserializa com `modelo_de_campos(e.tipo)` e ecoa `tipo`.
      `backend/tests/test_api.py` — default contrato, tipo válido viajando até a resposta, tipo
        desconhecido rejeitado com `campo: "tipo"`.
    acceptance_criteria: |
      T2-AC1 Sem `tipo`, a leitura nasce `contrato`; com `tipo` válido, ele viaja até o GET.
      T2-AC2 Tipo fora da lista → 422 com `campo: "tipo"`.
      T2-AC3 A migração sobe numa base com `extracao` sem a coluna, backfilla `contrato`, e desce
        limpo (verificado em SQLite isolado).
      T2-AC4 `alembic heads` devolve uma cabeça só (`c7e2b8a4d016`).
      T2-AC5 `venv/bin/python -m pytest` passa inteiro.
    depends_on: [T1]
    validation: cd backend && ./venv/bin/python -m pytest -q

  - id: T3
    role: builder
    goal: O front passa o tipo no upload e a tela de revisão funciona para qualquer tipo, com o
      guardrail 8.1/8.2 reaplicado no cliente.
    scope: |
      `src/api/client.ts` — `upload` aceita `campos` de texto no multipart (o `tipo` viaja aqui).
      `src/api/types.ts` — `ModalidadeCredito` (corrige drift do M6 no front).
      `src/api/contratos.ts` — `TipoDocumento`; `CamposContrato` completo (com encargos M6),
        `CamposBoleto`, `CamposCartaCobranca`, `CamposPrintCobranca`, `CamposExtraidos`; `tipo` em
        `ExtracaoContrato`; `enviarContrato(arquivo, tipo)`.
      `src/hooks/useContrato.ts` — `useEnviarContrato` recebe `{ arquivo, tipo }`.
      `src/util/extracao.ts` — `extracaoParaProposta` ramifica por tipo.
      `src/util/revisaoExtracao.ts` (novo) — `linhasDeRevisao(extracao)` monta as linhas por tipo;
        só formata, não calcula.
      `app/(tabs)/dividas/contrato/index.tsx` — seletor de tipo via `OptionGroup`.
      `app/(tabs)/dividas/contrato/[id].tsx` — renderiza as linhas do tipo lido.
      `src/test/mocks.ts` — `umBoleto`, `umaCarta`, `umPrint`; `tipo` em `umaExtracao`.
      `src/test/screens/contrato.test.tsx` e `src/util/extracao.test.ts` — cobertura por tipo.
    acceptance_criteria: |
      T3-AC1 O upload deixa escolher o tipo e o passa ao `enviarContrato`.
      T3-AC2 A revisão de um boleto mostra os campos do boleto e NÃO os do contrato (CET ausente).
      T3-AC3 Campo sem trecho não propõe valor em nenhum tipo (guardrail 8.1 no cliente).
      T3-AC4 O seletor tem alvo de 48pt e papéis de acessibilidade (via `OptionGroup`).
      T3-AC5 Os seis gates do front passam.
    depends_on: [T2]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check

  - id: T4
    role: builder
    goal: A documentação diz a verdade.
    scope: |
      `docs/api-contract.md` — `tipo` no multipart de `POST /v1/contratos`, `tipo` na resposta, e
        a tabela de campos por tipo.
      `roadmap.md` — item de M13 marcado, com o que ficou de pendência (aparelho, Postgres).
      `docs/features/F-013-extracao-multidocumento/` — `feature.md`, `plan.md`, `evidence.md`.
    acceptance_criteria: |
      T4-AC1 `api-contract.md` documenta o campo `tipo` e os campos de cada tipo.
      T4-AC2 O roadmap marca o item e declara as pendências.
      T4-AC3 `evidence.md` registra o resultado de cada gate com contagem.
    depends_on: [T1, T2, T3]
    validation: (revisão)

integration_strategy: |
  Execução sequencial num único worktree: T1 (extração), T2 (rota + migração), T3 (front), T4
  (docs). Cada camada validada antes da próxima. `docs/inventario.md` NÃO é tocado — consolidação
  é do orquestrador.

human_gates:
  - ABERTO — validar em aparelho (iOS e Android) o seletor de tipo e a revisão dos quatro tipos.
  - ABERTO — rodar a migração `tipo` contra Postgres (verificada em SQLite isolado; a cadeia
    completa em SQLite falha numa migração pré-existente de M7, sem relação com esta feature).
```

---

## Resultado da validação do plano

```text
PLAN_VALID
```

Quatro tarefas, dependências acíclicas (T1 → T2 → T3 → T4), critério de aceite por tarefa,
validação por comando real. Uma única migração (T2), encadeada na cabeça confirmada. Sem
`ARCHITECTURE_DECISION_REQUIRED`: as escolhas de schema/prompt são de método, registradas no
contrato.
