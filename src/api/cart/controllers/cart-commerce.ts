import { randomUUID } from 'crypto';

declare const strapi: any;

type AnyRecord = Record<string, any>;

const CART_POPULATE = {
  items: {
    populate: {
      variant: {
        populate: {
          product: {
            fields: ['name', 'slug', 'imageUrl', 'availableColors', 'availableSizes', 'availableFormats'],
          },
        },
      },
    },
  },
};

const publicCartItem = (item: AnyRecord) => {
  const variant = item.variant ?? {};
  const product = variant.product ?? {};
  const qty = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? variant.price ?? 0;

  return {
    id: String(item.documentId ?? item.id),
    quantity: qty,
    unitPrice,
    lineTotal: unitPrice * qty,
    selectedFormat: item.selectedFormat ?? variant.format ?? null,
    selectedColor: item.selectedColor ?? null,
    selectedSize: item.selectedSize ?? null,
    variant: {
      id: String(variant.documentId ?? variant.id ?? ''),
      sku: variant.sku ?? null,
      name: variant.name ?? null,
      format: variant.format ?? null,
      price: variant.price ?? null,
      stock: variant.stock ?? 0,
      imageUrl: variant.imageUrl ?? null,
    },
    product: product?.slug
      ? {
          id: String(product.documentId ?? product.id ?? ''),
          name: product.name,
          slug: product.slug,
          imageUrl: product.imageUrl ?? null,
        }
      : null,
  };
};

const publicCart = (cart: AnyRecord) => {
  const items = Array.isArray(cart.items) ? cart.items.map(publicCartItem) : [];
  const subtotal = items.reduce((sum: number, item: AnyRecord) => sum + item.lineTotal, 0);

  return {
    id: String(cart.documentId ?? cart.id),
    token: cart.token,
    currency: cart.currency || 'XOF',
    items,
    itemCount: items.reduce((sum: number, item: AnyRecord) => sum + item.quantity, 0),
    subtotal,
    total: subtotal,
  };
};

const findCartByToken = async (strapi: any, token: string) =>
  strapi.db.query('api::cart.cart').findOne({
    where: { token },
    populate: CART_POPULATE,
  });

export default {
  async create(ctx: any) {
    const token = randomUUID().replace(/-/g, '');
    const cart = await strapi.documents('api::cart.cart').create({
      data: {
        token,
        currency: 'XOF',
        user: ctx.state.user?.id ?? null,
      },
    });

    const full = await findCartByToken(strapi, cart.token);
    ctx.body = { cart: publicCart(full ?? cart) };
  },

  async findByToken(ctx: any) {
    const token = String(ctx.params.token ?? '').trim();
    if (!token) return ctx.badRequest('token requis');

    const cart = await findCartByToken(strapi, token);
    if (!cart) return ctx.notFound('Panier introuvable');

    ctx.body = { cart: publicCart(cart) };
  },

  async addItem(ctx: any) {
    const token = String(ctx.params.token ?? '').trim();
    const body = ctx.request.body ?? {};
    const variantId = String(body.variantId ?? body.variant ?? '').trim();
    const quantity = Math.max(1, Number.parseInt(String(body.qty ?? body.quantity ?? 1), 10) || 1);
    const selectedFormat = body.format ?? body.selectedFormat ?? null;
    const selectedColor = body.color ?? body.selectedColor ?? null;
    const selectedSize = body.size ?? body.selectedSize ?? null;

    if (!token || !variantId) return ctx.badRequest('token et variantId requis');

    const cart = await findCartByToken(strapi, token);
    if (!cart) return ctx.notFound('Panier introuvable');

    const variant =
      (await strapi.documents('api::variant.variant').findOne({ documentId: variantId })) ??
      (await strapi.db.query('api::variant.variant').findOne({ where: { documentId: variantId } })) ??
      (await strapi.db.query('api::variant.variant').findOne({ where: { id: Number(variantId) || -1 } }));

    if (!variant) return ctx.notFound('Variante introuvable');

    const unitPrice = variant.price ?? 0;
    const existing = (cart.items ?? []).find((item: AnyRecord) => {
      const vid = String(item.variant?.documentId ?? item.variant?.id ?? '');
      return (
        vid === String(variant.documentId ?? variant.id) &&
        (item.selectedColor ?? null) === (selectedColor ?? null) &&
        (item.selectedSize ?? null) === (selectedSize ?? null) &&
        (item.selectedFormat ?? null) === (selectedFormat ?? variant.format ?? null)
      );
    });

    if (existing) {
      await strapi.documents('api::cart-item.cart-item').update({
        documentId: existing.documentId,
        data: { quantity: (existing.quantity ?? 1) + quantity },
      });
    } else {
      await strapi.documents('api::cart-item.cart-item').create({
        data: {
          cart: cart.documentId ?? cart.id,
          variant: variant.documentId ?? variant.id,
          quantity,
          unitPrice,
          selectedFormat: selectedFormat ?? variant.format ?? null,
          selectedColor,
          selectedSize,
        },
      });
    }

    const updated = await findCartByToken(strapi, token);
    ctx.body = { cart: publicCart(updated) };
  },

  async updateItem(ctx: any) {
    const token = String(ctx.params.token ?? '').trim();
    const itemId = String(ctx.params.itemId ?? '').trim();
    const quantity = Number.parseInt(String(ctx.request.body?.qty ?? ctx.request.body?.quantity ?? ''), 10);

    if (!token || !itemId) return ctx.badRequest('token et itemId requis');
    if (!Number.isFinite(quantity) || quantity < 1) return ctx.badRequest('qty invalide');

    const cart = await findCartByToken(strapi, token);
    if (!cart) return ctx.notFound('Panier introuvable');

    const item = (cart.items ?? []).find(
      (entry: AnyRecord) => String(entry.documentId ?? entry.id) === itemId,
    );
    if (!item) return ctx.notFound('Ligne panier introuvable');

    await strapi.documents('api::cart-item.cart-item').update({
      documentId: item.documentId,
      data: { quantity },
    });

    const updated = await findCartByToken(strapi, token);
    ctx.body = { cart: publicCart(updated) };
  },

  async removeItem(ctx: any) {
    const token = String(ctx.params.token ?? '').trim();
    const itemId = String(ctx.params.itemId ?? '').trim();

    const cart = await findCartByToken(strapi, token);
    if (!cart) return ctx.notFound('Panier introuvable');

    const item = (cart.items ?? []).find(
      (entry: AnyRecord) => String(entry.documentId ?? entry.id) === itemId,
    );
    if (!item) return ctx.notFound('Ligne panier introuvable');

    await strapi.documents('api::cart-item.cart-item').delete({ documentId: item.documentId });

    const updated = await findCartByToken(strapi, token);
    ctx.body = { cart: publicCart(updated) };
  },

  async attach(ctx: any) {
    const token = String(ctx.params.token ?? '').trim();
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('JWT requis');
    if (!token) return ctx.badRequest('token requis');

    const cart = await findCartByToken(strapi, token);
    if (!cart) return ctx.notFound('Panier introuvable');

    await strapi.documents('api::cart.cart').update({
      documentId: cart.documentId,
      data: { user: user.id },
    });

    const updated = await findCartByToken(strapi, token);
    ctx.body = { cart: publicCart(updated) };
  },
};
