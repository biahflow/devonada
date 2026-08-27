# F-014 — Evidence

Handoff de revisão da feature F-014 (notificação discreta do lembrete de parcela). Consolida
referências; não substitui os artefatos que aponta.

## Round

```text
round: 1
reviewed_state: branch f-014-push-discreto, ramificada de `main` @ df3dd68, tarefa única (T1).
authorization: usuário autorizou NÃO travar em gate humano para esta feature — contrato escrito e
               construído no mesmo passo. Gate de device fica ABERTO.
```

---

## 1. Contrato e plano

| Artefato | Onde |
|---|---|
| Feature Contract | [`feature.md`](feature.md) |
| Execution Plan (`PLAN_VALID`) | [`plan.md`](plan.md) |
| Regra que domina a feature | `docs/guardrails.md`, seção 4 (discrição por padrão) |
| Contrato de API | `docs/api-contract.md:455-477` (`GET /v1/lembretes`) — forma preservada, exemplo e nota atualizados |

---

## 2. BASELINE

Medida no início, na worktree ramificada de `main` @ df3dd68:

- `backend/venv/bin/pytest -q` → **721 passed**, 27 avisos, verdes.
- `npm test` → **50 suítes / 606 testes**, verdes. (Jest tem flake de teardown de worker — "A
  worker process has failed to exit gracefully" — que intermitentemente reporta "1 failed" com exit
  0; reexecução dá 606/606. O front não é tocado por esta feature.)

**Ambiente:** worktree isolada com `node_modules` e `backend/venv` linkados ao checkout principal.
SQLite; nenhum teste toca a rede. Backend não tem lint configurado (sem ruff/flake8); pytest é o
gate.

---

## 3. CHANGE — T1

O vazamento estava no backend, onde o texto do lembrete nasce pronto (o front só repassa).

**`backend/routers/lembretes.py`**
- `_texto(credor, parcela, dias)` → `_texto()`: devolve o par constante e genérico
  `_TITULO = "Você tem um passo hoje"` / `_CORPO = "Abra o Devo Nada para ver o que você combinou."`.
  Antes: `titulo = f"{credor} {quando}"` ("Nubank vence amanhã") e
  `corpo = f"Parcela {n} de {total} — {brl(valor)}"` ("Parcela 3 de 12 — R$ 450,00").
- `_formatar_brl` e o import `centavos_para_decimal` **removidos**: sem formatação de moeda no
  módulo, valor não tem por onde vazar para o texto (garantia estrutural, não só de teste).
- `dividaId`/`parcelaId` seguem sendo montados no `schemas.Lembrete`, fora do texto — o deep link do
  card não muda. `src/notificacoes.ts` **não foi tocado**: já carrega os dois no `data` da
  notificação (`:97-101`) e apenas repassa `titulo`/`corpo`.

**`backend/tests/test_parcelas_api.py`**
- `test_parcela_dentro_da_janela_gera_lembrete`: deixou de afirmar `"Nubank" in titulo` /
  `"vence em 2 dias" in titulo`; passa a afirmar o título genérico exato, a ausência de "Nubank", e a
  presença de `dividaId`/`parcelaId`.
- `test_texto_vem_pronto_com_moeda_formatada` → `test_texto_nao_delata_valor_nem_vencimento`: deixou
  de afirmar `"R$ 450,00" in corpo` / `"vence amanhã" in titulo`; passa a afirmar a **ausência** de
  valor e vencimento.
- **Novo teste-gêmeo** `test_notificacao_nao_delata_credor_valor_nem_divida`: planta credor "Nubank"
  e valor 45000 e falha se qualquer delator (`nubank`, `dívida`, `divida`, `r$`, `450`, `parcela`,
  `vence`, `vencimento`) aparecer no `titulo`+`corpo`; confirma que `dividaId`/`parcelaId` sobrevivem
  fora do texto.
- `test_tom_neutro_sem_linguagem_de_cobranca`: intacto — continua valendo.

**Documentos (mesmo commit):**
- `docs/api-contract.md:463,476` — exemplo do `GET /v1/lembretes` e a nota mostram o texto genérico
  e a regra de discrição (credor/valor/parcela/vencimento/"dívida" fora do texto; identificador no
  payload de dados).
- `docs/guardrails.md`, seção 4 — o bullet de discrição foi **explicitado** para enumerar os cinco
  delatores e apontar onde o teste-gêmeo mora. Mesma regra, forma testável. Não é exceção nem
  afrouxamento.
- `roadmap.md`, M13 — item "Notificações discretas" marcado `[x]` com o que mudou.

---

## 4. PROVA (injeção)

O teste-gêmeo não é decorativo: revertendo `_CORPO` para um texto delator
("Sua dívida do Nubank — Parcela 3 de 12 — R$ 450,00 vence amanhã."),
`test_notificacao_nao_delata_credor_valor_nem_divida` e `test_texto_nao_delata_valor_nem_vencimento`
**falharam** (2 failed, 1 passed); revertida a injeção, voltam ao verde. O texto foi restaurado ao
correto.

---

## 5. VALIDAÇÃO — pós-mudança

| Gate | Resultado |
|---|---|
| `cd backend && venv/bin/pytest -q` | **722 passed** (721 baseline + 1 teste-gêmeo), 27 avisos |
| `npm run typecheck` | passa (exit 0) |
| `npm run lint` | passa (exit 0) |
| `npm test` | **50 suítes / 606 testes**, exit 0 (front intocado; flake de teardown descrito acima) |
| `npm run bundle:check` | passa (exit 0) |
| `npm run palette:check` | passa (exit 0) — nenhuma cor tocada |
| `npm run digits:check` | passa (exit 0) — nenhuma fonte tocada |

---

## 6. PENDÊNCIAS

- **Device (ABERTO).** Ver a notificação real tocar em iOS e Android e confirmar o texto genérico na
  tela de bloqueio. Nenhum agente declara este gate satisfeito. É a única linha não fechada da
  Definition of Done de `feature.md`.
- `docs/inventario.md` **não foi tocado** — consolidação é do orquestrador, por instrução da tarefa.
