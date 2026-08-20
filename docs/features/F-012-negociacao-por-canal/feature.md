# F-012 — Negociação por canal e registro de resultado

## Status

`PLANNING`

O plano de execução existe em [`plan.md`](plan.md) desde 20/08/2026, com **seis tarefas** e
resultado `PLAN_VALID`. Ele **não tem gate de planejamento aberto** e está pronto para
congelamento assim que a aprovação humana chegar — momento em que o estado passa a
`READY_FOR_BUILD`.

As duas decisões de produto de 20/08/2026 estão em *Decisions*, e as três incógnitas que faltavam
foram fechadas pela [**ADR 0021**](../../adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md),
aceita no mesmo dia — ver *Unknowns*. Entre elas, o **conflito já existente entre `docs/domain.md`
e o código em produção**, que a ADR resolve alterando o código.

**O planejamento fechou duas coisas que o contrato deixava em aberto.** `PF-1`: o canal default da
rota é `email`, porque o texto único de hoje já é uma mensagem formal e estruturada — qualquer
outro default trocaria o formato **e** o momento da oferta de uma vez. `PF-2`: o alerta anti-golpe
alcança quem cadastrou a dívida na mão **pela tela de revisão**, não pelo chat — `chat.py:137`
continua filtrando o card quando `valorJusto` é `null`, porque é a ADR 0008 e a regra de forma do
`api-contract.md`, e um card chamado "valor justo" sem valor justo é o modo de falha do
guardrail 7.1.

## Priority

`M12, segunda das duas features (paralela a F-011)`

## Problem

Três lacunas, e a mais séria não é de produto, é de segurança.

**O alerta anti-golpe não existe em código.** `docs/domain.md:316-336` já escreveu a regra por
extenso — *"Confira o número no site oficial do credor; nunca negocie com número que entrou em
contato primeiro. Golpe de falsa negociação por WhatsApp é epidêmico, e o alvo preferencial é
exatamente quem está endividado"* — e `grep -rn "canal"` em `backend/orm.py`, `backend/schemas.py`
e `src/api/types.ts` volta **vazio**. A regra vive só no documento.

**O script é uma string única, sem canal.** `montar_script()`
(`backend/routers/revisao.py:114-157`) monta um texto por template — um parágrafo por achado, mais
a frase de oferta ancorada no caixa. Não passa por LLM, e o docstring diz que é de propósito
(guardrail 3). Serve razoavelmente ao e-mail e mal ao telefone e ao chat, onde `domain.md` pede
mensagens curtas, uma ideia por bloco, copiáveis uma a uma.

**E o registro de negociação é grava-e-esquece.** `orm.Renegociacao` (`backend/orm.py:96-112`)
guarda `valor_anterior` e `novo_valor`, é escrita num único ponto
(`backend/routers/parcelas.py:174-185`), e **nenhum `GET` a devolve** — não há schema Pydantic de
saída para ela. O roadmap chama o registro de resultado de "maior ativo competitivo do produto";
hoje o dado entra e não sai. Benchmark de desconto por credor não existe sem leitura.

## Desired Outcome

O usuário recebe a fala certa para o canal em que vai negociar, sempre protegida pelo alerta de
validação e pela regra de pagamento — inclusive quando não há contrato para revisar. E o resultado
de cada negociação vira dado consultável, que é o que constrói o benchmark.

## Decisions

Tomadas pelo usuário em 20/08/2026. **Precisam subir para ADR 0021** antes de planejamento.

1. **O M12 vira duas features.** Esta e [F-011](../F-011-renda-tipada/feature.md), sem interseção
   de código.
