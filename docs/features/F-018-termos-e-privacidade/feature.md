# FDD — Termos de Uso e Política de Privacidade

## Cabeçalho

| | |
|---|---|
| Feature | As duas páginas legais existem, são servidas, e a tela de entrada leva a elas |
| Slug | F-018-termos-e-privacidade |
| Milestone | M13, e item de **pré-lançamento** — as duas lojas pedem |
| Issue | #10 |
| Telas | `app/(auth)/login.tsx` (a linha legal vira link) |
| Endpoints | `GET /termos`, `GET /privacidade`, `GET /publico.css` (novos) |
| Depende de | ADR 0005 (descarte do arquivo), guardrails 3, 5 e 9.1 |
| Decide | nenhuma ADR nova — a feature aplica decisões que já existem |

## Objetivo e não objetivos

A linha "Ao continuar você aceita os Termos e a Política de Privacidade" era texto sem link, com
comentário no código explicando o porquê: as páginas não existiam. As duas lojas as exigem como
URL que o revisor abre no navegador, e a Apple e o Google pedem ainda os formulários *App Privacy*
e *Data safety*, que bebem da mesma fonte.

**Não objetivos:**

- **Não** hospedar em `devonada.com.br` nem mexer em DNS. Infraestrutura é declarada em código e
  aplicada por humano; e o domínio é do dono do repositório.
- **Não** publicar texto jurídico como final. As duas páginas nascem com faixa de **minuta**, que
  sai por decisão humana depois da revisão por advogado.
- **Não** preencher os formulários das lojas. O que a feature entrega é o **guia**: cada dado
  mapeado para a categoria exata, com a resposta sugerida e de onde ela sai no código.
- **Não** criar site estático separado. As páginas seguem o padrão que a `/exclusao` já usa desde
  o M8, e migram junto com ela quando houver domínio.

## Jornada e interface

### As páginas

`GET /termos` e `GET /privacidade`, HTML estático em `backend/web/`, fora de `/v1/`, **sem
autenticação** e fora do OpenAPI. As três páginas passaram a compartilhar `GET /publico.css`.

### A tela de entrada

A frase legal continua legível inteira; **Termos** e **Política de Privacidade** viram link quando
`EXPO_PUBLIC_URL_TERMOS` e `EXPO_PUBLIC_URL_PRIVACIDADE` estão preenchidas. **Vazias, a frase volta
a ser texto** — link quebrado numa linha legal é pior que a frase sozinha, e um `404` de política
na frente do revisor da loja é reprovação.

### Os quatro estados

Não se aplicam no sentido usual: as páginas são estáticas e a linha legal não carrega dado remoto.
O estado que importa é o **binário de configuração** — com URL, link; sem URL, texto —, e ele tem
teste dos dois lados.

## Regras

1. **O conteúdo é derivado do código.** Cada afirmação corresponde a uma coluna de `orm.py`, a uma
   rota ou a um guardrail com teste. O levantamento vive em `docs/legal/inventario-de-dados.md` e
   muda **junto** com a política.
2. **A faixa de minuta permanece até a revisão jurídica**, e há teste que confirma.
3. **A política diz que o documento vai para um provedor de IA**, com o caminho de saída para quem
   preferir não correr esse risco. Era item separado do roadmap.
4. **As páginas não afirmam ilegalidade** — o mesmo guardrail 3 do produto, agora na web.
5. **Ver e apagar o próprio dado nunca é recurso pago**, e a política diz isso.
6. **Todo link interno aponta para página que existe** — teste derivado, que varre os `href`.
7. **As páginas ficam fora do OpenAPI.** Elas não são contrato.

## Critérios de aceite

- [x] `/termos`, `/privacidade`, `/exclusao` e `/publico.css` respondem **sem sessão**.
- [x] As três páginas usam a folha compartilhada e se apontam entre si.
- [x] Todo `href` interno leva a rota que responde `200`.
- [x] Termos e Política carregam a faixa de minuta; a `/exclusao`, não.
- [x] A política declara: envio ao provedor de IA, descarte do arquivo, ausência de telemetria e
      de localização, e que acesso e exclusão não dependem de assinatura.
- [x] Os termos negam as quatro coisas que o produto não é.
- [x] Nenhuma página afirma ilegalidade, e nenhuma cita a marca anterior.
- [x] A linha legal vira link com URL configurada, e volta a texto sem ela.
- [x] O guia de preenchimento dos dois formulários existe e sai do código.
- [ ] **Revisão por advogado.** Humano.
- [ ] **Hospedar em `devonada.com.br` e apontar o DNS.** Humano.
- [ ] **A caixa `contato@devonada.com.br` existir e ser lida** — as três páginas prometem resposta
      em até 30 dias. Humano.
- [ ] **Validação em aparelho** do toque no link. Humano.

## Riscos e limitações aceitas

- **O texto é minuta, e minuta publicada como final é o pior resultado possível desta feature.**
  Daí a faixa visível, o comentário HTML dizendo exatamente o que apagar, e o teste.
- **O controlador ainda não tem CNPJ nomeado.** A política identifica "o devo.nada" e o e-mail de
  contato; nomear a pessoa jurídica depende da publicação sob CNPJ, que é item separado do roadmap.
- **`renegociacao.observacao` e `resultado_negociacao.observacao` são texto livre**, e a pessoa
  pode escrever ali dado de terceiro. Nada no produto a induz a isso e nada valida o conteúdo — o
  fato está declarado no inventário, para o advogado decidir se a política precisa dizer algo.
- **O guia dos formulários é uma leitura do código, não uma decisão jurídica.** Quem responde no
  console assume a declaração.
