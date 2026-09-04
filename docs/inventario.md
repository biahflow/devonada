# Inventário do devo.nada

> **Documento derivado e datado.** Atualizado em **19/08/2026**, depois do fechamento dos quatro
> débitos do **M10**.
> Ele **descreve**, não decide: em qualquer divergência, quem manda é o documento canônico
> apontado em cada seção (`docs/agent-guidelines.md`, seção "Ordem de precedência").
> Não faz parte da ordem de precedência e não deve ser citado como fonte de regra.
>
> **Por que ele corre risco de envelhecer:** o `roadmap.md` recusa-se de propósito a repetir a
> fila do `api-contract.md`, porque "duas listas da mesma coisa divergem em uma semana". Um
> inventário é, por definição, uma segunda lista. Ao mudar stack, endpoint ou milestone,
> atualize o canônico primeiro; este aqui é o último a saber, e tudo bem.

---

# Parte I — Resumo executivo

## O que o produto é

Um assistente de dívidas para pessoa física. O usuário manda o contrato do empréstimo,
consignado ou financiamento; o app lê, propõe o cadastro, monta o cronograma de parcelas,
mostra o quanto da renda está comprometido, simula quitação por avalanche e bola de neve, e
aponta ponto a ponto o que vale contestar na cobrança — cada achado com o artigo de lei ou a
súmula que o sustenta, e com o trecho literal do contrato que o comprova.

A regra que organiza tudo: **nenhuma regra financeira é inventada.** Regra sem fonte devolve
`None`, e o app exibe "ainda não calculado", que é a verdade. É o que separa este produto de
uma calculadora com número bonito.

## Capacidades entregues

"Entregue" aqui significa **código pronto e gates verdes**. Não significa validado em aparelho —
os gates provam que a tela renderiza e reage, não que ela está legível ou cabe na tela. A
distinção é do `roadmap.md` e este documento não a apaga.

| # | Capacidade | Estado |
|---|---|---|
| M0 | Fundação do front: navegação em abas, design system, cache, testes | **Entregue e validado em device** |
| M1 | CRUD de dívidas: lista, detalhe, cadastro, edição, quitação, exclusão | Entregue; **lista** exercitada em device, demais telas não |
| M1.5 | Ingestão de contrato: upload, extração por LLM, revisão campo a campo | Entregue e exercitado por request real; **falta device** |
| M2 | Painel de endividamento: total, comprometimento, evolução, vencimentos | Entregue; **falta device** |
| M3 | Plano de pagamento, baixa de parcela, renegociação e lembretes locais | Entregue; **falta device** (inclusive o disparo da notificação) |
| M4 | Simulador de quitação: avalanche vs. bola de neve, aporte extra | Entregue; **falta device** |
| M5 | Dívidas dentro do chat: assistente fala sobre os dados reais | Entregue e exercitado com chamada real ao provedor; **falta device** |
| M6 | Revisão de cobrança: achados com fonte legal e script de negociação | Entregue e exercitado por request real; **falta device** |
| M7 | Módulo de caixa: renda, gastos, provisões e a capacidade real de pagamento | Entregue; **falta device** |
| M7.2 | Uma renda só: `fonte_renda` vira a fonte de verdade e o painel volta a exibir comprometimento | Entregue; **falta device** |
| M8 | Conta de usuário: cadastro, login, sessão revogável, recuperação de senha e exclusão de conta | Entregue; **falta device** |
| M9 | Assinatura in-app: 7 dias de teste, somente leitura depois, validação direta com as duas lojas | Entregue; **falta device e conta de loja** |
| M10 | Fork e marca devo.nada: paleta escura, wordmark, splash, ícone (ADR 0014, 0015 e 0018) | Entregue, **sem débito aberto** desde 19/08/2026: contrastes remedidos e virados gate, dígito medido, ícone refeito, `custoDiarioJuros` no resumo. **Falta device.** |
| M11 | Respiro: a fatia de viver entra na cascata antes do corte, e o marco vira evento que não se desfaz (ADR 0019) | Entregue em 20/08/2026; **falta device** — `RespiroCard`, a tela de declaração e a `MarcoScreen` não foram vistas em aparelho, e é o gate humano que fecha o milestone. |
| M12 | Metas nomeadas e a aba da fase verde (ADR 0017); **renda tipada e compromisso percentual (F-011)** e **negociação por canal e registro de resultado (F-012)** (ADR 0021) | Entregue; **falta device**. F-011 e F-012 fechados em 27/08/2026 (T1–T6 cada), integrados em `m12-integration`. |
| M13 | Entrada pelo alívio: onboarding em 3 passos, escolha **múltipla** de dívida e fila de cadastro (ADR 0016) | **Parcialmente entregue**: fluxo central, **data de origem no onboarding**, **extração de boleto/carta/print (F-013)**, **notificação discreta (F-014)**, **documento inline na fila multi-dívida (F-015, ADR 0022)** e **login social (F-016, ADR 0023)** entregues — este último **sem credencial real**, que é gate humano; **páginas de Termos/Privacidade** continuam pendentes. **Falta device**. |
| M14 | Lei do Superendividamento no corpus (ADR 0024) | **Entregue no código**: `backend/juridico/` com id estável e a Lei 14.181/2021; a repactuação nomeada no Caixa e na Rota, e **convite** (não afirmação) na triagem, onde a renda ainda não existe; trilha "como calculamos" em `GET /v1/juridico/fontes` + caixa + revisão. **Falta a revisão da copy jurídica por advogado** (gate de pré-lançamento) e **falta device**. |
| — | Navegação: seta de voltar em toda tela empilhada (ADR 0016) | Entregue; **falta device** |

## Stack, em uma tabela

| Camada | O que é |
|---|---|
| App | Expo SDK 54 · React Native 0.81 · React 19 · TypeScript 5.9 · expo-router · TanStack Query |
| API | Python 3.12 · FastAPI · SQLAlchemy 2 · Pydantic 2 · Alembic · uvicorn |
| Banco | PostgreSQL 16 em Docker, porta 5433 |
| LLM | OpenAI (padrão) ou Anthropic, atrás de uma camada de provedor própria |
| Testes | Jest + React Native Testing Library (front) · pytest (backend) |

## O que falta para o MVP fechar

1. **Validação em aparelho.** Pendente em M1.5, M2, M3, M4, M5 e M6, e parcial no M1. É a
   única pendência transversal do projeto e nenhum gate automático a substitui.
