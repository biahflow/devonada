# Backend — FastAPI + Postgres

> Documento vivo. O contrato que este backend cumpre está em `api-contract.md`; as regras de
> produto que ele respeita, em `guardrails.md`.
> Princípio-mãe: **nenhuma regra financeira é inventada.** Toda regra em `domain/` leva a fonte
> no docstring. Regra sem fonte devolve `None`, e o app exibe "ainda não calculado" — que é a
> verdade, e é melhor que um número que o usuário levaria a uma negociação real.

---

## Como subir

```bash
cd backend
cp .env.example .env                      # gere o BUDDY_API_TOKEN
docker compose up -d                      # Postgres na 5433
source venv/bin/activate
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
pytest                                     # 370 testes
```

**Portas escolhidas por colisão, não por gosto:** a 8000 e a 5432 já são do stack do
`biahflow-portal-cliente`. A API vai na **8001**, o Postgres na **5433**.

Depois de subir, cole o `BUDDY_API_TOKEN` no app em **Painel → Configurar conexão**. Sem isso,
toda tela de dados vira 401.

---

## Estrutura

```
config.py       settings de env (pydantic-settings), nada cravado no código
db.py           engine, SessionLocal, dependency get_db
orm.py          tabelas SQLAlchemy
schemas.py      contrato de API em Pydantic — espelha src/api/types.ts
auth.py         JWT → tenant_id · hash de senha · hash de token (ADR 0012)
domain/         REGRAS DE NEGÓCIO puras, com fonte citada
leitura.py      adaptadores persistência → domínio, compartilhados entre routers
routers/        dividas · resumo · simulacoes · parcelas · perfil · lembretes · contratos · chat
                caixa · revisao · auth · conta
llm/            ÚNICO lugar que conhece SDK de modelo (ADR 0007)
correio/        ÚNICO lugar que fala SMTP — mesmo desenho da camada llm/
web/            exclusao.html, a página pública servida em GET /exclusao
assistente/     o assistente do chat, sobre a camada llm/
extracao/       base.py (Protocol) · regras.py (prompt) · extrator_llm.py · factory
alembic/        migrations
tests/          pytest
```

### Duas regras estruturais

**Dinheiro é `BigInteger` em centavos; taxa é `Integer` em basis points.** Nenhuma coluna
`Numeric`, nenhuma `Float`, em nenhuma tabela. A regra dos centavos vale no banco, não só no
app — é aqui que ela para de ser convenção e vira estrutura.

**Toda query filtra por `tenant_id`.** Parecia cerimônia com um usuário só, e o M8 cobrou a
aposta: trocar o token fixo (ADR 0006) por conta de verdade (ADR 0012) foi trabalho de auth, e
não uma auditoria de isolamento em cada rota — nenhum router precisou mudar. O cliente nunca
envia tenant; ele vem do `sub` do access token.

A mesma disciplina rendeu de novo na exclusão de conta: como toda tabela de dado do usuário tem
`tenant_id`, a varredura de exclusão é DERIVADA de `orm.Base.metadata` em vez de escrita à mão.
Tabela nova entra na exclusão no commit em que nasce.

---

## As regras financeiras e suas fontes

| Campo | Regra | Fonte | Arquivo |
|---|---|---|---|
| `possivelPrescricao` | 5 anos completos desde a origem | Código Civil, art. 206, §5º, I | `domain/prescricao.py` |
| `valorCorrigido` | Juros compostos pela taxa **do próprio contrato** | O contrato do usuário | `domain/correcao.py` |
| `minimoExistencial` | **R$ 600,00 fixos** (config datada, sem derivar do salário mínimo) | Decreto 11.150/2022, art. 3º, **na redação do Decreto 11.567/2023** | `domain/minimo_existencial.py` |
| `custoMedioJurosMensal` | Média das taxas **ponderada pelo saldo** | — (escolha de método, documentada) | `domain/resumo.py` |
| Valor da parcela | Divisão inteira com a **sobra na última** | — (aritmética; a soma tem de fechar) | `domain/parcelas.py` |
| `situacao` da parcela | Vencimento < hoje e não paga | — (derivada no servidor, nunca no cliente) | `domain/parcelas.py` |
| Ordem da avalanche | Maior taxa primeiro; **sem taxa por último** | — (definição corrente da estratégia) | `domain/simulacao.py` |
| Ordem da bola de neve | Menor saldo primeiro | — (idem; ver `domain.md`, seção 4) | `domain/simulacao.py` |
| Orçamento da simulação | Mínimos iniciais + aporte, **com rolagem** | — (escolha de método, documentada) | `domain/simulacao.py` |
| `economiaVsMinimo` | Juros do cenário mínimo − juros do cenário com aporte | — (diferença entre dois resultados do mesmo motor) | `domain/simulacao.py` |
| Multa de atraso acima do teto | Teto de **2% do valor da prestação** | CDC, art. 52, §1º (redação da Lei 9.298/1996) | `domain/revisao.py` |
| Tarifa de cadastro repetida | Devida **no início do relacionamento** | STJ, Súmula 566 | `domain/revisao.py` |
| Seguro prestamista embutido | Consumidor não pode ser **compelido** a contratar | CDC, art. 39, I; STJ, Tema 972 | `domain/revisao.py` |
| Juros acima do teto do consignado | Teto vigente do consignado | Resolução do CNPS (config datada) | `domain/revisao.py` |
| CET não informado | Taxa efetiva anual é informação obrigatória | CDC, art. 52, II | `domain/revisao.py` |
| `valorJusto` | `valorCobrado` − Σ achados **com valor** | — (subtração, não estimativa; ADR 0008) | `domain/revisao.py` |

