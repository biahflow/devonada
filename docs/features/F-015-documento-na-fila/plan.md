# F-015 — Execution Plan

Como a feature aceita em [`feature.md`](feature.md) foi decomposta. Não altera requisito nem concede
aprovação — a ADR 0022 e o PR são o gate humano.

---

## FEATURE EXECUTION PLAN

```text
feature_id: F-015

goal: Permitir mandar o documento de cada dívida DENTRO da fila multi-dívida do onboarding, com a
  leitura rodando inline (sem sair do grupo (onboarding)), para a dívida nascer ligada à extração e
  a triagem dela ter valor justo, achados e script. Antes disso, consertar a ligação
  dívida→extração, quebrada no cliente: o backend aceita e grava `extracaoId`, mas nenhum código do
  app o envia.

assumptions:
  - O backend já aceita e grava `extracaoId` (schemas.NovaDivida.extracaoId; routers/dividas.py) e
    a revisão já o lê (routers/revisao.py:186, `_campos`). O conserto é 100% cliente.
  - A ADR 0016 permanece aceita; a ADR 0022 revoga só o ponto 5. O ponto 4 (nada gravado antes do
    fim) é invariante e não pode ser tocado.
  - A extração é assíncrona; `useExtracao` já faz polling a 2,5 s com teto de 2 min. Reusar, não
    reescrever.
  - `linhasDeRevisao`/`CampoRevisao` já aplicam o guardrail 8 (campo sem trecho, texto puro).
    Espelhar a tela contrato/[id].tsx, não duplicar lógica.
  - Nenhum teste toca rede; SQLite no backend.

risks:
  - Quebrar o invariante "nada gravado antes do fim" ao trazer a leitura para a fila. Fechado por
    desenho: extração grava linha `extracao`, nunca `divida`; o POST de dívida só sai no fim. Teste
    gêmeo trava isso.
  - Vínculo dívida→extração voltar a se romper em qualquer um dos três elos (tipo, util, form).
    Fechado por par de testes que exercita os três.
  - Copy de fila mais longa lida como formulário sem fim. Mitigado pelos quatro estados e pela
    contagem visível; validação de percepção é de device.
```

---

## Tarefas

O trabalho é **dois commits**, na ordem abaixo. Não há paralelismo: um agente, um worktree.

### T1 — Conserto do vínculo `extracaoId` (Parte 1) — commit 1

- **Arquivos:** `src/api/debts.ts` (tipo), `src/util/extracao.ts` (carrega `extracaoId`),
  `src/components/dividas/DividaForm.tsx` (repassa sem virar campo), `docs/api-contract.md`.
- **Testes:** `src/util/extracao.test.ts` (proposta carrega `extracaoId`); `src/test/screens/
  contrato.test.tsx` (confirmar a revisão posta `extracaoId`). Ambos falham antes do conserto.
- **AC1:** `extracaoParaProposta(e).extracaoId === e.id` quando há campos.
- **AC2:** confirmar o `DividaForm` na tela de revisão dispara `POST /v1/dividas` com `extracaoId`.
- **AC3:** o descarte de campo sem trecho continua valendo (guardrail 8.1) — só o `extracaoId` é
  isento.

### T2 — Documento inline na fila (Parte 2) — commit 2

- **Arquivos:** `app/(onboarding)/entrada.tsx` (fluxo inline, quatro estados, revisão, POST com
  vínculo), `src/test/screens/onboarding.test.tsx` (regra nova + estados), `roadmap.md` (M13),
  `docs/adr/0022-*.md`, `docs/features/F-015-documento-na-fila/*`.
- **AC1:** a fila oferece "Mandar o documento" opcional, lido inline (sem `router.push` para fora).
- **AC2:** a revisão campo-a-campo com trecho aparece antes de aceitar.
- **AC3:** confirmar liga o `extracaoId`; a dívida sem documento segue por valor.
- **AC4:** nada é gravado como `divida` antes do `enviarTudo()`, mesmo com documento lido e aceito.
- **AC5:** extração que falha oferece "seguir só pelo valor" — a fila não trava.

---

## human_gates

- A **ADR 0022** (revoga o ponto 5 da ADR 0016) e o **PR** são o gate humano.
- Copy de fila e de revisão inline entram na mesma revisão humana de copy de negociação do M12/M13.
- **Device:** seletor nativo, teclado, safe area e a percepção de "fila longa" só se validam em
  aparelho — declarado como pendência.