2. **Itens parciais do M1** — cadastro, detalhe, edição, quitação e exclusão nunca foram
   exercitados no app contra o backend real.
3. ~~**Anexar contrato a dívida já cadastrada**~~ — **entregue no F-019** (ADR 0025). Falta device.
4. **Fechamento do mês (M7.1)** — entregue. A tela abre pré-preenchida com o mês anterior,
   diz de onde veio cada número e grava só o que o usuário confirmou. Falta device.

---

# Parte II — Inventário técnico

## 1. Stack e versões

Números lidos das fontes, não de memória. Fonte de cada bloco indicada no cabeçalho.

### Front — `package.json`

| Pacote | Versão |
|---|---|
| `expo` | ^54.0.0 (instalado: **54.0.36**) |
| `react-native` | 0.81.5 |
| `react` | 19.1.0 |
| `typescript` | ~5.9.2 |
| `expo-router` | ~6.0.24 |
| `@tanstack/react-query` | ^5.101.4 |
| `react-native-reanimated` | ~4.1.1 (com `react-native-worklets` 0.5.1) |
| `react-native-safe-area-context` | ~5.6.0 |
| `react-native-svg` | 15.12.1 |
| `react-native-screens` | ~4.16.0 |
| `expo-secure-store` | ~15.0.8 |
| `expo-notifications` | ~0.32.17 |
| `expo-document-picker` · `expo-image-picker` | ~14.0.8 · ~17.0.11 |
| `expo-clipboard` · `expo-linking` · `expo-constants` | ~8.0.8 · ~8.0.12 · ~18.0.13 |
| `@expo-google-fonts/nunito-sans` · `@expo/vector-icons` | ^0.4.2 · ^15.0.3 |
| `@react-native-community/slider` · `datetimepicker` | 5.0.1 · 8.4.4 |
| `expo-apple-authentication` · `@react-native-google-signin/google-signin` | ~8.0.8 · ^16.1.4 |

Dev: `jest` ^29 · `jest-expo` ^57 · `@testing-library/react-native` ^13 · `eslint` ^9 ·
`typescript-eslint` ^8.66 · `prettier` ^3.9 · `qrcode-terminal` ^0.12.

**Versões travadas de propósito** (`docs/architecture.md`, seção 8): `eslint` em `^9` (a 10
quebra o `eslint-plugin-react` do `eslint-config-expo`), `jest` em `^29` (o `jest-expo` 57 traz
o ecossistema 29) e `@testing-library/react-native` em `^13` (a 14.0.1 tem import quebrado).
O `.npmrc` tem `legacy-peer-deps=true`, que já escondeu três problemas reais — confira com
`npm ls` ao adicionar dependência.

### Backend — `backend/requirements.txt`

| Pacote | Versão |
|---|---|
| `fastapi` | 0.141.1 |
| `starlette` | 1.4.1 |
| `uvicorn` | 0.52.1 |
| `SQLAlchemy` | 2.0.51 |
| `psycopg` / `psycopg-binary` | 3.3.4 |
| `alembic` | 1.19.0 |
| `pydantic` / `pydantic-settings` | 2.13.4 / 2.14.2 |
| `openai` | 2.53.0 |
| `anthropic` | 0.120.2 |
| `python-multipart` | 0.0.32 |
| `pytest` | 9.1.1 |
| `pysqlite3` | 0.6.0 (testes rodam em SQLite **e** em Postgres) |

### Runtime e infraestrutura — verificado com `--version`

| Item | Versão |
|---|---|
| Python | 3.12.10 (venv em `backend/venv/`, fora do versionamento) |
| Node | v24.12.0 |
| npm | 11.6.2 |
| Docker | 29.1.3 |
| PostgreSQL | 16-alpine, container `devonada-postgres` |

**Portas escolhidas por colisão, não por gosto:** API na **8001** e Postgres na **5433**,
porque 8000 e 5432 já são do stack do `biahflow-portal-cliente`.

### Modelos de LLM — `backend/config.py`

| Config | Padrão |
|---|---|
| `llm_provider` | `openai` |
| `llm_model_extracao` | `gpt-5` |
| `llm_model_assistente` | `gpt-5-mini` |
| `extrator` / `assistente` | `llm` (alternativa: implementação determinística) |

Chaves (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) vivem **só** no backend. Nada com prefixo
`EXPO_PUBLIC_` pode ser segredo — vai embutido no bundle.

## 2. Arquitetura

Canônico: `docs/architecture.md` · ADR 0003.

- **Cliente burro por decisão.** Todo valor derivado — `valorJusto`, `valorCorrigido`,
  `comprometimentoRenda`, ordem de amortização — vem calculado do servidor. O app formata e
  exibe. A única aritmética permitida no cliente é a subtração de `economia`, nominalmente
  autorizada no guardrail 1.2.
- **Egress único.** `src/api/client.ts` é o único lugar que faz rede: Bearer do
  `expo-secure-store`, JSON, `upload()` multipart e `ApiError` tipada com `status 0` para falha
  de conexão. Não há `fetch` solto em nenhum outro arquivo.
- **Dinheiro é centavo inteiro** em todo lugar, e **taxa é basis point** — no app, no schema e
  nas colunas do banco. Nenhuma coluna `Numeric`, nenhuma `Float`.
- **Multi-tenant desde o primeiro commit.** `tenant_id` vem do token; o cliente nunca o envia;
  toda query filtra por ele. Id de outro tenant devolve **404, nunca 403**. O M8 cobrou a aposta:
  trocar o token fixo por conta de verdade não tocou um único router.
- **Cache com prefixo `['dividas']`** (ADR 0002): resumo, parcelas e revisão vivem dentro do
  prefixo, então as mutações de dívida revalidam tudo sem código novo.

## 3. Superfície de API — 67 operações em 49 caminhos, mais 5 rotas soltas em `main.py`

Canônico: `docs/api-contract.md`. Autenticação: `Authorization: Bearer <access>`, um JWT de 15
minutos (ADR 0012). As únicas rotas públicas são as seis de `/v1/auth`, o health check e
`GET /exclusao`.

