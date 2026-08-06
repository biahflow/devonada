# ADR 0005 — O arquivo do contrato é descartado após a extração

**Status:** aceito
**Data:** 2026-08-06

## Contexto

A ingestão de contrato (M1.5) pede ao usuário o PDF ou a foto do contrato de empréstimo,
consignado ou financiamento. É o que remove o maior atrito do cadastro — quase ninguém sabe a
própria taxa de juros de cabeça, mas o contrato sabe.

O problema é o que vem junto. Um contrato de consignado carrega CPF, RG, matrícula funcional,
número de conta, endereço e assinatura. É o documento mais sensível que este produto vai tocar,
e ele chega inteiro, sem possibilidade de minimização na origem.

Guardar o arquivo tem apelo real: permite reconsultar, reprocessar quando a extração melhorar e
provar a procedência de um número numa negociação. Guardar também cria obrigação de cifra em
repouso, política de retenção, exclusão sob demanda e resposta a incidente — para um produto que
ainda não tem autenticação implementada.

## Decisão

O arquivo bruto é **descartado após a extração**. O que persiste é:

- os campos estruturados extraídos;
- os **trechos curtos** citados como evidência de cada campo;
- os alertas de cláusula, com seus trechos.

A UI informa isso ao usuário **antes** do upload, não em política escondida. Transparência aqui
é parte do consentimento, não cortesia.

## Consequências

+ A superfície de LGPD encolhe drasticamente. O que não se guarda não vaza, não precisa ser
  cifrado em repouso e não aparece numa auditoria.
+ Não há política de retenção a escrever, nem fluxo de exclusão sob demanda para o arquivo — só
  para os dados estruturados, que já seguem o ciclo de vida da dívida.
+ A evidência sobrevive onde importa: o trecho citado é o que sustenta o número numa conversa com
  o credor. O PDF inteiro raramente é necessário para isso.
+ O guardrail 1 fica visível na interface: cada campo mostra o trecho que o comprova, e campo sem
  trecho não é preenchido.
− Reprocessar exige pedir o arquivo de novo. Se a extração melhorar, contratos antigos não são
  reaproveitados automaticamente.
− O usuário não consegue reabrir o contrato pelo app. Ele continua tendo o original no próprio
  aparelho ou com o banco — não somos o arquivo dele, e não queremos ser.
− Erro de extração não pode ser auditado a posteriori sobre o documento original. Mitigação:
  guardar os trechos permite verificar se o modelo leu certo o que citou.

Se um dia houver necessidade real de retenção, ela vem com cifra em repouso, prazo declarado e
exclusão sob demanda — e substitui esta ADR, não a contorna.
