import fs from 'node:fs';

import { importModeCsv } from '../../../utils/import-mode';

const getUploadedFile = (files: any) => {
  if (!files) return null;
  const file = files.file ?? files.csv ?? Object.values(files)[0];
  return Array.isArray(file) ? file[0] : file;
};

const assertAdmin = async (strapi: any, ctx: any) => {
  const authorization = String(ctx.request.header.authorization ?? '');
  const parts = authorization.split(/\s+/);

  if (parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    return false;
  }

  const manager = strapi.sessionManager;
  if (!manager?.hasOrigin?.('admin')) {
    return false;
  }

  const result = manager('admin').validateAccessToken(parts[1]);
  if (!result?.isValid) {
    return false;
  }

  const isActive = await manager('admin').isSessionActive(result.payload.sessionId);
  if (!isActive) {
    return false;
  }

  const rawUserId = result.payload.userId;
  const numericUserId = Number(rawUserId);
  const userId =
    Number.isFinite(numericUserId) && String(numericUserId) === String(rawUserId)
      ? numericUserId
      : rawUserId;

  const user = await strapi.db.query('admin::user').findOne({
    where: { id: userId, isActive: true },
    populate: ['roles'],
  });

  if (!user) {
    return false;
  }

  ctx.state.user = user;
  ctx.state.isAuthenticated = true;
  ctx.state.session = { id: result.payload.sessionId };
  return true;
};

export default {
  async importMode(ctx: any) {
    const strapi = global.strapi as any;

    try {
      const ok = await assertAdmin(strapi, ctx);
      if (!ok) {
        ctx.status = 401;
        ctx.body = {
          code: 'ADMIN_UNAUTHORIZED',
          message: 'Authentification admin requise. Reconnecte-toi à l’admin Strapi puis réessaie.',
        };
        return;
      }

      const file = getUploadedFile(ctx.request.files);
      const filePath = file?.filepath ?? file?.path;
      const fileName = String(file?.originalFilename ?? file?.name ?? '');
      const extension = fileName.split('.').pop()?.toLowerCase();

      if (!file || !filePath || extension !== 'csv') {
        ctx.status = 400;
        ctx.body = {
          code: 'INVALID_CSV_FILE',
          message: 'Un fichier CSV est requis (ex. produits_mode_enrichi.csv).',
        };
        return;
      }

      const maxSizeMb = Number.parseInt(process.env.IMPORT_CSV_MAX_SIZE_MB ?? '5', 10);
      if (file.size && file.size > maxSizeMb * 1024 * 1024) {
        ctx.status = 413;
        ctx.body = {
          code: 'CSV_TOO_LARGE',
          message: `Le fichier CSV ne doit pas dépasser ${maxSizeMb} Mo.`,
        };
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const report = await importModeCsv(strapi, csvContent, {
        dryRun: ctx.request.body?.dryRun === 'true',
        importImages: ctx.request.body?.importImages === 'true',
        replaceCategory: ctx.request.body?.replaceCategory === 'true',
        expandMatrix: ctx.request.body?.expandMatrix === 'true',
      });

      ctx.body = {
        imported: true,
        report,
      };
    } catch (error: any) {
      strapi?.log?.error?.('[import-mode]', {
        message: error.message,
        stack: error.stack,
      });

      ctx.status = 500;
      ctx.body = {
        code: 'IMPORT_FAILED',
        message: error.message || 'Import impossible.',
      };
    }
  },
};