### As limitações declaradas

Estão aqui porque escondê-las seria pior que tê-las.

1. **`valorCorrigido` é `null` sem taxa.** Não aplicamos IPCA, INPC ou selic — corrigir por
   índice que o contrato não prevê seria inventar regra e apresentá-la como fato. Isto substitui
   o `valorCobrado * 1.1` que existia antes.
2. **`dependentes` não entra no mínimo existencial.** O Decreto 11.150 não escala por
   dependente. O campo é coletado e guardado, esperando você definir uma regra com fonte.
3. ~~`comprometimentoRenda` é aproximação~~ — **resolvido no M3.** Com parcelas reais, soma as
   parcelas pendentes do mês. A estimativa `valorCobrado / totalParcelas` sobrevive só para
   dívida cadastrada sem cronograma.
4. ~~`proximosVencimentos` volta vazio~~ — **resolvido no M3.** Lista as próximas parcelas reais.
5. **A simulação não projeta juros sobre dívida sem taxa** (M4). Ela é amortizada normalmente e
   vai para o fim da fila da avalanche, mas o prazo devolvido é **otimista** para quem tem
   dívida assim. Por isso a resposta carrega `dividasSemTaxa` e a tela nomeia quais foram — a
   alternativa, arbitrar uma taxa, é a mesma classe de erro do `* 1.1`.
6. **Dívida sem cronograma entra na simulação com parcela mínima zero** (M4). Ela só recebe
   pagamento quando chega à frente da fila. Inventar uma prestação a partir do valor cobrado
   produziria justamente o número que o usuário levaria a sério.
7. **Sem renda informada, o aporte não é checado contra o mínimo existencial** (M4). Não há o
   que comparar. Travar o simulador de quem não preencheu a renda tiraria a ferramenta de quem
   mais precisa dela; o painel já convida a informar.
8. **A revisão não recalcula o contrato** (M6). Achado cujo valor exigiria reamortizar — juros
   acima do teto, capitalização, comissão de permanência — aparece na tela **sem número** e não
   entra em `valorJusto`. Arbitrar esse valor seria reintroduzir a estimativa que a ADR 0008
   removeu.
9. **Dívida sem contrato lido não produz achado** (M6). A revisão trabalha sobre os encargos que
   a extração leu. Cadastro manual devolve `achados: []` e a tela leva ao envio do contrato.
10. **A margem consignável ficou de fora** (M6). O limite da Lei 10.820/2003 (45% para
    aposentadoria e pensão do RGPS, art. 6º, §5º, redação da Lei 14.601/2023; 40% para CLT,
    art. 2º, §2º, I, redação da Lei 14.431/2022) incide sobre a **soma de todas** as
    consignações do benefício, não sobre uma dívida — e o remédio é reduzir o desconto, não o
    débito. Não pertence a `valorJusto`.
11. **Teto de juros do consignado é responsabilidade do operador** (M6). Ele muda por resolução
    do CNPS e vive em `.env`, **sem default**. Não configurado ⇒ o achado não existe. A data de
    vigência viaja na resposta e aparece na tela, para o usuário ver a idade do número que
    embasou o achado.
12. **O indício de "relacionamento anterior" é estreito** (M6). Só sabemos de um contrato
    anterior quando existe outra dívida do mesmo credor, mais antiga, cadastrada no app.
    Relacionamento com a instituição é mais amplo — por isso o achado declara o indício e
    devolve a conclusão ao usuário, condicionada.
