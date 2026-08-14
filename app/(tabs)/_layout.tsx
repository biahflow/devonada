import { View } from 'react-native';
import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { TabBar } from '../../src/components/ui/TabBar';
import { AvisoSomenteLeitura } from '../../src/components/ui/AvisoSomenteLeitura';
import { useEstadoDaRota } from '../../src/hooks/useEstadoDaRota';

export default function TabsLayout() {
  // A MESMA LEITURA QUE A BARRA JÁ FAZ para escolher entre vermelho e verde
  // (src/components/ui/TabBar.tsx). Sai do cache do resumo, sem requisição nova
  // (ADR 0002) — por isso dá para consultá-la aqui, no layout, sem custo.
  const faseVerde = useEstadoDaRota() === 'quitado';

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
      {/*
        ORDEM E RÓTULO SÃO DA MARCA; O NOME DO ARQUIVO É DO DOMÍNIO.
        `painel`, `index` e `caixa` continuam sendo o que sempre foram na rota e
        no código — a linguagem ubíqua de docs/domain.md. Renomear a pasta
        quebraria deep link e teste sem entregar nada a quem usa o app. O que a
        pessoa lê é Rota · Dívidas · Buddy · Extrato.

        A Rota vem primeiro porque o produto é "o que eu faço agora", não
        "quanto eu devo": abrir no chat deixava a próxima ação a um toque de
        distância.
      */}
      <Tabs.Screen
        name="painel"
        options={{
          title: 'Rota',
          tabBarIcon: ({ color, size }) => <Feather name="map" color={color} size={size} />,
        }}
      />
      {/*
        A SEGUNDA ABA TROCA DE SENTIDO QUANDO A PESSOA ZERA. É a tela 09 da
        concepção: pós-quitação, "Dívidas" vira "Metas" — mesma mecânica, a barra
        crescendo em vez de encolhendo. Quem saiu da dívida não deveria abrir o
        app numa lista vazia do que já resolveu.

        `href: null` TIRA DA BARRA SEM TIRAR DA ROTA, e essa distinção é o que
        impede um beco sem saída: `/dividas` continua alcançável por `push` e por
        deep link na fase verde, e a tela de Metas oferece o caminho
        explicitamente. Esconder a rota faria quem quitou tudo e contraiu uma
        dívida nova não ter como cadastrá-la. Ver ADR 0017.
      */}
      <Tabs.Screen
        name="dividas"
        options={{
          title: 'Dívidas',
          tabBarIcon: ({ color, size }) => <Feather name="file-text" color={color} size={size} />,
          href: faseVerde ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: 'Metas',
          tabBarIcon: ({ color, size }) => <Feather name="target" color={color} size={size} />,
          href: faseVerde ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Buddy',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="caixa"
        options={{
          title: 'Extrato',
          tabBarIcon: ({ color, size }) => <Feather name="inbox" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
