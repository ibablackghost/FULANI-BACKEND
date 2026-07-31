import type { Core } from '@strapi/strapi';
import {
  grantAuthenticatedCommercePermissions,
  grantPublicCatalogPermissions,
  seedMarketingConnections,
  seedReferentials,
} from './bootstrap/fulani-catalog';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

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