2. **`montar_script` deixa de devolver `None`.** Sem achados, ele produz o script **sem argumento
   de contestação, mas com o alerta de validação de canal e a regra de pagamento**. A justificativa
   é a que separa esta feature das outras: validação de canal é **segurança, não argumento de
   negociação**. Quem cadastrou a dívida na mão vai negociar do mesmo jeito, e hoje receberia tela
   vazia — exatamente a pessoa sem documento, que é a mais exposta ao golpe.

   Isso **não afrouxa a ADR 0008**: continua não havendo `valorJusto` sem achado, e o script sem
   achado não afirma nada sobre a dívida. Ele só protege a conversa.

## Scope

- `canal` como conceito de primeira classe — `telefone`, `chat`, `email` —, com a semântica já
  fixada em `docs/domain.md:316-336`.
- Três variantes de script sobre o **mesmo motor de valor justo**: muda o formato, nunca o número.
  - `telefone`: fala corrida, mais objeções comuns com resposta pronta.
  - `chat`: mensagens curtas, uma ideia por bloco, cada bloco copiável sozinho.
  - `email`: texto estruturado e formal, que serve de insumo para dossiê de Procon.
- **Alerta de validação de canal abrindo** todo script escrito e **regra de pagamento fechando** —
  boleto ou Pix em nome do credor (CNPJ), jamais CPF de pessoa física.
- Script mínimo de segurança para dívida sem achado, conforme *Decisions*, item 2.
- Registro do resultado da negociação em qualquer canal: houve acordo ou não, por qual canal, e o
  que foi obtido.
- Leitura do que foi registrado — a rota que hoje não existe, sem a qual não há benchmark.
- Atualizar `docs/api-contract.md` no mesmo commit da mudança de contrato, e promover `ScriptCard`
  de `docs/design-system.md:676-694` ("Ainda só especificação") para verbete implementado.

## Out of Scope

- **Enviar qualquer coisa.** O app não disca, não manda mensagem, não dispara e-mail. Script é
  sugestão copiável e editável (guardrail 3, `docs/guardrails.md:112-113`), e a classe de ação
  continua sendo "rascunho, autônoma, não envia nada" (guardrail 7.2).
- **Gerar script por LLM.** `montar_script` é template curado, e o docstring já explica por quê.
  Fundamento legal não é improvisado pelo modelo.
- **Benchmark agregado entre usuários** — telas de "credores que mais dão desconto", média de
  mercado, comparação social. Este contrato **coleta e devolve o dado do próprio tenant**; agregar
  entre tenants é decisão de produto e de privacidade que ninguém tomou.
- Redigir petição, notificação extrajudicial ou peça para Procon. O dossiê é o que o usuário monta
  com o que exportar, não algo que o app assina.
- Afirmar ilegalidade ou direito. Os testes de copy que quebram em `ilegal|abusiv|nul[ao]\b|é seu
  direito|você tem direito|com certeza|garantid[ao]` continuam valendo, e passam a varrer as três
  variantes.
- Qualquer item de [F-011](../F-011-renda-tipada/feature.md), M13 ou M14.

## Acceptance Criteria

- Os três canais produzem o **mesmo `valorJusto` e os mesmos achados**; só o formato do texto
  muda. Há teste que compara os três e falha se algum número divergir.
- Todo script de canal escrito **abre** com o alerta de validação e **fecha** com a regra de
  pagamento. Há teste que falha se qualquer variante sair sem um dos dois.
- Dívida sem achado nenhum produz script — não `None` — contendo alerta e regra de pagamento, e
  **nenhuma** afirmação sobre valor cobrado, valor justo ou irregularidade. Há teste que planta
  uma dívida sem `extracao_id` e verifica as duas coisas.
- `valorJusto` continua `None` sem achado que o sustente. O script novo não cria número (ADR 0008).
- No canal `chat`, cada bloco é copiável isoladamente — a resposta da API entrega os blocos
  tipados, não um texto único que o cliente precise fatiar (guardrail 1.2).
- O resultado da negociação é consultável por uma rota de leitura, com o canal e o desconto
  obtido. Há teste que grava e lê de volta.
