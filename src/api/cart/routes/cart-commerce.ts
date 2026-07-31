export default {
  routes: [
    {
      method: 'POST',
      path: '/cart',
      handler: 'cart-commerce.create',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/cart/:token',
      handler: 'cart-commerce.findByToken',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/cart/:token/items',
      handler: 'cart-commerce.addItem',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/cart/:token/items/:itemId',
      handler: 'cart-commerce.updateItem',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/cart/:token/items/:itemId',
      handler: 'cart-commerce.removeItem',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/cart/:token/attach',
      handler: 'cart-commerce.attach',
      config: { auth: {} },
    },
  ],
};