13. **As exclusões do art. 4º do Decreto 11.150 não estão implementadas.** O decreto manda
    **não computar** na aferição do mínimo existencial as parcelas de financiamento imobiliário,
    crédito com garantia real, crédito com fiança ou aval, crédito rural, financiamento de
    atividade produtiva, dívida já renegociada na forma do CDC, tributos e despesas de condomínio,
    **crédito consignado regido por lei específica** e operações de antecipação, desconto ou
    cessão. O app só conhece a modalidade da dívida quando o contrato foi lido, e aplicar a
    exclusão sem saber a modalidade erraria para os dois lados. Enquanto isso, a margem exibida é
    **mais conservadora** que a do decreto — ela desconta parcelas que a lei mandaria ignorar, e
    errar propondo menos é o lado certo de errar. O consignado, além disso, tem ADPFs pendentes
    no STF (1005, 1006 e 1097), o que é mais um motivo para não antecipar a regra.
14. **`margemDisponivel` tem duas definições** (M7.2). Com o caixa conhecendo a saída, ela é o
    `aporteMaximo`: renda líquida menos custo de vida real, provisões, potes e as parcelas
    atuais. Sem caixa — ou com caixa só de renda, no Nível 0 — ela volta a ser
    `renda − mínimo existencial − comprometido`, que usa o piso legal como proxy de custo de vida
    e é **bem mais otimista**. O mesmo campo responde a duas perguntas parecidas, e pela tela o
    usuário não sabe qual está vendo. Unificar à força seria pior: a segunda definição é o melhor
    possível para quem não preencheu o caixa. O que falta é a tela **nomear a origem**, como o
    caixa já faz com a origem da renda — e ela ainda não nomeia.
15. **Renda deixou de ser editável fora do caixa** (M7.2). `PUT /v1/perfil` com `rendaMensal`
    devolve `422` quando há duas ou mais fontes ativas: um escalar não se reparte entre fontes
    sem inventar dado. Um app instalado que não atualizou e tenha múltiplas fontes recebe esse
    erro ao salvar o perfil — é o preço de não sobrescrever renda em silêncio, e some quando o
    aparelho atualiza, porque a tela nova não envia mais o campo.

### A simulação e o teto de 600 meses

`domain/simulacao.py` devolve `None` — e a rota responde `422` — quando o plano **não quita**:
seja porque o pagamento não cobre nem os juros do mês (o saldo para de cair, e nenhum mês
seguinte seria diferente), seja porque a amortização não cabe no teto de 600 meses. Um prazo
devolvido nesses casos seria ficção, e a mensagem de recusa é mais útil ao usuário que um número
inventado.

O motor roda em `Decimal` de reais durante o laço e só converte para centavos na saída: os juros
de um mês raramente caem em centavo inteiro, e arredondar a cada iteração acumularia o erro por
dezenas de meses.

### `evolucaoSaldo` acumula a partir de hoje

A tabela `saldo_snapshot` grava uma foto do total devido por mês, na primeira consulta do resumo
naquele mês. O gráfico nasce vazio e ganha um ponto por mês de uso — dado real, não histórico
retroativo estimado.

---

## A camada de LLM

`llm/` é o **único** lugar do backend que conhece um SDK de modelo. As capacidades — extração de
contrato, assistente do chat — falam com o `Protocol ClienteLLM` e não sabem qual provedor está
do outro lado. A decisão e o porquê estão na **ADR 0007**.

```
BUDDY_LLM_PROVIDER          openai (padrão) | anthropic
BUDDY_LLM_MODEL_EXTRACAO    modelo da leitura de contrato
BUDDY_LLM_MODEL_ASSISTENTE  modelo do chat
```

**Modelo por capacidade, não global:** ler contrato exige visão, PDF e evidência literal por
campo; classificar a intenção de uma frase, não.

A interface tem um método, `responder_json`, e ele devolve JSON validado contra **schema
estrito**. Não existe porta de texto livre — seria o caminho mais curto para um número sem
procedência chegar à tela. Todo erro de SDK vira `ErroDeLLM` com frase em pt-BR dentro do
adaptador; nenhuma exceção de provedor atravessa essa fronteira.

> **A chave vem do `Settings`, não do ambiente.** `pydantic-settings` carrega o `.env` para
> dentro do objeto de settings, mas os SDKs leem `os.environ` — as duas coisas não se
> encontravam, e a chave escrita em `backend/.env` **nunca era usada**. Agora ela passa por
> `Settings` e é entregue ao adaptador pela fábrica. `tests/conftest.py` zera as chaves: sem
> isso, uma chave real na máquina transforma a suíte em chamada paga.