- O registro de resultado continua disparando o marco `primeira_negociacao`
  (`backend/domain/marcos.py:83-84`), e o marco **não se desfaz** — o M11 já provou isso e a
  regressão continua verde.
- Os testes de copy do guardrail 3 (`backend/tests/test_revisao.py:202-228` e
  `src/test/screens/revisao.test.tsx:147-161`) varrem as três variantes. Provado por injeção: com
  um termo proibido plantado em cada variante, o teste falha nas três.
- Nenhum dado novo escapa do tenant: tabela ou coluna nova tem `tenant_id` e entra sozinha na
  exclusão de conta por `tabelas_do_tenant()`.
- Todo estado remoto de tela nova trata carregando, erro, vazio e conteúdo; alvo de toque de 48pt e
  `accessibilityLabel` onde não houver texto visível.

## Constraints

- Fundamento legal vem do backend curado; o front nunca compõe citação local
  (`docs/guardrails.md`, seção 3).
- Achado sem `fonte` não existe — `domain/revisao.Achado` (`backend/domain/revisao.py:45-62`) tem
  `fonte` como campo obrigatório, e os cinco produtores citam lei ou súmula no docstring.
- O script sai hoje dentro de `RevisaoCobranca`, por `GET /v1/dividas/{id}/revisao`
  (`backend/routers/revisao.py:234-254`), e o **mesmo caminho** alimenta o card `valor_justo` do
  chat via `montar_cards` — a rota e a conversa não podem divergir sobre o mesmo contrato. Qualquer
  mudança de forma atinge as duas superfícies.
- `RevisaoCobranca.script` é `string | null` em `src/api/types.ts:446-459`, e
  `ValorJustoCardData.script` é `string` obrigatório (`:76-86`). Mudar a forma do script é mudança
  de contrato nas duas pontas.
- Migrações forward-only; a cabeça da cadeia é `116f2181bdda`.
- Dinheiro em centavos inteiros; nenhum valor derivado calculado no cliente.

## Dependencies

- M6 / revisão de cobrança: achados, `valorJusto` e `montar_script`.
- M1.5 / ingestão de contrato, que é o que produz achado — e cuja ausência é justamente o caso que
  a decisão 2 passa a cobrir.
- M3 / `orm.Renegociacao` e `POST /v1/dividas/{id}/renegociacao`.
- M11 / `domain/marcos.py`, para o marco de primeira negociação.
- `docs/domain.md`, verbetes `canal`, `script`, `achado` e `fundamentos`.
- `docs/design-system.md:676-694`, `ScriptCard` — hoje na seção "Ainda só especificação".

## Unknowns

**Fechadas pela [ADR 0021](../../adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md)**,
aceita em 20/08/2026. Ficam registradas com a decisão. O Planner executa; não reabre.

1. **Conflito real entre documento e código, e ele já existe.** `docs/domain.md:334` diz que o
   script escrito *"nunca revela na primeira mensagem quanto o usuário pode pagar"*. Mas
   `montar_script` **hoje insere** a frase *"consigo comprometer até R$ X por mês"* no texto único
   (`backend/routers/revisao.py:149-155`), e esse texto é o que vai para o chat e para o e-mail.
   → **Decidido (0021, item 5):** **quem cede é o código.** `telefone` mantém a oferta na fala;
   `chat` a move para **bloco separado**, marcado para uso depois da proposta do credor; `email`
   manda o primeiro sem oferta, com o segundo pronto ao lado. O `valorJusto` e os achados são
   idênticos nos três — muda o formato e o momento, nunca o número. **Altera comportamento em
   produção** nas duas superfícies que `montar_script` alimenta: a tela de revisão e o card
   `valor_justo` do chat.
