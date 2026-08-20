import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { MarcoScreen } from '../../src/components/marco/MarcoScreen';
import { useCaixa, useDestinarRespiro } from '../../src/hooks/useCaixa';
import { useCelebrarMarco, useMarcos } from '../../src/hooks/useMarcos';

const TIPOS: readonly string[] = [
  'primeira_negociacao',
  'primeira_quitacao',
  'rota_25',
  'rota_50',
  'rota_75',
];

/**
 * O container da celebração: lê o marco da rota, o saldo do caixa e decide o
 * que a `MarcoScreen` mostra.
 *
 * QUATRO ESTADOS, e três deles saem da tela em vez de exibir alguma coisa:
 *
 * - carregando — enquanto marcos e caixa não chegam;
 * - sem tela — tipo inválido na rota, marco não atingido, marco já celebrado,
 *   ou falha de leitura. Em todos, a saída é voltar para a rota do usuário SEM
 *   ESCREVER NADA: `celebradoEm` continua nulo e a conquista volta na próxima
 *   abertura do app, que é exatamente o que o contrato desenhou para o marco
 *   que não pôde ser exibido (docs/api-contract.md, seção 3.13). Uma tela de
 *   erro aqui não teria saída — não há `PageHeader` numa tela terminal —, e
 *   prender alguém numa celebração quebrada é pior que adiá-la;
 * - conteúdo — nos três casos de `respiroSaldoAcumulado`, tratados na
 *   `MarcoScreen`.
 *
 * ABRIR A TELA NÃO CELEBRA. `celebradoEm` só é gravado por toque em um dos dois
 * botões (T7-AC5): uma celebração gravada na montagem se perderia junto com a
 * tela que o usuário nunca chegou a ver.
 */
export default function MarcoRota() {
  const router = useRouter();
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const { marcos, isPending: marcosPendentes, error: erroMarcos } = useMarcos();
  const { caixa, isPending: caixaPendente, error: erroCaixa } = useCaixa();
  const celebracao = useCelebrarMarco();
  const destinar = useDestinarRespiro();

  const valido = TIPOS.includes(tipo ?? '');
  const marco = valido ? marcos.find((m) => m.tipo === tipo) : undefined;
  const carregando = marcosPendentes || caixaPendente;
  // Atingido e ainda não celebrado é a ÚNICA combinação que abre a tela.
  const celebravel = marco?.atingidoEm != null && marco.celebradoEm === null;
  const semTela = !carregando && (!!erroMarcos || !!erroCaixa || !celebravel);

  useEffect(() => {
    if (semTela) router.replace('/painel');
  }, [semTela, router]);

  if (carregando) {
    return (
      <Screen>
        <LoadingState label="Buscando sua conquista" />
      </Screen>
    );
  }

  if (semTela || !celebravel || !marco) return null;

  const tipoDoMarco = marco.tipo;
  const saldo = caixa?.respiroSaldoAcumulado ?? null;

  /**
   * NENHUMA DAS DUAS ESCRITAS PRENDE O USUÁRIO NA TELA.
   *
   * `mutate` (e não `mutateAsync`) é a escolha técnica: ele não lança, o erro
   * fica no estado da mutação, e a navegação acontece na mesma passagem — sem
   * `await`, sem spinner e sem caminho em que a rede decida se a pessoa
   * consegue sair. Se a celebração falhar, inclusive com o `402` do período
   * somente leitura, `celebradoEm` continua nulo e a tela volta quando a
   * assinatura voltar: é o comportamento que o contrato pede, não um erro a
   * exibir aqui.
   */
  function sair() {
    router.replace('/painel');
  }

  function aproveitar() {
    // O saldo CONTINUA ACUMULADO — o marco libera, não gasta. Quem decide onde
    // usar é o usuário, pelo registro de uso na aba de caixa.
    celebracao.celebrar(tipoDoMarco);
    sair();
  }

  function guardarProProximoMarco() {
    // GUARDAR É DESTINAR, e não deixar parado: o acumulado vira aporte extra na
    // dívida, o que encurta a rota e aproxima o PRÓXIMO marco
    // (`rotaPercorridaBps` cruzando o limiar seguinte). Sem saldo — `null` de
    // quem nunca declarou, ou `0` de quem ainda não acumulou — não há o que
    // destinar, e a tela só celebra e sai (ADR 0019, item 5: destinar é botão,
    // nunca automático).
    if (saldo !== null && saldo > 0) destinar.mutate(saldo);
    celebracao.celebrar(tipoDoMarco);
    sair();
  }

  return (
    <MarcoScreen
      tipo={tipoDoMarco}
      respiroSaldoAcumulado={saldo}
      onAproveitar={aproveitar}
      onGuardarProProximoMarco={guardarProProximoMarco}
    />
  );
}
