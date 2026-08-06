import type { NovaDivida } from '../api/debts';
import type { CriticidadeTipo, DividaPropostaCardData } from '../api/types';

/**
 * O rascunho que o chat propôs, na travessia até o formulário.
 *
 * Duas regras sustentam o guardrail 7.2 e o 7.3 aqui:
 *
 * 1. **Nada é salvo por este caminho.** O rascunho só preenche campos; quem
 *    grava é o usuário, tocando em salvar na tela.
 * 2. **Parâmetro de rota é entrada não confiável**, mesmo tendo saído de um card
 *    nosso — ele atravessa a URL, onde qualquer coisa pode ter sido escrita. Por
 *    isso todo campo é validado DE NOVO na volta, com as mesmas regras do
 *    backend: valor que não parseia, data fora do calendário e classificação
 *    inventada não viram valor no formulário. Caem em silêncio, e o campo abre
 *    vazio — que é a verdade sobre o que se sabe dele.
 *
 * Nada aqui calcula: é seleção e conversão, como `extracaoParaProposta`.
 */

const CRITICIDADES: readonly CriticidadeTipo[] = [
  'essencial',
  'com_garantia',
  'juros_abusivos',
  'consumo',
];

const SO_DIGITOS = /^\d+$/;
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const TETO_PARCELAS = 480;
const TETO_CREDOR = 200;

/** O que `useLocalSearchParams` devolve: pode vir repetido na URL. */
export type ParamsDeRota = Record<string, string | string[] | undefined>;

/** Campos do card que viram parâmetro. `dividaId` não entra: ele é a rota. */
const CAMPOS = [
  'credor',
  'valorCobrado',
  'dataOrigem',
  'tipo',
  'taxaJurosMensal',
  'totalParcelas',
  'primeiroVencimento',
] as const;

export function propostaParaParams(card: DividaPropostaCardData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const campo of CAMPOS) {
    const valor = card[campo];
    // `null` e `undefined` significam "a pessoa não disse": o parâmetro não
    // existe, em vez de existir vazio.
    if (valor !== null && valor !== undefined) params[campo] = String(valor);
  }
  return params;
}

export function paramsParaProposta(params: ParamsDeRota): Partial<NovaDivida> {
  return {
    ...definido('credor', texto(params.credor)),
    ...definido('valorCobrado', inteiroPositivo(params.valorCobrado)),
    ...definido('dataOrigem', dataIso(params.dataOrigem)),
    ...definido('tipo', criticidade(params.tipo)),
    ...definido('taxaJurosMensal', inteiroPositivo(params.taxaJurosMensal)),
    ...definido('totalParcelas', inteiroPositivo(params.totalParcelas, TETO_PARCELAS)),
    ...definido('primeiroVencimento', dataIso(params.primeiroVencimento)),
  };
}

/** Houve proposta nesta rota? Só então a tela avisa que veio da conversa. */
export function temProposta(params: ParamsDeRota): boolean {
  return Object.keys(paramsParaProposta(params)).length > 0;
}

function definido<K extends string, T>(chave: K, valor: T | undefined): Partial<Record<K, T>> {
  return valor === undefined ? {} : ({ [chave]: valor } as Partial<Record<K, T>>);
}

function primeiro(bruto: string | string[] | undefined): string | undefined {
  const valor = Array.isArray(bruto) ? bruto[0] : bruto;
  return typeof valor === 'string' ? valor : undefined;
}

function texto(bruto: string | string[] | undefined): string | undefined {
  // Colapsa espaço e caractere de controle: o credor vai para um campo de
  // formulário, não para uma tela que interpreta o que recebe.
  const limpo = primeiro(bruto)?.split(/\s+/).filter(Boolean).join(' ').slice(0, TETO_CREDOR);
  return limpo ? limpo : undefined;
}

/** Zero cai junto com o inválido: 0 é uma afirmação, ausência é outra. */
function inteiroPositivo(bruto: string | string[] | undefined, teto?: number): number | undefined {
  const valor = primeiro(bruto);
  if (!valor || !SO_DIGITOS.test(valor)) return undefined;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) return undefined;
  if (teto !== undefined && numero > teto) return undefined;
  return numero;
}

function dataIso(bruto: string | string[] | undefined): string | undefined {
  const valor = primeiro(bruto);
  if (!valor || !ISO_DATA.test(valor)) return undefined;

  // 2026-02-31 casa o formato e não existe no calendário. A checagem é por
  // componente local — `new Date('...')` interpretaria como UTC e deslocaria o
  // dia conforme o fuso do aparelho (ver src/util/date.ts).
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const data = new Date(ano, mes - 1, dia);
  const valida =
    data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  return valida ? valor : undefined;
}

function criticidade(bruto: string | string[] | undefined): CriticidadeTipo | undefined {
  const valor = primeiro(bruto);
  return CRITICIDADES.find((c) => c === valor);
}
