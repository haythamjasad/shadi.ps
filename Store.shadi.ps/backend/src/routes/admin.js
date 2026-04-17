import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { requireAdmin, requireAnyPermission, requirePermission } from '../middleware/auth.js';
import { config } from '../config/env.js';
import {
  buildCustomerEmailContent,
  buildInternalEmailContent,
  getSmtpSettings,
  renderCustomerEmail,
  renderInternalEmail,
  sendOrderEmail,
  sendInternalOrderEmail
} from '../utils/mailer.js';
import {
  listSmtpSettings,
  getSmtpSettingsById,
  createSmtpSettings,
  updateSmtpSettings,
  deleteSmtpSettings,
  activateSmtpSettings
} from '../utils/smtp-repo.js';
import { getSiteBanner, saveSiteBanner, deleteSiteBanner } from '../utils/site-banner.js';
import { getLahzaSettingsForAdmin, getLahzaDiagnostics, saveLahzaSettings } from '../utils/lahza-settings.js';
import { getStoreSettings, saveStoreSettings } from '../utils/store-settings.js';
import { getClientIp, takeRateLimit } from '../utils/request-guard.js';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { getUploadSubdir } from '../utils/app-paths.js';
import { getManagedUploadUrl } from '../utils/public-paths.js';
import {
  ADMIN_PERMISSION_DEFINITIONS,
  PRIMARY_SUPERADMIN_EMAIL,
  buildFullPermissions,
  hasPermission,
  normalizePermissions,
  resolveAdminAccess
} from '../utils/admin-permissions.js';
import { getOrderSelectFields, hasOrderAdminStatusNote } from '../utils/order-select-fields.js';

const router = Router();
const ADMIN_SESSION_EXPIRES_IN = '30m';
const RESET_CODE_EXPIRES_MINUTES = 10;
const RESET_TOKEN_EXPIRES_IN = '15m';
const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');
const ORDER_ITEM_SELECT_FIELDS = 'id, order_id, product_id, product_name, color_name, color_hex, quantity, unit_price, line_total';
const CATEGORY_PRODUCT_SELECT_FIELDS = 'id, name, price, stock, image_url, image_urls, is_available, is_hidden, categories, category';
const ALLOWED_ORDER_STATUSES = new Set([
  'pending_payment',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled'
]);
const IMAGE_MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
};

function buildRateLimitKey(req, scope, identifier = '') {
  return `${scope}:${getClientIp(req)}:${String(identifier || '').trim().toLowerCase()}`;
}

function sendTooManyRequests(res, retryAfterMs) {
  const seconds = Math.max(1, Math.ceil(Number(retryAfterMs || 0) / 1000));
  res.set('Retry-After', String(seconds));
  return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
}

function parseXmlTagAttributes(tag = '') {
  const attrs = {};
  const attrRegex = /([a-zA-Z_][\w:.-]*)="([^"]*)"/g;
  let match = attrRegex.exec(tag);
  while (match) {
    attrs[match[1]] = match[2];
    match = attrRegex.exec(tag);
  }
  return attrs;
}

function parseXmlRelationships(xml = '') {
  const relationships = new Map();
  const relRegex = /<\w*:?\s*Relationship\b[^>]*\/?>/g;
  let tag = relRegex.exec(xml);
  while (tag) {
    const attrs = parseXmlTagAttributes(tag[0]);
    const relId = attrs.Id || attrs.id;
    const target = attrs.Target || attrs.target;
    if (relId && target) relationships.set(relId, target);
    tag = relRegex.exec(xml);
  }
  return relationships;
}

function getRelsPath(partPath) {
  const dir = path.posix.dirname(partPath);
  const file = path.posix.basename(partPath);
  return path.posix.join(dir, '_rels', `${file}.rels`);
}

function resolveZipTargetPath(fromPartPath, targetPath) {
  const baseDir = path.posix.dirname(fromPartPath);
  const cleanTarget = String(targetPath || '').replace(/^\/+/, '');
  return path.posix.normalize(path.posix.join(baseDir, cleanTarget));
}

function readZipEntryText(zip, entryPath) {
  const normalizedPath = path.posix.normalize(String(entryPath || '').replace(/^\/+/, ''));
  const entry = zip.getEntry(normalizedPath);
  if (!entry) return '';
  return entry.getData().toString('utf8');
}

function extractEmbeddedImagesByRow(xlsxBuffer) {
  const imageByRow = new Map();
  const zip = new AdmZip(xlsxBuffer);
  const workbookXml = readZipEntryText(zip, 'xl/workbook.xml');
  const workbookRels = parseXmlRelationships(readZipEntryText(zip, 'xl/_rels/workbook.xml.rels'));

  let firstSheetPath = 'xl/worksheets/sheet1.xml';
  if (workbookXml) {
    const sheetTag = workbookXml.match(/<\w*:?\s*sheet\b[^>]*\/?>/);
    if (sheetTag) {
      const attrs = parseXmlTagAttributes(sheetTag[0]);
      const relId = attrs['r:id'] || attrs.Id || attrs.id;
      const target = workbookRels.get(relId);
      if (target) firstSheetPath = resolveZipTargetPath('xl/workbook.xml', target);
    }
  }

  const sheetXml = readZipEntryText(zip, firstSheetPath);
  if (!sheetXml) return imageByRow;
  const sheetRels = parseXmlRelationships(readZipEntryText(zip, getRelsPath(firstSheetPath)));

  const drawingIds = [];
  const drawingTagRegex = /<\w*:?\s*drawing\b[^>]*\/?>/g;
  let drawingTag = drawingTagRegex.exec(sheetXml);
  while (drawingTag) {
    const attrs = parseXmlTagAttributes(drawingTag[0]);
    const relId = attrs['r:id'] || attrs.Id || attrs.id;
    if (relId) drawingIds.push(relId);
    drawingTag = drawingTagRegex.exec(sheetXml);
  }

  for (const drawingId of drawingIds) {
    const drawingTarget = sheetRels.get(drawingId);
    if (!drawingTarget) continue;
    const drawingPath = resolveZipTargetPath(firstSheetPath, drawingTarget);
    const drawingXml = readZipEntryText(zip, drawingPath);
    if (!drawingXml) continue;

    const drawingRels = parseXmlRelationships(readZipEntryText(zip, getRelsPath(drawingPath)));
    const anchorRegex = /<\w*:?\s*(?:twoCellAnchor|oneCellAnchor)\b[^>]*>([\s\S]*?)<\/\w*:?\s*(?:twoCellAnchor|oneCellAnchor)>/g;
    let anchor = anchorRegex.exec(drawingXml);

    while (anchor) {
      const block = anchor[1] || '';
      const fromMatch = block.match(/<\w*:?\s*from\b[^>]*>([\s\S]*?)<\/\w*:?\s*from>/);
      const rowMatch = fromMatch?.[1]?.match(/<\w*:?\s*row>(\d+)<\/\w*:?\s*row>/);
      const blipTag = block.match(/<\w*:?\s*blip\b[^>]*\/?>/);
      const blipAttrs = blipTag ? parseXmlTagAttributes(blipTag[0]) : {};
      const embedRelId = blipAttrs['r:embed'] || blipAttrs.embed || '';

      if (rowMatch && embedRelId) {
        const excelRow = Number(rowMatch[1]) + 1;
        const mediaTarget = drawingRels.get(embedRelId);
        if (mediaTarget) {
          const mediaPath = resolveZipTargetPath(drawingPath, mediaTarget);
          const mediaEntry = zip.getEntry(path.posix.normalize(mediaPath));
          if (mediaEntry && !imageByRow.has(excelRow)) {
            const imageBuffer = mediaEntry.getData();
            const ext = path.posix.extname(mediaPath).toLowerCase();
            const mime = IMAGE_MIME_BY_EXT[ext] || 'image/png';
            imageByRow.set(excelRow, `data:${mime};base64,${imageBuffer.toString('base64')}`);
          }
        }
      }

      anchor = anchorRegex.exec(drawingXml);
    }
  }

  return imageByRow;
}

