import type { CampoExtraido, ExtracaoContrato } from '../api/contratos';
import type { NovaDivida, PatchDivida } from '../api/debts';
import type { CriticidadeTipo, Divida } from '../api/types';
import { isoParaBR } from './date';
import { camposDaDivida } from './extracao';
import { formatBRL } from './money';
import { formatBasisPoints } from './percent';

/**
 * Conciliação campo a campo entre o que o DOCUMENTO diz e o que a PESSOA
 * digitou, para uma dívida que já existe (F-019, ADR 0025).
 *
 * Três regras sustentam este módulo:
 *
 * 1. **O digitado vence por padrão.** Divergência nasce DESMARCADA: um valor que
 *    o usuário já confirmou uma vez não é sobrescrito por leitura de modelo sem
 *    um toque dele (ADR 0025, decisão 3). Campo que a dívida não tem nasce
 *    marcado — ali não há afirmação anterior a apagar.
 * 2. **Nada aqui calcula.** Compara e formata, nunca soma nem deriva. Comparar
 *    dois inteiros para dizer "confere" é comparação; qualquer diferença exibida
 *    seria número sem procedência (guardrails 1.2 e 1.3).
 * 3. **O descarte do guardrail 8.1 já aconteceu.** A `proposta` vem de
 *    `extracaoParaProposta`, que joga fora todo campo sem `trecho` citável. Este
 *    módulo confia nesse descarte e não o contorna — o que não está na proposta
 *    não vira linha.
 */

/**
 * Os campos que participam da conciliação: só os que `Divida` tem coluna para e
 * o PATCH aceita.
 *
 * Os ENCARGOS do contrato (tarifa de cadastro, seguro prestamista, IOF, multa,
 * CET, modalidade) ficam de fora de propósito: não têm coluna em `Divida`.
 * Eles viajam com o vínculo e aparecem na revisão de cobrança como achado, que é
 * onde eles valem alguma coisa.
 */
export type CampoConciliavel =
  | 'credor'
  | 'valorCobrado'
  | 'dataOrigem'
  | 'tipo'
  | 'taxaJurosMensal';

export type SituacaoConciliacao =
  /** documento e dívida dizem o mesmo — nada a decidir */
  | 'confere'
  /** documento e dívida discordam — o digitado vence, então nasce desmarcada */
  | 'diverge'
  /** a dívida não tem o campo — nasce marcada, não há o que sobrescrever */
  | 'preenche';

export interface LinhaConciliacao {
  campo: CampoConciliavel;
  rotulo: string;
  situacao: SituacaoConciliacao;
  /**
   * O que vai para o corpo da requisição SE a linha for marcada — este campo e
   * nada mais. `extracaoId` nunca entra aqui: ele é o campo de topo do corpo, e
   * não um campo de dívida (`extracaoParaProposta` o carrega na proposta, e é
   * justamente por isso que este módulo monta o patch campo a campo).
   */
  patch: PatchDivida;
  /** O valor lido do documento, já formatado para a tela. */
  documentoFormatado: string;
  /** O valor que a pessoa informou, já formatado. Ausente em `preenche`. */
  atualFormatado?: string;
  /**
   * O campo extraído de origem — é dele que sai o TRECHO à vista. Texto puro,
   * sempre (guardrail 8.2).
   */
  extraido?: CampoExtraido<unknown>;
  marcadaPorPadrao: boolean;
}

/**
 * Rótulos de criticidade, os mesmos que o `CriticidadeBadge` exibe — vocabulário
 * de `docs/domain.md`, seção 2. Ficam repetidos aqui porque este módulo é puro:
 * ele formata para a tela sem importar componente nenhum.
 */
const ROTULO_TIPO: Record<CriticidadeTipo, string> = {
  essencial: 'Essencial',
  com_garantia: 'Com garantia',
  juros_abusivos: 'Juros altos',
  consumo: 'Consumo',
};

