# FDD — CRUD de dívidas

## Cabeçalho

| | |
|---|---|
| Feature | CRUD de dívidas |
| Slug | `crud-de-dividas` |
| Milestone | M1 (ver `roadmap.md`) |
| Telas | `app/(tabs)/dividas/index.tsx`, `nova.tsx`, `[id]/index.tsx`, `[id]/editar.tsx` |
| Endpoints | `GET/POST /v1/dividas`, `GET/PATCH/DELETE /v1/dividas/{id}`, `POST /v1/dividas/{id}/quitacao` |
| Depende de | M0 (navegação, TanStack Query, design system) |

## Objetivo e não objetivos

Dar ao usuário um registro confiável das próprias dívidas — cadastrar, consultar, corrigir,
quitar e excluir — para que exista base sobre a qual o painel (M2), o plano (M3) e o simulador
(M4) possam operar.

**Não objetivos:**

- Agregados, totais ou percentuais. Isso é M2, via `GET /v1/dividas/resumo`.
- Parcelas e cronograma de pagamento. Isso é M3.
- Qualquer projeção ou simulação. Isso é M4.
- Cálculo de prescrição. O front apenas **exibe** o alerta que o backend envia.

## Jornada e interface

O usuário abre a aba Dívidas. Vê a lista ordenada por prioridade (criticidade), com chips para
reordenar por valor ou vencimento. Toca em uma dívida e vai ao detalhe, de onde pode editar,
marcar como quitada ou excluir. O botão "Nova" abre o cadastro.

**Os quatro estados, em toda tela:**

| Estado | Lista | Detalhe / Edição | Cadastro |
|---|---|---|---|
| Carregando | `LoadingState` "Carregando suas dívidas" | `LoadingState` "Carregando a dívida" | — (form é local) |
| Erro | `ErrorState` com retry | `ErrorState` com retry | `Feedback` tom `error` acima do form |
| Vazio | `EmptyState` convidando ao primeiro cadastro | — | — |
| Conteúdo | `FlatList` de `DividaListItem` | `Card` com os campos | `DividaForm` |

## Contrato

- **Endpoints:** especificados em `docs/api-contract.md`, seções 2 e 3.
- **Tipos:** `Divida` ganha `situacao`, `saldoDevedor`, `taxaJurosMensal`, `totalParcelas`,
  `parcelasPagas` e `proximoVencimento`, **todos opcionais**. `NovaDivida` ganha
  `taxaJurosMensal` opcional.
- **Chaves de cache:** lê `['dividas']` e `['dividas', id]`; toda mutação invalida o prefixo
  `['dividas']` inteiro, porque o resumo do painel deriva dos mesmos dados.
- **Unidades:** valores em centavos inteiros; taxa em basis points inteiros (`250` = 2,50% a.m.).

## Requisitos funcionais

- **RF-001** — A lista exibe credor, valor, classificação de criticidade e próximo vencimento
  quando houver.
- **RF-002** — A lista pode ser ordenada por prioridade, valor ou vencimento. Dívida sem
  vencimento vai para o fim, nunca quebra a lista.
- **RF-003** — A lista vazia convida ao primeiro cadastro, com ação direta.
- **RF-004** — O cadastro exige credor, valor, data de origem e classificação. Taxa de juros é
  opcional.
- **RF-005** — Valor é sempre centavo inteiro (`CurrencyInput`); taxa é sempre basis point
  inteiro (`PercentInput`). Nenhum dos dois emite fracionário.
- **RF-006** — Taxa não informada é **omitida** do payload, não enviada como zero: ausência e
  "juros zero" são afirmações diferentes.
- **RF-007** — O detalhe exibe valor cobrado, corrigido, saldo devedor, taxa, parcelas e
  classificação. Campo não calculado exibe "ainda não calculado", **nunca R$ 0,00**.
- **RF-008** — `possivelPrescricao` é exibido como alerta para investigar ("pode ter prescrito,
  vale checar"), jamais como afirmação de que prescreveu.
- **RF-009** — Quitar e excluir exigem confirmação explícita via diálogo nativo.
- **RF-010** — Excluir é exclusão lógica no backend; a UI comunica que o histórico permanece.
- **RF-011** — Toda mutação bem-sucedida faz a lista refletir a mudança sem refresh manual.
- **RF-012** — O detalhe carrega o disclaimer de estimativa educacional.

## Guardrails desta feature

| Guardrail | Como é respeitado |
|---|---|
| 1.1 Centavo inteiro | `CurrencyInput` e `PercentInput` mantêm inteiros; provado por teste |
| 1.2 Sem valor derivado | Nenhum `reduce`, nenhuma soma de lista. Ordenação é comparação, permitida |
| 2 Egress único | Tudo passa por `request<T>` em `src/api/client.ts` |
| 3 Postura jurídica | `possivelPrescricao` como alerta; disclaimer no detalhe |
| 4 Tom anti-ansiedade | Saldo em `ink`; `juros_abusivos` em vermelho suave de fundo, nunca alarme |
| 5 LGPD | Nenhum valor ou credor em log |
| 6 Multi-tenant | Nenhum parâmetro de tenant enviado |
| 7.2 Confirmação | `Alert.alert` em quitar e excluir |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Endpoints especificados em `docs/api-contract.md`.
- [x] Estados de erro e de vazio definidos.
- [x] Guardrails aplicáveis identificados.
- [x] Copy revisada contra `docs/domain.md`.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint` e `npm test` passam (34 testes).
- [x] Os quatro estados implementados em todas as telas.
- [x] Nenhum valor monetário calculado no cliente.
- [x] Nenhum dado financeiro em log, analytics ou mensagem de erro.
- [x] Alvo de 48pt e `accessibilityLabel` em todo controle sem texto.
- [ ] **Testado em iOS e Android** — depende dos endpoints do backend.
- [x] Documentos canônicos atualizados no mesmo commit.

## Riscos e modos de falha

- **A maior parte desta feature não é verificável hoje.** Só lista e cadastro têm endpoint, e o
  cadastro só funciona depois que `backend/models.py:11` mudar `id: int` para `id: str`. Detalhe,
  edição, quitação e exclusão mostram `ErrorState` até as rotas existirem.
- **Sem persistência no backend**, cada reload do uvicorn zera a lista. A UI não distingue "lista
  vazia" de "dados perdidos" — e não deveria: quem garante durabilidade é o servidor.
- **`proximoVencimento` ainda não é enviado**, então a ordenação por vencimento devolve a lista
  praticamente inalterada. Coberto por teste para não quebrar quando o campo chegar.
