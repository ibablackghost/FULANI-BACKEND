import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type AnyRecord = Record<string, any>;

type ImportOptions = {
  dryRun?: boolean;
  importImages?: boolean;
  replaceCategory?: boolean;
  /** Crée une variante pour chaque combo type × couleur × taille (sinon variants = types tarifés). */
  expandMatrix?: boolean;
};

export type ImportReport = {
  dryRun: boolean;
  totalRows: number;
  productsFound: number;
  variantsFound: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  tagsCreated: number;
  tagsUpdated: number;
  productsDeleted: number;
  variantsDeleted: number;
  imagesImported: number;
  sourceFormat: 'woo' | 'enrichi' | 'unknown';
  errors: Array<{ scope: string; message: string }>;
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    if (char !== '\r') value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => String(cell).trim()));
};

const rowsToRecords = (rows: string[][]) => {
  if (!rows[0]) return [];
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const getField = (record: AnyRecord, ...candidates: string[]) => {
  for (const key of candidates) {
    if (record[key] != null && String(record[key]).length) return String(record[key]);
  }

  const keys = Object.keys(record);
  for (const candidate of candidates) {
    const normalized = candidate.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    const found = keys.find((k) => k.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() === normalized);
    if (found) return String(record[found] ?? '');
  }

  for (const candidate of candidates) {
    const base = candidate.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    const found = keys.find((k) => k.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().startsWith(base));
    if (found) return String(record[found] ?? '');
  }

  return '';
};

const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const slugify = (value: string) =>
  stripAccents(String(value ?? '').toLowerCase())
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const parsePrice = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const statusFor = (status: unknown) => (String(status).toLowerCase() === 'published' ? 'published' : 'draft');

const relationId = (entity: AnyRecord | null | undefined) => entity?.documentId ?? entity?.id;

const firstImageUrl = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return raw.split(',')[0].trim() || null;
};

