import { render } from '@testing-library/react-native';
import { ScriptCard } from '../../components/cards/ScriptCard';
import type { BlocoScript, Canal, ScriptNegociacao } from '../../api/types';

/**
 * A VARREDURA DE COPY do script de negociação, nas TRÊS variantes de canal (M12).
 *
 * Gêmeo do teste que quebra em "recomendada" (M4), "ilegal" (M6) e do sweep do
 * respiro (M11). Aqui o que ele protege é o mais sensível do produto: o texto que
 * o usuário LEVA A UM CREDOR REAL. Uma afirmação de ilegalidade ou de direito num
 * script é o modo de falha que o roadmap marca como capaz de encerrar o produto.
 *
 * O CONJUNTO DE TERMOS é o MESMO do backend (`test_revisao.py::TestCopy`), alinhado
 * em T6 (PF-4). As duas técnicas de varredura são complementares e ficam: o
 * backend varre campo a campo do `Achado` e os blocos de `montar_script`; o front
 * varre a ÁRVORE RENDERIZADA inteira via `JSON.stringify` — onde a copy proibida
 * pode se esconder num `accessibilityLabel` ou num rótulo que ninguém revisa.
 */
const PROIBIDO =
  /ilegal|abusiv|nul[ao]\b|é seu direito|você tem direito|com certeza|garantid[ao]/i;

const CANAIS: readonly Canal[] = ['telefone', 'chat', 'email'];

function blocosLimpos(canal: Canal): BlocoScript[] {
  const escrito = canal !== 'telefone';
  const blocos: BlocoScript[] = [];
  if (escrito) {
    blocos.push({
      id: 'alerta-validacao',
      titulo: 'Antes de negociar',
      texto: 'Confira o número do credor no site oficial dele antes de continuar.',
      momento: 'abertura',
      copiavel: true,
    });
  }
  blocos.push({
    id: 'saudacao',
    titulo: null,
    texto: 'Olá, sou cliente e gostaria de revisar meu contrato.',
    momento: 'abertura',
    copiavel: escrito,
  });
  blocos.push({
    id: 'argumento-multa',
    titulo: 'Multa de atraso acima do limite',
    texto: 'Vale contestar a diferença (Código de Defesa do Consumidor, art. 52, §1º).',
    momento: 'argumento',
    copiavel: escrito,
  });
  if (escrito) {
    blocos.push({
      id: 'regra-pagamento',
      titulo: 'Como pagar',
      texto: 'Pagamento só por boleto ou Pix em nome do credor — confira o CNPJ.',
      momento: 'fechamento',
      copiavel: true,
    });
  }
  return blocos;
}

function renderScript(script: ScriptNegociacao) {
  return render(<ScriptCard script={script} onSelectCanal={() => {}} />);
}

describe('copy do script de negociação — as três variantes de canal', () => {
  it.each(CANAIS)('não afirma ilegalidade nem direito no canal %s', (canal) => {
    const { toJSON } = renderScript({ canal, blocos: blocosLimpos(canal) });
    expect(JSON.stringify(toJSON())).not.toMatch(PROIBIDO);
  });

  // PROVA POR INJEÇÃO: um termo proibido plantado em cada variante FAZ a
  // varredura falhar — é o que garante que o teste acima não passa por não
  // enxergar. Sem esta metade, um sweep quebrado passaria despercebido.
  it.each(CANAIS)('a varredura pega um termo proibido plantado no canal %s', (canal) => {
    const blocos = blocosLimpos(canal);
    blocos[blocos.length - 1] = {
      ...blocos[blocos.length - 1]!,
      texto: 'Essa cobrança é ilegal e é seu direito receber de volta.',
    };
    const { toJSON } = renderScript({ canal, blocos });
    expect(JSON.stringify(toJSON())).toMatch(PROIBIDO);
  });
});
