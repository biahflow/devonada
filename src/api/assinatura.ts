import { request } from './client';
import type { PlataformaCompra, SituacaoAssinatura } from './types';

/**
 * Situação da assinatura e registro de compra.
 *
 * O RECIBO É A ÚNICA COISA QUE O APP ENVIA. Não mandamos `expiraEm`, `produtoId`
 * nem `status`: quem afirma até quando a assinatura vale é a loja, consultada
 * pelo backend. Um app modificado que declarasse a própria validade seria a
 * forma mais barata de burlar a cobrança, e a resposta é não perguntar a ele.
 */
export function getAssinatura() {
  return request<SituacaoAssinatura>('/v1/assinatura');
}

/**
 * Registra a compra — e também a RESTAURAÇÃO.
 *
 * Uma rota só para as duas: o botão "Restaurar compras" manda o mesmo recibo, e
 * a unicidade da transação no banco faz o reenvio encontrar a linha que já
 * existe. Duas funções aqui dariam duas chances de divergir do servidor.
 */
export function registrarCompra(plataforma: PlataformaCompra, recibo: string) {
  return request<SituacaoAssinatura>('/v1/assinatura/compra', {
    method: 'POST',
    body: { plataforma, recibo },
  });
}