const galleryUrlsJson = (value: unknown) => {
  const urls = String(value ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length > 0 ? JSON.stringify(urls) : null;
};

const splitList = (value: unknown) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const listToJson = (values: string[]) => (values.length ? JSON.stringify(values) : null);

const attrName = (record: AnyRecord, index: number) =>
  getField(record, `Nom de l'attribut ${index}`, `Nom de l’attribut ${index}`, `Attribute ${index} name`).trim();

const attrValues = (record: AnyRecord, index: number) =>
  getField(
    record,
    `Valeur(s) de l'attribut ${index}`,
    `Valeur(s) de l’attribut ${index}`,
    `Valeur(s) de l'attribut ${index} `,
    `Valeur(s) de l’attribut ${index} `,
    `Attribute ${index} value(s)`,
  ).trim();

const classifyAttr = (name: string) => {
  const n = stripAccents(name).toLowerCase();
  if (/couleur|color|colour/.test(n)) return 'color';
  if (/taille|size/.test(n)) return 'size';
  if (/type|format|modele|modèle/.test(n)) return 'format';
  return 'other';
};

const detectSourceFormat = (records: AnyRecord[]): ImportReport['sourceFormat'] => {
  if (!records[0]) return 'unknown';
  const keys = Object.keys(records[0]).map((k) => k.normalize('NFKC').toLowerCase());
  if (keys.some((k) => k.includes('nom de l') && k.includes('attribut')) || keys.includes('nom')) {
    if (keys.includes('sku') && keys.includes('name') && keys.some((k) => k.includes('strapi category'))) {
      return 'enrichi';
    }
    return 'woo';
  }
  if (keys.includes('sku') && keys.includes('name')) return 'enrichi';
  return 'unknown';
};

const parseParentId = (parent: string) => {
  const match = String(parent ?? '').match(/id:(\d+)/i);
  return match ? match[1] : '';
};

const stripHtml = (html: string) =>
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (text: string, max: number) => {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
};

/** Convertit un export Woo FR → lignes au format enrichi Fulani. */
export const normalizeWooToEnrichi = (records: AnyRecord[], options?: { expandMatrix?: boolean }) => {
  const CATEGORY = 'MODE';
  const TAGS = 'mode|fulani';
  const DEFAULT_STOCK = 10;
  const expandMatrix = Boolean(options?.expandMatrix);

  const parents = records.filter((r) => getField(r, 'Type').toLowerCase() === 'variable');
  const variations = records.filter((r) => getField(r, 'Type').toLowerCase() === 'variation');

  const idToSku = new Map<string, string>();
  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();

  const uniqueSku = (base: string) => {
    let sku = base;
    let n = 2;
    while (usedSkus.has(sku)) {
      sku = `${base}-${n}`;
      n += 1;
    }
    usedSkus.add(sku);
    return sku;
  };

  const uniqueSlug = (base: string) => {
    let slug = base || 'produit';
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    usedSlugs.add(slug);
    return slug;
  };

  for (const parent of parents) {
    const wooId = getField(parent, 'ID');
    const name = getField(parent, 'Nom', 'Name').trim() || `Produit-${wooId}`;
    idToSku.set(wooId, uniqueSku(`mode-${slugify(name) || wooId}`));
  }

  const out: AnyRecord[] = [];

  for (const parent of parents) {
    const wooId = getField(parent, 'ID');
    const name = getField(parent, 'Nom', 'Name').trim() || `Produit-${wooId}`;
    const sku = idToSku.get(wooId)!;
    const slug = uniqueSlug(slugify(name));
    const shortDescription = getField(parent, 'Description courte', 'Short description');
    const description = getField(parent, 'Description') || shortDescription || name;
    const images = getField(parent, 'Images');
    const published = getField(parent, 'Publié', 'Published') === '1';

    const attrs: Array<{ kind: string; name: string; values: string[] }> = [];
    for (let i = 1; i <= 3; i += 1) {
      const nameAttr = attrName(parent, i);
      const values = splitList(attrValues(parent, i));
      if (!nameAttr && values.length === 0) continue;
      attrs.push({
        kind: classifyAttr(nameAttr || (i === 1 ? 'type' : i === 2 ? 'couleur' : 'taille')),
        name: nameAttr,
        values,
      });
    }

    const formats = attrs.find((a) => a.kind === 'format')?.values ?? [];
    const colors = attrs.find((a) => a.kind === 'color')?.values ?? [];
    const sizes = attrs.find((a) => a.kind === 'size')?.values ?? [];

    const childVars = variations.filter((v) => parseParentId(getField(v, 'Parent')) === wooId);

    // Prix par format (Top/Ensemble…) à partir des variations Woo
    const priceByFormat = new Map<string, number>();
    for (const variation of childVars) {
      const formatValue = attrValues(variation, 1) || 'Standard';
      const price = parsePrice(getField(variation, 'Tarif régulier', 'Regular price'));
      if (price > 0) priceByFormat.set(formatValue, price);
    }

    const formatList =
      formats.length > 0
        ? formats
        : childVars.map((v) => attrValues(v, 1)).filter(Boolean).length > 0
          ? [...new Set(childVars.map((v) => attrValues(v, 1)).filter(Boolean))]
          : ['Standard'];

    const defaultFormat = formatList[0] ?? 'Standard';

    out.push({
      Name: name,
      SKU: sku,
      Type: 'variable',
      Categories: CATEGORY,
      'Regular price': '',
      'Short description': shortDescription || truncate(description, 280),
      Description: description,
      Images: firstImageUrl(images) ?? '',
      Link: '',
      Parent: '',
      'Attribute 1 name': 'type',
      'Attribute 1 value(s)': formatList.join(', '),
      'Attribute 1 visible': '1',
      'Attribute 1 global': '0',
      'Attribute 1 default': defaultFormat,
      'Attribute 2 name': 'couleur',
      'Attribute 2 value(s)': colors.join(', '),
      'Attribute 3 name': 'taille',
      'Attribute 3 value(s)': sizes.join(', '),
      'Strapi category': CATEGORY,
      Stock: '',
      Slug: slug,
      'Meta title': `${name} | ${CATEGORY}`.slice(0, 70),
      'Meta description': truncate(shortDescription || description, 155),
      Status: published ? 'published' : 'draft',
      'Compare at price': '',
      Tags: TAGS,
      'Image alt text': `${name} - mode`,
      'Gallery images': images,
      AvailableColors: listToJson(colors),
      AvailableSizes: listToJson(sizes),
      AvailableFormats: listToJson(formatList),
    });

    if (expandMatrix && (colors.length > 0 || sizes.length > 0)) {
      const colorList = colors.length > 0 ? colors : [''];
      const sizeList = sizes.length > 0 ? sizes : [''];
      let position = 0;

      for (const format of formatList) {
        const price = priceByFormat.get(format) ?? [...priceByFormat.values()][0] ?? 0;
        for (const color of colorList) {
          for (const size of sizeList) {
            const parts = [format, color, size].filter(Boolean);
            const label = parts.join(' / ');
            const varSku = uniqueSku(`${sku}-${slugify(parts.join('-')) || 'var'}`);
            out.push({
              Name: `${name} - ${label}`,
              SKU: varSku,
              Type: 'variation',
              Categories: '',
              'Regular price': String(price || ''),
              Images: firstImageUrl(images) ?? '',
              Parent: sku,
              'Attribute 1 name': 'type',
              'Attribute 1 value(s)': format,
              'Attribute 2 name': 'couleur',
              'Attribute 2 value(s)': color,
              'Attribute 3 name': 'taille',
              'Attribute 3 value(s)': size,
              'Strapi category': CATEGORY,
              Stock: String(DEFAULT_STOCK),
              Slug: uniqueSlug(`${slug}-${slugify(parts.join('-'))}`),
              Status: published ? 'published' : 'draft',
              Tags: TAGS,
              'Image alt text': `${name} - ${label}`,
              _position: position,
            });
            position += 1;
          }
        }
      }
    } else {
      // Variantes tarifées = formats (Top / Ensemble…)
      for (const [index, format] of formatList.entries()) {
        const matching = childVars.find((v) => attrValues(v, 1) === format) ?? childVars[index];
        const price =
          priceByFormat.get(format) ??
          parsePrice(getField(matching ?? {}, 'Tarif régulier', 'Regular price')) ??
          0;
        const varImages = matching ? getField(matching, 'Images') : '';
        const varSku = uniqueSku(`${sku}-${slugify(format) || 'var'}`);

        out.push({
          Name: `${name} - ${format}`,
          SKU: varSku,
          Type: 'variation',
          Categories: '',
          'Regular price': String(price || ''),
          Images: firstImageUrl(varImages) || firstImageUrl(images) || '',
          Parent: sku,
          'Attribute 1 name': 'type',
          'Attribute 1 value(s)': format,
          'Attribute 2 name': 'couleur',
          'Attribute 2 value(s)': '',
          'Attribute 3 name': 'taille',
          'Attribute 3 value(s)': '',
          'Strapi category': CATEGORY,
          Stock: getField(matching ?? {}, 'Stock') || String(DEFAULT_STOCK),
          Slug: uniqueSlug(`${slug}-${slugify(format)}`),
          Status: published ? 'published' : 'draft',
          Tags: TAGS,
          'Image alt text': `${name} - ${format}`,
          _position: index,
        });
      }
    }
  }

  return out;
};

const createReport = (dryRun: boolean): ImportReport => ({
  dryRun,
  totalRows: 0,
  productsFound: 0,
  variantsFound: 0,
  productsCreated: 0,
  productsUpdated: 0,
  variantsCreated: 0,
  variantsUpdated: 0,
  tagsCreated: 0,
  tagsUpdated: 0,
  productsDeleted: 0,
  variantsDeleted: 0,
  imagesImported: 0,
  sourceFormat: 'unknown',
  errors: [],
});

const findOne = async (strapi: any, uid: string, where: AnyRecord, populate?: AnyRecord) =>
  strapi.db.query(uid).findOne({
    where,
    ...(populate ? { populate } : {}),
  });

const findDocument = async (strapi: any, uid: string, filters: AnyRecord, populate?: AnyRecord) =>
  strapi.documents(uid).findFirst({
    filters,
    ...(populate ? { populate } : {}),
  });

const writeDocument = async (
  strapi: any,
  uid: string,
  existing: AnyRecord | null | undefined,
  data: AnyRecord,
  status: string,
  populate?: AnyRecord,
) => {
  if (existing?.documentId) {
    return strapi.documents(uid).update({
      documentId: existing.documentId,
      data,
      status,
      ...(populate ? { populate } : {}),
    });
  }

  return strapi.documents(uid).create({
    data,
    status,
    ...(populate ? { populate } : {}),
  });
};

const upsert = async (
  strapi: any,
  report: ImportReport,
  uid: string,
  where: AnyRecord,
  data: AnyRecord,
  counters: { created: keyof ImportReport; updated: keyof ImportReport },
  populate?: AnyRecord,
  status = 'published',
) => {
  const existing = (await findDocument(strapi, uid, where, populate)) ?? (await findOne(strapi, uid, where, populate));

  if (report.dryRun) {
    if (existing) {
      (report[counters.updated] as number) += 1;
      return existing;
    }
    (report[counters.created] as number) += 1;
    return { id: `${uid}:${Object.values(where).join(':')}`, documentId: `${uid}:${Object.values(where).join(':')}`, ...data };
  }

  if (existing) {
    (report[counters.updated] as number) += 1;
    return writeDocument(strapi, uid, existing, data, status, populate);
  }

  (report[counters.created] as number) += 1;
  return writeDocument(strapi, uid, null, data, status, populate);
};

const mediaTypeFor = (fileName: string, fallback?: string | null) => {
  if (fallback) return fallback;
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const uploadImage = async (strapi: any, report: ImportReport, cache: Map<string, number>, url: string, alt: string) => {
  if (!url || report.dryRun) return null;
  if (cache.has(url)) return cache.get(url) ?? null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      report.errors.push({ scope: 'image', message: `Image ignorée (${response.status}): ${url}` });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const urlPath = new URL(url).pathname;
    const fileName = path.basename(urlPath) || `fulani-${Date.now()}.jpg`;
    const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, buffer);

    const mimeType = mediaTypeFor(fileName, response.headers.get('content-type'));
    const file = {
      path: tempPath,
      filepath: tempPath,
      name: fileName,
      originalFilename: fileName,
      type: mimeType,
      mimetype: mimeType,
      size: buffer.length,
    };

    const uploaded = await strapi.plugin('upload').service('upload').upload({
      data: {
        fileInfo: {
          alternativeText: alt,
          caption: alt,
        },
      },
      files: file,
    });

    fs.unlinkSync(tempPath);

    const media = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    if (media?.id) {
      cache.set(url, media.id);
      report.imagesImported += 1;
      return media.id;
    }
  } catch (error: any) {
    report.errors.push({ scope: 'image', message: `${url}: ${error.message}` });
  }

  return null;
};

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');

