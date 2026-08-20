# F-012 — Execution Plan

Produzido pelo Planner a partir do Feature Contract aceito em [`feature.md`](feature.md). Este
documento diz **como** a feature aceita é decomposta. Ele não altera requisito, não escolhe harness
ou modelo e não concede aprovação.

O formato abaixo é o `FEATURE EXECUTION PLAN` de
`/Users/danielcampos/workspace/engineeringOS/agents/planner.md`.

---

## FEATURE EXECUTION PLAN

```text
feature_id: F-012

goal: Dar ao usuário a fala certa para o canal em que ele vai negociar, sempre protegida pelo
  alerta de validação e pela regra de pagamento — inclusive quando não há contrato para revisar —,
  e transformar o resultado de cada negociação em dado consultável. Hoje o alerta anti-golpe existe
  por extenso em `docs/domain.md:316-336` e NÃO existe em código; o script é uma string única
  montada em `routers/revisao.py:114-157`; e `orm.Renegociacao` é grava-e-esquece, escrita num
  ponto só (`parcelas.py:174-185`), sem nenhum `GET` que a devolva.

assumptions:
  - A ADR 0021 é a decisão vigente e não será reaberta: o canal decide QUANDO a oferta é dita, o
    número é idêntico nos três, o resultado de negociação é entidade nova, e o canal é parâmetro na
    leitura e coluna no registro.
  - Baseline de validação MEDIDA em 20/08/2026 durante o planejamento: 45 suítes / 539 testes Jest
    e 620 pytest com 23 avisos, todos verdes. A tabela de `docs/engineering-os-adoption.md` bate
    campo a campo com a medição.
  - A cabeça da cadeia Alembic é `116f2181bdda`, confirmada por `alembic heads`. **Só T3 escreve
    migração neste plano.**
  - `revisar_divida` (`revisao.py:188-231`) é caminho único de propósito, e alimenta DUAS
    superfícies: a rota `GET /v1/dividas/{id}/revisao` (`revisao.py:254`) e o card `valor_justo` do
    chat (`chat.py:136`). Qualquer mudança de forma atinge as duas — a rota e a conversa não podem
    divergir sobre o mesmo contrato.
  - Nenhuma tarefa roda contra Postgres nem contra aparelho.
  - F-011 e F-012 não têm interseção de ARQUIVOS. Têm interseção de EFEITO: o F-011 muda o número
    da oferta que o script desta feature recita (PF-1 do plano do F-011). Ver PF-3 aqui.

risks:
  - **Alerta de segurança que não alcança quem precisa.** É o risco que a decisão 2 do contrato
    existe para fechar, e ele volta se a implementação amarrar o alerta à existência de achado por
    algum caminho lateral. Hoje `app/(tabs)/dividas/[id]/revisao.tsx:140-151` renderiza o script
    condicionado a `revisao.script`, e `chat.py:137` filtra o card por `valorJusto is None or not
    r.script`. T4-AC1 é o critério que trava a tela; o filtro do chat fica como está por decisão
    (PF-2).
  - **Copy de negociação sem revisão de advogado.** O roadmap marca isso como o único item que pode
    ENCERRAR o produto em vez de atrasar um release. Esta feature multiplica a copy por três e é a
    que mais aumenta a superfície a revisar. É gate humano aberto, não pendência de código.
  - **Divergência entre a tela e o chat.** Três variantes de script criam a primeira chance real de
    a conversa e a tela discordarem sobre o mesmo contrato. T2 mantém `revisar_divida` como caminho
    único e T6 escreve o teste que compara os três canais.
  - **Script sem achado que parece afirmar algo.** Texto de segurança e texto de contestação lado a
    lado, mal separados, produzem a leitura de que a dívida tem problema quando ninguém disse isso.
    T1 separa por `momento` tipado, e T6-AC3 planta uma dívida sem achado e verifica que NENHUMA
    afirmação sobre valor aparece.
  - **Benchmark enviesado.** Se só o acordo fechado for registrado, metade da informação some. A
    entidade nova de T3 existe exatamente para caber recusa, contraproposta e silêncio.
  - **Mudança de comportamento em produção.** A oferta sai do primeiro contato nos canais escritos.
    Quem copiou o script na semana passada vai encontrar outro texto. É deliberado (ADR 0021,
    item 5) e precisa ser declarado no roadmap por T6.

tasks:
  - id: T1
    role: builder
    goal: O script deixa de ser uma string e vira blocos tipados por canal — com a segurança
      abrindo e fechando, e a oferta no momento que o canal permite.
    scope: |
      `backend/domain/script.py` (novo) — módulo PURO, sem sessão de banco, sem LLM:
        `Canal = Literal["telefone", "chat", "email"]`.
        `BlocoScript` frozen dataclass: `id`, `titulo: str | None`, `texto: str`,
          `momento: Literal["abertura","argumento","oferta","fechamento"]`, `copiavel: bool`.
        `montar_script(canal, credor, achados, capacidade_mensal) -> tuple[BlocoScript, ...]`.
      As duas constantes de segurança, com a fonte apontando para `docs/domain.md:316-336`:
        **alerta de validação de canal**, que ABRE todo script escrito — conferir o número no site
          oficial do credor, nunca negociar com número que entrou em contato primeiro;
        **regra de pagamento**, que FECHA todo script escrito — boleto ou Pix em nome do credor
          (CNPJ), jamais CPF de pessoa física.
      O posicionamento da oferta, conforme a ADR 0021, item 5 — hoje `revisao.py:149-155` faz
        `linhas.insert(-1, "...consigo comprometer até R$ X por mês...")` para **qualquer**
        destino, contra o que `domain.md:334` manda, e **o código é que cede**:
          `telefone` — a oferta continua na fala; conversa em tempo real não tem segunda mensagem.
          `chat` — a oferta vira bloco separado, `momento="oferta"`, marcado para uso DEPOIS da
            proposta do credor.
          `email` — o primeiro e-mail vai sem oferta, com o texto do segundo pronto ao lado.
      Script mínimo de segurança: **sem achado, `montar_script` NÃO devolve mais `None`**
        (hoje `revisao.py:134-135`). Produz alerta + regra de pagamento e nada mais — nenhuma
        afirmação sobre valor cobrado, valor justo ou irregularidade.
      Nos canais escritos, cada bloco é `copiavel=True` isoladamente.
      `backend/tests/test_script.py` (novo) — os três canais, o caso sem achado, e a prova de que
        o número é idêntico nos três.
    out_of_scope: |
      Nenhuma rota, nenhum schema Pydantic, nenhuma mudança em `routers/` — T2.
      Nada em `src/`.
      **Gerar script por LLM.** `montar_script` é template curado e o docstring já explica por quê
      (guardrail 3). Fundamento legal não é improvisado pelo modelo.
      Mudar `domain/revisao.py`: os achados, a `fonte` obrigatória e a soma do `valor_justo`
      (`revisao.py:339-346`) ficam exatamente como estão. A ADR 0008 não é afrouxada por esta
      feature.
      Afirmar ilegalidade ou direito, em qualquer variante.
      Redigir petição, notificação extrajudicial ou peça para Procon.
    expected_areas: backend/domain/script.py · backend/tests/test_script.py
    acceptance_criteria: |
      T1-AC1 Os três canais produzem o MESMO `valorJusto` e os MESMOS achados; só o formato muda.
        Há teste que compara os três e falha se algum número divergir.
      T1-AC2 `telefone`, `chat` e `email` diferem no posicionamento da oferta exatamente como a
        ADR 0021, item 5, descreve — e há um teste por canal.
      T1-AC3 Todo script de canal **escrito** abre com o alerta de validação e fecha com a regra de
        pagamento. Há teste que falha se qualquer variante sair sem um dos dois.
      T1-AC4 Dívida sem achado nenhum produz script — não `None` — contendo alerta e regra de
        pagamento, e **nenhuma** afirmação sobre valor cobrado, valor justo ou irregularidade.
      T1-AC5 No canal `chat`, cada bloco é copiável isoladamente: a função devolve blocos tipados,
        não um texto único que alguém precise fatiar (guardrail 1.2).
      T1-AC6 Nenhuma chamada a LLM entra no módulo, e o docstring diz por quê.
      T1-AC7 `cd backend && venv/bin/pytest` passa inteiro.
    depends_on: []
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/domain/script.py, backend/tests/test_script.py),
      VALIDATE (pytest)
    risk: Médio. É onde a copy de negociação triplica, e é a tarefa cuja saída o advogado vai
      revisar. Escrever texto que afirme algo é o modo de falha, não escrever código errado.
    relative_effort: M

  - id: T2
    role: builder
    goal: O canal chega à API, e o script mínimo de segurança alcança quem cadastrou a dívida na
      mão — nas duas superfícies que `revisar_divida` alimenta.
    scope: |
      `backend/routers/revisao.py` — `montar_script` (114-157) é SUBSTITUÍDA pela chamada ao módulo
        puro de T1; `revisar_divida` (188-231) passa a receber o canal; a rota (234-254) ganha
        `?canal=telefone|chat|email`, com **`email` como default** (ver PF-1).
      `backend/schemas.py` — `RevisaoCobranca.script` passa de `str | None` para a forma tipada
        `{ canal, blocos: [...] }`; mesmo campo em `ValorJustoCard`. Mudança de contrato declarada,
        não aditiva.
      `backend/routers/chat.py:121-150` — o card `valor_justo` passa a carregar os blocos do canal
        default. **O filtro da linha 137 (`if r.valorJusto is None or not r.script: continue`) fica
        como está** — decisão de 20/08/2026, PF-2: sem achado com valor a rota continua não
        emitindo card, porque é a ADR 0008 e a regra de forma do `api-contract.md`, seção M6.
      `backend/tests/test_revisao.py` — cobertura dos três canais na rota, do default, e do caso
        sem achado devolvendo script em vez de `null`.
    out_of_scope: |
      Registro de resultado de negociação e sua migração: T3. **Nenhuma tabela nova nesta tarefa.**
      Qualquer arquivo em `src/`: T4.
      **Afrouxar o filtro de `chat.py:137`** para emitir card com `valorJusto: null`. Um card
      chamado "valor justo" sem valor justo é o modo de falha exato do guardrail 7.1, e o alerta
      chega pela tela de revisão (PF-2).
      Mudar `domain/revisao.py` ou a regra de `valor_justo`.
      Persistir o canal. Na leitura ele é parâmetro de visualização e NÃO persiste (ADR 0021,
      item 7); persistir é papel de T3.
    expected_areas: backend/routers/revisao.py · backend/routers/chat.py · backend/schemas.py ·
      backend/tests/test_revisao.py
    acceptance_criteria: |
      T2-AC1 `GET /v1/dividas/{id}/revisao?canal=telefone|chat|email` devolve os blocos daquele
        canal; sem o parâmetro, devolve o default declarado no `api-contract.md`.
      T2-AC2 Os três canais devolvem `valorJusto` e `achados` idênticos — o teste compara as três
        respostas da ROTA, não só a função pura.
      T2-AC3 Dívida sem contrato lido devolve `200` com `achados: []` **e script presente**, com
        alerta e regra de pagamento. Há teste que planta uma dívida sem `extracao_id` e verifica as
        duas coisas.
      T2-AC4 `valorJusto` continua `null` sem achado que o sustente. O script novo não cria número.
      T2-AC5 O card `valor_justo` do chat continua NÃO sendo emitido quando `valorJusto` é `null`, e
        há teste que prova o filtro intacto.
      T2-AC6 O canal não é gravado em lugar nenhum nesta tarefa.
      T2-AC7 Dívida de outro tenant: **404, nunca 403**.
      T2-AC8 Os testes de copy de `test_revisao.py:202-228` passam a varrer as três variantes.
      T2-AC9 `cd backend && venv/bin/pytest` passa inteiro.
    depends_on: [T1]
    validation: cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (backend/routers/revisao.py, backend/routers/chat.py,
      backend/schemas.py, backend/tests/test_revisao.py), VALIDATE (pytest)
    risk: Alta. É a tarefa que altera comportamento JÁ EM PRODUÇÃO, em duas superfícies, e a única
      que muda a forma de um campo existente em vez de acrescentar.
    relative_effort: L

  - id: T3
    role: builder
    goal: O que aconteceu na negociação vira dado — inclusive quando não houve acordo — e passa a
      ter uma rota que o devolve.
    scope: |
      `backend/orm.py` — `ResultadoNegociacao` (nova): `tenant_id`, `divida_id`, `canal`,
        `desfecho` (`acordo` · `recusa` · `contraproposta` · `sem_resposta`), `valor_proposto` e
        `valor_obtido` opcionais, `renegociacao_id` opcional (preenchido quando houve acordo),
        `observacao` opcional, `registrado_em`. Append-only, no molde de `Renegociacao` (96-112).
      `backend/alembic/versions/` — UMA migração forward-only encadeada em `116f2181bdda`, no
        estilo de `116f2181bdda_marco_unique_tenant_tipo.py`, com índice em `tenant_id`.
      `backend/schemas.py` — request e response do registro e da leitura.
      `backend/routers/` — `POST /v1/dividas/{id}/negociacoes` → 201;
        `GET /v1/dividas/{id}/negociacoes` (histórico da dívida) e `GET /v1/negociacoes`
        (do tenant, que é o que constrói o benchmark). É a rota de leitura que hoje **não existe**:
        `orm.Renegociacao` não tem nenhum schema Pydantic de saída, e sem leitura não há benchmark.
      `backend/tests/` — grava e lê de volta, os quatro desfechos, e o isolamento por tenant.
    out_of_scope: |
      **Afrouxar os `NOT NULL` de `orm.Renegociacao`.** A ADR 0021, item 6, recusou explicitamente:
      mexeria em dado em produção e misturaria o que aconteceu na conversa com o que mudou no
      contrato. `Renegociacao` continua sendo só o acordo.
      **Mexer no marco.** `primeira_negociacao` continua nascendo do acordo fechado, ao lado do
      INSERT que o produz (`parcelas.py:190` chamando `registrar_marcos`), e continua não se
      desfazendo. Registrar um resultado NÃO dispara marco.
      **Benchmark agregado entre usuários** — média de mercado, "credores que mais dão desconto",
      comparação social. Este contrato coleta e devolve o dado do PRÓPRIO tenant; agregar entre
      tenants é decisão de produto e de privacidade que ninguém tomou.
      Qualquer arquivo em `src/`: T5.
      Script e canal na leitura: T1 e T2.
      Editar `backend/routers/conta.py` — a varredura é derivada do metadata.
    expected_areas: backend/orm.py · backend/alembic/versions/ · backend/schemas.py ·
      backend/routers/ · backend/tests/
    acceptance_criteria: |
      T3-AC1 O resultado é gravado com canal e desfecho, e devolvido por rota de leitura. Há teste
        que grava e lê de volta.
      T3-AC2 Os quatro desfechos são aceitos, inclusive os três SEM acordo. Recusa e silêncio são
        metade da informação do benchmark.
      T3-AC3 `desfecho: acordo` aceita `renegociacao_id`, e os demais o deixam nulo.
      T3-AC4 A tabela nova tem `tenant_id`, e um teste prova que ela aparece em
        `tabelas_do_tenant()` sem ninguém ter editado `routers/conta.py`.
      T3-AC5 O marco `primeira_negociacao` continua sendo disparado pelo acordo em
        `parcelas.py:190` e **não** pelo registro de resultado; a regressão do M11 segue verde.
      T3-AC6 Recurso de outro tenant devolve **404, nunca 403**.
      T3-AC7 `alembic upgrade head`, `downgrade -1` e `upgrade head` rodam contra banco limpo, com
        o DDL conferido contra `CreateTable(Base.metadata)` — `conftest.py` não valida migração.
      T3-AC8 `cd backend && venv/bin/pytest` passa inteiro.
    depends_on: []
    validation: cd backend && venv/bin/pytest ; venv/bin/alembic upgrade head ;
      venv/bin/alembic downgrade -1 ; venv/bin/alembic upgrade head
    required_capabilities: READ, WRITE (backend/orm.py, backend/alembic/versions, backend/schemas.py,
      backend/routers, backend/tests), VALIDATE (pytest, alembic)
    risk: Médio. Ramo independente do script; o risco é escopo, não técnica — a tentação de
      "aproveitar" e mexer na `Renegociacao` existente, que o contrato proíbe.
    relative_effort: M

  - id: T4
    role: builder
    goal: O `ScriptCard` sai de "Ainda só especificação" — e o alerta alcança quem não tem
      documento.
    scope: |
      `src/api/types.ts` — o tipo `BlocoScript` e `Canal`; `RevisaoCobranca.script` (hoje `:455`,
        `string | null`) e `ValorJustoCardData.script` (hoje `:83`, `string` obrigatório) passam à
        forma tipada. Mudança nas duas pontas.
      `src/api/revisao.ts` e `src/hooks/useRevisao.ts` — o canal como parâmetro de query; a chave
        de cache passa a incluir o canal, senão trocar de canal devolve o cache do anterior.
      `src/components/cards/ScriptCard.tsx` (novo) — seletor de canal no topo
        (`telefone · chat · e-mail`), fala entre aspas, e abaixo o bloco "Por que você pode falar
        isso" com borda esquerda verde de 2px e a citação em `caption`, conforme
        `docs/design-system.md:676-694`. Na variante escrita, **cada bloco é um bloco com botão
        copiar próprio**. O alerta de validação abre o card e a regra de pagamento o fecha.
      `app/(tabs)/dividas/[id]/revisao.tsx:140-151` — passa a exibir o script **mesmo quando
        `valorJusto` é `null`**. É aqui que o alerta anti-golpe alcança quem cadastrou a dívida na
        mão, e é o item de maior retorno por linha do milestone.
      `src/components/cards/ValorJustoCard.tsx` — consome a forma nova sem mudar o que exibe.
      `src/test/screens/revisao.test.tsx` — os quatro estados, os três canais, e o caso sem achado.
    out_of_scope: |
      Registro de resultado na tela: T5.
      **Compor citação de artigo de lei no cliente.** Fundamento legal vem do backend curado
      (guardrail 3, `docs/guardrails.md:112-113`). O front nunca compõe nem completa.
      **Enviar qualquer coisa.** O app não disca, não manda mensagem, não dispara e-mail. Script é
      sugestão copiável e editável; a classe de ação continua "rascunho, autônoma, não envia nada"
      (guardrail 7.2).
      Calcular economia, valor justo ou qualquer derivado além da subtração literal que
      `ValorJustoCard` já faz e que o guardrail 1.2 permite nominalmente.
      Escrever o verbete de design system — T6 o escreve a partir do que esta tarefa entregou.
      Backend.
    expected_areas: src/api/types.ts · src/api/revisao.ts · src/hooks/useRevisao.ts ·
      src/components/cards/ · app/(tabs)/dividas/[id]/revisao.tsx · src/test/screens/revisao.test.tsx
    acceptance_criteria: |
      T4-AC1 **O critério que dá nome à tarefa:** com `valorJusto: null` e `achados: []`, a tela de
        revisão EXIBE o script de segurança. Há teste que falha se ela o esconder.
      T4-AC2 O seletor de canal troca a variante, e a chave de cache inclui o canal — trocar e
        voltar não devolve o texto do canal anterior.
      T4-AC3 No canal `chat`, cada bloco tem botão copiar próprio, e copiar um bloco não copia os
        outros.
      T4-AC4 O alerta abre e a regra de pagamento fecha o card em toda variante escrita.
      T4-AC5 Nenhum texto da tela afirma ilegalidade ou direito, nas três variantes.
      T4-AC6 Os quatro estados de tela têm teste.
      T4-AC7 48pt e `accessibilityLabel` em todo controle sem texto visível — o seletor de canal e
        os botões de copiar por bloco são exatamente esse caso.
      T4-AC8 Os seis gates do front passam.
    depends_on: [T2]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check
    required_capabilities: READ, WRITE (src/api, src/hooks, src/components/cards,
      app/(tabs)/dividas, src/test), VALIDATE (npm scripts)
    risk: Alta. É a tela onde texto de segurança e texto de contestação convivem, e onde a leitura
      errada — "o app disse que a dívida tem problema" — nasce de separação visual ruim, não de
      código errado.
    relative_effort: L

  - id: T5
    role: builder
    goal: O canal deixa de ser placeholder de texto livre e vira dado.
    scope: |
      `src/api/types.ts`, `src/api/` e `src/hooks/` — o tipo e as chamadas de resultado de
        negociação.
      `app/(tabs)/dividas/[id]/renegociar.tsx` — canal e desfecho como campos TIPADOS. Hoje o canal
        só aparece como placeholder do campo `observacao` (linha 125, *"Acordo por telefone,
        protocolo 12345"*), e texto livre não sustenta benchmark nenhum.
      A tela de registro cobre os quatro desfechos, inclusive os três sem acordo — registrar uma
        recusa não pode exigir preencher valor de acordo.
      A leitura do que foi registrado, para a dívida.
      `src/test/screens/` — os quatro estados e os quatro desfechos.
    out_of_scope: |
      Telas de benchmark agregado entre usuários, "credores que mais dão desconto" ou comparação
      social. Fora de escopo pelo contrato.
      Mudar o fluxo de renegociação que já existe: registrar acordo continua chamando
      `POST /v1/dividas/{id}/renegociacao` e reescrevendo as parcelas. O resultado é registro
      ADICIONAL, não substituto.
      `ScriptCard` e canal na leitura do script: T4.
      Backend.
    expected_areas: src/api/types.ts · src/api/ · src/hooks/ ·
      app/(tabs)/dividas/[id]/renegociar.tsx · src/test/screens/
    acceptance_criteria: |
      T5-AC1 Canal e desfecho são campos tipados, não texto livre.
      T5-AC2 Os quatro desfechos são registráveis, e registrar recusa ou silêncio **não** exige
        valor de acordo.
      T5-AC3 O fluxo de renegociação existente continua funcionando sem mudança de comportamento.
      T5-AC4 Os quatro estados de tela têm teste.
      T5-AC5 48pt e `accessibilityLabel` nos controles novos.
      T5-AC6 Nenhum valor é calculado no cliente.
      T5-AC7 Os seis gates do front passam.
    depends_on: [T3]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check
    required_capabilities: READ, WRITE (src/api, src/hooks, app/(tabs)/dividas, src/test),
      VALIDATE (npm scripts)
    risk: Médio. Divide `src/api/types.ts` com T4.
    relative_effort: M

  - id: T6
    role: builder
    goal: Provar a copy nas três variantes, provar que o número não muda entre canais, e deixar a
      documentação dizendo a verdade.
    scope: |
      `src/test/screens/` — teste de copy das três variantes, no molde de
        `respiro-copy.test.tsx` (36 casos, prova por injeção): com um termo proibido plantado em
        cada variante, ele **falha nas três**.
      **Alinhar os dois regexes de copy do guardrail 3** (PF-4): `test_revisao.py:211` proíbe
        `ilegal|abusiv|nul[ao]\b|é seu direito|você tem direito|com certeza|garantid[ao]`;
        `revisao.test.tsx:150` usa o mesmo **sem `nul[ao]\b`**. Com a copy triplicando, a
        divergência deixa de ser cosmética.
      `backend/tests/` — teste que compara os três canais e falha se algum NÚMERO divergir; teste
        que planta dívida sem achado e verifica alerta presente e nenhuma afirmação sobre valor;
        regressão do marco `primeira_negociacao`; **regressão da oferta contra o PF-3** — o valor
        recitado pelo script é o mesmo que o simulador aceita.
      `docs/api-contract.md` — seção **3.15** com o contrato do script por canal e do resultado de
        negociação, e **Bloco 15** na fila da seção 4. A seção M6 (612-676) passa a apontar para a
        forma nova do campo `script`, porque hoje ela documenta a string única.
      `docs/design-system.md` — `ScriptCard` **promovido** de "Ainda só especificação" (676-694)
        para a seção dos componentes que existem, escrito a partir do que T4 entregou.
      `docs/guardrails.md` — decidir a incógnita aberta do contrato: "anti-golpe" não é guardrail
        numerado hoje. Se é o item de maior retorno por linha do milestone, ganha seção própria.
      `roadmap.md` — os quatro itens de F-012 no M12 marcados, e a **mudança de comportamento a
        declarar**: a oferta sai do primeiro contato nos canais escritos, atingindo a tela de
        revisão e o card `valor_justo` do chat.
      `docs/inventario.md` e `docs/engineering-os-adoption.md` — baseline novo, MEDIDO.
      `docs/features/F-012-negociacao-por-canal/evidence.md` (novo) — os seis `BUILD REPORT` com
        atribuição por tarefa.
    out_of_scope: |
      Código de feature. T6 escreve teste e documento.
      Declarar satisfeito o gate de revisão por advogado. Nenhum agente o declara, e esta feature
      **amplia** o que ele precisa cobrir.
      Marcar como validado em device o que não foi visto em aparelho.
      Fundir os `BUILD REPORT` num resumo.
    expected_areas: src/test/screens/ · backend/tests/ · docs/api-contract.md ·
      docs/design-system.md · docs/guardrails.md · roadmap.md · docs/inventario.md ·
      docs/engineering-os-adoption.md · docs/features/F-012-negociacao-por-canal/evidence.md
    acceptance_criteria: |
      T6-AC1 O teste de copy quebra por injeção nas TRÊS variantes, provado plantando um termo
        proibido em cada uma.
      T6-AC2 Os dois regexes de copy passam a ser o mesmo conjunto de termos (PF-4).
      T6-AC3 Teste que planta dívida sem `extracao_id` e verifica alerta presente E nenhuma
        afirmação sobre valor cobrado, valor justo ou irregularidade.
      T6-AC4 Teste que compara os três canais e falha se algum número divergir.
      T6-AC5 A regressão do marco `primeira_negociacao` do M11 continua verde.
      T6-AC6 `docs/design-system.md` não deixa o `ScriptCard` em "Ainda só especificação" depois de
        ele existir.
      T6-AC7 O roadmap declara a mudança de comportamento em produção.
      T6-AC8 `evidence.md` preserva os seis Builder Reports com atribuição por tarefa.
      T6-AC9 Os sete perfis passam, e o relato distingue o executado do pulado.
    depends_on: [T2, T4, T5]
    validation: npm run typecheck ; npm run lint ; npm test ; npm run bundle:check ;
      npm run palette:check ; npm run digits:check ; cd backend && venv/bin/pytest
    required_capabilities: READ, WRITE (src/test, backend/tests, docs/, roadmap.md),
      VALIDATE (todos os perfis)
    risk: Baixo tecnicamente, alto por ser o último portão — e por ser onde a mudança de
      comportamento em produção é declarada ou esquecida.
    relative_effort: M

parallel_groups:
  - onda_1: [T1, T3]        # nenhuma dependência; arquivos disjuntos (domain/script.py × orm.py)
  - onda_2: [T2]            # depende de T1
  - onda_3: [T4, T5]        # T4 espera T2; T5 espera T3. Dividem src/api/types.ts
  - onda_4: [T6]

critical_path: T1 → T2 → T4 → T6 (M, L, L, M)
  O caminho é o do script, não o do registro. T2 é a tarefa mais arriscada da feature — muda a
  forma de um campo existente em DUAS superfícies e altera comportamento em produção — e T4 é a
  tela onde segurança e contestação convivem. O ramo do registro (T3 → T5, M e M) é independente,
  mais curto, e reencontra o caminho em T6.

integration_strategy: |
  Dois ramos independentes que se encontram no fim: o do script (T1 → T2 → T4) e o do registro de
  resultado (T3 → T5). Nada no ramo do registro depende do ramo do script, e vice-versa.

  Integração contínua no `main`, uma tarefa por commit. T2 é o commit que muda comportamento em
  produção; ele não deve viajar junto com nenhum outro, para que reverter seja possível sem
  desfazer trabalho alheio.

  Duas tarefas de onda paralela não devem editar o mesmo arquivo ao mesmo tempo. Se a execução for
  sequencial, a ordem é T1, T3, T2, T5, T4, T6.

  T6 fecha a feature. Nenhuma tarefa marca item de device, e nenhuma declara satisfeito o gate do
  advogado.

human_gates:
  - SATISFEITO em 20/08/2026 — aprovação deste plano. F-012 está `READY_FOR_BUILD`.
  - ABERTO e de PRÉ-LANÇAMENTO — **revisão da copy das três variantes por advogado**, antes do
    público. Já está no roadmap como o único item capaz de encerrar o produto em vez de atrasar um
    release, e esta feature triplica a superfície que ele precisa cobrir. Nenhuma tarefa deste
    plano o declara satisfeito, e T6 é explicitamente proibida de fazê-lo.
  - SATISFEITO em 20/08/2026 — as três incógnitas do contrato, pela ADR 0021, incluindo o conflito
    entre `domain.md` e o código em produção, que ela decide resolver **alterando o código**.
  - SATISFEITO em 20/08/2026 — a modelagem do resultado de negociação (entidade nova × colunas
    aditivas), decidida na ADR 0021, item 6.
  - SATISFEITO em 20/08/2026 — onde o alerta anti-golpe alcança quem não tem achado (PF-2).
  - Validar em device o `ScriptCard` com seletor de canal — leitura dos blocos, botão de copiar por
    bloco, acessibilidade. Nenhum agente o declara satisfeito.

planning_findings:
  - id: PF-1
    severity: resolvido no plano
    finding: a rota `GET /v1/dividas/{id}/revisao` não tem parâmetro de canal hoje, e clientes
      existentes não vão mandar um. Escolher o default É uma decisão de comportamento em produção,
      não detalhe de implementação.
    resolution: **`email` como default.** O texto único de hoje (`revisao.py:137-157`) é uma
      mensagem formal e estruturada — "Olá. Sou cliente e gostaria de rever alguns pontos do meu
      contrato com {credor}", parágrafo por achado, pedido de demonstrativo — que é exatamente o
      registro do canal `email`. Qualquer outro default trocaria o formato E o momento da oferta de
      uma vez. Fica declarado no `api-contract.md` por T6, não deduzido do código.
  - id: PF-2
    severity: RESOLVIDO por decisão humana em 20/08/2026
    finding: `chat.py:137` filtra o card `valor_justo` com `if r.valorJusto is None or not r.script:
      continue`. Mesmo com `montar_script` deixando de devolver `None`, a primeira condição continua
      barrando quem não tem achado — que é justamente quem cadastrou a dívida na mão e é o alvo
      preferencial do golpe. O contrato promete que o alerta alcance essa pessoa e não diz por onde.
    decision: **o filtro fica como está, e a superfície do alerta é a tela de revisão.** Emitir card
      com `valorJusto: null` contrariaria a ADR 0008 e a regra de forma do `api-contract.md`, seção
      M6 ("sem achado com valor, a rota não emite o card"), e um card chamado "valor justo" sem
      valor justo é o modo de falha exato do guardrail 7.1. `app/(tabs)/dividas/[id]/revisao.tsx`
      passa a exibir o script mesmo com `valorJusto` nulo — T4-AC1. Um card de segurança próprio no
      chat fica registrado como caminho aberto, não como escopo desta feature.
  - id: PF-3
    severity: informativo, herdado do F-011
    finding: `revisao._capacidade_para_oferta` (`revisao.py:160-185`) lê
      `leitura.capacidade_atual` e é o QUARTO consumidor que nem a ADR 0021 nem os contratos citam.
      Quando o F-011 entregar o compromisso percentual, **o valor da oferta recitada por esta
      feature cai**, sem que nenhum arquivo desta feature seja tocado.
    resolution: aceito por decisão humana em 20/08/2026 (PF-1 do plano do F-011). T6 desta feature
      escreve a regressão do lado do script: o valor recitado é o mesmo que o simulador aceita. A
      premissa "F-011 e F-012 não têm interseção" vale por arquivo, não por efeito.
  - id: PF-4
    severity: resolvido no plano, atribuído a T6
    finding: os dois testes de copy do guardrail 3 não varrem o mesmo conjunto.
      `backend/tests/test_revisao.py:211` inclui `nul[ao]\b`; `src/test/screens/revisao.test.tsx:150`
      não. Eles também varrem coisas diferentes — o backend, campo a campo do `Achado`; o front, a
      árvore renderizada inteira via `JSON.stringify`. Com a copy de negociação triplicando, uma
      divergência que era cosmética passa a ser um buraco de cobertura.
    resolution: T6 alinha os dois conjuntos de termos, mantendo as duas técnicas de varredura, que
      são complementares e não redundantes.
  - id: PF-5
    severity: informativo
    finding: `registrar_marcos` NÃO está em `backend/domain/marcos.py`, como o contrato sugere ao
      citar "domain/marcos.py:83-84". O que está lá é `marcos_atingidos`, função pura (53-92), com
      `primeira_negociacao` em 83-84. A gravação com `SAVEPOINT` mora em
      `backend/routers/marcos.py:47-98`. Nenhuma tarefa precisa tocar nenhum dos dois; o registro
      fica onde está, em `parcelas.py:190`.
  - id: PF-6
    severity: informativo
    finding: a tabela nova entra sozinha na exclusão de conta, porque
      `routers/conta.tabelas_do_tenant()` (`conta.py:20-32`) é derivada de
      `orm.Base.metadata.sorted_tables`, filtrando por `tenant_id`. T3-AC4 **prova** que a varredura
      a alcança, em vez de assumir.
  - id: PF-7
    severity: aberto, não bloqueante — decisão de documentação
    finding: "anti-golpe" não é guardrail numerado. O conceito vive em `docs/domain.md` e no
      roadmap, e `docs/guardrails.md` não tem número para ele. O próprio contrato registra a
      pergunta e diz que ela não bloqueia.
    resolution: atribuída a T6, com o escopo de decidir e escrever. Se é o item de maior retorno por
      linha do milestone, provavelmente merece seção própria.

PARALLELISM_RISK:
  - arquivo: backend/schemas.py
    tarefas: [T2, T3]
    natureza: T2 muda a FORMA de `RevisaoCobranca.script` e `ValorJustoCard.script`; T3 acrescenta
      os schemas do resultado de negociação. Sem sobreposição semântica, com conflito de merge se
      rodarem juntas. Resolvido pelas ondas: T3 está na onda 1 e T2 na onda 2.
  - arquivo: src/api/types.ts
    tarefas: [T4, T5]
    natureza: T4 muda `RevisaoCobranca` e `ValorJustoCardData`; T5 acrescenta o tipo de resultado.
      Mesma natureza, mesma onda — coordenar ou serializar.
  - features: [F-011, F-012]
    arquivos: [backend/schemas.py, src/api/types.ts]
    natureza: as duas features escrevem nos mesmos dois arquivos, em classes diferentes. Elas não
      têm interseção de comportamento nesses arquivos, mas têm de merge. Se executadas em paralelo,
      use worktrees separados ou serialize os commits que tocam esses dois arquivos.
```

