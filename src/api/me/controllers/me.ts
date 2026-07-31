type AnyRecord = Record<string, any>;

declare const strapi: any;

const publicAddress = (address: AnyRecord) => ({
  id: String(address.documentId ?? address.id),
  label: address.label ?? null,
  line1: address.line1,
  line2: address.line2 ?? null,
  city: address.city,
  region: address.region ?? null,
  country: address.country ?? 'SN',
  postalCode: address.postalCode ?? null,
  phone: address.phone ?? null,
  isDefault: Boolean(address.isDefault),
});

const publicMe = (user: AnyRecord, addresses: AnyRecord[] = []) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  firstName: user.firstName ?? null,
  lastName: user.lastName ?? null,
  phone: user.phone ?? null,
  addresses: addresses.map(publicAddress),
});

export default {
  async me(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const full = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
    });

    const addresses = await strapi.db.query('api::address.address').findMany({
      where: { user: user.id },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });

    ctx.body = { me: publicMe(full ?? user, addresses) };
  },

  async updateMe(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const body = ctx.request.body ?? {};
    const data: AnyRecord = {};
    for (const key of ['firstName', 'lastName', 'phone', 'username']) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data,
    });

    const addresses = await strapi.db.query('api::address.address').findMany({
      where: { user: user.id },
    });

    ctx.body = { me: publicMe(updated, addresses) };
  },

  async listAddresses(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const addresses = await strapi.db.query('api::address.address').findMany({
      where: { user: user.id },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });

    ctx.body = { addresses: addresses.map(publicAddress) };
  },

  async createAddress(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const body = ctx.request.body ?? {};
    if (!body.line1 || !body.city) return ctx.badRequest('line1 et city requis');

    if (body.isDefault) {
      const existing = await strapi.db.query('api::address.address').findMany({
        where: { user: user.id, isDefault: true },
      });
      for (const address of existing) {
        await strapi.documents('api::address.address').update({
          documentId: address.documentId,
          data: { isDefault: false },
        });
      }
    }

    const created = await strapi.documents('api::address.address').create({
      data: {
        label: body.label ?? null,
        line1: body.line1,
        line2: body.line2 ?? null,
        city: body.city,
        region: body.region ?? null,
        country: body.country ?? 'SN',
        postalCode: body.postalCode ?? null,
        phone: body.phone ?? null,
        isDefault: Boolean(body.isDefault),
        user: user.id,
      },
    });

    ctx.body = { address: publicAddress(created) };
  },

  async updateAddress(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = String(ctx.params.id ?? '').trim();
    const address = await strapi.db.query('api::address.address').findOne({
      where: { documentId: id, user: user.id },
    });
    if (!address) return ctx.notFound();

    const body = ctx.request.body ?? {};
    if (body.isDefault) {
      const existing = await strapi.db.query('api::address.address').findMany({
        where: { user: user.id, isDefault: true },
      });
      for (const entry of existing) {
        if (entry.documentId !== address.documentId) {
          await strapi.documents('api::address.address').update({
            documentId: entry.documentId,
            data: { isDefault: false },
          });
        }
      }
    }

    const data: AnyRecord = {};
    for (const key of ['label', 'line1', 'line2', 'city', 'region', 'country', 'postalCode', 'phone', 'isDefault']) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    const updated = await strapi.documents('api::address.address').update({
      documentId: address.documentId,
      data,
    });

    ctx.body = { address: publicAddress(updated) };
  },

  async deleteAddress(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = String(ctx.params.id ?? '').trim();
    const address = await strapi.db.query('api::address.address').findOne({
      where: { documentId: id, user: user.id },
    });
    if (!address) return ctx.notFound();

    await strapi.documents('api::address.address').delete({ documentId: address.documentId });
    ctx.body = { ok: true };
  },
};
