# devo.nada — Roadmap & Backlog v1

> Consolidação da fase de concepção (agosto 2026). Complementa: brand board, telas v1/v2 e design-system.md.

---

## 1. Visão

Buddy financeiro brasileiro, mobile-first, que tira pessoas das dívidas por **ação** (triagem, valor justo, negociação) e não por retrovisor — e depois as guia rumo a metas (reserva, viagem, carro, carreira, aposentadoria). Intervenção comportamental no centro: a jornada precisa ter ganhos visíveis (Respiro), não só sacrifício.

**Público:** brasileiros endividados — CLT, PJ e autônomos (renda variável tratada como cidadã de primeira classe).

---

## 2. Regras de ouro (escritas em pedra)

1. **Nunca ganhar dinheiro oferecendo crédito.** Monetização por assinatura. Vender empréstimo destruiria a confiança de buddy.
2. **LLM não faz conta, não decide valores, não promete resultados.** Motor determinístico calcula; IA entende, traduz, conversa e intervém.
3. **Respiro é linha do plano, não recompensa.** Lazer/autocuidado reservado desde o dia 1; gasto de respiro nunca gera alerta ou culpa.
4. **Vermelho é status, nunca cenário.** (ver design-system.md)
5. **Privacidade como bandeira:** dados financeiros do usuário nunca viram oferta de crédito nem vão para birôs/parceiros. LGPD por design.
6. **Todo número tem "como calculamos".** Trilha de auditoria dos cálculos (fórmula, taxa BC, data) — confiança do usuário e defesa jurídica.
7. **Discrição:** notificações neutras por padrão (a palavra "dívida" nunca aparece em push/tela bloqueada). Vergonha é o sentimento central do público.

**North star:** R$ quitados através do app · usuários que chegaram ao "devo nada".
**Anti-métrica:** tempo de tela. O buddy quer a pessoa vivendo, não no app.

---

## 3. Fase 0 — MVP (dogfood pessoal, arquitetado multi-tenant)

Módulo Fuga de Dívidas completo e usável por uma pessoa real:

- [ ] Cadastro de dívidas + **triagem por criticidade** (nunca por valor)
- [ ] Cadastro de renda por tipo (**CLT / PJ por hora / Autônomo**) — autônomo com renda conservadora (mediana) e compromissos percentuais
- [ ] Gastos fixos + envelope de variáveis → **Capacidade de ataque** (alimenta propostas)
- [ ] **Respiro** básico: fatia reservada (5–8%) + marcos principais (1ª negociação, 1ª quitação, 25/50/75%)
- [ ] Cálculo determinístico de **valor justo** (taxas BC por modalidade)
- [ ] RAG jurídico do **CDC + Lei do Superendividamento (14.181/2021)** + geração de **scripts de negociação** com base legal exibida; triagem reconhece perfil de superendividado (muitos credores) e orienta caminho da repactuação em bloco / mínimo existencial
- [ ] **Script em 3 variantes de canal:** telefone, chat/WhatsApp (mensagens curtas copiáveis) e e-mail formal
- [ ] **Registro de resultado da negociação** (formulário pós-script, qualquer canal) — coleta desde o dia 1; vira o benchmark futuro
- [ ] Notificações discretas
- [ ] Trilha de auditoria ("como calculamos") nos números principais

## 4. Fase 1 — Lançamento público

Reduzir fricção de entrada e fortalecer a negociação:

- [ ] **Onboarding pelo alívio:** primeira pergunta = "qual dívida tira teu sono?"; valor em 3 min antes de cadastro completo
- [ ] **Extração multimodal:** foto de boleto/carta/print de cobrança → dívida cadastrada (onboarding de 90s)
- [ ] **Modo teleprompter** na ligação: fala principal + objeções comuns com respostas prontas
- [ ] **Analisador de propostas:** print da contraproposta → comparação com valor justo + armadilhas (juros embutidos, reaging, seguro empurrado)
- [ ] **Diretório verificado de canais oficiais** por credor (WhatsApp, chat, telefone, plataforma de renegociação), curado a partir dos sites oficiais + registro do BC; deep link `wa.me` abre a conversa com a 1ª mensagem já preenchida. **Não é bot proxy** — quem conversa é o usuário, na conta dele. Inclui data da última verificação e denúncia de número falso pelos usuários
- [ ] **Anti-golpe:** validação de boleto/chave Pix antes de pagar acordo (beneficiário × credor) — endividado é alvo nº 1 de golpe de falsa negociação
- [ ] Open Finance: categorização automática, fixo vs variável, padrão de renda do autônomo
- [ ] **Pílulas contextuais** de educação (30s, disparadas por evento — nunca "curso")
- [ ] Marcos completos + compartilhamento em formato story
- [ ] Tradutor de juridiquês (foto de cláusula → português de gente + red flags)

## 5. Fase 2 — Crescimento e retenção