| Router | Método e rota | O que faz |
|---|---|---|
| Dívidas | `GET /v1/dividas` | Lista as dívidas do tenant |
| | `POST /v1/dividas` | Cadastra (201) |
| | `GET /v1/dividas/{id}` | Detalhe |
| | `PATCH /v1/dividas/{id}` | Edita |
| | `POST /v1/dividas/{id}/quitacao` | Marca como quitada |
| | `DELETE /v1/dividas/{id}` | Exclui (204) |
| Resumo | `GET /v1/dividas/resumo` | Painel: total, comprometimento, evolução, vencimentos |
| Simulações | `POST /v1/dividas/simulacoes` | Avalanche vs. bola de neve, com aporte |
| Parcelas | `GET /v1/dividas/{id}/parcelas` | Cronograma |
| | `POST /v1/parcelas/{id}/pagamento` | Baixa de parcela |
| | `POST /v1/dividas/{id}/renegociacao` | Renegocia preservando histórico |
| Revisão | `GET /v1/dividas/{id}/revisao` | Achados com fonte + script. **Leitura pura** |
| Perfil | `GET /v1/perfil` · `PUT /v1/perfil` | Renda, dependentes, preferências |
| Lembretes | `GET /v1/lembretes` | Texto já formatado pelo backend |
| Contratos | `POST /v1/contratos` | Upload; extração em background (202) |
| | `GET /v1/contratos/{id}` | Acompanha a extração |
| Chat | `GET /v1/chat/messages` | Histórico, com cards remontados a cada leitura |
| | `POST /v1/chat/messages` | Envia mensagem |

**Nenhuma rota de escrita nasceu em M5 nem em M6.** O que o assistente propõe vira dado pelo
mesmo `POST /v1/dividas` do cadastro manual, depois da confirmação do usuário.

## 4. Modelo de dados — 12 tabelas

`backend/orm.py`, 4 migrations em `backend/alembic/versions/`.

| Tabela | Guarda |
|---|---|
| `divida` | A dívida: credor, valor em centavos, taxa em bps, tipo, datas |
| `parcela` | Cronograma; `situacao` derivada no servidor, nunca no cliente |
| `renegociacao` | Histórico — renegociar não apaga o passado |
| `perfil` | Renda, dependentes, horário do lembrete |
| `saldo_snapshot` | Série da evolução do painel |
| `mensagem_chat` | Histórico do chat; os cards são remontados na leitura |
| `extracao` | Campos lidos do contrato + trechos. **O arquivo não é guardado** (ADR 0005) |
| `fonte_renda` | De onde vem o dinheiro. Registro permanente, não lançamento mensal (M7) |
| `recebimento` | O que de fato caiu, por fonte e por mês. Daqui sai o pior mês (M7) |
| `gasto` | Valor mensal, com `essencial` classificado pelo **usuário** (M7) |
| `provisao_anual` | IPVA, seguro, licenciamento — o que vence de uma vez (M7) |
| `caixa_snapshot` | A cascata congelada. **Append-only**, nunca `UPDATE` (M7) |

## 5. Regras financeiras e suas fontes

É o diferencial do produto, e por isso está aqui inteiro. Canônico: `docs/backend.md`.

### Com fonte legal

| Campo | Regra | Fonte |
|---|---|---|
| `possivelPrescricao` | 5 anos completos desde a origem | Código Civil, art. 206, §5º, I |
| `minimoExistencial` | R$ 600,00 fixos, em config datada | Decreto 11.150/2022, art. 3º, na redação do Decreto 11.567/2023 |
| Multa de atraso acima do teto | Teto de 2% do valor da prestação | CDC, art. 52, §1º (Lei 9.298/1996) |
| Tarifa de cadastro repetida | Devida no início do relacionamento | STJ, Súmula 566 |
| Seguro prestamista embutido | Consumidor não pode ser compelido a contratar | CDC, art. 39, I; STJ, Tema 972 |
| Juros acima do teto do consignado | Teto vigente do consignado | Resolução do CNPS (config datada) |
| CET não informado | Taxa efetiva anual é informação obrigatória | CDC, art. 52, II |
| Prazo máximo do plano de repactuação | 5 anos | CDC, art. 104-A (Lei 14.181/2021) |
| Capitalização sem pactuação | — | STJ, Súmula 539 |
| Comissão de permanência cumulada | — | STJ, Súmula 472 |

### Escolhas de método, declaradas como tal

Não têm lei por trás, e o docstring diz isso: `valorCorrigido` (juros compostos pela taxa **do
próprio contrato**), `custoMedioJurosMensal` (média ponderada pelo saldo), valor da parcela
(divisão inteira com a sobra na última, para a soma fechar), ordem da avalanche (maior taxa
primeiro, sem taxa por último), ordem da bola de neve (menor saldo primeiro), orçamento da
simulação (mínimos + aporte, com rolagem) e `valorJusto` (subtração, não estimativa — ADR 0008).

### Postura

Todo achado é **convite a conferir**, nunca afirmação de ilegalidade. Existe teste automatizado
que quebra se alguém escrever "ilegal", "abusiv", "é seu direito" ou **"superendividado"** na
copy — gêmeo do teste que quebra em "recomendada" no simulador. O último existe porque a
definição legal de superendividamento (CDC, art. 54-A, § 1º) exige boa-fé e dívida de consumo, e
software não apura nenhuma das duas: o app diz que os números **não fecham** e convida a
investigar a repactuação. O produto não redige petição, não emite parecer e não
instrui a não pagar (`docs/guardrails.md`, seção 3).

## 6. Telas e componentes

### Rotas — `app/`, 5 abas

Os rótulos que o usuário lê são **Rota · Dívidas · Metas · Tino · Caixa**; os nomes de pasta são os do
domínio (`painel`, `dividas`, `index`, `caixa`) e não mudam, para não quebrar deep link nem teste.
Na **fase verde** a segunda aba vira **Metas** (ADR 0017).

| Aba | Rotas |
|---|---|
| **Tino** (chat) | `(tabs)/index` |
| **Dívidas** | `dividas/index` (lista) · `nova` · `simulador` · `contrato/index` (envio) · `contrato/[id]` (revisão da extração) · `[id]/index` (detalhe) · `[id]/editar` · `[id]/plano` · `[id]/renegociar` · `[id]/revisao` |
| **Metas** (fase verde) | `metas/index` (Rota de Chegada) · `metas/nova` · `metas/[id]/editar` |
| **Caixa** | `caixa/index` (a cascata) · `renda` · `gastos` · `provisoes` · `metas` ("Seus potes" — **não** é a aba Metas) |
| **Rota** (painel) | `painel/index` · `painel/preferencias` · `painel/assinatura` · `painel/excluir-conta` |
| **(fora das abas)** | `(auth)/login` · `registro` · `esqueci-senha` · `redefinir-senha` — login com barra de abas embaixo é convite a tocar numa aba que vai 401ar |
| **(fora das abas)** | `(onboarding)/divida` · `entrada` · `triagem` — quem chega sem dívida cadastrada não tem o que ver nas outras abas |

