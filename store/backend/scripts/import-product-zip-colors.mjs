import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

import pool from '../src/db.js';
import { getUploadSubdir } from '../src/utils/app-paths.js';
import { getManagedUploadUrl } from '../src/utils/public-paths.js';
import {
  ensureProductVariantSchema,
  normalizeVariantOptions,
  parseProductVariantOptions
} from '../src/utils/product-variants.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');

const DEFAULT_EXCEL = '/home/haytham/.codex/attachments/1472a5d4-2688-48af-bb4c-13df2ef691f0/store IT 26.xlsx';
const DEFAULT_ZIP = '/home/haytham/.codex/attachments/b6d9de17-1777-4348-8d4c-fcd1a6110897/Archive.zip';

const excelPath = process.argv[2] || DEFAULT_EXCEL;
const zipPath = process.argv[3] || DEFAULT_ZIP;

const fixedColors = [
  { code: '0', name: 'Chrome', hex: '#D7DCE0' },
  { code: '1', name: 'Brushed Nickel', hex: '#B8B1A4' },
  { code: '2', name: 'Brushed Rose Gold', hex: '#B76E79' },
  { code: '3', name: 'Brushed Gold', hex: '#C8A24A' },
  { code: '4', name: 'Gunmetal Gray', hex: '#4B5563' },
  { code: '5', name: 'Matte Black', hex: '#111111' }
];