function parseProductsImportRows(xlsxBuffer) {
  const workbook = XLSX.read(xlsxBuffer, { type: 'buffer', cellDates: false, raw: false });
  const firstSheetName = Array.isArray(workbook.SheetNames) ? workbook.SheetNames[0] : null;
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true
  });

  const headers = (Array.isArray(matrix[0]) ? matrix[0] : []).map((h) => String(h ?? '').trim());
  const imageByRow = extractEmbeddedImagesByRow(xlsxBuffer);
  const rows = [];

  for (let rowIndex = 2; rowIndex <= matrix.length; rowIndex += 1) {
    const row = Array.isArray(matrix[rowIndex - 1]) ? matrix[rowIndex - 1] : [];
    const hasValue = row.some((cell) => String(cell ?? '').trim() !== '');
    const embeddedImage = imageByRow.get(rowIndex) || '';
    if (!hasValue && !embeddedImage) continue;

    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      const header = headers[i];
      if (!header) continue;
      obj[header] = row[i] == null ? '' : row[i];
    }
    if (embeddedImage) obj.__image_data = embeddedImage;
    rows.push(obj);
  }

  return rows;
}

function getImportValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function normalizeImportName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCategoryNames(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[،,]+/);
  const seen = new Set();
  const cleaned = [];
  for (const entry of raw) {
    const name = String(entry || '').trim();
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(name);
  }
  return cleaned;
}

function parseStoredCategories(value, fallbackCategory = '') {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value || 'null');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
    }
  } catch {
    // fall through to legacy single category value
  }

  const fallback = String(fallbackCategory || '').trim();
  return fallback ? [fallback] : [];
}

function parsePositiveId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeOrderedIds(ids = []) {
  const uniqueIds = [];
  for (const value of ids) {
    const parsed = parsePositiveId(value);
    if (!parsed || uniqueIds.includes(parsed)) continue;
    uniqueIds.push(parsed);
  }
  return uniqueIds;
}

