/**
 * Full path: POST /api/custom-orders/submit
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/custom-orders/submit',
      handler: 'custom-order-submit.submit',
      config: { auth: false },
    },
  ],
};
