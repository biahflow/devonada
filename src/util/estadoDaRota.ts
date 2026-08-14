import type { ResumoDividas } from '../api/types';

/**
 * O estado que o ponto da marca reporta.
 *
 * O ponto de `devo.nada` é o único elemento da identidade que carrega cor, e a
 * cor é a do usuário, não a da empresa: ele conta em que ponto da rota a pessoa
 * está. Ver ADR 0015 e `docs/design-system.md`, seção 1.
 */
export type EstadoDaRota = 'divida' | 'negociando' | 'quitado' | 'neutro';

/**
 * Deriva o estado a partir do resumo. FUNÇÃO PURA de propósito: ela decide a
 * cor da marca no app inteiro, e uma decisão dessas precisa de teste sem
 * precisar de tela.
 *
 * `neutro` NÃO É VITÓRIA, e é por isso que ele existe separado de `quitado`:
 * quem acabou de criar a conta não tem dívida cadastrada, e um ponto verde ali
 * daria os parabéns por uma corrida que a pessoa nem começou. Verde é conquista
 * — só aparece para quem teve dívida e zerou.
 *
 * `negociando` (âmbar) NÃO É PRODUZIDO AQUI, e a ausência é declarada em vez de
 * silenciosa: `SituacaoDivida` é `ativa | quitada | renegociada`, e nenhum
 * desses significa "há um acordo em andamento". O estado entra quando o M12
 * trouxer o registro de resultado de negociação. Inventar o âmbar a partir de
 * `renegociada` seria afirmar um fato que o banco de dados não tem — e a cor
 * viraria mentira justamente no momento em que o usuário mais confia nela.
 */
export function estadoDaRota(resumo: ResumoDividas | undefined): EstadoDaRota {
  if (!resumo || resumo.quantidadeDividas === 0) return 'neutro';
  return resumo.totalDevido > 0 ? 'divida' : 'quitado';
}