function sortProductsByCategoryOrder(products = [], orderedIds = []) {
  const orderMap = new Map();
  orderedIds.forEach((id, index) => orderMap.set(Number(id), index));
  return products
    .map((product, index) => ({ product, index }))
    .sort((left, right) => {
      const leftOrder = orderMap.get(Number(left.product?.id));
      const rightOrder = orderMap.get(Number(right.product?.id));
      const leftRank = Number.isInteger(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isInteger(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.index - right.index;
    })
    .map(({ product }) => product);
}

async function getCategoryProductOrderIds(categoryId, conn = pool) {
  const [rows] = await conn.query(
    'SELECT product_id FROM category_product_orders WHERE category_id = ? ORDER BY sort_order ASC, product_id ASC',
    [categoryId]
  );
  return rows.map((row) => Number(row.product_id)).filter((value) => Number.isInteger(value) && value > 0);
}

async function listCategoryProducts(category, conn = pool) {
  const categoryName = String(category?.name || '').trim();
  if (!categoryName) return [];

  const [rows] = await conn.query(
    `SELECT ${CATEGORY_PRODUCT_SELECT_FIELDS}
       FROM products
      WHERE category = ?
         OR JSON_CONTAINS(COALESCE(categories, JSON_ARRAY()), JSON_QUOTE(?), '$')
      ORDER BY id DESC`,
    [categoryName, categoryName]
  );

  return rows.map((row) => {
    const imageUrls = (() => {
      try {
        const parsed = Array.isArray(row.image_urls) ? row.image_urls : JSON.parse(row.image_urls || 'null');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    return {
      id: row.id,
      name: row.name,
      price: row.price,
      stock: row.stock,
      is_available: row.is_available,
      is_hidden: row.is_hidden,
      image_url: row.image_url || imageUrls[0] || null,
      categories: parseStoredCategories(row.categories, row.category)
    };
  });
}

function parseImportNumber(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildImportErrorExport(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const lines = [
    ['row', 'name', 'reason'].join(',')
  ];
  for (const row of rows) {
    const values = [row?.row ?? '', row?.name ?? '', row?.reason ?? '']
      .map((value) => `"${String(value).replaceAll('"', '""')}"`);
    lines.push(values.join(','));
  }
  return Buffer.from(lines.join('\n'), 'utf8').toString('base64');
}

function serializeAdminUser(row, { fallbackFullAccess = false } = {}) {
  if (!row) return null;
  const access = resolveAdminAccess(row, { fallbackFullAccess });
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    is_super_admin: access.is_super_admin,
    permissions: access.permissions
  };
}

function parseAdminPermissions(payload) {
  return normalizePermissions(payload);
}

function countEnabledPermissions(permissions) {
  const normalized = normalizePermissions(permissions);
  return Object.values(normalized).reduce(
    (total, moduleActions) => total + Object.values(moduleActions).filter(Boolean).length,
    0
  );
}

async function countSuperAdmins(conn = pool) {
  const [rows] = await conn.query('SELECT COUNT(*) AS count FROM admin_users WHERE is_super_admin = 1 OR LOWER(TRIM(email)) = ?', [PRIMARY_SUPERADMIN_EMAIL]);
  return Number(rows[0]?.count || 0);
}

function ensureCanManageSuperAdmin(req, nextIsSuperAdmin) {
  if (nextIsSuperAdmin && !req.admin?.is_super_admin) {
    return 'Only a super admin can grant super admin access';
  }
  return '';
}

function saveImportedImage(dataUrl, rowNo, uploadsDir) {
  const text = String(dataUrl || '');
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = (match[1] || '').toLowerCase();
  const b64 = match[2] || '';
  const ext = mime.includes('png')
    ? 'png'
    : mime.includes('jpeg') || mime.includes('jpg')
      ? 'jpg'
      : mime.includes('webp')
        ? 'webp'
        : mime.includes('gif')
          ? 'gif'
          : 'png';
  const fileName = `row-${rowNo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  return getManagedUploadUrl('excel', fileName);
}

async function analyzeProductsImport(rows, { mode = 'create_only' } = {}) {
  const normalizedMode = mode === 'update_existing' ? 'update_existing' : 'create_only';
  const [existingProducts] = await pool.query('SELECT id, name FROM products');
  const existingProductMap = new Map(
    existingProducts
      .map((row) => [normalizeImportName(row?.name), { id: row.id, name: String(row?.name || '').trim() }])
      .filter(([key]) => key)
  );
  const [existingCategoryRows] = await pool.query('SELECT id, name FROM categories');
  const knownCategories = new Map(
    existingCategoryRows
      .map((row) => [normalizeImportName(row?.name), String(row?.name || '').trim()])
      .filter(([key, value]) => key && value)
  );

  const previewRows = [];
  const invalidRows = [];
  const createdCategories = [];
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  let toCreate = 0;
  let toUpdate = 0;
  const fileNames = new Set();

  for (let idx = 0; idx < rows.length; idx += 1) {
    const r = rows[idx];
    const rowNo = idx + 2;
    const name = String(getImportValue(r, ['اسم المنتج', 'المنتج', 'Name', 'Product']) || '').trim();
    const normalizedName = normalizeImportName(name);
    const description = String(getImportValue(r, ['وصف المنتج', 'Description']) || '').trim();
    const technical_data = String(getImportValue(r, ['بيانات فنية', 'بيانات فنية ', 'Technical Data']) || '').trim();
    const usage = String(getImportValue(r, ['تعليمات الاستخدام', 'Usage']) || '').trim();
    const warnings = String(getImportValue(r, ['تحذيرات', 'Warnings']) || '').trim();
    const price = parseImportNumber(getImportValue(r, ['البيع', 'السعر', 'Price']));
    const mrp = parseImportNumber(getImportValue(r, ['السعر قبل الخصم', 'MRP', 'Compare Price']));
    const image_url = String(getImportValue(r, ['صورة', 'Image', 'Image URL']) || '').trim();
    const categoryValue = getImportValue(r, ['الفئة', 'Category']);
    const categories = normalizeCategoryNames(categoryValue);
    const category = categories[0] || '';
    const is_available = parseBoolean(getImportValue(r, ['متوفر', 'Available', 'is_available']), true);
    const is_hidden = parseBoolean(getImportValue(r, ['مخفي', 'Hidden', 'is_hidden']), false);
    const show_on_home = parseBoolean(getImportValue(r, ['الرئيسية', 'Home', 'show_on_home']), false);
    const embeddedImage = r.__image_data || '';

    if (!normalizedName) {
      skippedInvalid += 1;
      invalidRows.push({ row: rowNo, reason: 'اسم المنتج مطلوب' });
      continue;
    }
    if (price == null || price <= 0) {
      skippedInvalid += 1;
      invalidRows.push({ row: rowNo, name, reason: 'السعر يجب أن يكون رقماً أكبر من صفر' });
      continue;
    }
    if (categories.length === 0) {
      skippedInvalid += 1;
      invalidRows.push({ row: rowNo, name, reason: 'الفئة مطلوبة' });
      continue;
    }
    if (fileNames.has(normalizedName)) {
      skippedDuplicates += 1;
      invalidRows.push({ row: rowNo, name, reason: 'اسم المنتج مكرر داخل الملف نفسه' });
      continue;
    }
    fileNames.add(normalizedName);

    const existing = existingProductMap.get(normalizedName) || null;
    if (existing && normalizedMode !== 'update_existing') {
      skippedDuplicates += 1;
      continue;
    }

    const finalCategories = categories.map((categoryName) => {
      const normalizedCategory = normalizeImportName(categoryName);
      const existingCategory = knownCategories.get(normalizedCategory) || categoryName;
      if (!knownCategories.has(normalizedCategory) && !createdCategories.includes(categoryName)) {
        createdCategories.push(categoryName);
        knownCategories.set(normalizedCategory, categoryName);
      }
      return existingCategory;
    });

    const action = existing ? 'update' : 'create';
    if (action === 'update') toUpdate += 1;
    else toCreate += 1;

    previewRows.push({
      row: rowNo,
      action,
      existingId: existing?.id || null,
      name,
      category: finalCategories[0],
      categories: finalCategories,
      price,
      mrp,
      is_available,
      is_hidden,
      show_on_home,
      description,
      technical_data,
      usage,
      warnings,
      image_url,
      embeddedImage,
      normalizedName
    });
  }

  return {
    mode: normalizedMode,
    totalRows: rows.length,
    previewRows,
    invalidRows,
    createdCategories,
    skippedDuplicates,
    skippedInvalid,
    toCreate,
    toUpdate,
    errorExportBase64: buildImportErrorExport(invalidRows)
  };
}

export async function applyProductImportAnalysis(conn, analysis, uploadsDir, saveImage = saveImportedImage) {
  let imported = 0;
  let updated = 0;

  await conn.beginTransaction();
  try {
    for (const categoryName of analysis.createdCategories) {
      await conn.query(
        `INSERT INTO categories (name) VALUES (?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [categoryName]
      );
    }

    for (const row of analysis.previewRows) {
      let finalImage = row.image_url || null;
      if (finalImage && String(finalImage).startsWith('data:image/')) {
        finalImage = saveImage(finalImage, row.row, uploadsDir);
      }
      if (!finalImage && row.embeddedImage) {
        finalImage = saveImage(row.embeddedImage, row.row, uploadsDir);
      }

      if (row.action === 'update' && row.existingId) {
        await conn.query(
          `UPDATE products
              SET name = ?, description = ?, \`usage\` = ?, technical_data = ?, warnings = ?,
                  price = ?, mrp = ?, category = ?, categories = ?, image_url = ?, image_urls = ?,
                  is_available = ?, is_hidden = ?, show_on_home = ?, brand = NULL, type = NULL
            WHERE id = ?`,
          [
            row.name,
            row.description || null,
            row.usage || null,
            row.technical_data || null,
            row.warnings || null,
            row.price,
            row.mrp,
            row.category,
            JSON.stringify(row.categories || [row.category]),
            finalImage,
            finalImage ? JSON.stringify([finalImage]) : null,
            row.is_available ? 1 : 0,
            row.is_hidden ? 1 : 0,
            row.show_on_home ? 1 : 0,
            row.existingId
          ]
        );
        updated += 1;
        continue;
      }

      await conn.query(
        `INSERT INTO products (name, description, \`usage\`, technical_data, warnings, price, mrp, stock, brand, type, category, categories, image_url, image_urls, docs, links, is_available, is_hidden, show_on_home)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.name,
          row.description || null,
          row.usage || null,
          row.technical_data || null,
          row.warnings || null,
          row.price,
          row.mrp,
          0,
          null,
          null,
          row.category,
          JSON.stringify(row.categories || [row.category]),
          finalImage,
          finalImage ? JSON.stringify([finalImage]) : null,
          null,
          null,
          row.is_available ? 1 : 0,
          row.is_hidden ? 1 : 0,
          row.show_on_home ? 1 : 0
        ]
      );
      imported += 1;
    }

    await conn.commit();
    return { imported, updated };
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

function buildTransport(settings, secureOverride) {
  const port = Number(settings.port) || 587;
  const secure = secureOverride == null ? !!settings.secure : !!secureOverride;
  return nodemailer.createTransport({
    host: settings.host,
    port,
    secure,
    auth: { user: settings.username, pass: settings.password },
    connectionTimeout: 15000,
    greetingTimeout: 12000,
    socketTimeout: 20000
  });
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function upsertEnvValues(updates) {
  const pairs = Object.entries(updates).map(([key, value]) => [String(key), String(value ?? '')]);
  let lines = [];
  if (fs.existsSync(ENV_FILE_PATH)) {
    lines = fs.readFileSync(ENV_FILE_PATH, 'utf8').split(/\r?\n/);
  }

  const updated = new Set();
  const nextLines = lines.map((line) => {
    for (const [key, value] of pairs) {
      if (line.startsWith(`${key}=`)) {
        updated.add(key);
        return `${key}=${value}`;
      }
    }
    return line;
  });

  for (const [key, value] of pairs) {
    if (!updated.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
    process.env[key] = value;
  }

  const content = `${nextLines.filter((line, idx, arr) => !(idx === arr.length - 1 && line === '')).join('\n')}\n`;
  fs.writeFileSync(ENV_FILE_PATH, content, 'utf8');
}

function getRecaptchaSettings() {
  return {
    enabled: !!config.recaptchaEnabled,
    site_key: config.recaptchaSiteKey || '',
    secret_key: config.recaptchaSecretKey || ''
  };
}

function getRecaptchaDiagnostics() {
  const enabled = !!config.recaptchaEnabled;
  const siteKey = String(config.recaptchaSiteKey || '').trim();
  const secretKey = String(config.recaptchaSecretKey || '').trim();
  const warnings = [];

  if (!enabled) warnings.push('reCAPTCHA معطل حالياً');
  if (!siteKey) warnings.push('Site Key غير موجود');
  if (!secretKey) warnings.push('Secret Key غير موجود');
  if (enabled && siteKey && !/^6[0-9A-Za-z_-]{20,}$/.test(siteKey)) {
    warnings.push('صيغة Site Key تبدو غير صحيحة');
  }
  if (enabled && secretKey && !/^6[0-9A-Za-z_-]{20,}$/.test(secretKey)) {
    warnings.push('صيغة Secret Key تبدو غير صحيحة');
  }
  return {
    enabled,
    has_site_key: !!siteKey,
    has_secret_key: !!secretKey,
    site_key_preview: siteKey ? `${siteKey.slice(0, 8)}...${siteKey.slice(-6)}` : '',
    secret_key_preview: secretKey ? `${secretKey.slice(0, 8)}...${secretKey.slice(-6)}` : '',
    verify_url: String(config.recaptchaVerifyUrl || 'https://www.google.com/recaptcha/api/siteverify').trim(),
    storefront_ready: !!(enabled && siteKey),
    backend_ready: !!(enabled && secretKey),
    warnings
  };
}

async function sendWithSmtpRetry(settings, mailOptions) {
  const port = Number(settings.port) || 587;
  const configuredSecure = !!settings.secure;
  const preferredSecure = configuredSecure || port === 465;

  try {
    return await buildTransport(settings, preferredSecure).sendMail(mailOptions);
  } catch (err) {
    const errorText = String(err?.message || '');
    const canRetry = /greeting never received|ssl|wrong version number|econnreset|etimedout/i.test(errorText);
    if (!canRetry) throw err;

    const fallbackSecure = !preferredSecure;
    try {
      return await buildTransport(settings, fallbackSecure).sendMail(mailOptions);
    } catch (retryErr) {
      const finalText = String(retryErr?.message || '');
      if (/535|authentication|auth/i.test(finalText)) {
        throw new Error(
          'SMTP auth failed (535). Re-enter SMTP username/password in admin settings. Use full email as username if required by provider.'
        );
      }
      throw new Error(
        `SMTP connection failed: ${retryErr.message}. Check SMTP host/port/secure (port 465 => secure ON, port 587 => secure OFF).`
      );
    }
  }
}

function hashResetCode(email, code) {
  const secret = String(process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret || secret === 'change-me' || secret.length < 16) {
    throw new Error('Password reset secret is not configured securely');
  }
  return crypto
    .createHash('sha256')
    .update(`${String(email).toLowerCase().trim()}::${String(code)}::${secret}`)
    .digest('hex');
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const rateLimit = takeRateLimit(buildRateLimitKey(req, 'admin:login', email), {
      limit: 5,
      windowMs: 15 * 60 * 1000
    });
    if (!rateLimit.ok) {
      return sendTooManyRequests(res, rateLimit.retryAfterMs);
    }

    const [rows] = await pool.query('SELECT id, email, password_hash, is_super_admin, permissions FROM admin_users WHERE email = ?', [email]);
    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const access = resolveAdminAccess(admin, { fallbackFullAccess: !admin.permissions });
    const token = signToken(
      {
        id: admin.id,
        email: admin.email,
        role: 'admin',
        is_super_admin: access.is_super_admin,
        permissions: access.permissions
      },
      ADMIN_SESSION_EXPIRES_IN
    );
    return res.json({ token, admin: serializeAdminUser(admin, { fallbackFullAccess: !admin.permissions }) });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password/request', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });

    const rateLimit = takeRateLimit(buildRateLimitKey(req, 'admin:forgot-password-request', email), {
      limit: 3,
      windowMs: 15 * 60 * 1000
    });
    if (!rateLimit.ok) {
      return sendTooManyRequests(res, rateLimit.retryAfterMs);
    }

    const [admins] = await pool.query(
      'SELECT id, email FROM admin_users WHERE email = ? LIMIT 1',
      [email]
    );
    const admin = admins[0];
    if (!admin) return res.json({ ok: true });

    const smtp = await getSmtpSettings({ includePassword: true });
    if (!smtp || !smtp.host || !smtp.username) {
      return res.json({ ok: true });
    }
    if (!smtp.password) {
      return res.json({ ok: true });
    }

    const code = generateResetCode();
    const codeHash = hashResetCode(admin.email, code);
    const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRES_MINUTES * 60 * 1000);

    await pool.query('DELETE FROM admin_password_resets WHERE admin_id = ?', [admin.id]);
    await pool.query(
      `INSERT INTO admin_password_resets (admin_id, email, code_hash, expires_at, attempt_count)
       VALUES (?, ?, ?, ?, 0)`,
      [admin.id, admin.email, codeHash, expiresAt]
    );

    const from = `"${smtp.from_name || 'Shadi Store'}" <${smtp.from_email || smtp.username}>`;
    await sendWithSmtpRetry(smtp, {
      from,
      to: admin.email,
      subject: 'رمز استعادة كلمة مرور لوحة الإدارة',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
          <p>تم طلب إعادة تعيين كلمة المرور لحساب الإدارة.</p>
          <p>رمز التحقق:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:6px 0 16px">${code}</p>
          <p>مدة صلاحية الرمز: ${RESET_CODE_EXPIRES_MINUTES} دقائق.</p>
        </div>
      `
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to send reset code' });
  }
});

router.post('/forgot-password/verify', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ error: 'email and code required' });
    }

    const rateLimit = takeRateLimit(buildRateLimitKey(req, 'admin:forgot-password-verify', email), {
      limit: 10,
      windowMs: 15 * 60 * 1000
    });
    if (!rateLimit.ok) {
      return sendTooManyRequests(res, rateLimit.retryAfterMs);
    }

    const [admins] = await pool.query(
      'SELECT id, email FROM admin_users WHERE email = ? LIMIT 1',
      [email]
    );
    const admin = admins[0];
    if (!admin) return res.status(400).json({ error: 'Invalid or expired code' });

    const [rows] = await pool.query(
      `SELECT id, code_hash, expires_at, attempt_count
         FROM admin_password_resets
        WHERE admin_id = ?
        LIMIT 1`,
      [admin.id]
    );
    const reset = rows[0];
    if (!reset) return res.status(400).json({ error: 'Invalid or expired code' });

    const expiresAt = new Date(reset.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      await pool.query('DELETE FROM admin_password_resets WHERE admin_id = ?', [admin.id]);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    if ((Number(reset.attempt_count) || 0) >= 5) {
      return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
    }

    const expectedHash = hashResetCode(admin.email, code);
    if (expectedHash !== reset.code_hash) {
      await pool.query(
        'UPDATE admin_password_resets SET attempt_count = attempt_count + 1 WHERE admin_id = ?',
        [admin.id]
      );
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const resetToken = signToken(
      { id: admin.id, email: admin.email, role: 'admin', purpose: 'password_reset' },
      RESET_TOKEN_EXPIRES_IN
    );

    return res.json({
      ok: true,
      email: admin.email,
      resetToken
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to verify code' });
  }
});

router.post('/forgot-password/reset', async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || '').trim();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    const rateLimit = takeRateLimit(buildRateLimitKey(req, 'admin:forgot-password-reset'), {
      limit: 5,
      windowMs: 15 * 60 * 1000
    });
    if (!rateLimit.ok) {
      return sendTooManyRequests(res, rateLimit.retryAfterMs);
    }

    if (!resetToken || !password || !confirmPassword) {
      return res.status(400).json({ error: 'resetToken, password and confirmPassword required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const payload = verifyToken(resetToken);
    if (!payload || payload.purpose !== 'password_reset' || !payload.id || !payload.email) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const [rows] = await pool.query(
      'SELECT id FROM admin_password_resets WHERE admin_id = ? AND email = ? LIMIT 1',
      [payload.id, payload.email]
    );
    if (!rows[0]) {
      return res.status(400).json({ error: 'Reset request not found' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE admin_users SET password_hash = ? WHERE id = ? AND email = ?',
      [hash, payload.id, payload.email]
    );
    await pool.query('DELETE FROM admin_password_resets WHERE admin_id = ?', [payload.id]);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
});

router.get('/me', requireAdmin, async (req, res) => {
  const refreshedToken = signToken(
    {
      id: req.admin.id,
      email: req.admin.email,
      role: req.admin.role,
      is_super_admin: !!req.admin.is_super_admin,
      permissions: req.admin.permissions || {}
    },
    ADMIN_SESSION_EXPIRES_IN
  );

  return res.json({
    id: req.admin.id,
    email: req.admin.email,
    role: req.admin.role,
    is_super_admin: !!req.admin.is_super_admin,
    permissions: req.admin.permissions || {},
    token: refreshedToken
  });
});

router.get('/orders', requirePermission('orders', 'read_list'), async (req, res) => {
  const orderSelectFields = await getOrderSelectFields();
  const { status, limit = 50, offset = 0 } = req.query;
  const params = [];
  let sql = `SELECT ${orderSelectFields} FROM orders`;
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 50, Number(offset) || 0);

  const [rows] = await pool.query(sql, params);
  return res.json(rows);
});

router.get('/orders/:id', requirePermission('orders', 'read_details'), async (req, res) => {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
  const order = orders[0];
  if (!order) return res.status(404).json({ error: 'Not found' });

  const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [req.params.id]);
  return res.json({ order, items });
});

router.get('/orders/:id/email-preview', requireAdmin, async (req, res) => {
  const { type } = req.query;
  if (type !== 'customer' && type !== 'internal') {
    return res.status(400).json({ error: 'invalid type' });
  }

  const allowed = type === 'customer'
    ? hasPermission(req.admin, 'orders', 'preview_customer_email')
    : hasPermission(req.admin, 'orders', 'preview_internal_email');
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have permission to preview this email' });
  }

  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
  const order = orders[0];
  if (!order) return res.status(404).json({ error: 'Not found' });

  const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [req.params.id]);
  const [payments] = await pool.query(
    'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [req.params.id]
  );
  const baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
  const logo = baseUrl ? `${baseUrl}/logo.png` : '';
  const payment = payments[0] || null;

  const html = type === 'customer'
    ? renderCustomerEmail({ order, logoUrl: logo, items, payment })
    : renderInternalEmail({ order, logoUrl: logo, items, payment });

  return res.json({ html });
});

router.post('/orders/:id/send-email', requireAdmin, async (req, res) => {
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

  try {
    const { type, email } = req.body || {};
    const customEmail = String(email || '').trim();
    if (type !== 'customer' && type !== 'internal') {
      return res.status(400).json({ error: 'invalid type' });
    }
    if (customEmail && !isValidEmail(customEmail)) {
      return res.status(400).json({ error: 'Recipient email is invalid' });
    }

    const allowed = type === 'customer'
      ? hasPermission(req.admin, 'orders', 'send_customer_email')
      : hasPermission(req.admin, 'orders', 'send_internal_email');
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to send this email' });
    }

    const orderSelectFields = await getOrderSelectFields();
    const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
    const order = orders[0];
    if (!order) return res.status(404).json({ error: 'Not found' });

    const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [req.params.id]);
    const [payments] = await pool.query(
      'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );
    const payment = payments[0] || null;

    if (type === 'customer') {
      const to = customEmail || String(order.customer_email || '').trim();
      if (!isValidEmail(to)) {
        return res.status(400).json({ error: 'Customer email is missing or invalid for this order' });
      }
      await sendOrderEmail({ to, order, items, payment });
      return res.json({ ok: true, sentTo: to });
    }

    let notifyTo = customEmail || config.orderNotifyEmail;
    if (!notifyTo) {
      try {
        const smtp = await getSmtpSettings();
        notifyTo = smtp?.notify_email || smtp?.from_email || smtp?.username;
      } catch {
        notifyTo = null;
      }
    }
    if (!customEmail && (!notifyTo || !isValidEmail(notifyTo))) {
      notifyTo = order.customer_email;
    }
    if (!isValidEmail(notifyTo)) {
      return res.status(400).json({ error: 'Internal notification email is not configured correctly' });
    }

    await sendInternalOrderEmail({ to: notifyTo, order, items, payment });
    return res.json({ ok: true, sentTo: notifyTo });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Failed to send email' });
  }
});

router.put('/orders/:id/status', requirePermission('orders', 'change_status'), async (req, res) => {
  const { status, note } = req.body || {};
  const normalizedStatus = String(status || '').trim();
  const normalizedNote = String(note || '').trim();
  if (!normalizedStatus) return res.status(400).json({ error: 'status required' });
  if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  if (!normalizedNote) {
    return res.status(400).json({ error: 'note required' });
  }

  if (await hasOrderAdminStatusNote()) {
    await pool.query('UPDATE orders SET status = ?, admin_status_note = ? WHERE id = ?', [normalizedStatus, normalizedNote, req.params.id]);
  } else {
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [normalizedStatus, req.params.id]);
  }
  const orderSelectFields = await getOrderSelectFields();
  const [rows] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
  return res.json(rows[0]);
});

