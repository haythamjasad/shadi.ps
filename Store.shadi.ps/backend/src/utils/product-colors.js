import pool from '../db.js';

const schemaState = {
  ready: false
};

function normalizeHex(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.startsWith('#') ? text : `#${text}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : '';
}

export function normalizeColorOptions(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const cleaned = [];

  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const name = String(entry.name || '').trim();
    const hex = normalizeHex(entry.hex);
    if (!name || !hex) continue;
    const key = `${name.toLowerCase()}::${hex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ name, hex });
  }

  return cleaned;
}

export function parseProductColorOptions(value) {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeColorOptions(value);
  if (typeof value === 'string') {
    try {
      return normalizeColorOptions(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

export async function ensureProductColorSchema() {
  if (schemaState.ready) return;

  try {
    await pool.query('ALTER TABLE products ADD COLUMN color_options JSON NULL AFTER categories');
  } catch {
    // column already exists
  }

  schemaState.ready = true;
}

export function resolveSelectedColor(colorOptions, input) {
  const options = normalizeColorOptions(colorOptions);
  if (options.length === 0) return { ok: true, color: null };

  const rawName = String(input?.selectedColorName || input?.color_name || input?.name || input?.selectedColor?.name || '').trim();
  const rawHex = normalizeHex(input?.selectedColorHex || input?.color_hex || input?.hex || input?.selectedColor?.hex || '');

  if (!rawName && !rawHex) {
    return { ok: false, error: 'Color selection is required' };
  }

  const match = options.find((option) => {
    if (rawName && option.name.toLowerCase() === rawName.toLowerCase()) return true;
    if (rawHex && option.hex === rawHex) return true;
    return false;
  });

  if (!match) {
    return { ok: false, error: 'Selected color is invalid' };
  }

  return { ok: true, color: match };
}
