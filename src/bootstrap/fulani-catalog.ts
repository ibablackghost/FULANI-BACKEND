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
  enable(perms, 'api::color', 'color', ['find', 'findOne']);
  enable(perms, 'api::size', 'size', ['find', 'findOne']);
  enable(perms, 'api::collection', 'collection', ['find', 'findOne']);
  enable(perms, 'api::cart', 'cart-commerce', [
    'create',
    'findByToken',
    'addItem',
    'updateItem',
    'removeItem',
  ]);
  enable(perms, 'api::public-marketing', 'public-marketing', ['config']);

  await strapi.plugin('users-permissions').service('role').updateRole(publicRole.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[fulani-catalog] Rôle Public: catalogue + panier guest + marketing-config.');
}

export async function grantAuthenticatedCommercePermissions(strapi: Core.Strapi) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
  });
  if (!role) return;

  const roleData = await strapi.plugin('users-permissions').service('role').findOne(role.id);
  const perms = roleData.permissions as Perms;

  enable(perms, 'api::me', 'me', [
    'me',
    'updateMe',
    'listAddresses',
    'createAddress',
    'updateAddress',
    'deleteAddress',
  ]);
  enable(perms, 'api::cart', 'cart-commerce', [
    'create',
    'findByToken',
    'addItem',
    'updateItem',
    'removeItem',
    'attach',
  ]);
  enable(perms, 'api::address', 'address', ['find', 'findOne', 'create', 'update', 'delete']);

  await strapi.plugin('users-permissions').service('role').updateRole(role.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[fulani-catalog] Rôle Authenticated: me + addresses + cart attach.');
}

const DEFAULT_COLORS = [
  { name: 'Noir', slug: 'noir', hex: '#111111' },
  { name: 'Blanc', slug: 'blanc', hex: '#FFFFFF' },
  { name: 'Blue', slug: 'blue', hex: '#1E3A8A' },
  { name: 'Rouge', slug: 'rouge', hex: '#B91C1C' },
  { name: 'Marron', slug: 'marron', hex: '#7C4A03' },
  { name: 'Beige', slug: 'beige', hex: '#D6C3A5' },
  { name: 'Vert', slug: 'vert', hex: '#166534' },
  { name: 'Jaune', slug: 'jaune', hex: '#CA8A04' },
];

const DEFAULT_SIZES = [
  { name: 'S', slug: 's', sortOrder: 10 },
  { name: 'M', slug: 'm', sortOrder: 20 },
  { name: 'L', slug: 'l', sortOrder: 30 },
  { name: 'XL', slug: 'xl', sortOrder: 40 },
  { name: 'XXL', slug: 'xxl', sortOrder: 50 },
  { name: 'X', slug: 'x', sortOrder: 60 },
];

export async function seedReferentials(strapi: Core.Strapi) {
  for (const color of DEFAULT_COLORS) {
    const existing = await strapi.db.query('api::color.color').findOne({ where: { slug: color.slug } });
    if (!existing) {
      await strapi.db.query('api::color.color').create({ data: color });
    }
  }

  for (const size of DEFAULT_SIZES) {
    const existing = await strapi.db.query('api::size.size').findOne({ where: { slug: size.slug } });
    if (!existing) {
      await strapi.db.query('api::size.size').create({ data: size });
    }
  }

  strapi.log.info('[fulani-catalog] Seed couleurs / tailles OK.');
}

const MARKETING_SEEDS: Array<{
  provider: 'ga4' | 'meta' | 'tiktok';
  status: 'disabled' | 'enabled';
  config: Record<string, unknown>;
  notes: string;
}> = [
  {
    provider: 'ga4',
    status: 'disabled',
    config: {
      measurementId: '',
      propertyId: '',
      enabled: false,
      debug: false,
    },
    notes:
      'config (public): measurementId, propertyId, enabled, debug. apiSecret → secretsEncrypted (JSON {"apiSecret":"..."}), jamais dans config.',
  },
  {
    provider: 'meta',
    status: 'disabled',
    config: { pixelId: '', enabled: false, debug: false },
    notes: 'Renseigne pixelId dans config. Colle le token CAPI dans secretsEncrypted (chiffré auto).',
  },
  {
    provider: 'tiktok',
    status: 'disabled',
    config: { pixelId: '', enabled: false, debug: false },
    notes: 'Stub MVP — Events API plus tard. Pixel ID optionnel pour le front.',
  },
];

