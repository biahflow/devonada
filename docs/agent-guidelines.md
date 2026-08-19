# Diretrizes compartilhadas para agentes de código

Fonte única de regras compartilhadas por Claude Code, Codex e qualquer outro agente de código
neste repositório. `CLAUDE.md` e `AGENTS.md` devem conter somente instruções específicas das
respectivas ferramentas e apontar para este documento.

---

## Engineering OS e ciclo de trabalho

O contexto global da Engineering OS está em
`/Users/danielcampos/workspace/engineeringOS/`. Ele define princípios, guardrails, Definition of
Done, contratos de agente e o ciclo `roadmap → Feature Contract → plano → tarefas → evidência →
gate humano`. Os documentos deste repositório definem o produto e não duplicam a regra global.
O resultado vigente da adoção está em [engineering-os-adoption.md](engineering-os-adoption.md).

As fontes de trabalho deste projeto são deliberadamente separadas:

- `roadmap.md` é o **roadmap canônico** do produto e do front. Para itens sem FDD, seu estado é a
  fonte canônica de pré-especificação.
- `docs/api-contract.md`, seção 4, é a **fila canônica do backend**. Ela não deve ser copiada
  para o roadmap.
- `docs/features/` guarda os **Feature Contracts** (FDDs). Um item só fica
  `READY_FOR_PLANNING` quando seu contrato é suficiente; o plano de execução e a evidência são
  artefatos distintos, nunca seções improvisadas do roadmap.
- `docs/inventario.md` é uma visão **derivada e datada**. Ela não decide prioridade nem estado;
  em divergência, atualize primeiro a fonte canônica e depois o inventário.

Não há CI versionado neste repositório nem evidência de CI externo. Até uma decisão humana mudar
isso, a política é executar e registrar os gates locais no PR; a ausência de CI não autoriza pular
validação.

M0–M9 preservam os FDDs históricos existentes. Não há obrigação de retropreenchê-los para a
adoção. Para novo trabalho, use o próximo identificador sequencial em `docs/features/`, partindo
do [template de FDD](feature-template.md) e do template global de Feature Contract em
`/Users/danielcampos/workspace/engineeringOS/templates/feature.md`.

---

## Ordem de precedência e leitura

Em caso de conflito, prevalecem, nesta ordem:

1. `docs/guardrails.md` — regras de produto e segurança que nenhuma conveniência de
   implementação supera;
2. `docs/architecture.md` e ADRs aceitos em `docs/adr/`;
3. `docs/api-contract.md` — o contrato com o backend;
4. `docs/domain.md`, `docs/design-system.md`, `docs/engineering-conventions.md`,
   `docs/feature-template.md` e `roadmap.md`;
5. este documento;
6. instruções específicas em `CLAUDE.md` ou `AGENTS.md`.

Antes de alterar uma feature, leia os documentos canônicos relacionados. Se documentação e
implementação divergirem, **não presuma silenciosamente qual está certa**: identifique a
divergência e corrija o artefato desatualizado dentro do escopo da tarefa. Documentação
desatualizada é fonte de alucinação para a IA.

`docs/data-ingestion.md` é **direção, não compromisso**. Ideias de produto podem sair dali, mas
nunca se sobrepõem aos documentos canônicos.

---

## Contexto e estrutura

**devo.nada** é um app Expo / React Native / TypeScript de assistência financeira pessoal,
com foco inicial na vertical de **dívidas**. O cliente é deliberadamente "burro": renderiza chat,
telas e cards; toda a inteligência (cálculo determinístico, LLM, base do CDC) vive no backend
FastAPI em `backend/`.

```
App.tsx / app/               entrada e rotas (expo-router a partir de M0)
src/
  config/env.ts              lê EXPO_PUBLIC_API_BASE_URL
  theme/theme.ts             tokens de design (ver docs/design-system.md)
  util/money.ts              formatação BRL a partir de centavos
  api/                       types.ts · client.ts · chat.ts · debts.ts
  hooks/                     estado de tela e wrappers de query
  components/                ui/ · chat/ · cards/
  screens/                   composição de tela
backend/                     FastAPI — território do dono do repositório
scripts/                     ferramentas de linha de comando em node puro (CommonJS)
docs/                        documentos canônicos
```

**O backend faz parte do repositório** e é desenvolvido por agentes também — ver
`docs/backend.md`. A exigência extra lá: **nenhuma regra financeira é inventada**. Toda regra em
`backend/domain/` cita a fonte no docstring; regra sem fonte devolve `None` e o app exibe
"ainda não calculado".

---

## Princípios inegociáveis

Estes princípios vencem qualquer conveniência de implementação. Toda decisão de código deve
poder ser justificada por um deles. O detalhamento e os modos de falha estão em
`docs/guardrails.md`.

1. **O app não é fonte da verdade sobre dinheiro.** Todo valor derivado — juros, correção,
   amortização, projeção, agregado de painel, resultado de simulação — é calculado no backend.
   O front formata e exibe. Ver ADR 0003.
2. **Dinheiro é centavo inteiro.** Em todo lugar, do input à exibição. Nunca float.
3. **Um único egress de rede.** Toda chamada HTTP passa por `src/api/client.ts`. Isso mantém
   auth, serialização e normalização de erro num lugar só, e garante que o app só conhece a
   própria API.
4. **Nenhum segredo no cliente.** Chave de LLM, credencial de agregador e afins ficam no
   backend. Qualquer coisa com prefixo `EXPO_PUBLIC_` vai embutida no bundle e é pública.
