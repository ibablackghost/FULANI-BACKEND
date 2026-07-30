/**
 * Custom import route (Content API).
 * Full path: POST /api/import/mode
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/import/mode',
      handler: 'import.importMode',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
