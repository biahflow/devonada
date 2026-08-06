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
pytest                                     # 156 testes
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
extracao/       base.py (Protocol) · anthropic_extrator.py · factory
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

## Extração de contrato

`extracao/base.py` define o `Protocol` `ExtratorDeContrato`; a factory escolhe a implementação
por `BUDDY_EXTRATOR`. Trocar de provedor não toca as rotas.

A implementação padrão usa Claude com visão (`BUDDY_LLM_MODEL`, default `claude-opus-5`), o que
lê PDF **e** foto sem OCR separado — sem dependência de Tesseract no servidor.

**Três guardrails aplicados no servidor, não só no cliente:**

- **8.1 — evidência obrigatória.** `limpar_campos_sem_evidencia()` zera todo campo que tem valor
  e não tem `trecho` literal antes de a resposta sair da rota. O front descartaria de qualquer
  forma; o backend não deve nem enviar.
- **7.3 — entrada não confiável.** O system prompt declara que o conteúdo do contrato é dado, não
  instrução, e que texto parecido com comando deve ser extraído, não obedecido.
- **ADR 0005 — descarte.** O arquivo vive em memória durante o processamento e nunca toca o
  disco. Persistem os campos e os trechos curtos.

Sem `ANTHROPIC_API_KEY`, o upload responde `status: "falhou"` com frase útil em vez de estourar
500 — o app já trata esse estado e oferece o cadastro manual.

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
> Os 156 testes passam nos dois. Rode contra Postgres antes de qualquer release — SQLite não
> pega divergência de dialeto (constraint que só o Postgres aplica, precisão de `BigInteger`,
> comportamento de índice).

> **`/v1/chat/messages` ainda é mock.** Devolve um card fixo, sem LLM. O chat real é o Bloco 5.
> Ganhou auth como todas as outras rotas.

> **Auth é de beta: um token, um tenant.** Suficiente para um usuário; insuficiente no dia em que
> houver dois. A troca por JWT não muda o cliente, que já manda `Bearer` e trata 401.