---

## Resultado da validação do plano

```text
PLAN_VALID
```

Conferido item a item contra a checklist de `agents/planner.md`:

| Verificação | Resultado |
|---|---|
| IDs únicos | T1–T6, sem repetição |
| Toda dependência aponta para tarefa existente | sim |
| Aciclicidade | sim — ondas 1 a 4, sem aresta de volta |
| Critério de aceite por tarefa | 6 tarefas, 48 critérios, idênticos nos Task Contracts |
| Validação por tarefa | comandos reais, conferidos contra `package.json` e o venv do backend |
| Capacidades declaradas | sim, com o escopo de escrita nomeado em arquivos |
| Requisitos da feature com dono | os 7 itens de `Scope` e os 10 `Acceptance Criteria` do `feature.md` estão cobertos; nenhum órfão, nenhum duplicado |
| Escopo de tarefa delimitado em arquivos | sim, com `out_of_scope` explícito em todas |
| Paralelismo seguro | 3 `PARALLELISM_RISK` registrados, nenhum bloqueante |
| Caminho crítico | T1 → T2 → T4 → T6, com a razão escrita |
| Estratégia de integração | contínua, com T2 isolada no próprio commit |

Este plano **não tem `ARCHITECTURE_DECISION_REQUIRED` nem gate de planejamento aberto**, e está
pronto para congelamento assim que a aprovação humana chegar — ao contrário do plano do F-011, cuja
base de incidência do percentual (o `PF-4` de lá) ainda não foi decidida.

