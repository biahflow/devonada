import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { TabBar } from '../../src/components/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      // A barra padrão só troca a cor do ícone — em aparelho ela lê como rodapé
      // estático. A nossa desliza uma pílula entre as abas, respeitando
      // `isReduceMotionEnabled`. Ver src/components/ui/TabBar.tsx.
      tabBar={(props) => <TabBar {...props} />}
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
