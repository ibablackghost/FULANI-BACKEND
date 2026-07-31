export default {
  routes: [
    {
      method: 'GET',
      path: '/public/marketing-config',
      handler: 'public-marketing.config',
      config: { auth: false },
    },
  ],
};
