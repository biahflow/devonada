import { View } from 'react-native';
import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { TabBar } from '../../src/components/ui/TabBar';
import { AvisoSomenteLeitura } from '../../src/components/ui/AvisoSomenteLeitura';

export default function TabsLayout() {
  return (
    <Tabs
      // A barra padrão só troca a cor do ícone — em aparelho ela lê como rodapé
      // estático. A nossa desliza uma pílula entre as abas, respeitando
      // `isReduceMotionEnabled`. Ver src/components/ui/TabBar.tsx.
      //
      // O AVISO DE SOMENTE LEITURA (M9) VAI AQUI, e não no topo de cada tela,
      // por dois motivos. Um: aqui ele aparece nas quatro abas de uma vez, em
      // vez de ser esquecido na quinta tela que alguém escrever. Dois: no topo
      // ele brigaria com a safe area que cada `Screen` já aplica, e no rodapé o
      // `TabBar` resolve o inset de baixo sozinho.
      tabBar={(props) => (
        <View>
          <AvisoSomenteLeitura />
          <TabBar {...props} />
        </View>
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="dividas"
        options={{
          title: 'Dívidas',
          tabBarIcon: ({ color, size }) => <Feather name="file-text" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="caixa"
        options={{
          title: 'Caixa',
          tabBarIcon: ({ color, size }) => <Feather name="inbox" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="painel"
        options={{
          title: 'Painel',
          tabBarIcon: ({ color, size }) => <Feather name="pie-chart" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