**Cobertura dos `Acceptance Criteria` do contrato:**

| Critério do `feature.md` | Tarefa |
|---|---|
| Três canais, mesmo `valorJusto` e mesmos achados | T1 (puro), T2 (rota), T6 (prova) |
| Todo script escrito abre com alerta e fecha com regra de pagamento | T1, T4 |
| Dívida sem achado produz script, sem afirmar nada | T1, T2, T6 |
| `valorJusto` continua `null` sem achado | T2 |
| No `chat`, cada bloco é copiável isoladamente | T1 (blocos tipados), T4 (botão por bloco) |
| Resultado consultável por rota de leitura, com canal e desconto | T3, T5 |
| Marco `primeira_negociacao` continua disparando e não se desfaz | T3, T6 |
| Testes de copy varrem as três variantes, provado por injeção | T6 |
| Nenhum dado novo escapa do tenant | T3 |
| Quatro estados, 48pt e `accessibilityLabel` em tela nova | T4, T5 |

---

## `PLAN_DEVIATION`

Nenhum. O plano ainda não foi congelado para execução. A partir do congelamento, mudança em
dependência ou em trabalho planejado entra aqui com tarefa, estado planejado, estado real, impacto
e resolução; não se corrige o plano em silêncio.

---

## PLAN_DEVIATION — 20/08/2026 · coordenação da cadeia Alembic entre F-011 e F-012

- **task:** F-011 T1 e F-012 T3.
- **planned:** cada plano assumiu, isoladamente, ser o único a escrever migração no milestone, e
  ambos declararam encadear em `116f2181bdda`.
- **actual:** as duas features foram autorizadas a executar **em paralelo** por decisão humana de
  20/08/2026. Duas migrações nascidas do mesmo pai partem a cadeia em dois ramos, e
  `alembic upgrade head` passa a falhar por múltiplas cabeças.
- **impact:** nenhum no escopo das tarefas; é ordem de execução. Nenhum plano perde tarefa ou
  critério de aceite.
- **resolution:** **F-011 T1 escreve a primeira migração**, encadeada em `116f2181bdda`. **F-012 T3
  encadeia na cabeça que T1 deixar** — confirmada por `venv/bin/alembic heads` no início da tarefa,
  não presumida. Se `heads` devolver mais de uma cabeça, a tarefa para e reporta. Registrado nos
  contratos de T1 (F-011) e T3 (F-012).