const categoryPresetFor = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const normalized = stripAccents(raw).toLowerCase().replace(/[_-]+/g, ' ');

  if (normalized.includes('mode') || !raw || normalized.includes('non classe')) {
    return {
      name: 'Mode',
      slug: 'mode',
      description: 'Catalogue mode Fulani Official',
      metaTitle: 'Mode | Fulani',
      metaDescription: 'Découvrez les tenues traditionnelles revisitées Fulani Official.',
      canonicalPath: '/collections/mode',
    };
  }

  const name = titleCase(raw.replace(/[_-]+/g, ' ').trim());
  const slug = slugify(name);

  return {
    name,
    slug,
    description: `Catégorie ${name} Fulani`,
    metaTitle: `${name} | Fulani`,
    metaDescription: `Découvrez la sélection ${name.toLowerCase()} Fulani Official.`,
    canonicalPath: `/collections/${slug}`,
  };
};

const ensureCategory = async (strapi: any, report: ImportReport, cache: Map<string, AnyRecord>, value: unknown) => {
  const preset = categoryPresetFor(value);
  if (cache.has(preset.slug)) return cache.get(preset.slug);

  const existing =
    (await findDocument(strapi, 'api::category.category', { slug: preset.slug })) ??
    (await findOne(strapi, 'api::category.category', { slug: preset.slug }));

  let category = existing;
  if (!report.dryRun) {
    category = await writeDocument(strapi, 'api::category.category', existing, preset, 'published');
  } else if (!category) {
    category = { documentId: `category:${preset.slug}`, ...preset };
  }

  cache.set(preset.slug, category);
  return category;
};

