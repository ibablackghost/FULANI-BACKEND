declare const strapi: any;

export default {
  async config(ctx: any) {
    const service = strapi.service('api::marketing-connection.marketing-connection');
    const payload = await service.getPublicConfig();
    ctx.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    ctx.body = payload;
  },
};
