# ADR 0007 — Camada de provedor de LLM, e OpenAI como padrão

**Status:** aceito
**Data:** 2026-08-06
**Substitui parcialmente:** ADR 0006, na parte do extrator plugável

## Contexto

O ADR 0006 colocou a extração de contrato atrás de um `Protocol`, com uma implementação
Anthropic. A abstração estava na **capacidade** ("como extrair um contrato"), e cada
implementação carregava o SDK de um provedor junto com as regras de produto.

Duas coisas expuseram o limite disso ao mesmo tempo:

1. O M5 acrescenta uma segunda capacidade que usa modelo — o assistente do chat.
2. Apareceu uma chave da OpenAI; a da Anthropic segue vazia, e a leitura de contrato estava
   bloqueada desde o M1.5 por causa disso.

Seguir o desenho anterior produziria `anthropic_extrator.py` + `openai_extrator.py` +
`anthropic_assistente.py` + `openai_assistente.py`: **duas capacidades × N provedores**, com o
prompt, o schema e os guardrails copiados em cada arquivo. Regra duplicada diverge no primeiro
ajuste — e aqui a regra duplicada seria "todo campo carrega o trecho literal que o comprova",
que é um guardrail, não um detalhe.

## Decisão

**Abstrair o provedor, não a capacidade.** `backend/llm/` é o único lugar do backend que conhece
um SDK de modelo.

A interface tem **um método**, `responder_json`, que recebe um system prompt, blocos de conteúdo
neutros (`BlocoTexto`, `BlocoImagem`, `BlocoDocumento`) e um **JSON schema estrito**, e devolve
`dict`. Não existe "me dê texto livre": as duas capacidades do produto precisam de saída
estruturada, e uma porta de texto livre seria o caminho mais curto para um número sem
procedência chegar à tela.

Fora da interface, de propósito: `thinking`, `effort`, `temperature`. São dialeto de provedor e
vivem dentro de cada adaptador.

**Todo erro de SDK vira `ErroDeLLM`** dentro do adaptador, com frase em pt-BR para leigo. Nenhum
`anthropic.APIStatusError` ou `openai.APIConnectionError` atravessa essa fronteira.

**OpenAI como padrão**, com Anthropic vivo no repositório. **Modelo por capacidade**
(`BUDDY_LLM_MODEL_EXTRACAO`, `BUDDY_LLM_MODEL_ASSISTENTE`): ler contrato exige visão, PDF e
evidência literal por campo; classificar a intenção de uma frase, não. Um modelo só forçaria
pagar o mais caro nas duas ou arriscar o mais fraco na leitura de contrato.

## Consequências

+ Duas capacidades **mais** N provedores, em vez de duas vezes N. Um provedor novo é um arquivo
  em `llm/`, e nenhuma regra de produto se move.
+ O prompt e o schema de cada capacidade passam a existir **uma vez** (`extracao/regras.py`,
  `assistente/regras.py`), valendo para qualquer provedor.
+ A leitura de contrato saiu do bloqueio: exercitada de ponta a ponta com um contrato sintético,
  com trecho literal em todos os sete campos.
+ Manter o adaptador Anthropic sem chave configurada é o que prova que a fronteira é real, e não
  uma interface desenhada em volta de um provedor só.
− `extracao/anthropic_extrator.py` foi removido. Código que funcionava foi reescrito; o
  comportamento está coberto por teste, mas a reescrita é custo real.
− Dois SDKs no `requirements.txt` para usar um. Mitigado com import preguiçoso: quem não usa LLM
  não carrega nenhum dos dois.
− A interface é estreita por decisão. Um caso que precise de streaming ou de tool use não cabe
  nela sem alargá-la — e esse alargamento deve ser uma decisão consciente, não um `**kwargs`.

## Nota de implementação — a chave nunca chegava ao SDK

`pydantic-settings` carrega o `.env` para dentro do objeto de settings; os SDKs leem
`os.environ`. As duas coisas não se encontravam, então **a chave escrita em `backend/.env` nunca
era usada**: o servidor respondia "não configurado" com a chave preenchida na frente do
desenvolvedor. O bug existia desde o ADR 0006 e só apareceu quando houve uma chave para usar.

As chaves agora passam por `Settings` (com `validation_alias`, porque não levam o prefixo
`BUDDY_`) e são entregues ao adaptador pela fábrica. E `tests/conftest.py` zera as duas: sem
isso, uma chave real na máquina de quem roda transforma a suíte em chamada paga — o teste de
"sem chave configurada" chegou a passar **pelo motivo errado**, porque a API real respondia com
erro.
