import pool from '../db.js';
import { normalizeColorOptions, parseProductColorOptions } from './product-colors.js';

const schemaState = { ready: false, promise: null };

function normalizeHex(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.startsWith('#') ? text : `#${text}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : '';
}

function normalizePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : NaN;
}

function normalizeImageUrls(value) {
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  return source
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

export function normalizeVariantOptions(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const cleaned = [];

  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const colorName = String(entry.color_name || entry.colorName || entry.color || entry.name || '').trim();
    const colorHex = normalizeHex(entry.color_hex || entry.colorHex || entry.hex || '');
    const sizeName = String(entry.size_name || entry.sizeName || entry.size || entry.measurement || '').trim();
    const price = normalizePrice(entry.price);
    const purchasePrice = normalizePrice(entry.purchase_price ?? entry.purchasePrice);
    const imageUrls = normalizeImageUrls(entry.image_urls || entry.imageUrls || entry.images || entry.image_url || entry.imageUrl);
    if (!colorName && !sizeName) continue;
    if (colorName && !colorHex) continue;
    if (Number.isNaN(price) || Number.isNaN(purchasePrice)) continue;

    const key = `${colorName.toLowerCase()}::${colorHex}::${sizeName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cleaned.push({
      id: String(entry.id || `variant-${cleaned.length + 1}`),
      color_name: colorName || null,
      color_hex: colorName ? colorHex : null,
      size_name: sizeName || null,
      price,
      purchase_price: purchasePrice,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls.length ? imageUrls : null
    });
  }

  return cleaned;
}

export function parseProductVariantOptions(value) {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeVariantOptions(value);
  if (typeof value === 'string') {
    try {
      return normalizeVariantOptions(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

export function buildLegacyVariantsFromColors(colorOptions) {
  return normalizeColorOptions(colorOptions).map((color, index) => ({
    id: `color-${index + 1}`,
    color_name: color.name,
    color_hex: color.hex,
    size_name: null,
    price: null,
    purchase_price: null,
    image_url: null,
    image_urls: null
  }));
}

export function getProductVariants(product) {
  const variants = parseProductVariantOptions(product?.variant_options);
  if (variants.length > 0) return variants;
  return buildLegacyVariantsFromColors(parseProductColorOptions(product?.color_options));
}

function normalizeSelectedVariantInput(input) {
  return {
    variantId: String(input?.selectedVariantId || input?.variant_id || input?.variantId || '').trim(),
    colorName: String(input?.selectedColorName || input?.color_name || input?.selectedColor?.name || '').trim(),
    colorHex: normalizeHex(input?.selectedColorHex || input?.color_hex || input?.selectedColor?.hex || ''),
    sizeName: String(input?.selectedSizeName || input?.size_name || input?.sizeName || input?.selectedSize?.name || '').trim()
  };
}

export function resolveSelectedVariant(product, input) {
  const variants = getProductVariants(product);
  if (variants.length === 0) {
    return { ok: true, variant: null };
  }

  const selected = normalizeSelectedVariantInput(input);
  if (!selected.variantId && !selected.colorName && !selected.colorHex && !selected.sizeName) {
    return { ok: false, error: 'Variant selection is required' };
  }

  const match = variants.find((variant) => {
    if (selected.variantId && String(variant.id) === selected.variantId) return true;
    const colorMatches = variant.color_name
      ? ((selected.colorName && String(variant.color_name).toLowerCase() === selected.colorName.toLowerCase()) || (selected.colorHex && variant.color_hex === selected.colorHex))
      : !selected.colorName && !selected.colorHex;
    const sizeMatches = variant.size_name
      ? selected.sizeName && String(variant.size_name).toLowerCase() === selected.sizeName.toLowerCase()
      : !selected.sizeName;
    return colorMatches && sizeMatches;
  });

  if (!match) {
    return { ok: false, error: 'Selected product option is invalid' };
  }

  return { ok: true, variant: match };
}

export async function ensureProductVariantSchema() {
  if (schemaState.ready) return;
  if (schemaState.promise) return schemaState.promise;

  schemaState.promise = (async () => {
    try {
      await pool.query('ALTER TABLE products ADD COLUMN variant_options JSON NULL AFTER color_options');
    } catch {
      // column already exists
    }

    try {
      await pool.query('ALTER TABLE order_items ADD COLUMN variant_id VARCHAR(120) NULL AFTER color_hex');
    } catch {
      // column already exists
    }

    try {
      await pool.query('ALTER TABLE order_items ADD COLUMN size_name VARCHAR(255) NULL AFTER variant_id');
    } catch {
      // column already exists
    }

    schemaState.ready = true;
    schemaState.promise = null;
  })().catch((error) => {
    schemaState.promise = null;
    throw error;
  });

  return schemaState.promise;
}
