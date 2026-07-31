import { factories } from '@strapi/strapi';
import { decryptSecret } from '../../../utils/crypto';
import { getGa4MeasurementId, normalizeGa4Config, parseGa4Secrets } from '../../../integrations/google/ga4';

export default factories.createCoreService('api::marketing-connection.marketing-connection' as any, ({ strapi }) => ({
  async findByProvider(provider: 'ga4' | 'meta' | 'tiktok') {
    return strapi.db.query('api::marketing-connection.marketing-connection').findOne({
      where: { provider },
    });
  },

  async getDecryptedSecret(provider: 'ga4' | 'meta' | 'tiktok') {
    const row = await this.findByProvider(provider);
    if (!row?.secretsEncrypted) return null;
    return decryptSecret(row.secretsEncrypted);
  },

  async getGa4ApiSecret() {
    const raw = await this.getDecryptedSecret('ga4');
    return parseGa4Secrets(raw).apiSecret ?? null;
  },

  async getPublicConfig() {
    const rows = await strapi.db.query('api::marketing-connection.marketing-connection').findMany({});

    const byProvider = Object.fromEntries(rows.map((row: any) => [row.provider, row]));

    const ga4 = byProvider.ga4;
    const meta = byProvider.meta;
    const tiktok = byProvider.tiktok;

    const ga4Cfg = normalizeGa4Config(ga4?.config);
    const ga4On = ga4?.status === 'enabled';
    const ga4MeasurementId = ga4On ? getGa4MeasurementId(ga4Cfg) : null;

    const metaPixelId =
      meta?.status === 'enabled' ? (meta.config?.pixelId ?? meta.config?.metaPixelId ?? null) : null;
    const tiktokPixelId =
      tiktok?.status === 'enabled' ? (tiktok.config?.pixelId ?? tiktok.config?.tiktokPixelId ?? null) : null;

    return {
      ga4MeasurementId: ga4MeasurementId || null,
      ga4Debug: ga4On ? Boolean(ga4Cfg.debug) : false,
      metaPixelId: metaPixelId || null,
      tiktokPixelId: tiktokPixelId || null,
      enabled: {
        ga4: Boolean(ga4MeasurementId),
        meta: Boolean(metaPixelId),
        tiktok: Boolean(tiktokPixelId),
      },
    };
  },
}));