## Extração de contrato

`extracao/base.py` define o `Protocol` `ExtratorDeContrato`; `extracao/regras.py` guarda o prompt
e o schema, valendo para qualquer provedor; `extracao/extrator_llm.py` é a implementação.

Lê PDF **e** foto sem OCR separado — sem dependência de Tesseract no servidor.

`BUDDY_EXTRATOR` continua existindo porque a porta faz sentido: um extrator determinístico para
o layout de um banco específico seria mais exato que qualquer modelo, e entraria sem tocar a rota.

**Três guardrails aplicados no servidor, não só no cliente:**

- **8.1 — evidência obrigatória.** `limpar_campos_sem_evidencia()` zera todo campo que tem valor
  e não tem `trecho` literal antes de a resposta sair da rota. O front descartaria de qualquer
  forma; o backend não deve nem enviar.
- **7.3 — entrada não confiável.** O system prompt declara que o conteúdo do contrato é dado, não
  instrução, e que texto parecido com comando deve ser extraído, não obedecido.
- **ADR 0005 — descarte.** O arquivo vive em memória durante o processamento e nunca toca o
  disco. Persistem os campos e os trechos curtos.

Sem chave do provedor configurado, o upload responde `status: "falhou"` com frase útil em vez de
estourar 500 — o app já trata esse estado e oferece o cadastro manual.

**Uma rede extra, aprendida na primeira leitura real:** o modelo devolveu `dataOrigem` como
`12/03/2025`, e a extração inteira caía por causa do formato, perdendo os seis campos que vieram
certos. O prompt agora pede ISO, e `_normalizar_data` converte `DD/MM/AAAA` antes da validação —
prompt não é garantia, e contrato brasileiro escreve data no formato brasileiro.

## O assistente do chat

`assistente/` segue o mesmo desenho: `base.py` com o `Protocol`, `regras.py` com prompt e schema,
`assistente_llm.py` para qualquer provedor e `determinista.py` sem modelo nenhum.

> **O modelo escolhe QUAL card; o backend preenche os NÚMEROS.** É a regra que organiza o pacote.
> `PedidoDeCard` carrega um id e, no máximo, o aporte que o próprio usuário declarou — no que o
> modelo AFIRMA, **não existe campo para valor monetário**, não por confiança nele, mas porque o
> tipo não permite. Quem preenche saldo, prazo e economia é `routers/chat.py::montar_cards`, lendo
> o banco.

Três camadas independentes sustentam o guardrail 7.1, porque prompt não é guardrail:

| Camada | Onde | O que impede |
|---|---|---|
| Estrutural | `assistente/regras.py` | Schema sem campo de valor no que ele afirma: o modelo não consegue emitir número como fato |
| Contexto | `routers/chat.py::_contexto` | O prompt recebe identificação, nunca valores |
| Varredura | `assistente/assistente_llm.py` | Número no texto sem card **de banco** derruba o texto, no servidor |

**O caso do `valor_justo` (M6).** Ele carrega número do banco e mesmo assim **não** sustenta um
número no texto livre. O critério da varredura não é "carrega número do banco", é "vai existir na
tela com certeza" — e a rota descarta o `valor_justo` quando não há achado com valor. Contá-lo
como sustentação abriria caminho para um número cujo card sumiu depois, que é o modo de falha
exato do guardrail 7.1. `CARDS_COM_PROCEDENCIA` continua sendo só `divida_resumo` e
`plano_sugerido`.

**A exceção: `divida_proposta`.** `PropostaDeDivida` tem campo para valor porque é o RASCUNHO do que
a pessoa disse, devolvido para ela confirmar num formulário (guardrail 7.2). Não é dado apurado, não
é exibido como fato, e não chega ao banco: a gravação continua sendo `POST /v1/dividas`, disparada
pela tela. Todo campo é saneado em `assistente_llm.py::_proposta` — resposta de modelo é entrada não
confiável mesmo com schema — e campo inválido cai sozinho, sem derrubar os válidos ao lado. Este é
também o único card **não remontado** do banco a cada leitura do histórico: ele não tem lastro lá, e
registro do que foi dito não envelhece.

**Limitações declaradas:**

