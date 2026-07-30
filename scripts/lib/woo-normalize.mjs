/** Normalisation export WooCommerce FR → lignes enrichies Fulani Mode. */

const getField = (record, ...candidates) => {
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

const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const slugify = (value) =>
  stripAccents(String(value ?? '').toLowerCase())
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const parsePrice = (value) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstImageUrl = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.split(',')[0].trim() || '';
};

const splitList = (value) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const listToJson = (values) => (values.length ? JSON.stringify(values) : '');

const attrName = (record, index) =>
  getField(record, `Nom de l'attribut ${index}`, `Nom de l’attribut ${index}`, `Attribute ${index} name`).trim();

const attrValues = (record, index) =>
  getField(
    record,
    `Valeur(s) de l'attribut ${index}`,
    `Valeur(s) de l’attribut ${index}`,
    `Valeur(s) de l'attribut ${index} `,
    `Valeur(s) de l’attribut ${index} `,
    `Attribute ${index} value(s)`,
  ).trim();

const classifyAttr = (name) => {
  const n = stripAccents(name).toLowerCase();
  if (/couleur|color|colour/.test(n)) return 'color';
  if (/taille|size/.test(n)) return 'size';
  if (/type|format|modele|modèle/.test(n)) return 'format';
  return 'other';
};

const parseParentId = (parent) => {
  const match = String(parent ?? '').match(/id:(\d+)/i);
  return match ? match[1] : '';
};

const stripHtml = (html) =>
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (text, max) => {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
};

export const normalizeWooToEnrichi = (records, options = {}) => {
  const CATEGORY = 'MODE';
  const TAGS = 'mode|fulani';
  const DEFAULT_STOCK = 10;
  const expandMatrix = Boolean(options.expandMatrix);

  const parents = records.filter((r) => getField(r, 'Type').toLowerCase() === 'variable');
  const variations = records.filter((r) => getField(r, 'Type').toLowerCase() === 'variation');

  const idToSku = new Map();
  const usedSlugs = new Set();
  const usedSkus = new Set();

  const uniqueSku = (base) => {
    let sku = base;
    let n = 2;
    while (usedSkus.has(sku)) {
      sku = `${base}-${n}`;
      n += 1;
    }
    usedSkus.add(sku);
    return sku;
  };

  const uniqueSlug = (base) => {
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

  const out = [];

  for (const parent of parents) {
    const wooId = getField(parent, 'ID');
    const name = getField(parent, 'Nom', 'Name').trim() || `Produit-${wooId}`;
    const sku = idToSku.get(wooId);
    const slug = uniqueSlug(slugify(name));
    const shortDescription = getField(parent, 'Description courte', 'Short description');
    const description = getField(parent, 'Description') || shortDescription || name;
    const images = getField(parent, 'Images');
    const published = getField(parent, 'Publié', 'Published') === '1';

    const attrs = [];
    for (let i = 1; i <= 3; i += 1) {
      const nameAttr = attrName(parent, i);
      const values = splitList(attrValues(parent, i));
      if (!nameAttr && values.length === 0) continue;
      attrs.push({
        kind: classifyAttr(nameAttr || (i === 1 ? 'type' : i === 2 ? 'couleur' : 'taille')),
        values,
      });
    }

    const formats = attrs.find((a) => a.kind === 'format')?.values ?? [];
    const colors = attrs.find((a) => a.kind === 'color')?.values ?? [];
    const sizes = attrs.find((a) => a.kind === 'size')?.values ?? [];
    const childVars = variations.filter((v) => parseParentId(getField(v, 'Parent')) === wooId);

    const priceByFormat = new Map();
    for (const variation of childVars) {
      const formatValue = attrValues(variation, 1) || 'Standard';
      const price = parsePrice(getField(variation, 'Tarif régulier', 'Regular price'));
      if (price > 0) priceByFormat.set(formatValue, price);
    }

    const formatList =
      formats.length > 0
        ? formats
        : [...new Set(childVars.map((v) => attrValues(v, 1)).filter(Boolean))].length > 0
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
      Images: firstImageUrl(images),
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
            out.push({
              Name: `${name} - ${label}`,
              SKU: uniqueSku(`${sku}-${slugify(parts.join('-')) || 'var'}`),
              Type: 'variation',
              Categories: '',
              'Regular price': String(price || ''),
              Images: firstImageUrl(images),
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
              AvailableColors: '',
              AvailableSizes: '',
              AvailableFormats: '',
            });
            position += 1;
          }
        }
      }
    } else {
      for (const [index, format] of formatList.entries()) {
        const matching = childVars.find((v) => attrValues(v, 1) === format) ?? childVars[index];
        const price = priceByFormat.get(format) ?? parsePrice(getField(matching ?? {}, 'Tarif régulier', 'Regular price'));
        const varImages = matching ? getField(matching, 'Images') : '';
        out.push({
          Name: `${name} - ${format}`,
          SKU: uniqueSku(`${sku}-${slugify(format) || 'var'}`),
          Type: 'variation',
          Categories: '',
          'Regular price': String(price || ''),
          Images: firstImageUrl(varImages) || firstImageUrl(images),
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
          AvailableColors: '',
          AvailableSizes: '',
          AvailableFormats: '',
        });
      }
    }
  }

  return out;
};
