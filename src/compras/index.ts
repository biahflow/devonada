import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';
import type { Purchase } from 'expo-iap';
import { env } from '../config/env';
import type { PlataformaCompra } from '../api/types';

/**
 * O único lugar do app que fala com a App Store e com o Google Play.
 *
 * Mesmo papel que `src/notificacoes.ts` tem para `expo-notifications`: o SDK da
 * loja fica atrás desta fronteira, e a tela conversa em termos do produto —
 * `precoLocalizado`, `comprar`, `restaurar`.
 *
 * ISTO NÃO É EGRESS DE REDE DO APP no sentido do guardrail 2. A regra é que o
 * app só conhece a SUA API, e ela continua valendo: o SDK não fala com nenhum
 * servidor nosso, fala com a loja do sistema operacional, pelo mesmo canal que
 * o app usa para pedir permissão de câmera. Nenhum dado financeiro do usuário
 * atravessa esta camada — o que sobe é um id de produto e o que desce é um
 * recibo.
 *
 * NADA DISTO FUNCIONA NO EXPO GO. In-app purchase exige *development build*
 * (`eas build --profile development`), porque o módulo nativo da loja não está
 * no binário do Expo Go. As funções abaixo degradam para "loja indisponível"
 * em vez de estourar, para a tela conseguir dizer isso ao usuário.
 */

export interface ProdutoDaLoja {
  id: string;
  /** Já formatado pela loja, na moeda do usuário. NUNCA formatamos preço aqui. */
  precoLocalizado: string;
  titulo: string;
}

/** A plataforma como o backend a nomeia. */
export function plataformaAtual(): PlataformaCompra {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/** O id do produto configurado para esta plataforma. */
export function produtoDaPlataforma(): string {
  return Platform.OS === 'ios' ? env.produtoAssinaturaIos : env.produtoAssinaturaAndroid;
}

export class LojaIndisponivel extends Error {
  constructor(message = 'A loja não está disponível neste aparelho.') {
    super(message);
    this.name = 'LojaIndisponivel';
  }
}

let conectado = false;

/**
 * Abre a conexão com a loja, uma vez por sessão do app.
 *
 * Idempotente de propósito: a tela de assinatura pode montar mais de uma vez, e
 * `initConnection` repetido é desperdício silencioso no Android.
 */
export async function conectar(): Promise<void> {
  if (conectado) return;
  try {
    await initConnection();
    conectado = true;
  } catch (e) {
    throw new LojaIndisponivel(
      e instanceof Error && e.message ? e.message : 'A loja não está disponível neste aparelho.',
    );
  }
}

/**
 * O produto de assinatura, com o preço que a loja informa.
 *
 * O PREÇO VEM DAQUI E DE MAIS LUGAR NENHUM. Ele chega localizado em moeda e
 * formato pela loja do usuário; cravá-lo no bundle ou servi-lo pelo backend
 * mentiria para quem está em outro país e envelheceria na primeira promoção.
 * As duas lojas exigem que seja assim.
 */
export async function produtos(): Promise<ProdutoDaLoja[]> {
  await conectar();
  const sku = produtoDaPlataforma();
  if (!sku) return [];

  const encontrados = await fetchProducts({ skus: [sku], type: 'subs' });

  return (encontrados ?? []).map((p) => ({
    id: p.id,
    precoLocalizado: p.displayPrice,
    titulo: p.title,
  }));
}

/**
 * Dispara a folha de compra do sistema.
 *
 * O RESULTADO NÃO VEM DAQUI. As duas lojas entregam a compra por evento, e é
 * por isso que quem quer saber o desfecho assina `aoComprar` — confiar no
 * retorno desta função perderia a compra que a loja entrega depois, como a que
 * o usuário confirmou com Face ID em outra tela.
 */
export async function comprar(): Promise<void> {
  await conectar();
  const sku = produtoDaPlataforma();
  if (!sku) throw new LojaIndisponivel('Nenhum plano configurado para este aparelho.');

  await requestPurchase({
    request: { apple: { sku }, google: { skus: [sku] } },
    type: 'subs',
  });
}

/**
 * Devolve as compras que a loja já reconhece para esta conta de loja.
 *
 * É o "Restaurar compras" que a Apple exige (diretriz 3.1.1) e o caminho que a
 * revisão dela testa primeiro — instalar em aparelho novo e recuperar o acesso
 * sem pagar de novo. Ele não cria rota nova no backend: cada recibo devolvido
 * aqui vai para a MESMA `POST /v1/assinatura/compra`.
 */
export async function restaurar(): Promise<Purchase[]> {
  await conectar();
  return (await getAvailablePurchases()) ?? [];
}

/**
 * O recibo que o backend precisa: JWS no iOS, `purchaseToken` no Android.
 *
 * O `expo-iap` já unifica os dois neste campo, o que é a razão de ele existir —
 * sem isso, esta camada teria um `Platform.OS` para escolher entre dois nomes
 * do mesmo conceito.
 */
export function reciboDe(compra: Purchase): string | null {
  return compra.purchaseToken ?? null;
}

/**
 * Encerra a transação na loja. SÓ DEPOIS QUE O BACKEND CONFIRMOU.
 *
 * A ordem é a parte que importa. Encerrar antes deixa o usuário cobrado com o
 * servidor sem saber da compra: a loja não reentrega o que já foi reconhecido,
 * e a pessoa fica pagando por um app travado, sem caminho de volta que não
 * passe por suporte. Encerrar depois, no pior caso, reentrega uma compra que
 * já registramos — e a rota é idempotente exatamente para isso.
 */
export async function encerrar(compra: Purchase): Promise<void> {
  await finishTransaction({ purchase: compra, isConsumable: false });
}

/** Abre a tela de gerenciamento de assinatura do sistema. */
export async function abrirGerenciamento(): Promise<void> {
  await deepLinkToSubscriptions({ skuAndroid: produtoDaPlataforma() });
}

/**
 * Assina os eventos da loja.
 *
 * Devolve a função de cancelamento; quem chama é responsável por chamá-la ao
 * desmontar, senão dois listeners registram a mesma compra duas vezes.
 */
export function aoComprar(
  onCompra: (compra: Purchase) => void,
  onErro: (mensagem: string) => void,
): () => void {
  const compra = purchaseUpdatedListener(onCompra);
  const erro = purchaseErrorListener((e) => {
    // Cancelar não é erro. A pessoa olhou o preço e desistiu; mostrar um alerta
    // vermelho para isso trata desistência como falha.
    if (e.code === 'user-cancelled') return;
    onErro(e.message || 'Não deu para concluir a compra. Tente de novo.');
  });

  return () => {
    compra.remove();
    erro.remove();
  };
}
