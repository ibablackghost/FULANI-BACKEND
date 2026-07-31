/**
 * Stub Meta Conversions API — Purchase only (à brancher après checkout).
 * Les secrets viennent de Marketing Connection (chiffrés).
 */
import { decryptSecret } from '../../utils/crypto';

type PurchasePayload = {
  orderNumber: string;
  value: number;
  currency?: string;
  email?: string;
  phone?: string;
  fbp?: string;
  fbc?: string;
};

export async function sendMetaPurchase(strapi: any, payload: PurchasePayload) {
  const row = await strapi.db.query('api::marketing-connection.marketing-connection').findOne({
    where: { provider: 'meta' },
  });

  if (!row || row.status !== 'enabled') {
    return { skipped: true, reason: 'meta_disabled' };
  }

  const pixelId = row.config?.pixelId ?? row.config?.metaPixelId;
  const token = row.secretsEncrypted ? decryptSecret(row.secretsEncrypted) : null;

  if (!pixelId || !token) {
    return { skipped: true, reason: 'meta_incomplete_config' };
  }

  // MVP : log only — brancher l’appel Graph API quand les commandes sont live
  strapi.log.info('[meta-capi] Purchase ready (sandbox/log)', {
    event_id: payload.orderNumber,
    value: payload.value,
    currency: payload.currency ?? 'XOF',
    pixelId,
    hasToken: Boolean(token),
  });

  return {
    ok: true,
    mode: 'log',
    event_name: 'Purchase',
    event_id: payload.orderNumber,
    pixelId,
  };
}