5. **Multi-tenant desde já.** `tenant_id` vem do token; o cliente nunca o envia. Não introduza
   parâmetro de tenant em nenhuma chamada.
6. **Determinístico e LLM são camadas separadas.** Número exibido vem de campo tipado, nunca
   de texto livre gerado por modelo.
7. **Postura anti-ansiedade.** A UI reduz alarme em vez de produzi-lo. Vermelho é exceção.

---

## Convenções de implementação

O detalhamento está em `docs/engineering-conventions.md`. O essencial:

- TypeScript `strict` com `noUncheckedIndexedAccess`. Não use `any` nem `@ts-ignore` para
  fechar uma tarefa; se o tipo do backend mudou, atualize `src/api/types.ts` e
  `docs/api-contract.md` juntos.
- Componente não chama `src/api/` direto. A cadeia é `api/` → `hooks/` → `screens/` →
  `components/`. Componente recebe dado por prop.
- Toda tela que carrega dado remoto trata **quatro** estados: carregando, erro, vazio e
  conteúdo. Não existe tela que só trata o caminho feliz.
- Nomes de arquivo e de tipo em inglês quando são infraestrutura (`client.ts`, `request`), em
  português quando são domínio (`Divida`, `valorCobrado`, `CriticidadeTipo`). Isso já é o padrão
  do repo — mantenha.
- Copy em **pt-BR**, tom acolhedor e direto. Ver `docs/domain.md` para os termos corretos.

---

## Comandos

```bash
npm install
npm start           # Expo dev server (Expo Go ou simulador)
npm run android
npm run ios
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # jest — inclui os testes de tela
npm run bundle:check # expo export: prova que o grafo inteiro compila
npm run palette:check # WCAG 2.1 e CIEDE2000 dos pares declarados de src/theme/theme.ts
npm run digits:check  # largura de dígito lida da tabela hmtx dos TTF das fontes do app
```

### O que cada gate pega — e o que nenhum deles pega

| Gate | Pega |
|---|---|
| `typecheck` | prop renomeada, tipo divergente do contrato, união não exaustiva |
| `lint` | regra de hook violada, `any`, `setState` em efeito |
| `test` | **lógica e comportamento de tela**: ordenação errada, estado não tratado, copy que sumiu |
| `bundle:check` | import quebrado, módulo que não resolve em arquivo que nenhum teste importa |
| `palette:check` | par de cor abaixo do piso de contraste, e token de cor renomeado sem a lista de pares acompanhar |
| `digits:check` | escala de número em coluna apontando para fonte de dígito proporcional sem pedir `tabular-nums` |

As duas primeiras categorias se sobrepõem menos do que parece: renomear prop é `typecheck`;
inverter uma ordem de prioridade passa por ele intacto e só o teste de tela vê.

> **Nenhum gate prova que a tela está legível, bonita ou que cabe no aparelho.** Eles provam que
> ela renderiza, reage, que as cores passam o piso de contraste — que é piso, não legibilidade — e
> que a escala do número em coluna pede o dígito tabular que a fonte é capaz de dar. Layout,
> contraste percebido, comportamento de teclado e safe area em
> aparelho com notch **exigem validação humana em device** — um agente não consegue fazer isso e
> não deve afirmar que fez.

Nem tudo que soa como "validação em aparelho" é. Largura de dígito parecia ser, e não era: está
gravada na tabela `hmtx` do TTF, idêntica em todo aparelho, e ficou meses adiada por ter sido
classificada errado. Antes de anotar algo como pendente de device, pergunte se o dado não está num
arquivo que dá para ler daqui.

Backend (rodado pelo dono do repositório, a partir de `backend/` com o venv ativo):

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Aponte `EXPO_PUBLIC_API_BASE_URL` no `.env` para o IP da máquina na rede local — `localhost`
não resolve de dentro do Expo Go no celular.

---

## Definition of Ready

Uma tarefa só entra em execução quando:

- [ ] O comportamento esperado está escrito (spec em `docs/features/` a partir de
      `docs/feature-template.md`, ou o item do `roadmap.md` é inequívoco).
- [ ] Os endpoints que a tarefa consome estão especificados em `docs/api-contract.md`, com
      request, response e unidade de cada campo.
- [ ] Os estados de erro e de vazio estão definidos, não só o caminho feliz.
- [ ] Os guardrails aplicáveis foram identificados.

## Definition of Done

- [ ] Os seis gates passam: `typecheck`, `lint`, `test`, `bundle:check`, `palette:check` e
      `digits:check`.
- [ ] Nenhuma verificação foi desativada para concluir a tarefa.
- [ ] Tela nova tem teste em `src/test/screens/` cobrindo os quatro estados.
- [ ] O que **não** foi validado em device está dito explicitamente no relato.
- [ ] Os quatro estados de tela estão implementados e verificáveis.
- [ ] Nenhum valor monetário é calculado no cliente.
- [ ] Nenhum dado financeiro ou pessoal aparece em log, analytics ou crash report.
- [ ] Alvo de toque mínimo de 48pt e `accessibilityLabel` em todo controle sem texto visível.
- [ ] O documento canônico afetado foi atualizado no mesmo commit.
- [ ] `.github/pull_request_template.md` preenchido.

---

## Git e coordenação entre agentes

- Um agente por worktree. Não paralelize edições nos mesmos arquivos sem coordenação explícita.
- Mudança desconhecida na árvore de trabalho é trabalho do usuário ou de outro agente:
  preserve, não reverta.
- Commit descreve o efeito no produto, não o mecanismo. `docs/engineering-conventions.md`
  tem o formato.
