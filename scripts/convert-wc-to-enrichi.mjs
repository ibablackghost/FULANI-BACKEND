/**
 * Convertit l’export WooCommerce FR Fulani → CSV enrichi (couleurs & tailles).
 *
 *   node scripts/convert-wc-to-enrichi.mjs
 *   node scripts/convert-wc-to-enrichi.mjs --expand-matrix
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWooToEnrichi } from './lib/woo-normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const INPUT = path.resolve(root, arg('in', 'wc-product-export-29-7-2026-1785333248464.csv'));
const OUTPUT = path.resolve(root, arg('out', 'produits_mode_enrichi.csv'));
const EXPAND = process.argv.includes('--expand-matrix');

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        value += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else value += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === ',') {
      row.push(value);
      value = '';
      continue;
    }
    if (c === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }
    if (c !== '\r') value += c;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => String(x).trim()));
};

const rowsToRecords = (rows) => {
  const headers = rows[0].map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
};

const csvEscape = (value) => {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const HEADERS = [
  'Name',
  'SKU',
  'Type',
  'Categories',
  'Regular price',
  'Short description',
  'Description',
  'Images',
  'Link',
  'Parent',
  'Attribute 1 name',
  'Attribute 1 value(s)',
  'Attribute 1 visible',
  'Attribute 1 global',
  'Attribute 1 default',
  'Attribute 2 name',
  'Attribute 2 value(s)',
  'Attribute 3 name',
  'Attribute 3 value(s)',
  'Strapi category',
  'Stock',
  'Slug',
  'Meta title',
  'Meta description',
  'Status',
  'Compare at price',
  'Tags',
  'Image alt text',
  'Gallery images',
  'AvailableColors',
  'AvailableSizes',
  'AvailableFormats',
];

const records = rowsToRecords(parseCsv(fs.readFileSync(INPUT, 'utf8')));
const outRows = normalizeWooToEnrichi(records, { expandMatrix: EXPAND });

const csv = [HEADERS.join(','), ...outRows.map((row) => HEADERS.map((h) => csvEscape(row[h])).join(','))].join('\n');
fs.writeFileSync(OUTPUT, `\uFEFF${csv}\n`, 'utf8');

const parents = outRows.filter((r) => r.Type === 'variable').length;
const vars = outRows.filter((r) => r.Type === 'variation').length;
const sample = outRows.find((r) => r.Type === 'variable');

console.log(`OK → ${OUTPUT}`);
console.log(`Parents: ${parents} | Variations: ${vars} | expandMatrix=${EXPAND}`);
console.log(`Exemple ${sample?.Name}: formats=${sample?.AvailableFormats} colors=${sample?.AvailableColors} sizes=${sample?.AvailableSizes}`);
