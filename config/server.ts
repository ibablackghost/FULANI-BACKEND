import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  // Railway v2 healthchecks need IPv6 — "::" listens on IPv4+IPv6
  host: env('HOST', '::'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', env('APP_URL', '')),
  proxy: {
    koa: env.bool('IS_PROXIED', true),
  },
  app: {
    keys: env.array('APP_KEYS')!,
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});

export default config;
