import type { Core } from '@strapi/strapi';
import {
  grantAuthenticatedCommercePermissions,
  grantPublicCatalogPermissions,
  seedMarketingConnections,
  seedReferentials,
} from './bootstrap/fulani-catalog';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Route liveness simple (200) — utile pour probes manuels / monitoring
    strapi.server.routes([
      {
        method: 'GET',
        path: '/health',
        handler: (ctx) => {
          ctx.status = 200;
          ctx.body = { ok: true, service: 'fulani-api' };
        },
        config: { auth: false },
      },
    ]);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      await grantPublicCatalogPermissions(strapi);
      await grantAuthenticatedCommercePermissions(strapi);
      await seedReferentials(strapi);
      await seedMarketingConnections(strapi);
    } catch (error) {
      strapi.log.error('[fulani-catalog] Bootstrap échoué.', error);
    }
  },
};