router.get('/brands', requirePermission('products', 'read'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM brands ORDER BY name ASC');
  return res.json(rows);
});

router.get('/categories', requireAnyPermission([['categories', 'read'], ['categories', 'sort'], ['products', 'read'], ['products', 'sort']]), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
  return res.json(rows);
});

router.get('/cities', requirePermission('cities', 'read'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM cities ORDER BY name ASC');
  return res.json(rows);
});

router.post('/brands', requireAnyPermission([['products', 'create'], ['products', 'update']]), async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  await pool.query('INSERT INTO brands (name) VALUES (?)', [name.trim()]);
  const [rows] = await pool.query('SELECT id, name FROM brands ORDER BY name ASC');
  return res.status(201).json(rows);
});

router.post('/categories', requirePermission('categories', 'create'), async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  const [[lastRow]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS maxSortOrder FROM categories');
  await pool.query('INSERT INTO categories (name, sort_order) VALUES (?, ?)', [name.trim(), Number(lastRow?.maxSortOrder || 0) + 1]);
  const [rows] = await pool.query('SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
  return res.status(201).json(rows);
});

router.put('/categories/reorder', requirePermission('categories', 'sort'), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'ids required' });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id FROM categories ORDER BY sort_order ASC, name ASC, id ASC FOR UPDATE');
    const existingIds = rows.map((row) => Number(row.id));
    const existingSet = new Set(existingIds);
    const uniqueIds = [];
    for (const id of ids) {
      if (!existingSet.has(id) || uniqueIds.includes(id)) continue;
      uniqueIds.push(id);
    }

    const remainingIds = existingIds.filter((id) => !uniqueIds.includes(id));
    const orderedIds = [...uniqueIds, ...remainingIds];

    for (let index = 0; index < orderedIds.length; index += 1) {
      await conn.query('UPDATE categories SET sort_order = ? WHERE id = ?', [index + 1, orderedIds[index]]);
    }

    await conn.commit();

    const [updatedRows] = await pool.query('SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
    return res.json(updatedRows);
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to reorder categories' });
  } finally {
    conn.release();
  }
});