const ensureTag = async (strapi: any, report: ImportReport, cache: Map<string, AnyRecord>, tagName: string) => {
  const slug = slugify(tagName);
  if (cache.has(slug)) return cache.get(slug);

  const tag = await upsert(
    strapi,
    report,
    'api::tag.tag',
    { slug },
    { name: tagName, slug },
    { created: 'tagsCreated', updated: 'tagsUpdated' },
    undefined,
    'published',
  );

  cache.set(slug, tag);
  return tag;
};

const deleteDocumentOrEntity = async (strapi: any, uid: string, entity: AnyRecord) => {
  if (entity?.documentId) {
    await strapi.documents(uid).delete({ documentId: entity.documentId });
    return;
  }
  if (entity?.id) {
    await strapi.db.query(uid).delete({ where: { id: entity.id } });
  }
};

const replaceImportedCategory = async (strapi: any, report: ImportReport, records: AnyRecord[]) => {
  const categoryValues = new Set(
    records
      .filter((record) => record.Type === 'variable' || record.Type === 'simple')
      .map((record) => categoryPresetFor(record['Strapi category'] || record.Categories).slug),
  );

  for (const categorySlug of categoryValues) {
    const products = await strapi.db.query('api::product.product').findMany({
      where: { category: { slug: categorySlug } },
      populate: { variants: true },
    });

    for (const product of products) {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      for (const variant of variants) {
        await deleteDocumentOrEntity(strapi, 'api::variant.variant', variant);
        report.variantsDeleted += 1;
      }
      await deleteDocumentOrEntity(strapi, 'api::product.product', product);
      report.productsDeleted += 1;
    }
  }
};

