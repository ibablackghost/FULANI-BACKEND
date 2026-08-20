declare const strapi: any;

const publicOrder = (order: Record<string, any>) => ({
  id: String(order.documentId ?? order.id),
  orderDate: order.orderDate ?? null,
  firstName: order.firstName,
  lastName: order.lastName,
  email: order.email,
  phone: order.phone,
  status: order.status,
  emailStatus: order.emailStatus,
  totalAmount: order.totalAmount ?? null,
  advanceAmount: order.advanceAmount ?? null,
  remainingAmount: order.remainingAmount ?? null,
});

export default {
  async submit(ctx: any) {
    try {
      const service = strapi.service('api::custom-order.custom-order');
      const order = await service.submitPublic(ctx.request.body ?? {});
      ctx.status = 201;
      ctx.body = {
        ok: true,
        message: 'Commande sur mesure enregistrée.',
        order: publicOrder(order),
      };
    } catch (error: any) {
      ctx.status = 400;
      ctx.body = {
        ok: false,
        error: error?.message || 'Impossible d’enregistrer la commande.',
      };
    }
  },
};