### Design system — `docs/design-system.md`

Forma derivada das telas do Budgi (ADR 0011) — card branco sem borda sobre base clara, teal de
ação, violeta de conquista, anel colorido de categoria —, tipografia Nunito Sans, tom
**anti-ansiedade**: acima do limite é `warning` com ícone e texto, nunca `danger`, nunca cor
sozinha. Todo par texto/fundo é medido, não estimado.

Componentes: `Screen`, `PageHeader`, `Card`, `ListRow`, `GrupoDeLista`, `CategoriaIcon`,
`Button`, `FormField`, `CurrencyInput`,
`PercentInput`, `DateField`, `OptionGroup`, `SeletorDeArquivo`, `Feedback`, `LoadingState`,
`EmptyState`, `ErrorState`, `Badge`/`CriticidadeBadge`, `MoneyText`, `StatTile`, `Meter`,
`ConfigurarConexaoButton`. Gráficos em `react-native-svg`: `LinhaEvolucao`, `BarrasCriticidade`
— paleta validada por script, não estimada.

### Cards do chat — união discriminada, `switch` exaustivo

`valor_justo` · `info` · `divida_resumo` · `plano_sugerido` · `divida_proposta`. O dispatcher
`ActionCard` não tem `default`: `kind` sem tratamento é erro de compilação, não card invisível.
Deep link sempre por campo tipado, nunca por id extraído de texto.

## 7. Qualidade

| Suíte | Números |
|---|---|
| Jest | **657 testes em 52 suítes**, verdes em 01/09/2026 no fechamento do F-018 (páginas legais + pacote de revisão jurídica); eram 654 / 52 na integração do F-017 com o F-016, número MEDIDO na árvore integrada e não somado; 643 / 51 no F-016 e 620 / 50 no F-015 (documento inline na fila + conserto do vínculo `extracaoId`); eram 611 / 50 no fechamento integrado do M13 (data de origem + F-013 + F-014) e 606 / 50 no M12. O processo **conclui a suíte e não encerra**, por handle aberto — a contagem sai antes disso, e `--forceExit` é o contorno. Há avisos de `act(...)` a investigar. |
| pytest | **819 testes**, verdes em SQLite em 01/09/2026 no fechamento do F-018 (páginas legais + pacote de revisão jurídica); eram 800 na integração do F-017 com o F-016 (medido, não somado), 773 no F-016, 733 no fechamento do M13 e 721 no M12; avisos são `HTTP_422_UNPROCESSABLE_ENTITY` depreciado, Starlette/httpx e `InsecureKeyLength` do JWT de teste — nenhuma classe nova. Rodado em Python 3.12 via `uv` (o `python3` do sistema é 3.9), sem `pysqlite3` (não é importado por teste; o dialeto `sqlite+pysqlite` usa o `sqlite3` da stdlib). A execução contra Postgres continua obrigatória antes de release e **não** foi feita aqui. |

