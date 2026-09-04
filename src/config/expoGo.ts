import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Estamos rodando dentro do binário do Expo Go?
 *
 * O Expo Go é um binário PRONTO, publicado nas lojas, com um conjunto FIXO de
 * módulos nativos. O que não está nele não existe em tempo de execução — e
 * nenhuma configuração deste app muda isso. `@react-native-google-signin` e o
 * SDK de compra da loja exigem módulo nativo que o Expo Go não tem; o único
 * jeito de usá-los é *development build* (`eas build --profile development`).
 *
 * Este helper é o único lugar do app que faz essa pergunta. `src/social/` e
 * `src/compras/` o consultam para recusar cedo, em vez de deixar o SDK
 * estourar uma exceção síncrona no meio do boot.
 */
export function rodandoNoExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
