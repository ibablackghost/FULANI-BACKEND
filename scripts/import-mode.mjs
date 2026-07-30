import fs from 'node:fs';
import path from 'node:path';

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337';
const TOKEN = process.env.STRAPI_IMPORT_TOKEN;
const CSV_PATH = path.resolve(process.env.MODE_CSV_PATH ?? './produits_mode_enrichi.csv');
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

if (!TOKEN && !DRY_RUN) {
  console.error('STRAPI_IMPORT_TOKEN est obligatoire pour importer dans Strapi.');
  process.exit(1);
}

const parseCsv = (text) => {
  const rows = [];
  let row = [];
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

  return rows;
};

const rowsToRecords = (rows) => {
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const api = async (apiPath, options = {}) => {
  if (DRY_RUN && options.method && options.method !== 'GET') {
    return { data: { documentId: `dry_${Date.now()}`, id: Date.now() } };
  }

  const response = await fetch(`${STRAPI_URL}${apiPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${apiPath} -> ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
};

const relationId = (entity) => entity?.documentId ?? entity?.id;

const firstData = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data[0] ?? null;
  return payload?.data ?? null;
};

const findOne = async (collection, field, value) => {
  const payload = await api(
    `/api/${collection}?filters[${field}][$eq]=${encodeURIComponent(value)}&pagination[pageSize]=1`,
  );
  return firstData(payload);
};

const createOrUpdate = async (collection, field, value, data) => {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] ${collection}: ${value}`);
    return {
      id: `${collection}_${value}`,
      documentId: `${collection}_${value}`,
      ...data,
    };
  }

  const existing = await findOne(collection, field, value);
  if (existing) {
    const id = existing.documentId ?? existing.id;
    console.log(`MAJ ${collection}: ${value}`);
    return firstData(
      await api(`/api/${collection}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ data }),
      }),
    );
  }

  console.log(`Creation ${collection}: ${value}`);
  return firstData(
    await api(`/api/${collection}`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
  );
};

const parsePrice = (value) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const publishedAtFor = (status) =>
  String(status).toLowerCase() === 'published' ? new Date().toISOString() : null;

const firstImageUrl = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return raw.split(',')[0].trim() || null;
};

const galleryUrlsJson = (value) => {
  const urls = String(value ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length > 0 ? JSON.stringify(urls) : null;
};

const slugify = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`CSV introuvable: ${CSV_PATH}`);
  process.exit(1);
}

const csvRows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8')).filter((row) =>
  row.some((value) => String(value).trim()),
);
const records = rowsToRecords(csvRows);
const parents = records.filter((record) => String(record.Type).toLowerCase() === 'variable');
const variations = records.filter((record) => String(record.Type).toLowerCase() === 'variation');
const variationsByParent = new Map();

for (const variation of variations) {
  const list = variationsByParent.get(variation.Parent) ?? [];
  list.push(variation);
  variationsByParent.set(variation.Parent, list);
}

console.log(`Import mode Fulani: ${parents.length} produits, ${variations.length} variations.`);
console.log(`CSV: ${CSV_PATH}`);
if (DRY_RUN) console.log('Mode DRY_RUN actif: aucune ecriture reelle.');

const category = await createOrUpdate('categories', 'slug', 'mode', {
  name: 'Mode',
  slug: 'mode',
  description: 'Catalogue mode Fulani Official',
  metaTitle: 'Mode | Fulani',
  metaDescription: 'Découvrez les tenues traditionnelles revisitées Fulani Official.',
  canonicalPath: '/collections/mode',
  publishedAt: new Date().toISOString(),
});

const tagCache = new Map();
const ensureTag = async (tagName) => {
  const slug = slugify(tagName);
  if (tagCache.has(slug)) return tagCache.get(slug);

  const tag = await createOrUpdate('tags', 'slug', slug, {
    name: tagName,
    slug,
    publishedAt: new Date().toISOString(),
  });
  tagCache.set(slug, tag);
  return tag;
};

for (const parent of parents) {
  const productVariations = variationsByParent.get(parent.SKU) ?? [];
  const prices = productVariations
    .map((variation) => parsePrice(variation['Regular price']))
    .filter((price) => price > 0);
  const productPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const imageUrl = firstImageUrl(parent.Images);
  const tags = [];

  for (const tagName of String(parent.Tags ?? '')
    .split('|')
    .map((tag) => tag.trim())
    .filter(Boolean)) {
    tags.push(relationId(await ensureTag(tagName)));
  }

  const product = await createOrUpdate('products', 'slug', parent.Slug, {
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
    category: relationId(category),
    tags,
    publishedAt: publishedAtFor(parent.Status),
  });

  for (const [index, variation] of productVariations.entries()) {
    const format = String(variation['Attribute 1 value(s)'] ?? '').trim() || 'Standard';
    const price = parsePrice(variation['Regular price']);
    const defaultFormat = String(parent['Attribute 1 default'] ?? '').trim();

    await createOrUpdate('variants', 'sku', variation.SKU, {
      name: variation.Name,
      sku: variation.SKU,
      format,
      label: format,
      size: String(variation['Attribute 3 value(s)'] ?? '').trim() || null,
      colorName: String(variation['Attribute 2 value(s)'] ?? '').trim() || null,
      price,
      compareAtPrice: parsePrice(variation['Compare at price']) || null,
      stock: parsePrice(variation.Stock) || 0,
      lowStockThreshold: 5,
      isDefault: format === defaultFormat || (index === 0 && !defaultFormat),
      isActive: true,
      position: index,
      imageUrl: firstImageUrl(variation.Images),
      product: relationId(product),
      publishedAt: publishedAtFor(variation.Status),
    });
  }
}

console.log('Import mode Fulani termine.');
