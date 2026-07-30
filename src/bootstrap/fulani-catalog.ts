import type { Core } from '@strapi/strapi';

type Perms = Record<
  string,
  { controllers?: Record<string, Record<string, { enabled: boolean }>> }
>;

const enable = (perms: Perms, apiKey: string, controller: string, actions: string[]) => {
  const ctrl = perms[apiKey]?.controllers?.[controller];
  if (!ctrl) return;
  for (const action of actions) {
    if (ctrl[action]) ctrl[action].enabled = true;
  }
};

export async function grantPublicCatalogPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  if (!publicRole) {
    strapi.log.warn('[fulani-catalog] Rôle Public introuvable — permissions inchangées.');
    return;
  }

  const roleData = await strapi.plugin('users-permissions').service('role').findOne(publicRole.id);
  const perms = roleData.permissions as Perms;

  enable(perms, 'api::category', 'category', ['find', 'findOne']);
  enable(perms, 'api::product', 'product', ['find', 'findOne', 'catalog', 'findBySlug']);
  enable(perms, 'api::tag', 'tag', ['find', 'findOne']);
  enable(perms, 'api::variant', 'variant', ['find', 'findOne']);

  await strapi.plugin('users-permissions').service('role').updateRole(publicRole.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[fulani-catalog] Rôle Public: lecture catalogue (products, variants, categories, tags).');
}