- [ ] **Benchmarks de desconto por credor** (base coletada desde o MVP) — calibra propostas e vira conteúdo
- [ ] **Calendário brasileiro de negociação:** 13º, restituição IR, feirões/mutirões — buddy orienta timing
- [ ] **Simulador de ligação (roleplay):** buddy interpreta o atendente; usuário treina antes de ligar (texto → depois voz)
- [ ] **Modo SOS cobrança abusiva:** direitos na hora, o que dizer e anotar (CDC — cobrança vexatória)
- [ ] **Simulador "e se":** trocar dívida cara por barata (ex. consignado quita rotativo), vender um bem — só a conta determinística, nunca oferta de crédito
- [ ] **Alinhamento de vencimentos** com datas de recebimento
- [ ] **"Posso?" — decisão de compra em tempo real:** no momento da tentação (shopping, loja), usuário pergunta por atalho/widget/voz "posso comprar X de R$ Y?" → resposta determinística em 3 camadas (cabe no Respiro? → cabe no envelope de variáveis? → impacto na rota em dias). Buddy mostra o trade-off, decisão é do usuário; precisa dizer SIM quando cabe (sim sem culpa constrói o hábito). Quando não cabe: regra das 24h ("te lembro amanhã e a gente vê onde encaixar")
- [ ] **Detecção de risco de desistência** + tom adaptativo do buddy
- [ ] "Onde corto R$ 200?" — cortes concretos ranqueados por dor a partir das transações
- [ ] **Buddy no WhatsApp por áudio** (possível produto de entrada)
- [ ] **Feed de vitórias anônimas** (prova social)
- [ ] **Dossiê da dívida em PDF** (Procon/juizado) quando a negociação falha
- [ ] **Modo blindagem pós-quitação:** Open Finance detecta recaída cedo, buddy intervém — argumento de assinatura vitalícia
- [ ] **Módulo de metas / Rota de Chegada:** reserva de emergência primeiro; viagem, carro, estudo, aposentadoria (motor: valor + prazo → aporte)
- [ ] **Modo casal:** plano e respiro compartilhados — acaba o policiamento mútuo
- [ ] **Widget discreto** de progresso na home screen
- [ ] App leve para celulares de entrada e dados limitados (público C/D)

## 6. Fase 3 — Visão: distribuição e ecossistema

- [ ] **Calculadora web gratuita** "quanto sua dívida realmente vale" — motor de valor justo exposto como lead magnet/SEO
- [ ] **Turmas de quitação** (coortes anônimas com accountability em grupo — modelo Vigilantes do Peso)
- [ ] **B2B2C:** parcerias com igrejas (sinergia direta com OikOS — ministérios de finanças) e RHs (endividamento × produtividade)
- [ ] Acompanhamento de nome limpo / score pós-quitação
- [ ] **Fábrica de conteúdo:** casos reais anonimizados → roteiros pro canal (série "Rumo ao Devo Nada")

---

## 7. Mapa de IA (onde a IA entra — e onde não entra)

**Não entra:** cálculo, decisão de valores, promessa de resultado. Motor determinístico manda.

| Área | Aplicação |
|---|---|
| Entrada | Extração multimodal (boleto/carta/print/contrato); tradutor de juridiquês; categorização Open Finance; reconhecimento do padrão de renda do autônomo |
| Negociação | Geração de scripts (RAG CDC); teleprompter com objeções; roleplay de ligação; analisador de contrapropostas e armadilhas |
| Comportamental | "Posso?" (decisão de compra em tempo real, resposta determinística + framing do buddy); detecção de risco de desistência; tom adaptativo; "onde corto R$ X?"; intervenção de recaída |
| Canal | Buddy no WhatsApp por áudio (STT/TTS) |
| Marketing | Casos anonimizados → roteiros de conteúdo |

---

## 8. Notas de arquitetura

- **Roteamento de modelos:** classificação/categorização/extração simples em modelo barato (Haiku-class); scripts, roleplay e conversas do buddy em modelo forte. Sem isso, custo por usuário inviabiliza freemium.
- **Classificador de crise (requisito, não feature):** app de dívida conversa com gente em desespero; detectar sinais de sofrimento grave e desviar (LangGraph) para protocolo de acolhimento + indicação de ajuda profissional/CVV.
- **Multi-tenant desde o MVP** (decisão já tomada) — dogfood pessoal, arquitetura SaaS.
- **Stack (decidida):** Python 3.11/FastAPI · LangChain+LangGraph · PostgreSQL+pgvector (dados, checkpointer, embeddings CDC) · OpenAI/Anthropic · React Native+Expo+TS · Supabase/Neon + Render/Railway/Fly.io.
- **Coleta desde o dia 1:** resultado de negociações (benchmark futuro é o maior ativo competitivo).

## 9. Riscos, validação e monetização

- **Fronteira jurídica:** disclaimer educacional ("não é aconselhamento jurídico/financeiro"); atenção ao limite com prática de advocacia; trilha de auditoria como defesa; consulta com advogado antes do lançamento público.
- **Audiência antes do app:** canal (YouTube/TikTok/Instagram) começa durante o dogfood — documentar a construção + ensinar negociação; landing em devonada.com.br com lista de espera → validação de demanda + primeiros beta testers.
- **Freemium:** grátis = 1 dívida ativa com triagem + script (o primeiro "uau" é grátis); assinatura = dívidas ilimitadas, buddy ilimitado, "Posso?", analisador de propostas. Âncora de preço: menos que os juros de um mês ("o app se paga na primeira ligação").
- **Métrica de ativação (instrumentada desde o MVP):** % de usuários que registram a primeira negociação com desconto + dias até esse evento. É o "aha" do produto; antecede qualquer métrica de receita.

---

*v1 · agosto 2026*
