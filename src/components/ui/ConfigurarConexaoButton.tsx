import { useRouter } from 'expo-router';
import type { ViewStyle } from 'react-native';
import { Button } from './Button';

interface Props {
  style?: ViewStyle;
}

/**
 * Saída única do 401. A rota da tela de token é conhecida SÓ aqui: antes ela
 * estava escrita à mão no painel e em lugar nenhum mais, e um 401 no chat virava
 * texto vermelho sem ação — a pessoa lia "sua sessão expirou" sem ter onde entrar
 * de novo.
 */
export function ConfigurarConexaoButton({ style }: Props) {
  const router = useRouter();

  return (
    <Button
      label="Configurar conexão"
      onPress={() => router.push('/painel/token')}
      variant="ghost"
      accessibilityHint="Abre a tela para informar o token do servidor"
      style={style}
    />
  );
}