const enrichFromParentAttrs = (parent: AnyRecord) => {
  if (parent.AvailableColors || parent.AvailableSizes || parent.AvailableFormats) {
    return {
      colors: parent.AvailableColors ?? listToJson(splitList(parent['Attribute 2 value(s)'])),
      sizes: parent.AvailableSizes ?? listToJson(splitList(parent['Attribute 3 value(s)'])),
      formats: parent.AvailableFormats ?? listToJson(splitList(parent['Attribute 1 value(s)'])),
    };
  }

  // Enrichi sans colonnes Available* : classer attr 1/2/3
  const buckets = { format: [] as string[], color: [] as string[], size: [] as string[] };
  for (let i = 1; i <= 3; i += 1) {
    const kind = classifyAttr(String(parent[`Attribute ${i} name`] ?? ''));
    const values = splitList(parent[`Attribute ${i} value(s)`]);
    if (kind === 'color') buckets.color = values;
    else if (kind === 'size') buckets.size = values;
    else if (kind === 'format') buckets.format = values;
    else if (i === 1) buckets.format = values;
    else if (i === 2) buckets.color = values;
    else buckets.size = values;
  }

  return {
    colors: listToJson(buckets.color),
    sizes: listToJson(buckets.size),
    formats: listToJson(buckets.format),
  };
};

