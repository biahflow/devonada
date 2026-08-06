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
pytest                                     # 202 testes
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
auth.py         Bearer → tenant_id
domain/         REGRAS DE NEGÓCIO puras, com fonte citada
routers/        dividas · resumo · simulacoes · parcelas · perfil · lembretes · contratos · chat
llm/            ÚNICO lugar que conhece SDK de modelo (ADR 0007)
assistente/     o assistente do chat, sobre a camada llm/
extracao/       base.py (Protocol) · regras.py (prompt) · extrator_llm.py · factory
alembic/        migrations
tests/          pytest
```

### Duas regras estruturais

**Dinheiro é `BigInteger` em centavos; taxa é `Integer` em basis points.** Nenhuma coluna
`Numeric`, nenhuma `Float`, em nenhuma tabela. A regra dos centavos vale no banco, não só no
app — é aqui que ela para de ser convenção e vira estrutura.

**Toda query filtra por `tenant_id`.** Com um usuário só isso parece cerimônia, mas é o que faz
a troca por JWT multiusuário depois ser trabalho de auth, e não uma auditoria de isolamento em
cada rota. O cliente nunca envia tenant; ele vem do token.

---

## As regras financeiras e suas fontes

| Campo | Regra | Fonte | Arquivo |
|---|---|---|---|
| `possivelPrescricao` | 5 anos completos desde a origem | Código Civil, art. 206, §5º, I | `domain/prescricao.py` |
| `valorCorrigido` | Juros compostos pela taxa **do próprio contrato** | O contrato do usuário | `domain/correcao.py` |
| `minimoExistencial` | 25% do salário mínimo vigente | Decreto 11.150/2022, art. 3º | `domain/minimo_existencial.py` |
| `custoMedioJurosMensal` | Média das taxas **ponderada pelo saldo** | — (escolha de método, documentada) | `domain/resumo.py` |
| Valor da parcela | Divisão inteira com a **sobra na última** | — (aritmética; a soma tem de fechar) | `domain/parcelas.py` |
| `situacao` da parcela | Vencimento < hoje e não paga | — (derivada no servidor, nunca no cliente) | `domain/parcelas.py` |
| Ordem da avalanche | Maior taxa primeiro; **sem taxa por último** | — (definição corrente da estratégia) | `domain/simulacao.py` |
| Ordem da bola de neve | Menor saldo primeiro | — (idem; ver `domain.md`, seção 4) | `domain/simulacao.py` |
| Orçamento da simulação | Mínimos iniciais + aporte, **com rolagem** | — (escolha de método, documentada) | `domain/simulacao.py` |
| `economiaVsMinimo` | Juros do cenário mínimo − juros do cenário com aporte | — (diferença entre dois resultados do mesmo motor) | `domain/simulacao.py` |

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
> `PedidoDeCard` carrega um id e, no máximo, o aporte que o próprio usuário declarou — **não
> existe campo para valor monetário**, não por confiança no modelo, mas porque o tipo não
> permite. Quem preenche saldo, prazo e economia é `routers/chat.py::montar_cards`, lendo o banco.

Três camadas independentes sustentam o guardrail 7.1, porque prompt não é guardrail:

| Camada | Onde | O que impede |
|---|---|---|
| Estrutural | `assistente/regras.py` | Schema sem campo de valor: o modelo não consegue emitir número |
| Contexto | `routers/chat.py::_contexto` | O prompt recebe identificação, nunca valores |
| Varredura | `assistente/assistente_llm.py` | Número no texto sem card derruba o texto, no servidor |

**Limitações declaradas:**

1. **O determinístico reconhece três intenções.** Credor citado pelo nome, pedido de plano e
   pedido de resumo. Fora disso, diz que não sabe. É o que roda na suíte (sem rede) e o fallback
   quando não há chave.
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
> Os 202 testes passam nos dois. Rode contra Postgres antes de qualquer release — SQLite não
> pega divergência de dialeto (constraint que só o Postgres aplica, precisão de `BigInteger`,
> comportamento de índice).

> **O card `valor_justo` não é calculado por ninguém.** Ele existe no contrato e no front desde o
> começo, mas nenhum endpoint o produz: não há regra de valor justo com fonte citável, e
> inventá-la seria o oposto do que este backend faz. O chat deixou de ser mock no M5, mas não
> passou a emitir esse card.

> **Auth é de beta: um token, um tenant.** Suficiente para um usuário; insuficiente no dia em que
> houver dois. A troca por JWT não muda o cliente, que já manda `Bearer` e trata 401.