router.get('/categories/:id/products', requireAnyPermission([['categories', 'read'], ['categories', 'sort'], ['products', 'sort']]), async (req, res) => {
  const categoryId = parsePositiveId(req.params.id);
  if (!categoryId) return res.status(400).json({ error: 'invalid category id' });

  const [categoryRows] = await pool.query('SELECT id, name, sort_order FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  const category = categoryRows[0];
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const [products, orderedIds] = await Promise.all([
    listCategoryProducts(category),
    getCategoryProductOrderIds(categoryId)
  ]);

  return res.json({
    category,
    items: sortProductsByCategoryOrder(products, orderedIds),
    orderedIds
  });
});

async function reorderCategoryProducts(req, res) {
  const categoryId = parsePositiveId(req.params.id);
  if (!categoryId) return res.status(400).json({ error: 'invalid category id' });

  const requestedIds = normalizeOrderedIds(req.body?.ids);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [categoryRows] = await conn.query('SELECT id, name, sort_order FROM categories WHERE id = ? LIMIT 1 FOR UPDATE', [categoryId]);
    const category = categoryRows[0];
    if (!category) {
      await conn.rollback();
      return res.status(404).json({ error: 'Category not found' });
    }

    const existingProducts = await listCategoryProducts(category, conn);
    const existingIds = existingProducts.map((product) => Number(product.id));
    const existingSet = new Set(existingIds);
    const uniqueIds = requestedIds.filter((id) => existingSet.has(id));
    const orderedIds = [...uniqueIds, ...existingIds.filter((id) => !uniqueIds.includes(id))];

    await conn.query('DELETE FROM category_product_orders WHERE category_id = ?', [categoryId]);

    if (orderedIds.length > 0) {
      const placeholders = orderedIds.map(() => '(?, ?, ?)').join(', ');
      const values = [];
      orderedIds.forEach((productId, index) => {
        values.push(categoryId, productId, index + 1);
      });
      await conn.query(
        `INSERT INTO category_product_orders (category_id, product_id, sort_order) VALUES ${placeholders}`,
        values
      );
    }

    await conn.commit();

    return res.json({
      category,
      items: sortProductsByCategoryOrder(existingProducts, orderedIds),
      orderedIds
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to reorder category products' });
  } finally {
    conn.release();
  }
}

router.put('/categories/:id/products/reorder', requirePermission('products', 'sort'), reorderCategoryProducts);
router.post('/categories/:id/products/reorder', requirePermission('products', 'sort'), reorderCategoryProducts);

router.post('/cities', requirePermission('cities', 'create'), async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  await pool.query('INSERT INTO cities (name) VALUES (?)', [name.trim()]);
  const [rows] = await pool.query('SELECT id, name FROM cities ORDER BY name ASC');
  return res.status(201).json(rows);
});

router.delete('/brands/:id', requirePermission('products', 'delete'), async (req, res) => {
  await pool.query('DELETE FROM brands WHERE id = ?', [req.params.id]);
  return res.status(204).end();
});

router.delete('/categories/:id', requirePermission('categories', 'delete'), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id, name FROM categories WHERE id = ? FOR UPDATE', [req.params.id]);
    const category = rows[0];
    if (!category) {
      await conn.rollback();
      return res.status(404).json({ error: 'Category not found' });
    }

    const [products] = await conn.query('SELECT id, category, categories FROM products');
    let clearedProducts = 0;
    for (const product of products) {
      const categories = parseStoredCategories(product.categories, product.category);
      const nextCategories = categories.filter((name) => name !== category.name);
      if (nextCategories.length === categories.length) continue;
      clearedProducts += 1;
      await conn.query('UPDATE products SET category = ?, categories = ? WHERE id = ?', [nextCategories[0] || null, nextCategories.length ? JSON.stringify(nextCategories) : null, product.id]);
    }

    await conn.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    await conn.commit();
    return res.json({ ok: true, clearedProducts });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to delete category' });
  } finally {
    conn.release();
  }
});