1. **O determinístico reconhece três intenções.** Credor citado pelo nome, pedido de plano e
   pedido de resumo. Fora disso, diz que não sabe. É o que roda na suíte (sem rede) e o fallback
   quando não há chave. Ele **não propõe cadastro**: tirar "mil e quinhentos no Nubank" de uma
   frase exigiria um interpretador de dinheiro escrito à mão, e errar a leitura da fala da pessoa
   é pior que não propor.
2. **A varredura de número é heurística.** Pega dígitos; não pega "mil e quinhentos" por extenso.
   A defesa estrutural é a primeira camada; a varredura é a segunda.
3. **O modelo inventa navegação, não número.** Na primeira chamada real mandou o usuário a uma
   "seção de indicadores econômicos" inexistente. O prompt passou a enumerar as três abas reais e
   a proibir inventar tela — vale reexaminar a cada troca de modelo.
4. **Toda mensagem é uma chamada paga**, sem cache nem limite por usuário.
5. **O histórico cresce sem poda.** O teto de 50 é de leitura; nada apaga mensagem antiga.

---

## Erros

Todo erro sai como `{"message": "..."}`, em pt-BR, escrito para leigo — `src/api/client.ts` exibe
esse campo **direto ao usuário**. Nunca carrega valor, credor, CPF ou detalhe técnico
(guardrail 5). Em `422`, acompanha `campo` para o formulário destacar.

Recurso de outro tenant devolve **404, nunca 403**: um 403 confirmaria que o id existe.

---

## Dívida técnica conhecida

> **A suíte roda em SQLite por padrão, e passa igual contra Postgres.** SQLite é o default por
> ser rápido e não exigir infraestrutura; para rodar contra o mesmo banco da produção:
>
> ```bash
> docker exec buddy-postgres psql -U buddy -d postgres -c "CREATE DATABASE buddy_test;"
> BUDDY_TEST_DATABASE_URL=postgresql+psycopg://buddy:buddy@localhost:5433/buddy_test pytest
> ```
>
> Os 420 testes passam nos dois. **A fixture `engine` precisa de `eng.dispose()` no `finally`**:
> sem ele, um engine por teste esgota o `max_connections` do Postgres ("sorry, too many clients
> already"). Em SQLite em memória isso passava despercebido, e a suíte só quebrou quando cresceu
> o bastante para estourar o limite — no M6. É exatamente o tipo de divergência que rodar só em
> SQLite esconde.
>
> Rode contra Postgres antes de qualquer release — SQLite não
> pega divergência de dialeto (constraint que só o Postgres aplica, precisão de `BigInteger`,
> comportamento de índice).

> ~~**O card `valor_justo` não é calculado por ninguém.**~~ — **resolvido no M6.**
> `GET /v1/dividas/{id}/revisao` o produz e o chat passou a emitir o card. Nenhuma regra foi
> inventada: o que mudou foi a definição do campo. `valorJusto` deixou de ser estimativa — que
> de fato não tem fonte — e passou a ser `valorCobrado` menos a soma dos achados citáveis, cada
> um com artigo, súmula ou resolução no docstring. Ver **ADR 0008** e as limitações 8 a 12
> acima.

> ~~**Auth é de beta: um token, um tenant.**~~ — **resolvido no M8.** Há conta, login, sessão
> revogável e recuperação de senha (ADR 0012). A previsão de que "a troca não muda o cliente"
> valeu pela metade: ele já mandava `Bearer` e já tratava 401, mas ganhou renovação silenciosa —
> a peça mais fácil de quebrar do milestone, e a única que exige aparelho para se ter certeza.

> **Recuperação de senha depende de SMTP configurado.** Sem `BUDDY_SMTP_HOST` e
> `BUDDY_SMTP_REMETENTE`, `POST /v1/auth/senha/recuperacao` continua respondendo `202` — ela
> responde 202 sempre, de propósito — mas nenhum código sai, e quem esqueceu a senha fica sem
> caminho de volta para dados financeiros que são só dele. O envio é plugável
> (`BUDDY_CORREIO=smtp|memoria`), e `memoria` serve para desenvolvimento e para a suíte.
>
> É a única dependência externa do produto cuja ausência não tem contorno pela interface. As
> outras degradam com frase útil e caminho manual: sem chave de LLM o chat responde 503 e a
> leitura de contrato oferece o cadastro à mão.

> **Um access token sobrevive até 15 minutos à exclusão da conta.** É o preço de o JWT não
> consultar o banco. Mitigado onde importa: a exclusão reconfirma a senha e apaga as sessões
> junto, então token roubado sozinho não apaga conta nem sobrevive a um logout.
