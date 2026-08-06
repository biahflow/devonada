const DEV_DEFAULT = 'http://localhost:8000';

/**
 * Config do cliente. O app é um cliente "burro": só fala com a SUA API.
 * NUNCA adicione chave de LLM aqui — cálculo determinístico, chamadas de
 * modelo e a base do CDC ficam todos no backend.
 */
export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEV_DEFAULT,
};