router.delete('/cities/:id', requirePermission('cities', 'delete'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM cities WHERE id = ?', [req.params.id]);
  const city = rows[0];
  if (!city) return res.status(404).json({ error: 'City not found' });

  await pool.query('DELETE FROM cities WHERE id = ?', [req.params.id]);
  return res.json({ ok: true, removed: city.name });
});

router.get('/types', requirePermission('products', 'read'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM types ORDER BY name ASC');
  return res.json(rows);
});

router.post('/types', requireAnyPermission([['products', 'create'], ['products', 'update']]), async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  await pool.query('INSERT INTO types (name) VALUES (?)', [name.trim()]);
  const [rows] = await pool.query('SELECT id, name FROM types ORDER BY name ASC');
  return res.status(201).json(rows);
});

router.delete('/types/:id', requirePermission('products', 'delete'), async (req, res) => {
  await pool.query('DELETE FROM types WHERE id = ?', [req.params.id]);
  return res.status(204).end();
});

router.get('/smtp-settings', requirePermission('smtp', 'read'), async (req, res) => {
  try {
    const settings = await listSmtpSettings({ includePassword: false });
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load SMTP settings' });
  }
});

function sanitizeSmtpConfig(payload) {
  if (!payload) return null;
  const { password, ...safe } = payload;
  return {
    ...safe,
    has_password: safe.has_password != null ? !!safe.has_password : !!password
  };
}

router.get('/smtp-settings/active', requirePermission('smtp', 'read'), async (req, res) => {
  try {
    const settings = await getSmtpSettings({ includePassword: false });
    return res.json(sanitizeSmtpConfig(settings) || {});
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load active SMTP settings' });
  }
});

router.get('/smtp-settings/:id(\\d+)', requirePermission('smtp', 'read'), async (req, res) => {
  try {
    const settings = await getSmtpSettingsById(req.params.id, { includePassword: false });
    if (!settings) return res.status(404).json({ error: 'SMTP config not found' });
    return res.json(sanitizeSmtpConfig(settings));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load SMTP config' });
  }
});

router.post('/smtp-settings', requirePermission('smtp', 'create'), async (req, res) => {
  try {
    const saved = await createSmtpSettings(req.body || {});
    return res.status(201).json(sanitizeSmtpConfig(saved) || {});
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create SMTP config' });
  }
});

router.put('/smtp-settings/:id(\\d+)', requirePermission('smtp', 'update'), async (req, res) => {
  try {
    const saved = await updateSmtpSettings(req.params.id, req.body || {});
    if (!saved) return res.status(404).json({ error: 'SMTP config not found' });
    return res.json(sanitizeSmtpConfig(saved));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to update SMTP config' });
  }
});

router.delete('/smtp-settings/:id(\\d+)', requirePermission('smtp', 'delete'), async (req, res) => {
  try {
    const ok = await deleteSmtpSettings(req.params.id);
    if (!ok) return res.status(404).json({ error: 'SMTP config not found' });
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete SMTP config' });
  }
});

router.post('/smtp-settings/:id(\\d+)/activate', requirePermission('smtp', 'activate'), async (req, res) => {
  try {
    const saved = await activateSmtpSettings(req.params.id);
    if (!saved) return res.status(404).json({ error: 'SMTP config not found' });
    return res.json(sanitizeSmtpConfig(saved));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to activate SMTP config' });
  }
});

// Legacy endpoint kept for compatibility with older admin builds.
router.put('/smtp-settings', requirePermission('smtp', 'update'), async (req, res) => {
  try {
    const active = await getSmtpSettings({ includePassword: true });
    if (!active) {
      const created = await createSmtpSettings({ ...(req.body || {}), is_active: true });
      return res.json(sanitizeSmtpConfig(created) || {});
    }
    const updated = await updateSmtpSettings(active.id, req.body || {});
    return res.json(sanitizeSmtpConfig(updated) || {});
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save SMTP settings' });
  }
});

router.get('/whatsapp-settings', requirePermission('whatsapp', 'read'), async (req, res) => {
  const [rows] = await pool.query('SELECT phone, message, qr_data_url FROM whatsapp_settings WHERE id = 1');
  return res.json(rows[0] || {});
});

