export default {
  routes: [
    {
      method: 'GET',
      path: '/me',
      handler: 'me.me',
      config: { auth: {} },
    },
    {
      method: 'PATCH',
      path: '/me',
      handler: 'me.updateMe',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/me/addresses',
      handler: 'me.listAddresses',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/me/addresses',
      handler: 'me.createAddress',
      config: { auth: {} },
    },
    {
      method: 'PATCH',
      path: '/me/addresses/:id',
      handler: 'me.updateAddress',
      config: { auth: {} },
    },
    {
      method: 'DELETE',
      path: '/me/addresses/:id',
      handler: 'me.deleteAddress',
      config: { auth: {} },
    },
  ],
};
