import type { Core } from '@strapi/strapi';
import { grantPublicCatalogPermissions } from './bootstrap/fulani-catalog';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      await grantPublicCatalogPermissions(strapi);
    } catch (error) {
      strapi.log.error('[fulani-catalog] Échec de la configuration des permissions catalogue.', error);
    }
  },
};