Gates locais, **seis** desde 19/08/2026: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run bundle:check`, `npm run palette:check` e `npm run digits:check`, mais `pytest` no backend.

Os dois últimos existem porque medição fora do repositório envelhece em silêncio — foi o que
aconteceu com as tabelas de contraste quando o tema virou (ADR 0018). `palette:check` mede **56**
pares declarados em WCAG 2.1 e CIEDE2000 (49 passam, 7 exceções declaradas, 0 reprovam);
`digits:check` lê a largura de avanço dos dígitos direto do TTF.

**Nenhum destes números vale como validação em aparelho.** Eles provam que o código compila,
renderiza, reage e que os pares de cor passam o piso de contraste — piso, não legibilidade. As
telas do M11 (`RespiroCard`, a tela de declaração e a `MarcoScreen`) continuam pendentes de device,
como as de M1.5 a M10.

**Não existe CI.** `.github/` contém apenas `pull_request_template.md`. Os gates dependem de
alguém rodá-los.

**O que nenhum gate prova:** que a tela é legível, que cabe em tela pequena, que o teclado não
cobre o campo, que a notificação toca na hora certa e que a permissão de câmera se comporta.
Isso é o "falta device" que aparece em quase todos os milestones.

## 8. Decisões arquiteturais — 25 ADRs

| # | Decisão |
|---|---|
| 0001 | expo-router como camada de navegação |
| 0002 | TanStack Query para estado de servidor |
| 0003 | Todo cálculo financeiro fica no backend |
| 0004 | Paleta híbrida: pine primário, dourado acento (superseded pela 0010) |
| 0005 | O arquivo do contrato é descartado após a extração |
| 0006 | Postgres, token fixo e extrator plugável (extrator substituído pela 0007; token fixo, pela 0012) |
| 0007 | Camada de provedor de LLM, e OpenAI como padrão |
| 0008 | `valorJusto` é soma de achados citáveis, não estimativa |
| 0009 | O usuário decide a ordem dos potes; o app mostra a aritmética |
| 0010 | Paleta derivada de Pierre e Budgi (superseded pela 0011) |
| 0011 | A forma vem das telas do produto, não do CSS da landing |
| 0012 | Conta de usuário: JWT curto, refresh rotacionado e a sessão como único estado global |
| 0013 | Assinatura in-app: teste de 7 dias, somente leitura depois, e validação no servidor |
| 0014 | devo.nada nasce como fork, não como projeto novo |
| 0015 | Vermelho é status de dívida, e a interface é escura |
| 0016 | Toda tela empilhada tem volta, e o onboarding aceita mais de uma dívida |
| 0017 | `Meta` é entidade nova, e a fase verde troca a aba sem esconder as dívidas |
| 0018 | A medição de contraste volta para dentro do repositório e vira gate; o vermelho ganha token de texto |
| 0019 | O respiro é o piso do corte, e quem diz o valor dele é o usuário |
| 0020 | O assistente se chama Tino, e a marca antiga sai da página pública |
| 0021 | O tipo da renda ganha efeito por adição, e o canal decide quando a oferta é dita |
| 0022 | Documento lido inline na fila multi-dívida do onboarding, sem sair do grupo |
| 0023 | Login social: a conta é o `sub` do provedor, e conta sem senha exclui pelo provedor |
| 0024 | O corpus jurídico é registro curado com id estável, e a trilha não carrega valor |
| 0025 | Documento em dívida existente entra por rota própria, e o que a pessoa digitou vence |

As linhas 0019 a 0022 **estavam faltando** nesta tabela desde o M11 — o inventário é visão
derivada, e a fonte canônica é [`docs/adr/README.md`](adr/README.md). Corrigidas aqui.

ADR aceita nunca é reescrita — decisão que muda vira ADR nova.

## 9. Limitações declaradas

Estão aqui porque escondê-las inverteria o princípio do projeto. Íntegras em `docs/backend.md`.

1. `valorCorrigido` é `null` sem taxa — não aplicamos IPCA, INPC ou Selic que o contrato não prevê.
2. `dependentes` não entra no mínimo existencial — o Decreto 11.150 não escala por dependente.
3. A simulação **não projeta juros sobre dívida sem taxa**; o prazo devolvido é otimista para
   quem tem dívida assim, e a tela nomeia quais são.
4. Dívida sem cronograma entra na simulação com parcela mínima zero.
5. Sem renda informada, o aporte não é checado contra o mínimo existencial.
6. A revisão **não recalcula o contrato**: achado que exigiria reamortizar aparece sem número e
   não entra em `valorJusto`.
7. **~~Dívida sem contrato lido não produz achado~~ — RESOLVIDO no F-019 (ADR 0025).** Cadastro
   manual continua devolvendo `achados: []` **enquanto** não houver documento ligado, mas isso
   deixou de ser condenação: `POST /v1/dividas/{id}/documento` leva um documento a uma dívida que
   já existe, com conciliação campo a campo (o digitado vence por padrão), e a revisão daquela
   dívida passa a produzir achado. As entradas estão no detalhe da dívida e no vazio da própria
   revisão — que antes convidava a "envie o contrato" **sem botão nenhum**.
8. A margem consignável ficou de fora: incide sobre a soma de todas as consignações, não sobre
   uma dívida.
9. O teto de juros do consignado é responsabilidade do operador, vive no `.env` **sem default**,
   e não configurado significa achado inexistente.
10. O indício de "relacionamento anterior" é estreito — só há sinal quando existe outra dívida do
    mesmo credor, mais antiga, cadastrada no app.
11. **As exclusões do art. 4º do Decreto 11.150 não estão implementadas.** O decreto manda não
    computar na aferição do mínimo existencial as parcelas de consignado, financiamento
    imobiliário, garantia real, crédito rural e outras. O app só conhece a modalidade quando o
    contrato foi lido, então a margem exibida é **mais conservadora** que a do decreto.
12. **Sem caixa preenchido, o simulador ainda usa o piso legal como custo de vida** (M7). É
    otimista, e por isso é fallback e não o caminho principal — mas recusar tudo de quem ainda
    não chegou na aba de caixa tiraria a ferramenta de quem mais precisa dela.
13. **A renda típica precisa de três recebimentos** para deixar de ser o valor informado (M7).
    Com um ou dois pontos não há variação observada, só pontos soltos.
14. **`margemDisponivel` muda de definição conforme o caixa** (M7.2): `aporteMaximo` quando o
    caixa conhece a saída, `renda − mínimo existencial − comprometido` quando não. A tela ainda
    não nomeia qual das duas está exibindo.
15. **~~Na fila multi-dívida do onboarding, o documento não é pedido durante o cadastro~~ —
    RESOLVIDO no F-015 (ADR 0022).** A leitura do documento agora acontece **inline** dentro do
    grupo `(onboarding)`, sem abandonar a fila: cada dívida marcada pode mandar o documento, a
    extração roda ali mesmo com revisão campo a campo (trecho à vista, guardrail 8.1) e o
    `extracaoId` viaja no POST final. O invariante da ADR 0016 (nada gravado antes do fim) sobrevive
    porque extração grava linha `extracao`, nunca `divida`. O F-015 também consertou um bug
    pré-existente: o cliente nunca enviava `extracaoId`, então dívida vinda de contrato não ligava a
    extração e a triagem dela não mostrava achado.
16. **~~Não existe login social~~ — CÓDIGO RESOLVIDO no F-016 (ADR 0023); FALTA CREDENCIAL.**
    `POST /v1/auth/social` confere o ID token pela camada plugável `backend/identidade/`
    (`apple` · `google` · `memoria`), a conta é `(provedor, sub)`, e `DELETE /v1/conta` reconfirma
    pela credencial que a conta tem — senha, ou o provedor com o `sub` conferido, sem o que quem
    entra pela Apple ficaria sem como excluir a conta (diretriz 5.1.1(v)). No app,
    `expo-apple-authentication` e `@react-native-google-signin/google-signin` atrás de
    `src/social/`, e o botão só aparece onde há para onde mandar o toque.
    **O que falta é humano, não código:** `DEVONADA_APPLE_CLIENT_IDS`,
    `DEVONADA_GOOGLE_CLIENT_IDS` e `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` precisam de conta na Apple
    Developer e projeto no Google Cloud. Vazias, os botões seguem desligados com a legenda e a rota
    recusa com `503`. **Nada disso foi validado em aparelho.**
17. **~~A linha "Termos e Política de Privacidade" é texto, não link~~ — RESOLVIDO no F-018;
    FALTA REVISÃO JURÍDICA E URL PÚBLICA.** As duas páginas existem em `GET /termos` e
    `GET /privacidade`, no padrão da `/exclusao`, com conteúdo derivado do código — o levantamento
    que o sustenta está em [`docs/legal/inventario-de-dados.md`](legal/inventario-de-dados.md). A
    linha da tela de entrada virou link, e **volta a ser texto quando a URL não está configurada**:
    um 404 de política na frente do revisor da loja é reprovação.
    **O que falta é humano:** revisão por advogado (as páginas carregam faixa de minuta até lá, com
    teste que confirma), hospedar em `devonada.com.br` e apontar o DNS — a mesma pendência que a
    `/exclusao` já tinha.
18. **Duas coisas chamadas "metas"** (ADR 0017): `/v1/caixa/metas` são os potes da cascata do
    fechamento; `/v1/metas` são as metas nomeadas da aba. Custo assumido de não migrar, porque
    mover os potes mudaria a capacidade de todo mundo em silêncio.
19. **A troca de aba da fase verde não tem teste.** `jest-expo` mocka `Tabs` como `View`, então
    `href: null` é invisível para a suíte — mesma situação de `gestureEnabled` no onboarding. São
    configuração de navegação, e a verificação é em device, nos dois sistemas.

20. **As ementas do corpus jurídico são paráfrase nossa, ainda não revisada por advogado — mas
    passaram por conferência de citação.** Cada uma foi checada contra a norma que alega, e a
    passada achou erro: a ementa da Súmula 566 citava a MP 1.963-17/2000, que é a norma da Súmula
    539; os dispositivos originais do CDC declaravam vigência 11/09/1990, quando o código só
    entrou em vigor em 11/03/1991 (art. 118, 180 dias de vacatio); e as entradas da Lei
    14.181/2021 traziam a data da lei, não a da publicação. **Os três estão corrigidos e travados
    por teste.** Dois não puderam ser verificados e viraram pergunta objetiva: o número do artigo
    do Decreto 11.150 e a tese do Tema 972.
    O pacote que fecha o item está em
    [`docs/legal/pacote-de-revisao-juridica.md`](legal/pacote-de-revisao-juridica.md) — todo o
    texto jurídico que o produto exibe, onde aparece, e sete perguntas de resposta curta.
    **Conferir citação não é revisar juridicamente**, e quem fez a conferência não é advogado.
    `backend/juridico/fontes.py` guarda quinze normas com id estável (M14, ADR 0024), e é ele que
    alimenta o disclosure "como calculamos" e o `fonte` de cada achado. O `texto` **literal** só
    está preenchido onde a citação já estava conferida no repositório; nas seis entradas da Lei
    14.181/2021 ele é `None` de propósito — e `None` significa "leia na fonte", com o link do
    Planalto viajando junto. A revisão por advogado já era gate de pré-lançamento do `roadmap.md`;
    o que mudou é que ela agora tem alvo delimitado: um arquivo, quinze entradas.

21. **A trilha "como calculamos" é convenção, não obrigação.** Quatro números derivados têm a sua
    (`capacidadeHoje`, `naoFecha`, `valorJusto`, `possivelPrescricao`), e o teste cobre esses
    quatro. Nada no código força uma regra nova de domínio que produza número exposto a ganhar
    trilha — e a que não ganhar volta a ser número sem procedência na tela.

22. **~~Mudar o valor cobrado não regenera as parcelas~~ — RESOLVIDO onde dá para resolver
    honestamente.** Os dois caminhos que mudam `valorCobrado` (`PATCH /v1/dividas/{id}` e
    `POST /v1/dividas/{id}/documento`) passaram a chamar `ajustar_parcelas_pendentes`: as parcelas
    **pendentes** passam a somar `novo valor − o que já foi pago`, mantendo datas, quantidade e
    **ids** — os lembretes de push mandam `parcelaId` no payload, e recriar parcela quebraria deep
    link em voo. Pagas e canceladas nunca são tocadas, e nenhuma `Renegociacao` é gravada: corrigir
    um número errado não é o credor ter aceitado termos novos, e sujar essa tabela corromperia o
    benchmark de desconto por credor. O método de divisão agora tem definição única
    (`dividir_valor`, em `backend/domain/parcelas.py`), usada também por `gerar_cronograma`.

    **Onde ele se recusa a resolver:** se o novo valor ficar **abaixo do que já foi pago**, a rota
    devolve `409` e não altera nada. Pode ser erro de digitação, pode ser juros, pode ser acordo
    novo — nenhuma dessas é conta que o app tenha fonte para fazer, e escolher uma seria o
    `valorCobrado * 1.1` de novo.

    **Limitação residual, e ela continua real:** dívida com o carnê **inteiramente pago** não é
    ajustada, porque mexer no `valor` de uma parcela paga falsificaria histórico de pagamento.
    Nesse caso a soma das parcelas continua divergindo do `valorCobrado`. É o único caso que sobra,
    e ele sobra por escolha.

23. **~~O mapa campo→trecho é mantido em dois lugares~~ — RESOLVIDO.** `camposDaDivida`
    (`src/util/extracao.ts`) passou a ser a definição única do mapa "campo do documento → campo da
    dívida", tipada campo a campo. `extracaoParaProposta` monta a proposta a partir dela e
    `linhasDeConciliacao` a indexa para achar o trecho — o segundo `switch` deixou de existir.
    O teste que trava o invariante percorre as **duas funções públicas**, não o mapa: para os
    quatro tipos de documento, todo campo que a proposta traz tem de virar linha com `trecho` à
    vista. Se alguém reseparar os mapas e eles divergirem, a divergência aparece ali como campo
    proposto sem linha, ou linha sem trecho.
    `linhasDeRevisao` (`src/util/revisaoExtracao.ts`) **não** foi unificado de propósito: ele monta
    as linhas de TODOS os campos do documento, encargos inclusive, e não é o mesmo mapa.

24. **~~`divida.parcelas_pagas` nunca é escrito~~ — RESOLVIDO por derivação.** A coluna nunca
    foi mantida por ninguém, e a tela exibia **"0 de 12 pagas" com o carnê inteiro quitado**.
    `parcelasPagas` passou a ser **contado da lista real de parcelas** (não canceladas, com
    `paga_em` preenchido) em `_agregados_de_parcelas`. A coluna continua no banco como resquício —
    remover coluna é mudança destrutiva e exige aprovação humana — mas deixou de ser a resposta.
    Não se passou a escrever a coluna de propósito: coluna que alguém precisa lembrar de atualizar
    envelhece; derivada, não (mesma lição de `tabelas_do_tenant()` no M8).

25. **~~`divida.proximo_vencimento` não avança quando uma parcela é paga~~ — RESOLVIDO por
    derivação.** `proximoVencimento` passou a ser o **menor vencimento entre as pendentes**. Carnê
    inteiro pago devolve `null`, e não a data antiga: não há nada a vencer, e cair de volta na
    coluna reintroduziria a data velha por outra porta. `backend/routers/chat.py:82` continua com o
    fallback próprio — ele já lê as parcelas reais quando há pendentes, e sua lógica não foi tocada.

    As duas derivações saem de **uma query só** para a página inteira de `GET /v1/dividas`,
    agregada em Python — nada de `COUNT(...) FILTER` ou `case()`, que são construções de dialeto e
    passariam no SQLite da suíte para quebrar no Postgres do ar. **Há teste que conta as queries** e
    falha se voltar a ser uma por dívida (verificado injetando o N+1).

26. **Depois de uma renegociação, "X de Y pagas" mistura dois carnês — e há `numero` repetido.**
    `renegociar()` cancela só as **pendentes** e cria o carnê novo numerado a partir de 1
    (`backend/routers/parcelas.py:171-206`). A parcela paga do carnê antigo sobrevive, não
    cancelada, com o `numero` dela. Consequências, as duas reais:
    (a) `GET /v1/dividas/{id}/parcelas` devolve **duas parcelas número 1** — uma paga do carnê
    antigo e a primeira do novo —, e a tela de plano as lista lado a lado;
    (b) **as duas telas discordam entre si.** Verificado em aparelho em 04/09/2026, com um acordo
    de R$ 3.600,00 em 3 parcelas fechado sobre um carnê de 12 com uma paga: o detalhe da dívida
    exibe **"1 de 3 pagas"** — `app/(tabs)/dividas/[id]/index.tsx:122` usa `parcelasPagas` e
    `totalParcelas` da API —, enquanto o carnê exibe **"1 de 4 pagas"** —
    `app/(tabs)/dividas/[id]/plano.tsx:76` conta as linhas carregadas. A descrição anterior desta
    limitação previa só o "1 de 3 onde existem 4 linhas"; o que o usuário vê são **dois números
    diferentes em duas telas**, e a lista ainda mostra "Parcela 1 de 12" ao lado de "Parcela 1 de
    3", com o denominador antigo e o novo no mesmo carnê.

    Observado na mesma passagem, menor e de rolagem: voltar da renegociação para o carnê deixa a
    tela **em branco** até rolar para cima — a lista encurtou de 12 para 4 itens e a posição de
    scroll anterior ficou além do novo conteúdo.
    Decidido em 03/09/2026 **não** derivar o denominador junto: ele deixaria de bater com o número
    de parcelas que a pessoa combinou no acordo. A correção de raiz é a renegociação continuar a
    numeração e somar as pagas ao total — mexe na semântica de `novoTotalParcelas` no contrato de
    API e pede ADR própria.

27. **A extração de CONTRATO não funciona com `DEVONADA_LLM_PROVIDER=anthropic`.** Verificado em
    runtime em 04/09/2026: `POST /v1/contratos` com `tipo=contrato` termina em `status: "falhou"`
    para **qualquer** documento, com **400** do provedor — *"Schemas contains too many parameters
    with union types (38 parameters with type arrays or anyOf) ... limit: 16"*. A causa é
    estrutural e não depende do arquivo: `CampoExtraido` (`backend/schemas.py:415`) tem três campos
    anuláveis (`valor`, `trecho`, `pagina`) e o structured outputs conta cada um como união, então
    os 12 campos do contrato viram 36. **O boleto passa a um campo do teto** (15 de 16); carta (12)
    e print (9) sobram. O usuário vê apenas "Não deu certo agora", porque `ClienteAnthropic`
    traduz `APIStatusError` sem registrar o corpo do erro (`backend/llm/anthropic_cliente.py`) — o
    diagnóstico exige chamar o extrator fora da rota e ler a exceção encadeada. O resto do
    adaptador está correto para os modelos atuais (`thinking` adaptativo, `output_config` com
    `effort` e `format`, sem parâmetros de amostragem). **Não apareceu antes porque o provedor
    padrão é `openai`:** o caminho anthropic é a segunda implementação que prova que a fronteira do
    `ClienteLLM` é real, e nenhum teste o exercita — a suíte não toca a rede.

28. **"Falta quitar" não desce quando o usuário paga uma parcela, e discorda do simulador.**
    Verificado em aparelho em 04/09/2026: com uma parcela de R$ 400,00 paga, a aba Rota continuou
    exibindo **R$ 26.300,00** e **"0% da rota percorrida"**, enquanto o simulador, na mesma sessão e
    no mesmo mês, partiu de **R$ 23.582,50**. São duas definições de saldo convivendo:

    | quem | fonte | setembro/26 |
    | --- | --- | --- |
    | Rota, detalhe da dívida, cards do chat | `sum(valor_cobrado)` — `backend/routers/resumo.py:168`, `backend/routers/dividas.py:98`, `backend/routers/chat.py:114` | R$ 26.300,00 |
    | Simulador | soma das parcelas pendentes — `backend/leitura.py:41` | R$ 23.582,50 |

    A do simulador é deliberada e está escrita no próprio código ("SALDO E PARCELA MÍNIMA VÊM DAS
    PARCELAS REAIS quando existe cronograma"). A outra nunca foi decidida: `valor_cobrado` é o que o
    credor cobra, e só vira zero quando a dívida inteira é marcada como quitada. O alcance passa da
    linha "Saldo devedor": **`rotaPercorridaBps`, a curva de evolução do saldo e os marcos**
    (`registrar_marcos`, mesmo router) derivam do mesmo total, então pagar parcela não move a rota
    nem atinge marco — o oposto da tese do produto. **Não é conserto de uma linha:** descontar a
    parcela paga do total afirmaria uma amortização que o app não tem fonte para calcular (parte da
    parcela é juro), e é exatamente o tipo de número que a seção 1.2 proíbe inventar. Pede decisão
    de produto sobre o que "falta quitar" significa, e provavelmente ADR — o comprometimento da
    renda e os próximos vencimentos **já** usam parcela real e estão corretos.

    **A rota não está congelada — ela anda pelo evento errado.** Observado na mesma sessão: a
    renegociação da mesma dívida (valor cobrado de R$ 4.800,00 para R$ 3.600,00) moveu o painel na
    hora, de "R$ 26.300,00 · 0%" para "R$ 25.100,00 · 5% da rota percorrida". Ou seja: negociar um
    desconto move a rota, e pagar a parcela combinada não. Para quem usa o app, é o incentivo
    invertido.

29. **As trilhas do caixa descrevem uma conta que não é a executada: o mínimo existencial está na
    fórmula e não está na aritmética.** Verificado em aparelho e pela API em 04/09/2026, com renda
    líquida de R$ 3.500,00 e piso de R$ 600,00 configurado (`minimoExistencialVigenteEm`
    2023-06-19): `capacidadeHoje` voltou **R$ 3.500,00** — o piso não foi descontado —, e a tela
    exibiu esse número sob "Como chegamos na sua sobra por mês", com a fórmula *"renda típica −
    impostos e reservas − **mínimo existencial** − respiro − gastos essenciais − gastos não
    essenciais"* e o passo *"Tiramos o mínimo existencial: o piso que a lei protege de qualquer
    plano de pagamento"* (`backend/juridico/trilhas.py:65`).

    A cascata real (`backend/domain/caixa.py:460-489`) é `renda_líquida − essenciais − provisão −
    reserva − aposentadoria − respiro − compromisso − não_essenciais`. O piso não aparece em linha
    nenhuma dela: no caixa ele é **guardrail de validação** — respiro ou compromisso que empurre a
    sobra abaixo dele é recusado com 422 (`backend/routers/caixa.py:880` e `:1161`) — e o campo
    `abaixoDoPiso`. Nunca uma parcela subtraída.

    **Vale para as duas trilhas do caixa.** `NAO_FECHA` declara *"soma das parcelas mínimas > renda
    típica − impostos − mínimo existencial"*, e o domínio decide por `comprometido_dividas >
    capacidade_maxima` (`backend/domain/caixa.py:553`), também sem o piso.

    Nenhuma das duas contas está necessariamente errada — tratar o piso como limite, e não como
    despesa, é decisão defensável e é o que o 422 já faz. O que está errado é a trilha afirmar uma
    coisa e a conta fazer outra, na peça que existe justamente para tornar o número auditável, e
    sobre justamente o número que a lei protege. `_conferida()` (`trilhas.py:55`) valida que os ids
    das fontes existem; **nada valida que a fórmula corresponda à cascata** — é o mesmo buraco das
    limitações 23 e 24, agora entre a narrativa do número e o número.

30. **Sobra por mês negativa aparece em verde, ao lado de um selo de saúde e de um alerta que se
    contradizem aos olhos.** Verificado em aparelho em 04/09/2026, no cenário em que as parcelas
    não cabem (`naoFecha: true`, `margemDisponivel: -48531`): o painel exibiu **"Sobra por mês
    −R$ 485,31" em verde**. A cor é fixa — `app/(tabs)/painel/index.tsx:131` passa `tone="accent"`
    ao `MoneyText`, e `corDoTom` (`src/components/ui/MoneyText.tsx:67`) só desvia de tom para
    `debt` em tamanho grande. Nenhum caminho pinta valor negativo de outra cor.

    No mesmo cartão convivem, de cima para baixo: o medidor verde "Comprometimento da renda 11,01%
    · Dentro do limite saudável de 30%", o número negativo em verde, e o alerta âmbar "As parcelas
    que você já paga não cabem no que sobra". **O medidor não está errado** — ele troca o texto
    quando passa do limite (`src/components/ui/Meter.tsx:49`), e 11,01% está mesmo abaixo de 30%,
    porque mede parcelas ÷ renda. O alerta também não: ele considera gastos e provisões. As duas
    métricas respondem perguntas diferentes e aparecem lado a lado sem nomear qual é qual — a
    mesma raiz da limitação 14, agora visível como contradição aparente na tela de abertura.

(Duas limitações antigas foram **resolvidas** no M3 e não constam acima: `comprometimentoRenda`
deixou de ser aproximação e `proximosVencimentos` deixou de voltar vazio.)

---

# Parte III — O que dá para construir depois

## Lacunas do que já existe

| Lacuna | Situação |
|---|---|
| ~~**Anexar contrato a dívida já cadastrada**~~ | **Fechada no F-019** (ADR 0025). `POST /v1/dividas/{id}/documento` liga extração concluída do mesmo tenant a uma dívida existente, com conciliação campo a campo. Não precisou de migração: `divida.extracao_id` existia desde a migração inicial — faltava caminho, não coluna |
| **Validação em device** | Pendência transversal de M1.5 a M6 |
| **Telas do M1 não exercitadas** | Cadastro, detalhe, edição, quitação e exclusão contra o backend real |
| ~~**Login de verdade**~~ | **Fechada no M8.** Cadastro, login, sessão revogável e recuperação de senha (ADR 0012). A tela de token do beta foi removida |
| ~~**Não há como cobrar**~~ | **Fechada no M9.** In-app purchase com validação no servidor, provedor de loja plugável e paywall por método HTTP (ADR 0013). Falta cadastrar o produto nas lojas |
| **Recuperação de senha sem SMTP** | Sem `DEVONADA_SMTP_*` configurado, nenhum código é enviado — e a rota continua respondendo 202, porque responder outra coisa a transformaria em verificador de cadastro. É a única dependência externa do produto cuja ausência não tem contorno pela interface |
| **URL pública de exclusão** | `GET /exclusao` existe, mas só onde a API existe. A exigência do Google é uma URL pública. O domínio é `devonada.com.br` desde 20/08/2026; falta hospedar e apontar o DNS |
| **CI** | Nenhum pipeline. Os gates dependem de disciplina |
| **Tetos do consignado** | Sem default e sem rotina de atualização — mudam por resolução do CNPS |

## Pós-MVP — direção, não compromisso

- **Open Finance** (`docs/data-ingestion.md`) — extrato, saldo e cartão alimentando o contexto
  do assistente. É o que transforma "assistente de dívidas" em planejador financeiro, e é o
  maior salto de complexidade, custo e risco regulatório do roadmap. O obstáculo é estrutural:
  o Banco Central exige instituição autorizada para integração direta.
- **Renda, orçamento e metas** — o outro lado do fluxo de caixa.
- **Onboarding, signup e billing** — o cliente já é multi-tenant, então não há retrofit de
  isolamento a fazer.
- **Offline-first com storage cifrado** — `AsyncStorage` cru está descartado pelo guardrail 5.
- **Proteção contra screenshot** nas telas de dívida.
- **Acessibilidade auditada** com leitor de tela real, não só `accessibilityLabel` presente.

## Regras financeiras que caberiam, e o que falta para cada uma

Cada linha abaixo exige a mesma disciplina do M6: conferir no texto primário antes do código.

- **Margem consignável** (Lei 10.820/2003) — precisa da soma de todas as consignações do
  benefício, que o app não tem. Não pertence a `valorJusto`; seria uma tela própria.
- **Correção por índice oficial** — hoje `valorCorrigido` é `null` sem taxa contratual. Aplicar
  IPCA ou INPC exige decidir e documentar qual índice e por quê.
- **Mínimo existencial com dependentes** — o Decreto não escala; a regra teria de vir de outra
  fonte, ou ser declarada como escolha de método.

---

## Como manter este documento honesto

Ele mente no dia em que um número aqui divergir da fonte. Ao revisá-lo, reconfira contra:
`package.json`, `backend/requirements.txt`, `backend/docker-compose.yml`, os decoradores
`@router` em `backend/routers/`, os `__tablename__` em `backend/orm.py`, e a saída real de
`npm test` e `pytest`. Se não der para reconferir, é melhor apagar a linha do que deixá-la.