export function linhasDeConciliacao(
  proposta: Partial<NovaDivida>,
  divida: Divida,
  extracao: ExtracaoContrato,
): LinhaConciliacao[] {
  const linhas: LinhaConciliacao[] = [];
  // Uma leitura só do mapa campo→trecho (docs/inventario.md, limitação 23). A
  // FONTE do mapa é `camposDaDivida`, em `extracao.ts` — a mesma que
  // `extracaoParaProposta` usa para montar `proposta`. Indexar aqui em vez de
  // chamar de novo por campo evita recalcular o mesmo `switch` cinco vezes.
  const origem = camposDaDivida(extracao);

  if (proposta.credor !== undefined) {
    linhas.push(
      comparar({
        campo: 'credor',
        rotulo: 'Credor',
        doDocumento: proposta.credor,
        daDivida: divida.credor,
        formatar: (valor) => valor,
        patch: { credor: proposta.credor },
        extraido: origem.credor,
      }),
    );
  }

  if (proposta.valorCobrado !== undefined) {
    linhas.push(
      comparar({
        campo: 'valorCobrado',
        rotulo: 'Valor cobrado',
        doDocumento: proposta.valorCobrado,
        daDivida: divida.valorCobrado,
        formatar: formatBRL,
        patch: { valorCobrado: proposta.valorCobrado },
        extraido: origem.valorCobrado,
      }),
    );
  }

  if (proposta.dataOrigem !== undefined) {
    linhas.push(
      comparar({
        campo: 'dataOrigem',
        rotulo: 'Data de origem',
        doDocumento: proposta.dataOrigem,
        daDivida: divida.dataOrigem,
        formatar: isoParaBR,
        patch: { dataOrigem: proposta.dataOrigem },
        extraido: origem.dataOrigem,
      }),
    );
  }

  if (proposta.tipo !== undefined) {
    linhas.push(
      comparar({
        campo: 'tipo',
        rotulo: 'Classificação',
        doDocumento: proposta.tipo,
        daDivida: divida.tipo,
        formatar: (valor) => ROTULO_TIPO[valor],
        patch: { tipo: proposta.tipo },
        extraido: origem.tipo,
      }),
    );
  }

  if (proposta.taxaJurosMensal !== undefined) {
    linhas.push(
      comparar({
        campo: 'taxaJurosMensal',
        rotulo: 'Juros ao mês',
        doDocumento: proposta.taxaJurosMensal,
        daDivida: divida.taxaJurosMensal,
        formatar: formatBasisPoints,
        patch: { taxaJurosMensal: proposta.taxaJurosMensal },
        extraido: origem.taxaJurosMensal,
      }),
    );
  }

  return linhas;
}

/** Os campos da conciliação que a pessoa aceitou, prontos para o corpo do POST. */
export function camposMarcados(
  linhas: readonly LinhaConciliacao[],
  marcada: (linha: LinhaConciliacao) => boolean,
): PatchDivida {
  return linhas
    .filter((linha) => linha.situacao !== 'confere' && marcada(linha))
    .reduce<PatchDivida>((acc, linha) => ({ ...acc, ...linha.patch }), {});
}

interface Comparacao<T extends string | number> {
  campo: CampoConciliavel;
  rotulo: string;
  doDocumento: T;
  daDivida: T | null | undefined;
  formatar: (valor: T) => string;
  patch: PatchDivida;
  extraido?: CampoExtraido<unknown>;
}

function comparar<T extends string | number>({
  campo,
  rotulo,
  doDocumento,
  daDivida,
  formatar,
  patch,
  extraido,
}: Comparacao<T>): LinhaConciliacao {
  if (daDivida === null || daDivida === undefined) {
    return {
      campo,
      rotulo,
      situacao: 'preenche',
      patch,
      documentoFormatado: formatar(doDocumento),
      extraido,
      marcadaPorPadrao: true,
    };
  }

  // Igualdade ESTRITA, sem normalizar caixa nem espaços. Dizer "confere" onde os
  // dois textos diferem seria afirmar uma coincidência que não existe; e a
  // divergência não custa nada à pessoa, porque nasce desmarcada.
  const situacao: SituacaoConciliacao = daDivida === doDocumento ? 'confere' : 'diverge';

  return {
    campo,
    rotulo,
    situacao,
    patch,
    documentoFormatado: formatar(doDocumento),
    atualFormatado: formatar(daDivida),
    extraido,
    marcadaPorPadrao: false,
  };
}
