import { View } from 'react-native';
import { Tabs } from 'expo-router';
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
      {/*
        ORDEM E RÓTULO SÃO DA MARCA; O NOME DO ARQUIVO É DO DOMÍNIO.
        `painel`, `index` e `caixa` continuam sendo o que sempre foram na rota e
        no código — a linguagem ubíqua de docs/domain.md. Renomear a pasta
        quebraria deep link e teste sem entregar nada a quem usa o app. O que a
        pessoa lê é Rota · Dívidas · Buddy · Caixa.

        NÃO HÁ `tabBarIcon` AQUI: a barra não desenha ícone nenhum. O rótulo
        escrito diz o que a aba é, e o elemento gráfico guarda a única coisa que
        o texto não diz — onde estou e em que fase. Ver src/components/ui/TabBar.

        A Rota vem primeiro porque o produto é "o que eu faço agora", não
        "quanto eu devo": abrir no chat deixava a próxima ação a um toque de
        distância.
      */}
      <Tabs.Screen
        name="painel"
        options={{
          title: 'Rota',
        }}
      />
      {/*
        DÍVIDAS E METAS CONVIVEM, as duas sempre na barra.

        A ADR 0017 previa que a segunda aba TROCASSE de sentido na fase verde:
        "Dívidas" viraria "Metas", com `href: null` escondendo uma de cada vez. A
        troca nunca chegou a acontecer em aparelho — a barra é desenhada por
        `src/components/ui/TabBar.tsx`, que lia `state.routes` na mão e ignorava
        o `href`, então as duas apareciam juntas desde o M12. O defeito foi
        corrigido; a decisão de produto que ele escondia é que mudou de rumo.

        Metas é destino, não prêmio de fim de jogo: quem está pagando dívida
        também guarda para o IPVA de janeiro, e esconder a aba até a quitação
        adiava a única tela que fala do depois. O custo aceito é a quinta aba na
        barra — e é por isso que ela não tem ícone (ver TabBar): cinco rótulos
        curtos cabem onde cinco pictogramas competiriam.
      */}
      <Tabs.Screen
        name="dividas"
        options={{
          title: 'Dívidas',
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: 'Metas',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Buddy',
        }}
      />
      <Tabs.Screen
        name="caixa"
        options={{
          title: 'Caixa',
        }}
      />
    </Tabs>
  );
}