router.put('/whatsapp-settings', requirePermission('whatsapp', 'update'), async (req, res) => {
  const { phone, message, qr_data_url } = req.body || {};
  const [rows] = await pool.query('SELECT id FROM whatsapp_settings WHERE id = 1');
  if (!rows.length) {
    await pool.query(
      `INSERT INTO whatsapp_settings (id, phone, message, qr_data_url)
       VALUES (1, ?, ?, ?)`,
      [phone || '', message || '', qr_data_url || '']
    );
  } else {
    await pool.query(
      `UPDATE whatsapp_settings SET phone = ?, message = ?, qr_data_url = ? WHERE id = 1`,
      [phone || '', message || '', qr_data_url || '']
    );
  }
  const [saved] = await pool.query('SELECT phone, message, qr_data_url FROM whatsapp_settings WHERE id = 1');
  return res.json(saved[0] || {});
});

router.get('/banner', requirePermission('banner', 'read'), async (req, res) => {
  try {
    const banner = await getSiteBanner(pool);
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load banner settings' });
  }
});

router.put('/banner', requirePermission('banner', 'update'), async (req, res) => {
  try {
    const { image_data_url, image_url, feature_tabs } = req.body || {};
    const banner = await saveSiteBanner(pool, {
      imageDataUrl: image_data_url,
      imageUrl: image_url,
      featureTabs: feature_tabs
    });
    return res.json(banner);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to save banner' });
  }
});

router.get('/store-settings', requirePermission('store', 'read'), async (req, res) => {
  try {
    return res.json(await getStoreSettings());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load store settings' });
  }
});

router.put('/store-settings', requirePermission('store', 'update'), async (req, res) => {
  try {
    return res.json(await saveStoreSettings(req.body || {}));
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to save store settings' });
  }
});

router.delete('/banner', requirePermission('banner', 'delete'), async (req, res) => {
  try {
    await deleteSiteBanner(pool);
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete banner' });
  }
});

router.get('/lahza-settings', requirePermission('lahza', 'read'), async (req, res) => {
  try {
    return res.json(await getLahzaSettingsForAdmin());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load Lahza settings' });
  }
});

router.get('/lahza-settings/check', requirePermission('lahza', 'check'), async (req, res) => {
  try {
    return res.json(await getLahzaDiagnostics());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to inspect Lahza settings' });
  }
});

router.put('/lahza-settings', requirePermission('lahza', 'update'), async (req, res) => {
  try {
    return res.json(await saveLahzaSettings(req.body || {}));
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to save Lahza settings' });
  }
});

router.get('/recaptcha-settings', requirePermission('recaptcha', 'read'), async (req, res) => {
  return res.json(getRecaptchaSettings());
});

router.get('/recaptcha-settings/check', requirePermission('recaptcha', 'check'), async (req, res) => {
  return res.json(getRecaptchaDiagnostics());
});

router.put('/recaptcha-settings', requirePermission('recaptcha', 'update'), async (req, res) => {
  try {
    const current = getRecaptchaSettings();
    const nextSiteKey = String(req.body?.site_key ?? current.site_key ?? '').trim();
    const incomingSecret = req.body?.secret_key;
    const nextSecretKey = incomingSecret == null || incomingSecret === ''
      ? String(current.secret_key || '')
      : String(incomingSecret).trim();
    const nextEnabled = parseBoolean(req.body?.enabled, current.enabled);

    if (nextEnabled && !nextSiteKey) {
      return res.status(400).json({ error: 'site_key required when reCAPTCHA is enabled' });
    }
    if (nextEnabled && !nextSecretKey) {
      return res.status(400).json({ error: 'secret_key required when reCAPTCHA is enabled' });
    }
    if (nextEnabled && nextSiteKey && !/^6[0-9A-Za-z_-]{20,}$/.test(nextSiteKey)) {
      return res.status(400).json({ error: 'site_key format looks invalid' });
    }
    if (nextEnabled && nextSecretKey && !/^6[0-9A-Za-z_-]{20,}$/.test(nextSecretKey)) {
      return res.status(400).json({ error: 'secret_key format looks invalid' });
    }

    const suffix = String(config.envKey || '').toUpperCase();
    const envUpdates = {
      RECAPTCHA_ENABLED: nextEnabled ? '1' : '0',
      RECAPTCHA_SITE_KEY: nextSiteKey,
      RECAPTCHA_SECRET_KEY: nextSecretKey
    };
    if (suffix) {
      envUpdates[`RECAPTCHA_ENABLED_${suffix}`] = nextEnabled ? '1' : '0';
      envUpdates[`RECAPTCHA_SITE_KEY_${suffix}`] = nextSiteKey;
      envUpdates[`RECAPTCHA_SECRET_KEY_${suffix}`] = nextSecretKey;
    }
    upsertEnvValues(envUpdates);

    config.recaptchaEnabled = nextEnabled;
    config.recaptchaSiteKey = nextSiteKey;
    config.recaptchaSecretKey = nextSecretKey;

    return res.json(getRecaptchaSettings());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save reCAPTCHA settings' });
  }
});

function buildDemoOrderEmailPayload(targetEmail) {
  const items = [
    { product_name: 'منتج تجريبي 1', quantity: 2, unit_price: 45, line_total: 90 },
    { product_name: 'منتج تجريبي 2', quantity: 1, unit_price: 120, line_total: 120 }
  ];
  const total = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const stamp = Date.now().toString().slice(-6);

  const order = {
    id: `TEST-${stamp}`,
    customer_name: 'عميل تجريبي',
    customer_phone: '0590000000',
    customer_email: targetEmail || '',
    address_line1: 'عنوان تجريبي',
    city: 'رام الله',
    state: 'فلسطين',
    country: 'فلسطين',
    total
  };

  return { order, items };
}

router.post('/smtp-settings/test', requirePermission('smtp', 'test'), async (req, res) => {
  try {
    const { to, type = 'smtp', smtpId } = req.body || {};
    const settings = smtpId
      ? await getSmtpSettingsById(Number(smtpId), { includePassword: true })
      : await getSmtpSettings({ includePassword: true });
    if (!settings || !settings.host || !settings.username) {
      return res.status(400).json({ error: 'SMTP not configured' });
    }
    if (!settings.password) {
      if (settings.has_password) {
        return res.status(400).json({
          error: 'SMTP password could not be decrypted. Set SMTP_ENCRYPTION_KEY correctly or re-save SMTP password.'
        });
      }
      return res.status(400).json({ error: 'SMTP password is missing' });
    }

    const from = `"${settings.from_name || 'Shadi Store'}" <${settings.from_email || settings.username}>`;
    const toEmail = (to || '').trim();
    const fallbackTo = settings.from_email || settings.username;
    const notifyTo = settings.notify_email || settings.from_email || settings.username;
    const baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
    const logo = baseUrl ? `${baseUrl}/logo.png` : '';

    if (type === 'smtp') {
      await sendWithSmtpRetry(settings, {
        from,
        to: toEmail || fallbackTo,
        subject: 'اختبار SMTP',
        html: '<p>تم إعداد SMTP بنجاح.</p>'
      });
      return res.json({ ok: true, type: 'smtp' });
    }

    const demoTarget = toEmail || fallbackTo;
    const { order, items } = buildDemoOrderEmailPayload(demoTarget);

    if (type === 'customer') {
      const emailContent = await buildCustomerEmailContent({ order, logoUrl: logo, items });
      await sendWithSmtpRetry(settings, {
        from,
        to: demoTarget,
        subject: `اختبار رسالة العميل #${order.id}`,
        html: emailContent.html,
        attachments: emailContent.attachments
      });
      return res.json({ ok: true, type: 'customer' });
    }

    if (type === 'internal') {
      const emailContent = await buildInternalEmailContent({ order, logoUrl: logo, items });
      await sendWithSmtpRetry(settings, {
        from,
        to: toEmail || notifyTo,
        subject: `اختبار رسالة تجهيز الطلب #${order.id}`,
        html: emailContent.html,
        attachments: emailContent.attachments
      });
      return res.json({ ok: true, type: 'internal' });
    }

    if (type === 'both') {
      const customerEmail = await buildCustomerEmailContent({ order, logoUrl: logo, items });
      const internalEmail = await buildInternalEmailContent({ order, logoUrl: logo, items });
      await sendWithSmtpRetry(settings, {
        from,
        to: demoTarget,
        subject: `اختبار رسالة العميل #${order.id}`,
        html: customerEmail.html,
        attachments: customerEmail.attachments
      });
      await sendWithSmtpRetry(settings, {
        from,
        to: toEmail || notifyTo,
        subject: `اختبار رسالة تجهيز الطلب #${order.id}`,
        html: internalEmail.html,
        attachments: internalEmail.attachments
      });
      return res.json({ ok: true, type: 'both' });
    }

    return res.status(400).json({ error: 'invalid test type' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'SMTP test failed' });
  }
});