export const importModeCsv = async (strapi: any, csvContent: string, options: ImportOptions = {}) => {
  const report = createReport(Boolean(options.dryRun));
  const importImages = options.importImages === true;
  const rows = parseCsv(csvContent);
  let records = rowsToRecords(rows);
  const sourceFormat = detectSourceFormat(records);
  report.sourceFormat = sourceFormat;

  if (sourceFormat === 'woo') {
    records = normalizeWooToEnrichi(records, { expandMatrix: options.expandMatrix });
    report.errors.push({
      scope: 'format',
      message: options.expandMatrix
        ? 'CSV Woo détecté : import avec matrice type × couleur × taille.'
        : 'CSV Woo détecté : variantes = types (prix), couleurs/tailles stockées sur le produit.',
    });
  }

  const parents = records.filter(
    (record) => String(record.Type).toLowerCase() === 'variable' || String(record.Type).toLowerCase() === 'simple',
  );
  const variations = records.filter((record) => String(record.Type).toLowerCase() === 'variation');
  const variationsByParent = new Map<string, AnyRecord[]>();
  const tagCache = new Map<string, AnyRecord>();
  const categoryCache = new Map<string, AnyRecord>();
  const imageCache = new Map<string, number>();

  report.totalRows = records.length;
  report.productsFound = parents.length;
  report.variantsFound = variations.length;

  if (records.length === 0) {
    report.errors.push({ scope: 'csv', message: 'Le fichier CSV est vide.' });
    return report;
  }

  if (parents.length === 0) {
    report.errors.push({
      scope: 'csv',
      message: 'Aucun produit Type=variable trouvé. Utilise l’export Woo ou le CSV enrichi Fulani.',
    });
    return report;
  }

  if (options.replaceCategory) {
    if (report.dryRun) {
      report.errors.push({
        scope: 'replaceCategory',
        message: 'Mode remplacement détecté en test à blanc : aucune suppression effectuée.',
      });
    } else {
      await replaceImportedCategory(strapi, report, records);
    }
  }

  for (const variation of variations) {
    const list = variationsByParent.get(variation.Parent) ?? [];
    list.push(variation);
    variationsByParent.set(variation.Parent, list);
  }

  for (const parent of parents) {
    try {
      const category = await ensureCategory(strapi, report, categoryCache, parent['Strapi category'] || parent.Categories);
      const productVariations = variationsByParent.get(parent.SKU) ?? [];
      const prices = productVariations.map((v) => parsePrice(v['Regular price'])).filter((p) => p > 0);
      const productPrice = prices.length > 0 ? Math.min(...prices) : parsePrice(parent['Regular price']);
      const imageUrl = firstImageUrl(parent.Images);
      const imageId =
        importImages && imageUrl
          ? await uploadImage(strapi, report, imageCache, imageUrl, parent['Image alt text'] || parent.Name)
          : null;

      const tags = [];
      for (const tagName of String(parent.Tags ?? '')
        .split('|')
        .map((tag) => tag.trim())
        .filter(Boolean)) {
        tags.push(relationId(await ensureTag(strapi, report, tagCache, tagName)));
      }

      const { colors, sizes, formats } = enrichFromParentAttrs(parent);

      const product = await upsert(
        strapi,
        report,
        'api::product.product',
        { slug: parent.Slug },
        {
          name: parent.Name,
          slug: parent.Slug,
          shortDescription: parent['Short description'],
          description: parent.Description || parent['Short description'] || parent.Name,
          price: productPrice,
          compareAtPrice: parsePrice(parent['Compare at price']) || null,
          rating: 0,
          reviews: 0,
          metaTitle: parent['Meta title'],
          metaDescription: parent['Meta description'],
          canonicalPath: `/produits/${parent.Slug}`,
          sourceUrl: parent.Link || null,
          imageUrl,
          imageAlt: parent['Image alt text'] || parent.Name,
          galleryUrls: galleryUrlsJson(parent['Gallery images'] || parent.Images),
          availableColors: colors,
          availableSizes: sizes,
          availableFormats: formats,
          ...(imageId ? { image: imageId, gallery: [imageId] } : {}),
          category: relationId(category),
          tags,
        },
        { created: 'productsCreated', updated: 'productsUpdated' },
        undefined,
        statusFor(parent.Status),
      );

      const variantsToImport =
        productVariations.length > 0
          ? productVariations
          : [
              {
                Name: `${parent.Name} - Standard`,
                SKU: `${parent.SKU}-standard`,
                'Attribute 1 value(s)': parent['Attribute 1 default'] || 'Standard',
                'Regular price': parent['Regular price'],
                Stock: parent.Stock,
                Status: parent.Status,
                Images: parent.Images,
              },
            ];

      const defaultFormat = String(parent['Attribute 1 default'] ?? '').trim();

      for (const [index, variation] of variantsToImport.entries()) {
        const format = String(variation['Attribute 1 value(s)'] ?? '').trim() || 'Standard';
        const colorName = String(variation['Attribute 2 value(s)'] ?? '').trim() || null;
        const size = String(variation['Attribute 3 value(s)'] ?? '').trim() || null;
        const label = [format, colorName, size].filter(Boolean).join(' / ');

        await upsert(
          strapi,
          report,
          'api::variant.variant',
          { sku: variation.SKU },
          {
            name: variation.Name,
            sku: variation.SKU,
            format,
            label,
            colorName,
            size,
            price: parsePrice(variation['Regular price']),
            compareAtPrice: parsePrice(variation['Compare at price']) || null,
            stock: parsePrice(variation.Stock) || 0,
            lowStockThreshold: 5,
            isDefault: format === defaultFormat || (index === 0 && !defaultFormat),
            isActive: true,
            position: variation._position ?? index,
            imageUrl: firstImageUrl(variation.Images),
            product: relationId(product),
          },
          { created: 'variantsCreated', updated: 'variantsUpdated' },
          undefined,
          statusFor(variation.Status),
        );
      }
    } catch (error: any) {
      report.errors.push({ scope: parent.SKU || parent.Name, message: error.message });
    }
  }

  return report;
};
