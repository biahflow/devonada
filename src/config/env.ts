// 8001, não 8000: a 8000 já é do stack do biahflow-portal-cliente. Ver
// backend/docker-compose.yml. Isto é só o fallback de quem esqueceu o `.env` —
// com a variável preenchida ele nunca é lido, e apontar para a porta errada
// fazia o erro parecer de rede em vez de configuração.
const DEV_DEFAULT = 'http://localhost:8001';

/**
 * Config do cliente. O app é um cliente "burro": só fala com a SUA API.
 * NUNCA adicione chave de LLM aqui — cálculo determinístico, chamadas de
 * modelo e a base do CDC ficam todos no backend.
 */
export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEV_DEFAULT,

  /**
   * Id do produto de assinatura em cada loja (M9).
   *
   * `EXPO_PUBLIC_` é PÚBLICO — vai embutido no bundle. Aqui isso não é
   * problema, e é a única forma que funciona: o SDK precisa do id antes de
   * qualquer chamada ao nosso servidor, e um id de produto não é segredo em
   * lugar nenhum. Ele está impresso na página da assinatura na App Store.
   *
   * O PREÇO NÃO ESTÁ AQUI e não deve estar. Ele vem da loja em tempo de
   * execução, já localizado — ver `src/compras/`.
   */
  produtoAssinaturaIos: process.env.EXPO_PUBLIC_PRODUTO_ASSINATURA_IOS ?? '',
  produtoAssinaturaAndroid: process.env.EXPO_PUBLIC_PRODUTO_ASSINATURA_ANDROID ?? '',
};
