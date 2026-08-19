# Marca

`brand-board-v1.html` é o **brand board de agosto de 2026**, versionado aqui porque o
`design-system.md` o cita como fonte de regra — logo, paleta, tipografia, tracking, área de
respiro e as regras de "faça / não faça". Referência que vive na pasta de downloads de alguém
envelhece em silêncio; é a mesma lição da ADR 0018, que trouxe o validador de contraste para
dentro do repositório.

**Ele NÃO está na ordem de precedência.** Em qualquer divergência entre o board e
`docs/design-system.md`, manda o design system — ele é o documento vivo, e é onde as decisões que
o código tomou depois do board estão registradas com o motivo. Três divergências conhecidas, todas
explicadas lá:

- O board descreve **três estados do ponto**; o código tem **quatro**. Falta `neutro`, sem o qual
  o ponto nasce verde em conta nova.
- "Números · Archivo Black" vale para o número **protagonista**. Número em coluna é Inter com
  `tabular-nums`, por medição.
- "Papel `#F2F2ED` · fundo claro" é regra de material impresso e social. No app esse hex é cor de
  TEXTO — não há light mode, e o grafite é identidade, não preferência.

Abrir no navegador: `open docs/marca/brand-board-v1.html`.
