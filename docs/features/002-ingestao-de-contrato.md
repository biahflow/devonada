# FDD — Ingestão de contrato

## Cabeçalho

| | |
|---|---|
| Feature | Ingestão de contrato |
| Slug | `ingestao-de-contrato` |
| Milestone | M1.5 (ver `roadmap.md`) |
| Telas | `app/(tabs)/dividas/contrato/index.tsx`, `contrato/[id].tsx` |
| Endpoints | `POST /v1/contratos`, `GET /v1/contratos/{id}`, `POST /v1/dividas` |
| Depende de | M1 (o `DividaForm` é o destino da revisão) |

## Objetivo e não objetivos

Ler o contrato de empréstimo, consignado ou financiamento e propor o cadastro preenchido, para o
usuário conferir em vez de digitar. Remove o maior atrito do M1 — quase ninguém sabe a própria
taxa de juros de cabeça, mas o contrato sabe — e alimenta o contexto que os agentes vão usar
depois.

**Não objetivos:**

- **Parecer jurídico.** Alerta de cláusula é sinal para investigar, nunca conclusão.
- **Arquivo do usuário.** Não guardamos o contrato; ele continua com o original (ADR 0005).
- **Gravação automática.** A extração propõe; quem salva é o usuário.
- **Cálculo.** Nenhum número é derivado no cliente. Tudo vem extraído do backend.

## Jornada e interface

Da lista de dívidas, "Ler contrato". O usuário escolhe a origem (PDF, câmera ou galeria), vê o
aviso de que o arquivo será descartado, e envia. A tela de acompanhamento faz polling. Ao
concluir, ele vê os campos lidos **com o trecho do contrato que sustenta cada um**, os alertas de
cláusula, e abaixo o formulário do M1 pré-preenchido — que ele revisa e salva.

**Os quatro estados:**

| Estado | Envio | Revisão |
|---|---|---|
| Carregando | botão em `loading` | `LoadingState` + aviso de demora após 2 min |
| Erro | `Feedback` tom `error` | `ErrorState` com retry; `status: falhou` vira `Feedback` com saídas |
| Vazio | — | campo não extraído aparece como "não encontramos no contrato" |
| Conteúdo | arquivo escolhido | campos com evidência + alertas + formulário |

Toda tela de erro oferece **duas saídas**: tentar outro arquivo ou cadastrar à mão. Nunca um beco.

## Contrato

- **Endpoints:** `docs/api-contract.md`, seção M1.5.
- **Tipos:** `CampoExtraido<T>`, `ExtracaoContrato`, `AlertaContrato` em `src/api/contratos.ts`.
- **Chaves de cache:** `['contratos', id]`. Polling a cada 2,5s, teto de 2 minutos.
- **Unidades:** centavos e basis points inteiros, do payload ao `POST /v1/dividas`.
- **Rede:** upload multipart vive em `upload()` de `src/api/client.ts` — o egress segue único.

## Requisitos funcionais

- **RF-001** — O usuário escolhe a origem entre PDF, câmera e galeria, em menu nativo.
- **RF-002** — Permissão de câmera é pedida no contexto, ao escolher a câmera, nunca no boot.
- **RF-003** — O aviso de descarte do arquivo aparece **antes** do envio.
- **RF-004** — O envio é assíncrono; a tela acompanha por polling.
- **RF-005** — O polling para ao concluir, ao falhar ou ao estourar o teto de 2 minutos.
- **RF-006** — Ao estourar o teto, o usuário recebe aviso e duas saídas, não um spinner eterno.
- **RF-007** — Cada campo extraído é exibido com o trecho literal do contrato e a página.
- **RF-008** — **Campo sem trecho não é preenchido no formulário**, mesmo trazendo valor.
- **RF-009** — Campo com `valor: null` exibe "não encontramos no contrato", nunca zero.
- **RF-010** — Confiança `baixa` ou `media` é sinalizada com "Confere isso".
- **RF-011** — Trechos são renderizados como texto puro, jamais como marcação ou link.
- **RF-012** — Alertas de cláusula usam tom de investigação e trazem rodapé explícito.
- **RF-013** — Nada é gravado até o usuário submeter o formulário de revisão.
- **RF-014** — Toda tela de falha oferece cadastrar à mão como alternativa.

## Guardrails desta feature

| Guardrail | Como é respeitado |
|---|---|
| 1 Sem LLM como fonte da verdade | Extração é proposta; campo sem evidência é descartado (`src/util/extracao.ts`) |
| 2 Egress único | Upload multipart dentro de `client.ts`, não em `fetch` solto |
| 3 Postura jurídica | `AlertaCard` com copy de investigação e rodapé |
| 5 LGPD | Arquivo descartado (ADR 0005); nenhum trecho em log |
| 7.2 Confirmação | A dívida só nasce quando o usuário submete a revisão |
| 7.3 Entrada não confiável | Trecho como texto puro, sem marcação nem link |
| 8 Documento do usuário | Seção escrita a partir desta feature |

## Definition of Ready

- [x] Objetivo e não objetivos escritos.
- [x] Endpoints especificados em `docs/api-contract.md`.
- [x] Estados de erro, vazio e de timeout definidos.
- [x] Guardrails identificados; ADR 0005 escrito antes do código.
- [x] Copy revisada contra `docs/domain.md`.

## Definition of Done

- [x] `npm run typecheck`, `npm run lint` e `npm test` passam (57 testes).
- [x] Os quatro estados implementados nas duas telas.
- [x] Nenhum valor calculado no cliente.
- [x] Nenhum trecho de contrato em log ou mensagem de erro.
- [x] Permissão de câmera com texto de justificativa em `app.json`.
- [ ] **Testado em iOS e Android** — depende dos endpoints do backend.
- [x] Documentos canônicos atualizados no mesmo commit.

## Riscos e modos de falha

- **Nada é verificável em runtime hoje.** Nenhum dos dois endpoints existe. O front está pronto
  contra o contrato, como no M1.
- **Upload multipart em React Native tem pegadinhas.** O `Content-Type` **não** é definido à mão
  de propósito: o runtime precisa gerar o boundary. É o ponto mais provável de quebrar em device
  e só se prova com backend real.
- **OCR de foto tem qualidade muito inferior à de PDF com texto.** Espera-se mais `confianca:
  baixa` e mais `valor: null` nesse caminho — e o desenho já trata os dois.
- **Extração é a superfície de injeção mais exposta do produto.** A defesa principal é do
  backend; o front não facilita (texto puro, sem link, sem marcação).
