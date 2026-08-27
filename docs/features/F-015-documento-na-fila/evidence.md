# F-015 — Evidence

Handoff de revisão da feature F-015 (documento lido inline na fila multi-dívida). Consolida
referências; não substitui os artefatos que aponta.

## Round

```text
round: 1
reviewed_state: branch `f-015-documento-na-fila`, ramificada de `main` @ 4f7b150.
  Commit 1 (Parte 1, conserto do vínculo extracaoId): e473c46.
  Commit 2 (Parte 2, feature + ADR 0022 + FDD): este commit.
authorization: o usuário autorizou reverter o ponto 5 da ADR 0016 e proceder. A ADR 0022 e o PR
  são o gate humano.
```

---

## 1. Contrato e plano

| Artefato | Onde |
|---|---|
| Feature Contract | [`feature.md`](feature.md) |
| Execution Plan | [`plan.md`](plan.md) |
| Decisão de arquitetura | `docs/adr/0022-documento-inline-na-fila-multi-divida.md` (revoga o ponto 5 da ADR 0016) |
| Contrato de API | `docs/api-contract.md` — `POST /v1/dividas` e "POST /v1/dividas com vínculo" |
| Guardrails que dominam | `docs/guardrails.md`, seção 8 inteira; ADR 0016 ponto 4; ADR 0005; ADR 0008 |

---

## 2. Arquivos alterados

### Commit 1 — Parte 1 (conserto do vínculo `extracaoId`)

| Arquivo | O quê |
|---|---|
| `src/api/debts.ts` | `NovaDivida` ganha `extracaoId?: Uuid`. |
| `src/util/extracao.ts` | `extracaoParaProposta` carrega `extracaoId` (chave da leitura, isenta do descarte 8.1). |
| `src/components/dividas/DividaForm.tsx` | Repassa `inicial.extracaoId` ao `onSubmit` sem virar campo editável. |
| `docs/api-contract.md` | `extracaoId` explícito no exemplo e no bloco de vínculo, com a regressão nomeada. |
| `src/util/extracao.test.ts` | Prova que a proposta carrega o `extracaoId` (falha antes do conserto). |
| `src/test/screens/contrato.test.tsx` | Prova que confirmar a revisão posta `extracaoId` (falha antes do conserto). |

### Commit 2 — Parte 2 (a feature)

| Arquivo | O quê |
|---|---|
| `app/(onboarding)/entrada.tsx` | Documento inline na fila: quatro estados, revisão campo-a-campo com trecho, POST com vínculo. Invariante "nada gravado antes do fim" preservado. |
| `src/test/screens/onboarding.test.tsx` | Regra nova (upload inline na fila) + estados + vínculo + invariante. |
| `roadmap.md` | M13 "Documento durante a fila multi-dívida" → `[x]`. |
| `docs/adr/0022-*.md` | ADR nova, status aceito. |
| `docs/features/F-015-documento-na-fila/*` | `feature.md`, `plan.md`, `evidence.md`. |

---

## 3. Gates

Rodados na worktree (deps linkadas do checkout principal).

| Gate | Resultado |
|---|---|
| `npm run typecheck` | passa |
| `npm run lint` | passa |
| `npm test` (jest) | **50 suítes / 620 testes**, verde (+6 net vs. baseline 614) |
| `npm run bundle:check` | passa (`expo export` ios, bundle 4.8 MB) |
| `npm run palette:check` | passa (nenhuma cor tocada) |
| `npm run digits:check` | passa (nenhuma fonte tocada) |
| backend `pytest -q` | **733 testes**, verde (28 avisos pré-existentes) |

Nota de execução: `npx jest <arquivo-único>` deixa um handle aberto (o polling de `useExtracao`),
o que exige `--forceExit` ao rodar UM arquivo isolado; a suíte completa (`npm test`) encerra
normalmente. Nenhum teste toca a rede.

---

## 4. Requisitos → prova

| RF | Prova |
|---|---|
| RF-001 / RF-002 / RF-003 | `extracao.test.ts` (proposta com `extracaoId`); `contrato.test.tsx` ("ao confirmar, cria a dívida LIGADA à extração"). |
| RF-004 | `onboarding.test.tsx` "oferece o documento inline na fila, sem sair do grupo". |
| RF-005 / RF-008 | quatro estados no `renderDocumento` de `entrada.tsx`; aviso de descarte antes do toque; teste da falha ("seguir só pelo valor"). |
| RF-006 | `onboarding.test.tsx` "mostra a revisão com o trecho do documento antes de aceitar". |
| RF-007 | `onboarding.test.tsx` "lê o documento, pré-preenche e liga o extracaoId; a sem documento segue por valor" e "não grava nenhuma dívida antes do fim, mesmo com documento lido e aceito". |

---

## 5. Pendências

- **Device (iOS e Android):** seletor nativo de arquivo, teclado, safe area com notch, e a
  percepção de que a fila com leitura assíncrona não parece travamento. Um agente não valida isto;
  fica declarado.
- **Consolidação do `docs/inventario.md`:** a limitação #15 fica **resolvida** por esta feature,
  mas a edição do inventário é do orquestrador — não tocada aqui.
- **Revisão humana de copy:** a copy da fila e da revisão inline entra na mesma revisão de copy de
  negociação do milestone.