2. **O que é "resultado" de uma negociação que não virou acordo.** `orm.Renegociacao` só nasce
   quando há acordo: ela grava `novo_valor` e reescreve as parcelas. Recusa, contraproposta e
   silêncio são resultado igualmente valioso para o benchmark.
   → **Decidido (0021, item 6):** **entidade nova** — `tenant_id`, dívida, canal, desfecho
   (`acordo` · `recusa` · `contraproposta` · `sem_resposta`), valores opcionais e referência
   opcional à `Renegociacao`. Afrouxar os `NOT NULL` da tabela atual foi recusado: mexeria em dado
   em produção e misturaria o que aconteceu na conversa com o que mudou no contrato. A tabela nova
   carrega `tenant_id` e entra sozinha em `tabelas_do_tenant()`.
3. **Onde o canal é escolhido.**
   → **Decidido (0021, item 7):** **nos dois, com papéis distintos.** Na leitura do script é
   **parâmetro e não persiste** — é escolha de visualização. No resultado registrado é **coluna e
   persiste** — é fato do que aconteceu, e é o que o benchmark lê. O `observacao` de texto livre
   (`app/(tabs)/dividas/[id]/renegociar.tsx:125`) deixa de ser o único lugar onde o canal aparece.

**Aberta, mas não bloqueia:** "anti-golpe" não é guardrail numerado. O conceito vive em
`domain.md` e no roadmap; `docs/guardrails.md` não tem número para ele. Se é o item de maior
retorno por linha do milestone, provavelmente merece seção própria — decisão de documentação, que
pode ser tomada durante a execução.

## Risks

- **Alerta de segurança que não alcança quem precisa.** É o risco que a decisão 2 existe para
  fechar, e ele volta se a implementação amarrar o alerta à existência de achado por algum caminho
  lateral — por exemplo, o front escondendo o card quando `valorJusto` é `null`.
- **Copy de negociação sem revisão de advogado.** O roadmap marca isso como o único item que pode
  **encerrar** o produto em vez de atrasar um release. Esta feature multiplica a copy de negociação
  por três, e é a que mais aumenta a superfície a revisar.
- **Divergência entre a tela e o chat.** `revisar_divida` é caminho único de propósito; três
  variantes de script criam a primeira chance real de a conversa e a tela discordarem.
- **Script sem achado que parece afirmar algo.** Texto de segurança e texto de contestação lado a
  lado, mal separados, produzem a leitura de que a dívida tem problema quando ninguém disse isso.
- O dado de benchmark nasce enviesado se só o acordo fechado for registrado — quem recusou é
  metade da informação.

## Human Gates

- ~~Aprovar a ADR 0021 com as três incógnitas resolvidas, em especial o conflito 1, que altera
  comportamento já em produção.~~ **Satisfeito em 20/08/2026** — ADR 0021 aceita, e ela decide
  alterar o comportamento em produção.
- **Revisão da copy das três variantes por advogado**, antes do público. É gate de pré-lançamento
  já listado no roadmap, e esta feature amplia o que ele precisa cobrir.
- Aprovar a modelagem do resultado de negociação (entidade nova × colunas aditivas), que é
  propriedade de dado.
- Validar em device o `ScriptCard` com seletor de canal — leitura dos blocos, botão de copiar por
  bloco, acessibilidade.

## References

- `roadmap.md`, M12 — itens de canal, alerta de validação e registro de resultado.
- `docs/domain.md`, verbetes `canal`, `script`, `achado`, `fundamentos`.
- `docs/guardrails.md`, seções 3, 7.1 e 7.2.
- `docs/design-system.md:676-694`, `ScriptCard`.
- `docs/adr/0008` (valor justo é soma de achados) e `docs/adr/0005` (descarte do arquivo).
- `backend/routers/revisao.py`, `backend/domain/revisao.py`, `backend/routers/parcelas.py`,
  `backend/orm.py`.
- `docs/features/F-010-respiro/` — molde de contrato, plano e evidência.
- [ADR 0021](../../adr/0021-renda-tipada-por-adicao-e-o-canal-decide-quando-a-oferta-e-dita.md) — as sete incógnitas do M12, fechadas.
