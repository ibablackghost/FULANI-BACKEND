import type { StrapiApp } from '@strapi/strapi/admin';

const ImportIcon = () => <span aria-hidden="true">CSV</span>;

export default {
  config: {
    locales: [],
  },
  register(app: StrapiApp) {
    app.addMenuLink({
      to: 'plugins/import-mode',
      icon: ImportIcon,
      intlLabel: {
        id: 'import-mode.plugin.name',
        defaultMessage: 'Import Produits CSV',
      },
      Component: () => import('./pages/ImportMode'),
      permissions: [],
      position: 8,
    });

    app.registerPlugin({
      id: 'import-mode',
      name: 'Import Produits CSV',
    });
  },
  bootstrap() {},
};