router.post('/import-products', requirePermission('products', 'import'), async (req, res) => {
  const { fileData, dryRun = false, mode = 'create_only' } = req.body || {};
  if (!fileData) return res.status(400).json({ error: 'fileData required' });

  const base64 = fileData.includes(',')
    ? fileData.split(',')[1]
    : fileData;

  const buffer = Buffer.from(base64, 'base64');
  const uploadsDir = getUploadSubdir('excel');
  fs.mkdirSync(uploadsDir, { recursive: true });

  try {
    const rows = parseProductsImportRows(buffer);
    if (!rows.length) {
      return res.status(400).json({ error: 'لم يتم العثور على أي صفوف صالحة في ملف Excel' });
    }
    const analysis = await analyzeProductsImport(rows, { mode });

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        mode: analysis.mode,
        totalRows: analysis.totalRows,
        skippedDuplicates: analysis.skippedDuplicates,
        skippedInvalid: analysis.skippedInvalid,
        toCreate: analysis.toCreate,
        toUpdate: analysis.toUpdate,
        createdCategories: analysis.createdCategories,
        invalidRows: analysis.invalidRows.slice(0, 20),
        previewRows: analysis.previewRows.slice(0, 25),
        errorExportBase64: analysis.errorExportBase64
      });
    }

    const conn = await pool.getConnection();
    let imported = 0;
    let updated = 0;

    try {
      ({ imported, updated } = await applyProductImportAnalysis(conn, analysis, uploadsDir));
    } finally {
      conn.release();
    }

    return res.json({
      ok: true,
      imported,
      updated,
      mode: analysis.mode,
      skippedDuplicates: analysis.skippedDuplicates,
      skippedInvalid: analysis.skippedInvalid,
      createdCategories: analysis.createdCategories,
      invalidRows: analysis.invalidRows.slice(0, 20),
      errorExportBase64: analysis.errorExportBase64,
      totalRows: analysis.totalRows
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Import failed' });
  }
});

router.get('/users', requirePermission('users', 'read'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, email, created_at, is_super_admin, permissions FROM admin_users ORDER BY id DESC');
  return res.json(rows.map((row) => serializeAdminUser(row, { fallbackFullAccess: !row.permissions })));
});

router.post('/users', requirePermission('users', 'create'), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const nextPermissions = parseAdminPermissions(req.body?.permissions || {});
  const wantsSuperAdmin = !!req.body?.is_super_admin || normalizedEmail === PRIMARY_SUPERADMIN_EMAIL;

  if (ensureCanManageSuperAdmin(req, wantsSuperAdmin)) {
    return res.status(403).json({ error: ensureCanManageSuperAdmin(req, wantsSuperAdmin) });
  }

  if (!req.admin?.is_super_admin && !hasPermission(req.admin, 'users', 'manage_permissions')) {
    return res.status(403).json({ error: 'You need permission management access to create users' });
  }

  if (!wantsSuperAdmin && countEnabledPermissions(nextPermissions) === 0) {
    return res.status(400).json({ error: 'Select at least one permission for non-superadmin users' });
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO admin_users (email, password_hash, is_super_admin, permissions) VALUES (?, ?, ?, ?)',
    [normalizedEmail, hash, wantsSuperAdmin ? 1 : 0, JSON.stringify(nextPermissions)]
  );
  const [rows] = await pool.query('SELECT id, email, created_at, is_super_admin, permissions FROM admin_users ORDER BY id DESC');
  return res.status(201).json(rows.map((row) => serializeAdminUser(row, { fallbackFullAccess: !row.permissions })));
});

router.put('/users/:id/permissions', requirePermission('users', 'manage_permissions'), async (req, res) => {
  const userId = parsePositiveId(req.params.id);
  if (!userId) return res.status(400).json({ error: 'invalid user id' });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id, email, is_super_admin, permissions FROM admin_users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    const target = rows[0];
    if (!target) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedEmail = String(target.email || '').trim().toLowerCase();
    const requestedSuperAdmin = normalizedEmail === PRIMARY_SUPERADMIN_EMAIL ? true : !!req.body?.is_super_admin;
    const superAdminError = ensureCanManageSuperAdmin(req, requestedSuperAdmin);
    if (superAdminError) {
      await conn.rollback();
      return res.status(403).json({ error: superAdminError });
    }

    if (!requestedSuperAdmin && (target.is_super_admin || normalizedEmail === PRIMARY_SUPERADMIN_EMAIL)) {
      const totalSuperAdmins = await countSuperAdmins(conn);
      if (totalSuperAdmins <= 1 || normalizedEmail === PRIMARY_SUPERADMIN_EMAIL) {
        await conn.rollback();
        return res.status(400).json({ error: 'Cannot remove super admin access from the last protected super admin' });
      }
    }

    const permissions = parseAdminPermissions(req.body?.permissions || {});
    await conn.query(
      'UPDATE admin_users SET is_super_admin = ?, permissions = ? WHERE id = ?',
      [requestedSuperAdmin ? 1 : 0, JSON.stringify(permissions), userId]
    );

    await conn.commit();

    const [updatedRows] = await pool.query('SELECT id, email, created_at, is_super_admin, permissions FROM admin_users ORDER BY id DESC');
    return res.json(updatedRows.map((row) => serializeAdminUser(row, { fallbackFullAccess: !row.permissions })));
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to update user permissions' });
  } finally {
    conn.release();
  }
});

router.put('/users/:id/password', requirePermission('users', 'update_password'), async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
  return res.json({ ok: true });
});

router.delete('/users/:id', requirePermission('users', 'delete'), async (req, res) => {
  const userId = parsePositiveId(req.params.id);
  if (!userId) return res.status(400).json({ error: 'invalid user id' });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT id, email, is_super_admin FROM admin_users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    const target = rows[0];
    if (!target) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedEmail = String(target.email || '').trim().toLowerCase();
    if (normalizedEmail === PRIMARY_SUPERADMIN_EMAIL) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cannot delete the primary super admin' });
    }

    if (target.is_super_admin) {
      const totalSuperAdmins = await countSuperAdmins(conn);
      if (totalSuperAdmins <= 1) {
        await conn.rollback();
        return res.status(400).json({ error: 'Cannot delete the last super admin' });
      }
    }

    await conn.query('DELETE FROM admin_users WHERE id = ?', [userId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to delete user' });
  } finally {
    conn.release();
  }
  return res.status(204).end();
});

export default router;