export async function seedMarketingConnections(strapi: Core.Strapi) {
  const { normalizeGa4Config } = await import('../integrations/google/ga4');
  const { encryptSecret } = await import('../utils/crypto');

  for (const seed of MARKETING_SEEDS) {
    const existing = await strapi.db.query('api::marketing-connection.marketing-connection').findOne({
      where: { provider: seed.provider },
    });
    if (existing) {
      // Upgrade legacy ga4 config shape without wiping existing IDs
      if (seed.provider === 'ga4') {
        const next = normalizeGa4Config(existing.config);
        const prev = existing.config ?? {};
        const needsUpgrade =
          prev.propertyId === undefined ||
          prev.enabled === undefined ||
          prev.debug === undefined ||
          prev.apiSecret !== undefined;
        if (needsUpgrade) {
          const { apiSecret: _leak, ...rest } = prev as Record<string, unknown>;
          await strapi.db.query('api::marketing-connection.marketing-connection').update({
            where: { id: existing.id },
            data: {
              config: { ...next, measurementId: next.measurementId || String(rest.measurementId ?? '') },
              notes: seed.notes,
            },
          });
        }
      }
      continue;
    }

    await strapi.db.query('api::marketing-connection.marketing-connection').create({
      data: {
        provider: seed.provider,
        status: seed.status,
        config: seed.config,
        notes: seed.notes,
      },
    });
  }

  // Optional hydrate from env on first boot
  const ga4Id = process.env.GA4_MEASUREMENT_ID?.trim();
  const ga4Secret = process.env.GA4_API_SECRET?.trim();
  const ga4Property = process.env.GA4_PROPERTY_ID?.trim();
  if (ga4Id || ga4Secret || ga4Property) {
    const ga4 = await strapi.db.query('api::marketing-connection.marketing-connection').findOne({
      where: { provider: 'ga4' },
    });
    if (ga4) {
      const config = normalizeGa4Config(ga4.config);
      const shouldHydrateId = ga4Id && !config.measurementId;
      const shouldHydrateProperty = ga4Property && !config.propertyId;
      if (shouldHydrateId || shouldHydrateProperty || ga4Secret) {
        await strapi.db.query('api::marketing-connection.marketing-connection').update({
          where: { id: ga4.id },
          data: {
            config: {
              ...config,
              measurementId: shouldHydrateId ? ga4Id! : config.measurementId,
              propertyId: shouldHydrateProperty ? ga4Property! : config.propertyId,
              enabled: true,
            },
            status: 'enabled',
            ...(ga4Secret && !ga4.secretsEncrypted
              ? { secretsEncrypted: encryptSecret(JSON.stringify({ apiSecret: ga4Secret })) }
              : {}),
          },
        });
      }
    }
  }

  const metaPixel = process.env.META_PIXEL_ID?.trim();
  const metaToken = process.env.META_CAPI_TOKEN?.trim();
  if (metaPixel) {
    const meta = await strapi.db.query('api::marketing-connection.marketing-connection').findOne({
      where: { provider: 'meta' },
    });
    if (meta && !meta.config?.pixelId) {
      await strapi.db.query('api::marketing-connection.marketing-connection').update({
        where: { id: meta.id },
        data: {
          config: { pixelId: metaPixel, enabled: true, debug: false },
          status: 'enabled',
          ...(metaToken ? { secretsEncrypted: encryptSecret(metaToken) } : {}),
        },
      });
    }
  }

  strapi.log.info('[fulani-catalog] Seed Marketing Connection (ga4/meta/tiktok) OK.');
}