function clean(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function boolFromArabic(value, fallback = false) {
  const text = clean(value).toLowerCase();
  if (!text) return fallback ? 1 : 0;
  if (['نعم', 'yes', 'true', '1', 'متوفر'].includes(text)) return 1;
  if (['لا', 'no', 'false', '0', 'غير متوفر'].includes(text)) return 0;
  return fallback ? 1 : 0;
}

function safeFilePart(value) {
  return clean(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
}

function getRowValue(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return '';
}

function readWorkbookRows(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function readZipImages(filePath) {
  const zip = new AdmZip(filePath);
  const imagesByProduct = new Map();
  const warnings = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName.replace(/\\/g, '/');
    if (entryName.includes('__MACOSX') || entryName.endsWith('.DS_Store')) continue;

    const parts = entryName.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const folderId = parts[parts.length - 2];
    const fileName = parts[parts.length - 1];
    const match = fileName.match(/^(\d+)\.(jpe?g|png|webp)$/i);
    if (!/^\d+$/.test(folderId) || !match) continue;

    const colorCode = match[1];
    const ext = match[2].toLowerCase().replace('jpeg', 'jpg');
    if (!imagesByProduct.has(folderId)) imagesByProduct.set(folderId, []);
    imagesByProduct.get(folderId).push({
      colorCode,
      ext,
      entry,
      entryName
    });
  }

  for (const [folderId, items] of imagesByProduct.entries()) {
    for (const item of items) {
      if (item.colorCode !== '0' && !fixedColors.some((color) => color.code === item.colorCode)) {
        warnings.push(`Folder ${folderId}: ignored unknown color image ${path.basename(item.entryName)}`);
      }
    }
  }

  return { imagesByProduct, warnings };
}

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_global_settings (
      setting_key VARCHAR(120) PRIMARY KEY,
      setting_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureFixedColorsInSettings() {
  await ensureSettingsTable();
  const [rows] = await pool.query(
    'SELECT setting_value FROM admin_global_settings WHERE setting_key = ? LIMIT 1',
    ['product_color_options']
  );
  let existing = [];
  try {
    existing = rows[0]?.setting_value ? JSON.parse(rows[0].setting_value) : [];
  } catch {
    existing = [];
  }

  const next = Array.isArray(existing) ? [...existing] : [];
  for (const color of fixedColors) {
    const found = next.find((item) => clean(item?.name).toLowerCase() === color.name.toLowerCase());
    if (found) {
      found.hex = found.hex || color.hex;
      continue;
    }
    next.push({
      id: `fixed-${color.code}`,
      name: color.name,
      hex: color.hex
    });
  }

  await pool.query(
    `INSERT INTO admin_global_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    ['product_color_options', JSON.stringify(next)]
  );
}

async function ensureCategory(name) {
  const category = clean(name);
  if (!category) return null;
  const [existing] = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category]);
  if (existing.length) return existing[0].id;
  await pool.query('INSERT INTO categories (name, sort_order, is_hidden) VALUES (?, 0, 0)', [category]);
  return null;
}

function buildProductData(row) {
  const excelId = clean(getRowValue(row, ['المنتج', 'المعرف', 'ID', 'id']));
  const name = clean(getRowValue(row, ['اسم المنتج', 'name', 'Name']));
  const category = clean(getRowValue(row, ['الفئة', 'الفئات', 'category', 'categories']));
  const price = numberOrNull(getRowValue(row, ['البيع', 'سعر البيع', 'price']));
  const purchasePrice = numberOrNull(getRowValue(row, ['الشراء', 'سعر الشراء', 'purchase_price']));

  return {
    excelId,
    name,
    description: clean(getRowValue(row, ['وصف المنتج', 'الوصف', 'description'])),
    technical_data: clean(getRowValue(row, ['بيانات فنية', 'technical_data'])),
    usage: clean(getRowValue(row, ['تعليمات الاستخدام', 'usage'])),
    warnings: clean(getRowValue(row, ['تحذيرات', 'warnings'])),
    category,
    categories: category ? [category] : [],
    price,
    purchase_price: purchasePrice,
    is_available: boolFromArabic(getRowValue(row, ['متوفر', 'is_available']), true),
    is_hidden: boolFromArabic(getRowValue(row, ['مخفي', 'is_hidden']), false)
  };
}

function mergeColorVariants(existingVariants, zipImages, productData, savedImages) {
  const next = parseProductVariantOptions(existingVariants);
  let variantImages = 0;
  let baseImageUrl = null;
  const warnings = [];

  for (const image of zipImages) {
    const color = fixedColors.find((item) => item.code === image.colorCode);
    if (image.colorCode === '0') {
      baseImageUrl = savedImages.get(image.entryName) || null;
      continue;
    }
    if (!color) {
      warnings.push(`Product ${productData.excelId}: ignored unknown color image ${path.basename(image.entryName)}`);
      continue;
    }

    const imageUrl = savedImages.get(image.entryName);
    if (!imageUrl) continue;

    const existingIndex = next.findIndex((variant) => {
      return !clean(variant.size_name)
        && clean(variant.color_name).toLowerCase() === color.name.toLowerCase();
    });

    const previous = existingIndex >= 0 ? next[existingIndex] : {};
    const merged = {
      ...previous,
      id: previous.id || `color-${color.code}`,
      color_name: color.name,
      color_hex: color.hex,
      size_name: null,
      price: previous.price ?? productData.price,
      purchase_price: previous.purchase_price ?? productData.purchase_price,
      image_url: imageUrl,
      image_urls: [imageUrl]
    };

    if (existingIndex >= 0) next[existingIndex] = merged;
    else next.push(merged);
    variantImages += 1;
  }

  return {
    baseImageUrl,
    variantImages,
    variants: normalizeVariantOptions(next),
    warnings
  };
}

async function saveZipImages(productData, zipImages) {
  const uploadDir = getUploadSubdir('excel');
  fs.mkdirSync(uploadDir, { recursive: true });
  const saved = new Map();

  for (const image of zipImages) {
    const fileName = `${safeFilePart(productData.excelId)}-${Date.now()}-${image.colorCode}.${image.ext}`;
    const target = path.join(uploadDir, fileName);
    fs.writeFileSync(target, image.entry.getData());
    saved.set(image.entryName, getManagedUploadUrl('excel', fileName));
  }

  return saved;
}

async function findProduct(productData) {
  const [byName] = await pool.query('SELECT * FROM products WHERE name = ? LIMIT 1', [productData.name]);
  if (byName.length) return { product: byName[0], match: 'name' };

  const numericId = Number(productData.excelId);
  if (Number.isInteger(numericId) && numericId > 0) {
    const [byId] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [numericId]);
    if (byId.length && clean(byId[0].name) === productData.name) {
      return { product: byId[0], match: 'id' };
    }
  }

  return { product: null, match: 'new' };
}

async function updateProduct(product, productData, imageData) {
  const updates = [
    'description = ?',
    '`usage` = ?',
    'technical_data = ?',
    'warnings = ?',
    'price = ?',
    'purchase_price = ?',
    'category = ?',
    'categories = ?',
    'is_available = ?',
    'is_hidden = ?',
    'variant_options = ?'
  ];
  const values = [
    productData.description,
    productData.usage,
    productData.technical_data,
    productData.warnings,
    productData.price ?? product.price,
    productData.purchase_price ?? product.purchase_price,
    productData.category || product.category,
    productData.categories.length ? JSON.stringify(productData.categories) : product.categories,
    productData.is_available,
    productData.is_hidden,
    JSON.stringify(imageData.variants)
  ];

  if (imageData.baseImageUrl) {
    updates.push('image_url = ?', 'image_urls = ?');
    values.push(imageData.baseImageUrl, JSON.stringify([imageData.baseImageUrl]));
  }

  values.push(product.id);
  await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
}

async function createProduct(productData, imageData) {
  const [result] = await pool.query(
    `INSERT INTO products
      (name, description, \`usage\`, technical_data, warnings, price, purchase_price,
       category, categories, color_options, variant_options, image_url, image_urls,
       is_available, is_hidden, show_on_home)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0)`,
    [
      productData.name,
      productData.description,
      productData.usage,
      productData.technical_data,
      productData.warnings,
      productData.price ?? 0,
      productData.purchase_price ?? 0,
      productData.category || null,
      productData.categories.length ? JSON.stringify(productData.categories) : null,
      imageData.variants.length ? JSON.stringify(imageData.variants) : null,
      imageData.baseImageUrl,
      imageData.baseImageUrl ? JSON.stringify([imageData.baseImageUrl]) : null,
      productData.is_available,
      productData.is_hidden
    ]
  );
  return result.insertId;
}

async function main() {
  if (!fs.existsSync(excelPath)) throw new Error(`Excel file not found: ${excelPath}`);
  if (!fs.existsSync(zipPath)) throw new Error(`ZIP file not found: ${zipPath}`);

  await ensureProductVariantSchema();
  await ensureFixedColorsInSettings();

  const rows = readWorkbookRows(excelPath);
  const { imagesByProduct, warnings: zipWarnings } = readZipImages(zipPath);
  const summary = {
    rows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    baseImages: 0,
    variantImages: 0,
    warnings: [...zipWarnings]
  };

  for (const row of rows) {
    const productData = buildProductData(row);
    if (!productData.excelId || !productData.name || productData.price === null) {
      summary.skipped += 1;
      summary.warnings.push(`Skipped row: missing product id, name, or sale price (${productData.name || 'no name'})`);
      continue;
    }

    await ensureCategory(productData.category);
    const zipImages = imagesByProduct.get(productData.excelId) || [];
    const savedImages = await saveZipImages(productData, zipImages);
    const { product, match } = await findProduct(productData);
    const imageData = mergeColorVariants(
      product?.variant_options || [],
      zipImages,
      productData,
      savedImages
    );
    summary.warnings.push(...imageData.warnings);
    if (imageData.baseImageUrl) summary.baseImages += 1;
    summary.variantImages += imageData.variantImages;

    if (product) {
      await updateProduct(product, productData, imageData);
      summary.updated += 1;
      console.log(`UPDATED ${product.id} (${match}): ${productData.name}`);
    } else {
      const newId = await createProduct(productData, imageData);
      summary.created += 1;
      console.log(`CREATED ${newId}: ${productData.name}`);
    }
  }

  console.log('IMPORT_SUMMARY', JSON.stringify(summary, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
