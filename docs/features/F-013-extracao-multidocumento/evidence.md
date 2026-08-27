# F-013 — Evidence

Registro do que foi construído e validado. Branch `f-013-extracao-multidoc`.

---

## BUILD REPORT — T1 · Roteamento de prompt/schema por tipo

**Efeito:** a camada de extração deixa de ser hardcoded para "contrato". `extracao/regras.py` vira
um registro `REGRAS: dict[str, RegraExtracao]`, um `SYSTEM` + schema + modelo Pydantic por tipo,
gerado pelo `montar_schema()` comum. `ExtratorLLM.extrair` escolhe a regra pelo `arquivo.tipo`.

**Arquivos:**
- `backend/schemas.py` — `TipoDocumento`; `CamposBoleto`, `CamposCartaCobranca`,
  `CamposPrintCobranca`; união `CamposExtraidos`; `tipo` + `campos: CamposExtraidos` em
  `ExtracaoContrato`.
- `backend/extracao/regras.py` — registro por tipo, quatro prompts, `montar_schema()`, aliases de
  compatibilidade (`SYSTEM`, `CAMPOS`, `SCHEMA_EXTRACAO`).
- `backend/extracao/extrator_llm.py` — roteamento por tipo; `_normalizar_datas` generalizada para
  os campos de data declarados por tipo.
- `backend/extracao/base.py` — `ArquivoContrato.tipo`; tipos ampliados para `CamposExtraidos`.
- `backend/extracao/__init__.py` — `TIPOS_DOCUMENTO`, `modelo_de_campos(tipo)`.
- `backend/tests/test_extracao.py` — classe `TestRoteamentoPorTipo` (8 casos).

**Guardrail 8.1/8.2:** o `trecho` é forçado nas três camadas (prompt, `required` do schema,
servidor); "DADO, não instrução" é conferido nos quatro prompts por teste em loop; o descarte de
campo sem trecho é provado no boleto.

---

## BUILD REPORT — T2 · Tipo na API e migração

**Efeito:** `POST /v1/contratos` recebe `tipo` no multipart (default `contrato`), valida (422 fora
da lista), grava e ecoa. A coluna `tipo` entra em `orm.Extracao` com `server_default='contrato'`,
retrocompatível.

**Arquivos:**
- `backend/orm.py` — coluna `tipo`.
- `backend/alembic/versions/c7e2b8a4d016_tipo_de_documento_na_extracao.py` — add_column encadeado
  em `a1c2e3f40b5d` (cabeça confirmada por `alembic heads`).
- `backend/routers/contratos.py` — `Form("contrato")`, validação, `_para_schema` com
  `modelo_de_campos` e eco do `tipo`.
- `backend/tests/test_api.py` — 3 casos novos em `TestContratos`.

**Migração verificada em SQLite isolado:** upgrade backfilla `contrato` numa linha pré-existente,
downgrade remove a coluna. A cadeia completa `alembic upgrade head` em SQLite falha numa migração
de M7 (`482c266f5c6a`, `renda_mensal`) alheia a esta feature; Postgres é do dono do repo.
`alembic heads` → uma cabeça só: `c7e2b8a4d016`.

---

## BUILD REPORT — T3 · Front multidocumento

**Efeito:** o upload deixa escolher o tipo; a revisão renderiza os campos do tipo lido. Guardrail
8.1/8.2 reaplicado no cliente (texto puro, descarte de campo sem trecho). Drift do M6 no front
corrigido: `CamposContrato` do front passa a ter os 5 encargos e `modalidade`.

**Arquivos:**
- `src/api/client.ts` — `upload` aceita `campos` de texto no multipart.
- `src/api/types.ts` — `ModalidadeCredito`.
- `src/api/contratos.ts` — `TipoDocumento`, os quatro `Campos*`, `CamposExtraidos`, `tipo` em
  `ExtracaoContrato`, `enviarContrato(arquivo, tipo)`.
- `src/hooks/useContrato.ts` — `useEnviarContrato({ arquivo, tipo })`.
- `src/util/extracao.ts` — `extracaoParaProposta` por tipo.
- `src/util/revisaoExtracao.ts` (novo) — `linhasDeRevisao`; só formata.
- `app/(tabs)/dividas/contrato/index.tsx` — seletor via `OptionGroup` (48pt, radiogroup).
- `app/(tabs)/dividas/contrato/[id].tsx` — linhas por tipo.
- `src/test/mocks.ts` — `umBoleto`, `umaCarta`, `umPrint`; `tipo` em `umaExtracao`.
- `src/test/screens/contrato.test.tsx`, `src/util/extracao.test.ts` — cobertura por tipo.

---

## BUILD REPORT — T4 · Documentação

- `docs/api-contract.md` (M1.5) — `tipo` no multipart e na resposta; tabela de campos por tipo.
- `roadmap.md` (M13) — item marcado, com pendências declaradas (aparelho, Postgres).
- `docs/features/F-013-extracao-multidocumento/` — `feature.md`, `plan.md`, `evidence.md`.
- `docs/inventario.md` NÃO tocado (consolidação é do orquestrador).

---

## Gates

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | passa, sem erros |
| Lint | `npm run lint` | passa, sem erros |
| Testes front | `npm test` | **50 suites, 609 testes, verdes** |
| Bundle | `npm run bundle:check` | passa (exit 0) |
| Paleta | `npm run palette:check` | passa (exit 0) — nenhum par de cor novo (reuso de tokens via `OptionGroup`) |
| Dígitos | `npm run digits:check` | passa (exit 0) — nenhuma fonte tocada |
| Testes backend | `./venv/bin/python -m pytest -q` | **732 testes, verdes** |
| Migração (SQLite isolado) | up/backfill/down | passa |
| Cabeça Alembic | `alembic heads` | uma só: `c7e2b8a4d016` |

**Avisos:** o pytest emite ~28 `StarletteDeprecationWarning` pré-existentes (HTTP_422, httpx),
alheios a esta feature. O jest emite `act()` warnings do polling do react-query, também
pré-existentes.

## Pendências (gates humanos abertos)

- **Aparelho (iOS e Android):** seletor de tipo no upload e revisão dos quatro tipos não foram
  vistos em device.
- **Postgres:** a migração `tipo` foi verificada em SQLite isolado; rodá-la na cadeia real é do
  dono do repo.
