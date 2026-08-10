import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { requireAdmin, requireAnyPermission, requirePermission } from '../middleware/auth.js';
import { config } from '../config/env.js';
import {
  buildCustomerEmailContent,
  buildInternalOrderPdf,
  buildInternalEmailContent,
  buildOrderEmailTemplatePdf,
  getSmtpSettings,
  renderCustomerEmail,
  renderInternalEmail,
  sendOrderPdfEmail,
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
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { getAppRoot, getUploadSubdir } from '../utils/app-paths.js';
import { getManagedUploadUrl } from '../utils/public-paths.js';
import {
  ADMIN_PERMISSION_DEFINITIONS,
  PRIMARY_SUPERADMIN_EMAIL,
  buildFullPermissions,
  hasPermission,
  normalizePermissions,
  resolveAdminAccess
} from '../utils/admin-permissions.js';
import { getOrderSelectFields, hasOrderAdminStatusNote, hasOrderColumn, hasOrderDiscountColumns } from '../utils/order-select-fields.js';
import { buildOrderSummary, calculateOrderDiscount, createOrderFromDraft, releaseStockForItems, reserveStockForItems } from '../utils/order.js';
import { saveUploadedProductDoc } from '../utils/product-docs.js';
import { normalizeVariantOptions, parseProductVariantOptions } from '../utils/product-variants.js';

const router = Router();
const ADMIN_SESSION_EXPIRES_IN = '30m';
const RESET_CODE_EXPIRES_MINUTES = 10;
const RESET_TOKEN_EXPIRES_IN = '15m';
const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');
const ORDER_ITEM_SELECT_FIELDS = 'id, order_id, product_id, supplier_id, product_name, color_name, color_hex, variant_id, size_name, quantity, unit_price, purchase_price, line_total';
const CATEGORY_PRODUCT_SELECT_FIELDS = 'id, name, price, purchase_price, stock, image_url, image_urls, is_available, is_hidden, categories, category, color_options, variant_options';
const ACCOUNTING_ORDER_CUTOFF = '2026-06-22 00:00:00';
const SHARAH_ADMIN_TOKEN_KEY = 'sharah_admin_token';
const PRODUCT_COLOR_OPTIONS_KEY = 'product_color_options';
const PRODUCT_SIZE_OPTIONS_KEY = 'product_size_options';
const DELIVERY_PAYER_VALUES = new Set(['customer', 'store', 'supplier']);
const CLIENT_DELIVERY_REFERENCE_SUFFIX = 'توصيل';
const CLIENT_DELIVERY_DEFAULT_NOTE = 'رسوم توصيل على الزبون';
const SUPPLIER_DELIVERY_REFERENCE_SUFFIX = 'رسوم توصيل المورد';
const SUPPLIER_DELIVERY_DEFAULT_NOTE = 'رسوم توصيل على المورد';
const CLIENT_VOUCHER_TYPE_LABELS = {
  sales_invoice: 'فاتورة بيع / مدين',
  client_receipt: 'قبض من العميل / دائن',
  client_service_debit: 'خدمات / مدين',
  client_discount_credit: 'خصم / دائن'
};
const CLIENT_VOUCHER_TRANSACTION_TYPES = {
  sales_invoice: 'debit',
  client_service_debit: 'debit',
  client_receipt: 'credit',
  client_discount_credit: 'credit'
};
const SUPPLIER_VOUCHER_TYPE_LABELS = {
  purchase_invoice: 'فاتورة شراء / دائن',
  supplier_payment: 'دفعة للمورد / مدين',
  supplier_service_credit: 'خدمات / دائن',
  supplier_discount_debit: 'خصم / مدين'
};
const SUPPLIER_VOUCHER_TRANSACTION_TYPES = {
  purchase_invoice: 'credit',
  supplier_service_credit: 'credit',
  supplier_payment: 'debit',
  supplier_discount_debit: 'debit'
};
const SHARAH_FALLBACK_API_BASES = [
  'https://shara.shadi.ps/v01/api/sharah',
  'https://shara.shadi.ps/api/sharah'
];
const IDEMPOTENCY_KEY_MAX_LENGTH = 160;
let adminIdempotencyTableReady = null;

function stableJsonStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(',')}}`;
}

function hashIdempotencyRequest(req, routeKey) {
  return crypto
    .createHash('sha256')
    .update(stableJsonStringify({
      method: req.method,
      route: routeKey,
      params: req.params || {},
      query: req.query || {},
      body: req.body || {}
    }))
    .digest('hex');
}

async function ensureAdminIdempotencyTable() {
  if (!adminIdempotencyTableReady) {
    adminIdempotencyTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS admin_idempotency_keys (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        admin_scope VARCHAR(120) NOT NULL,
        idempotency_key VARCHAR(160) NOT NULL,
        method VARCHAR(12) NOT NULL,
        route_key VARCHAR(160) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        status_code INT NULL,
        response_json LONGTEXT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_admin_idempotency_key (admin_scope, idempotency_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
  await adminIdempotencyTableReady;
}

export function __resetAdminIdempotencyForTests() {
  adminIdempotencyTableReady = null;
}

export function adminIdempotency(routeKey) {
  return async (req, res, next) => {
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
    if (!idempotencyKey) return next();
    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return res.status(400).json({ error: 'Idempotency-Key is too long' });
    }

    const adminScope = String(req.admin?.id || req.admin?.email || 'admin');
    const requestHash = hashIdempotencyRequest(req, routeKey);

    try {
      await ensureAdminIdempotencyTable();
      const [insertResult] = await pool.query(
        `INSERT IGNORE INTO admin_idempotency_keys (admin_scope, idempotency_key, method, route_key, request_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [adminScope, idempotencyKey, req.method, routeKey, requestHash]
      );

      if (insertResult.affectedRows === 0) {
        const [rows] = await pool.query(
          `SELECT request_hash, status_code, response_json
             FROM admin_idempotency_keys
            WHERE admin_scope = ?
              AND idempotency_key = ?
            LIMIT 1`,
          [adminScope, idempotencyKey]
        );
        const existing = rows[0];
        if (!existing) {
          return res.status(409).json({ error: 'Duplicate request is already processing' });
        }
        if (existing.request_hash !== requestHash) {
          return res.status(409).json({ error: 'Idempotency-Key was reused with different request data' });
        }
        if (!existing.status_code) {
          return res.status(409).json({ error: 'Duplicate request is already processing' });
        }
        let responseBody = {};
        try {
          responseBody = existing.response_json ? JSON.parse(existing.response_json) : {};
        } catch {
          responseBody = {};
        }
        return res.status(existing.status_code).json(responseBody);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const statusCode = res.statusCode || 200;
        pool.query(
          `UPDATE admin_idempotency_keys
              SET status_code = ?, response_json = ?
            WHERE admin_scope = ?
              AND idempotency_key = ?`,
          [statusCode, JSON.stringify(body ?? null), adminScope, idempotencyKey]
        ).catch((err) => {
          console.error('Failed to persist admin idempotency response', err);
        });
        return originalJson(body);
      };

      return next();
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to check duplicate request' });
    }
  };
}

function addAccountingOrderCutoff(conditions, orderAlias = 'o') {
  conditions.push(`${orderAlias}.created_at >= '${ACCOUNTING_ORDER_CUTOFF}'`);
}

function addAccountingDeliveredOrderOnly(conditions, orderAlias = 'o') {
  conditions.push(`${orderAlias}.status = 'delivered'`);
}

function addAccountingJournalOrderCutoff(conditions, journalAlias = '') {
  const prefix = journalAlias ? `${journalAlias}.` : '';
  conditions.push(`(${prefix}order_id IS NULL OR EXISTS (SELECT 1 FROM orders cutoff_o WHERE cutoff_o.id = ${prefix}order_id AND cutoff_o.created_at >= '${ACCOUNTING_ORDER_CUTOFF}' AND cutoff_o.status = 'delivered'))`);
}

router.post(
  '/product-docs',
  requirePermission('products', 'update'),
  express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '30mb' }),
  async (req, res) => {
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length === 0) return res.status(400).json({ error: 'PDF file is required' });
    if (buffer.slice(0, 5).toString('utf8') !== '%PDF-') return res.status(400).json({ error: 'Only PDF files are allowed' });

    const rawName = String(req.get('x-file-name') || 'document.pdf').trim();
    const fileName = decodeURIComponent(rawName || 'document.pdf');
    const doc = await saveUploadedProductDoc(buffer, fileName);
    return res.status(201).json(doc);
  }
);

router.get('/products', requirePermission('products', 'read'), async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id,
            p.name,
            p.price,
            p.mrp,
            p.stock,
            p.brand,
            p.type,
            p.supplier_id,
            p.purchase_price,
            s.name AS supplier_name,
            p.category,
            p.categories,
            p.is_available,
            p.is_hidden,
            p.created_at,
            p.updated_at
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.id DESC`
  );
  return res.json(rows.map((row) => {
    let categories = [];
    try {
      const parsed = Array.isArray(row.categories) ? row.categories : JSON.parse(row.categories || 'null');
      categories = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      categories = [];
    }
    if (!categories.length && row.category) categories = [row.category];
    return {
      ...row,
      categories,
      category: categories[0] || row.category || null
    };
  }));
});

router.get('/products/export', requirePermission('products', 'read'), async (req, res) => {
  const format = normalizeExportFormat(req.query.format);
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.technical_data, p.\`usage\`, p.warnings,
            p.price, p.mrp, p.stock, p.brand, p.type, p.category, p.categories,
            p.is_available, p.is_hidden, p.purchase_price,
            p.image_url, p.variant_options,
            s.name AS supplier_name, s.contact_info AS supplier_phone, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.id DESC`
  );
  const exportRows = rows.flatMap((row) => {
    const variants = parseProductVariantOptions(row.variant_options);
    if (!variants.length) return [{ ...row, __variant: null }];
    return variants.map((variant) => ({ ...row, __variant: variant }));
  });

  return sendTableExport(res, {
    format,
    filename: 'products',
    sheetName: 'المنتجات',
    columns: [
      { key: 'name', label: 'اسم المنتج' },
      { key: 'categories', label: 'الفئات', value: (row) => parseStoredCategories(row.categories, row.category).join('، ') },
      { key: 'price', label: 'سعر البيع' },
      { key: 'purchase_price', label: 'سعر الشراء' },
      { key: 'supplier_name', label: 'المورد', value: (row) => row.supplier_name || '' },
      { key: 'description', label: 'الوصف' },
      { key: 'technical_data', label: 'بيانات فنية' },
      { key: 'usage', label: 'تعليمات الاستخدام' },
      { key: 'warnings', label: 'تحذيرات' },
      { key: 'is_available', label: 'متوفر', value: (row) => row.is_available ? 'نعم' : 'لا' },
      { key: 'is_hidden', label: 'مخفي', value: (row) => row.is_hidden ? 'نعم' : 'لا' },
      { key: 'variant_color', label: 'لون الخيار', value: (row) => row.__variant?.color_name || '' },
      { key: 'variant_hex', label: 'كود لون الخيار', value: (row) => row.__variant?.color_hex || '' },
      { key: 'variant_size', label: 'قياس الخيار', value: (row) => row.__variant?.size_name || '' },
      { key: 'variant_price', label: 'سعر بيع الخيار', value: (row) => row.__variant?.price ?? '' },
      { key: 'variant_purchase_price', label: 'سعر شراء الخيار', value: (row) => row.__variant?.purchase_price ?? '' },
      { key: 'created_at', label: 'تاريخ الإنشاء', value: (row) => formatExportDate(row.created_at) },
      { key: 'updated_at', label: 'آخر تحديث', value: (row) => formatExportDate(row.updated_at) }
    ],
    rows: exportRows
  });
});

async function ensureAdminGlobalSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_global_settings (
      setting_key VARCHAR(120) NOT NULL,
      setting_value TEXT NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAdminGlobalSetting(key) {
  await ensureAdminGlobalSettingsTable();
  const [rows] = await pool.query('SELECT setting_value FROM admin_global_settings WHERE setting_key = ? LIMIT 1', [key]);
  return String(rows[0]?.setting_value || '').trim();
}

async function saveAdminGlobalSetting(key, value) {
  await ensureAdminGlobalSettingsTable();
  await pool.query(
    `INSERT INTO admin_global_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [key, String(value || '').trim()]
  );
}

function parseAdminJsonSetting(value, fallback = []) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeHexColor(value) {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toUpperCase()}`;
  return '';
}

function normalizeProductColorOptions(value = []) {
  const seen = new Set();
  const colors = [];
  for (const item of Array.isArray(value) ? value : []) {
    const name = String(item?.name || '').trim();
    const hex = normalizeHexColor(item?.hex || item?.color_hex || item?.rgb);
    if (!name || !hex) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push({
      id: String(item?.id || `color-${Date.now()}-${colors.length + 1}`),
      name,
      hex
    });
  }
  return colors;
}

function normalizeProductSizeOptions(value = []) {
  const seenGroups = new Set();
  const groups = [];
  for (const item of Array.isArray(value) ? value : []) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const groupKey = name.toLowerCase();
    if (seenGroups.has(groupKey)) continue;
    seenGroups.add(groupKey);
    const seenSizes = new Set();
    const sizes = (Array.isArray(item?.sizes) ? item.sizes : [])
      .map((size) => ({
        value: String(size?.value || '').trim(),
        unit: String(size?.unit || '').trim()
      }))
      .filter((size) => {
        if (!size.value) return false;
        const key = `${size.value} ${size.unit}`.trim().toLowerCase();
        if (seenSizes.has(key)) return false;
        seenSizes.add(key);
        return true;
      });
    groups.push({
      id: String(item?.id || `size-group-${Date.now()}-${groups.length + 1}`),
      name,
      sizes
    });
  }
  return groups;
}

router.get('/product-options/colors', requirePermission('products', 'read'), async (_req, res) => {
  const colors = await ensureFixedColorOptions();
  return res.json(colors);
});

router.put('/product-options/colors', requirePermission('products', 'update'), async (req, res) => {
  const colors = normalizeProductColorOptions(req.body?.colors || req.body || []);
  await saveAdminGlobalSetting(PRODUCT_COLOR_OPTIONS_KEY, JSON.stringify(colors));
  return res.json(colors);
});

async function ensureFixedColorOptions() {
  const raw = await getAdminGlobalSetting(PRODUCT_COLOR_OPTIONS_KEY);
  const colors = normalizeProductColorOptions(parseAdminJsonSetting(raw));
  const next = [...colors];
  let changed = false;
  for (const [colorNo, color] of FIXED_IMPORT_COLORS.entries()) {
    const exists = next.some((item) => String(item.name || '').trim().toLowerCase() === color.name.toLowerCase());
    if (exists) continue;
    next.push({ id: `fixed-color-${colorNo}`, name: color.name, hex: color.hex });
    changed = true;
  }
  if (changed) await saveAdminGlobalSetting(PRODUCT_COLOR_OPTIONS_KEY, JSON.stringify(next));
  return next;
}

router.get('/product-options/sizes', requirePermission('products', 'read'), async (_req, res) => {
  const raw = await getAdminGlobalSetting(PRODUCT_SIZE_OPTIONS_KEY);
  return res.json(normalizeProductSizeOptions(parseAdminJsonSetting(raw)));
});

router.put('/product-options/sizes', requirePermission('products', 'update'), async (req, res) => {
  const sizes = normalizeProductSizeOptions(req.body?.groups || req.body || []);
  await saveAdminGlobalSetting(PRODUCT_SIZE_OPTIONS_KEY, JSON.stringify(sizes));
  return res.json(sizes);
});

async function getConfiguredSharahAdminToken() {
  return (await getAdminGlobalSetting(SHARAH_ADMIN_TOKEN_KEY)) || String(config.sharahAdminToken || '').trim();
}

function normalizeSharahApiBase(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return SHARAH_FALLBACK_API_BASES[0];
  try {
    const url = new URL(text);
    if (/^\/api\/sharah\/?$/i.test(url.pathname)) return `${url.origin}/v01/api/sharah`;
  } catch {
    if (/^\/api\/sharah\/?$/i.test(text)) return '/v01/api/sharah';
  }
  return text;
}

function getSharahApiBases() {
  const bases = [normalizeSharahApiBase(config.sharahApiBase), ...SHARAH_FALLBACK_API_BASES.map(normalizeSharahApiBase)];
  return Array.from(new Set(bases.filter(Boolean)));
}

function buildSharahUrlWithBase(baseValue, path, query = {}) {
  const base = normalizeSharahApiBase(baseValue);
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  const url = new URL(`${base}${safePath}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function fetchSharah(path, { method = 'GET', query, body, admin = false } = {}) {
  const headers = {};
  if (method !== 'GET' && method !== 'DELETE') headers['Content-Type'] = 'application/json';
  if (admin) {
    const sharahToken = await getConfiguredSharahAdminToken();
    if (sharahToken) headers['X-Admin-Token'] = sharahToken;
  }

  let lastError = null;
  for (const base of getSharahApiBases()) {
    const response = await fetch(buildSharahUrlWithBase(base, path, query), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body || {}) } : {})
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text || 'Shara returned a non-JSON response' };
    }

    if (!response.ok) {
      const error = new Error(data?.detail || data?.message || data?.error || 'Shara request failed');
      error.status = response.status;
      lastError = error;
      if (response.status === 404) continue;
      throw error;
    }

    if (typeof data?.message === 'string' && data.message.includes('WSGIAdapter')) {
      lastError = Object.assign(new Error('Shara returned WSGI source instead of API JSON'), { status: 502 });
      continue;
    }

    return data;
  }

  throw lastError || Object.assign(new Error('Shara request failed'), { status: 502 });
}

async function fetchSharahReadable(path, query = {}) {
  const hasToken = !!(await getConfiguredSharahAdminToken());
  if (!hasToken) return fetchSharah(path, { query });
  try {
    return await fetchSharah(path, { query: { ...query, include_hidden: 1 }, admin: true });
  } catch (err) {
    if (err.status !== 401 && err.status !== 403) throw err;
    return fetchSharah(path, { query });
  }
}
const ALLOWED_ORDER_STATUSES = new Set([
  'pending_payment',
  'paid',
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function resolveInternalOrderEmailRecipient(order, customEmail = '') {
  const requested = String(customEmail || '').trim();
  if (requested) return isValidEmail(requested) ? requested : '';

  let notifyTo = config.orderNotifyEmail;
  if (!notifyTo) {
    try {
      const smtp = await getSmtpSettings();
      notifyTo = smtp?.notify_email || smtp?.from_email || smtp?.username;
    } catch {
      notifyTo = null;
    }
  }

  if (!notifyTo || !isValidEmail(notifyTo)) {
    notifyTo = order?.customer_email;
  }

  return isValidEmail(notifyTo) ? String(notifyTo).trim() : '';
}

async function sendInternalOrderEmailById(orderId, order = null) {
  const currentOrder = order || (await (async () => {
    const orderSelectFields = await getOrderSelectFields();
    const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
    return orders[0] || null;
  })());
  if (!currentOrder) return { sent: false, skipped: true, reason: 'Order not found' };

  const to = await resolveInternalOrderEmailRecipient(currentOrder);
  if (!to) return { sent: false, skipped: true, reason: 'Internal notification email is not configured correctly' };

  const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);
  const [payments] = await pool.query(
    'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [orderId]
  );
  const result = await sendInternalOrderEmail({ to, order: currentOrder, items, payment: payments[0] || null });
  return { sent: !!result?.sent, skipped: !!result?.skipped, sentTo: to };
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

function hasImportValue(row, keys) {
  return keys.some((key) => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '');
}

function hasImportColumn(row, keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(row, key));
}

function normalizeImportName(value) {
  return String(value || '').trim().toLowerCase();
}

const CATEGORY_IMPORT_ALIASES = new Map([
  [normalizeImportName('السيليكون'), 'مواد السيليكون والسيلنت والتثبيت']
]);

function normalizeCategoryNames(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[،,]+/);
  const seen = new Set();
  const cleaned = [];
  for (const entry of raw) {
    const rawName = String(entry || '').trim();
    const name = CATEGORY_IMPORT_ALIASES.get(normalizeImportName(rawName)) || rawName;
    if (!name) continue;
    const normalized = normalizeImportName(name);
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

function parseMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN;
}

function normalizeCustomerLookupValue(value) {
  return String(value || '').trim();
}

function normalizeCustomerLookupKey(value) {
  return normalizeCustomerLookupValue(value).toLowerCase();
}

function doesClientMatchOrderCustomer(client = {}, order = {}) {
  const orderName = normalizeCustomerLookupKey(order.customer_name);
  const clientName = normalizeCustomerLookupKey(client.name);
  return !!orderName && !!clientName && orderName === clientName;
}

function isPlaceholderCustomerEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email === 'nill'
    || email === 'nil'
    || email === 'none'
    || email === 'noemail'
    || email === 'nill@nill.com'
    || email === 'nil@nil.com'
    || email === 'nll@nill.com'
    || email === 'nill@nll.com'
    || email === 'noemail@noemail.com'
    || email === 'none@none.com';
}

function normalizeDeliveryPayer(value) {
  const payer = String(value || '').trim();
  if (payer === 'merchant' || payer === 'me') return 'store';
  return payer;
}

export function normalizeSupplierDeliveryRows(rows = [], allowedSupplierIds = []) {
  if (!Array.isArray(rows)) {
    throw Object.assign(new Error('supplier_deliveries must be an array'), { statusCode: 400 });
  }

  const allowed = new Set(Array.from(allowedSupplierIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0));
  const seen = new Set();
  const normalized = [];
  let totalAmount = 0;

  for (const row of rows) {
    const supplierId = parsePositiveId(row?.supplier_id);
    if (!supplierId || !allowed.has(supplierId)) {
      throw Object.assign(new Error('supplier delivery supplier_id must belong to this order'), { statusCode: 400 });
    }
    if (seen.has(supplierId)) {
      throw Object.assign(new Error('supplier delivery supplier_id must be unique'), { statusCode: 400 });
    }
    seen.add(supplierId);

    const amount = parseMoney(row?.amount ?? 0);
    if (Number.isNaN(amount) || amount < 0) {
      throw Object.assign(new Error('supplier delivery amount must be zero or greater'), { statusCode: 400 });
    }

    const note = String(row?.note || '').trim() || null;
    totalAmount = Math.round((totalAmount + amount) * 100) / 100;
    normalized.push({ supplier_id: supplierId, amount, note });
  }

  return { rows: normalized, totalAmount };
}

function parseJournalDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

const tableColumnCache = new Map();

async function hasTableColumn(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (tableColumnCache.has(key)) return tableColumnCache.get(key);
  try {
    const [rows] = await pool.query(
      `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      [tableName, columnName]
    );
    tableColumnCache.set(key, rows.length > 0);
  } catch {
    tableColumnCache.set(key, false);
  }
  return tableColumnCache.get(key);
}

async function hasClientJournalVoucherType() {
  return hasTableColumn('client_journal_entries', 'voucher_type');
}

async function hasSupplierJournalVoucherType() {
  return hasTableColumn('journal_entries', 'voucher_type');
}

async function hasClientSourceColumn() {
  return hasTableColumn('clients', 'source');
}

async function getClientVoucherTypeSelect(alias = 'cje') {
  return (await hasClientJournalVoucherType())
    ? `${alias}.voucher_type`
    : `CASE WHEN ${alias}.transaction_type = 'debit' THEN 'sales_invoice' ELSE 'client_receipt' END AS voucher_type`;
}

async function getSupplierVoucherTypeSelect(alias = 'je') {
  return (await hasSupplierJournalVoucherType())
    ? `${alias}.voucher_type`
    : `CASE WHEN ${alias}.transaction_type = 'credit' THEN 'purchase_invoice' ELSE 'supplier_payment' END AS voucher_type`;
}

function getClientVoucherLabel(row) {
  return CLIENT_VOUCHER_TYPE_LABELS[row?.voucher_type] || (row?.transaction_type === 'debit' ? 'فاتورة بيع / مدين' : 'قبض من العميل / دائن');
}

function getSupplierVoucherLabel(row) {
  return SUPPLIER_VOUCHER_TYPE_LABELS[row?.voucher_type] || (row?.transaction_type === 'credit' ? 'فاتورة شراء' : 'دفعة للمورد');
}

function getReportDateRange(query = {}) {
  return {
    dateFrom: parseJournalDate(query.date_from),
    dateTo: parseJournalDate(query.date_to)
  };
}

function addDateRangeWhere(conditions, params, column, dateFrom, dateTo) {
  if (dateFrom) {
    conditions.push(`${column} >= ?`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(dateTo);
  }
}

function addOrderStatusWhere(conditions, params, status) {
  const normalized = String(status || '').trim();
  if (!normalized) {
    conditions.push("o.status <> 'cancelled'");
    return;
  }
  if (!ALLOWED_ORDER_STATUSES.has(normalized) || normalized === 'cancelled') {
    conditions.push('1 = 0');
    return;
  }
  conditions.push('o.status = ?');
  params.push(normalized);
}

function normalizeExportFormat(value) {
  const format = String(value || '').trim().toLowerCase();
  if (format === 'xlsx') return 'xlsx';
  if (format === 'pdf') return 'pdf';
  return 'csv';
}

function formatExportDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function escapeCsvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function resolveReportPdfFontPath() {
  const fontPath = path.join(getAppRoot(), 'email-assets', 'KoufiyaLT-Regular.ttf');
  return fs.existsSync(fontPath) ? fontPath : '';
}

function reportTextValue(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeReportPdfText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function visualReportRtl(value) {
  const text = normalizeReportPdfText(value);
  if (!text) return '';
  return text.split(' ').reverse().join(' ');
}

function sendPdfTableExport(res, { filename, sheetName, columns, rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: sheetName || filename } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.send(Buffer.concat(chunks));
  });

  const fontPath = resolveReportPdfFontPath();
  if (fontPath) doc.font(fontPath);

  const page = { width: 595.28, height: 841.89 };
  const margin = 40;
  const width = page.width - margin * 2;
  const orange = '#f99d1c';
  const orangeLight = '#fff7ed';
  const border = '#fed7aa';
  const ink = '#111827';
  const muted = '#4b5563';
  let y = 34;

  const ensureSpace = (height = 110) => {
    if (y + height <= page.height - 48) return;
    doc.addPage({ size: 'A4', margin: 0 });
    y = 42;
  };

  const write = (text, x, textY, options = {}) => {
    doc.fillColor(options.color || ink).fontSize(options.size || 10);
    const pdfText = normalizeReportPdfText(text);
    const textOptions = {
      width: options.width || width,
      align: options.align || 'right',
      lineGap: options.lineGap ?? 4
    };
    doc.text(pdfText, x, textY, textOptions);
    const nextY = doc.y;
    if (options.bold !== false) {
      doc.text(pdfText, x + 0.22, textY, textOptions);
      doc.y = nextY;
    }
    return nextY;
  };
  const writeRtl = (text, x, textY, options = {}) => write(visualReportRtl(text), x, textY, options);

  doc.roundedRect(margin, y, width, 128, 24).fillAndStroke('#ffedd5', border);
  doc.roundedRect(margin + width - 116, y + 22, 92, 25, 12).fillAndStroke('#ffffff', border);
  writeRtl('تقرير PDF', margin + width - 108, y + 30, { width: 76, size: 10, color: '#b45309', align: 'center' });
  writeRtl(sheetName || filename, margin + 28, y + 64, { width: width - 56, size: 22, color: ink, align: 'right' });
  writeRtl(`عدد السجلات: ${safeRows.length}`, margin + 28, y + 100, { width: width - 56, size: 11, color: muted, align: 'right' });
  y += 154;

  const drawField = (label, value, x, fieldY, fieldW) => {
    doc.roundedRect(x, fieldY, fieldW, 30, 12).fillAndStroke('#ffffff', '#e5e7eb');
    writeRtl(`${label}: ${reportTextValue(value)}`, x + 10, fieldY + 9, { width: fieldW - 20, size: 9.5, color: ink, align: 'right' });
  };

  const drawRow = (row, index) => {
    const rowFields = columns.map((column) => ({
      label: column.label,
      value: column.value ? column.value(row) : row[column.key]
    }));
    const pairs = Math.ceil(rowFields.length / 2);
    const cardHeight = 58 + pairs * 36;
    ensureSpace(cardHeight + 16);

    doc.roundedRect(margin, y, width, cardHeight, 18).fillAndStroke(index % 2 === 0 ? '#ffffff' : '#fffaf4', '#e5e7eb');
    doc.circle(margin + width - 28, y + 27, 14).fill(orange);
    write(`#${index + 1}`, margin + width - 42, y + 20, { width: 28, size: 11, color: '#ffffff', align: 'center' });
    writeRtl(rowFields[0]?.value || sheetName || filename, margin + 24, y + 19, { width: width - 72, size: 14, color: '#9a3412', align: 'right' });

    let fieldY = y + 52;
    const gap = 10;
    const fieldW = (width - 48 - gap) / 2;
    for (let i = 0; i < rowFields.length; i += 2) {
      const right = rowFields[i];
      const left = rowFields[i + 1];
      if (right) drawField(right.label, right.value, margin + 24 + fieldW + gap, fieldY, fieldW);
      if (left) drawField(left.label, left.value, margin + 24, fieldY, fieldW);
      fieldY += 36;
    }
    y += cardHeight + 16;
  };

  if (safeRows.length === 0) {
    doc.roundedRect(margin, y, width, 64, 16).fillAndStroke(orangeLight, border);
    writeRtl('لا توجد بيانات ضمن الفلاتر الحالية', margin + 24, y + 24, { width: width - 48, size: 13, color: '#9a3412', align: 'right' });
  } else {
    safeRows.forEach(drawRow);
  }

  doc.end();
}

function sendTableExport(res, { format, filename, sheetName, columns, rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const exportedRows = safeRows.map((row) => {
    const mapped = {};
    columns.forEach((column) => {
      mapped[column.label] = column.value ? column.value(row) : row[column.key];
    });
    return mapped;
  });

  if (format === 'xlsx') {
    const labels = columns.map((column) => column.label);
    const worksheet = XLSX.utils.json_to_sheet(exportedRows, { header: labels });
    worksheet['!cols'] = labels.map((label) => ({ wch: Math.max(12, String(label || '').length + 6) }));
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(exportedRows.length, 1), c: Math.max(labels.length - 1, 0) } }) };
    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  }

  if (format === 'pdf') {
    return sendPdfTableExport(res, { filename, sheetName, columns, rows: safeRows });
  }

  const labels = columns.map((column) => column.label);
  const lines = [labels.map(escapeCsvCell).join(',')];
  exportedRows.forEach((row) => {
    lines.push(labels.map((label) => escapeCsvCell(row[label])).join(','));
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  return res.send(`\ufeff${lines.join('\n')}`);
}

async function getOrderItemDetailsMap(orderIds = [], options = {}) {
  const ids = Array.from(new Set(orderIds.map((id) => Number(id)).filter(Boolean)));
  if (!ids.length) return new Map();

  const conditions = [`oi.order_id IN (${ids.map(() => '?').join(',')})`];
  const params = [...ids];
  if (options.supplierId) {
    conditions.push('COALESCE(oi.supplier_id, p.supplier_id) = ?');
    params.push(Number(options.supplierId));
  }

  const [rows] = await pool.query(
    `SELECT oi.order_id,
            oi.product_id,
            oi.product_name,
            oi.quantity,
            oi.unit_price,
            oi.line_total,
            COALESCE(oi.purchase_price, 0) AS purchase_price,
            ROUND(oi.quantity * COALESCE(oi.purchase_price, 0), 2) AS purchase_total,
            ROUND(oi.line_total - (oi.quantity * COALESCE(oi.purchase_price, 0)), 2) AS profit_total
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY oi.order_id ASC, oi.id ASC`,
    params
  );

  const map = new Map();
  rows.forEach((row) => {
    const key = String(row.order_id);
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  });
  return map;
}

function attachOrderItemSummaries(rows = [], itemMap = new Map()) {
  return rows.map((row) => {
    const items = itemMap.get(String(row.order_id)) || [];
    const totalSales = items.reduce((total, item) => total + Number(item.line_total || 0), 0);
    const purchaseTotal = items.reduce((total, item) => total + Number(item.purchase_total || 0), 0);
    const netProfit = items.reduce((total, item) => total + Number(item.profit_total || 0), 0);
    return {
      ...row,
      items,
      total_sales: totalSales,
      purchase_total: purchaseTotal,
      net_profit: netProfit,
      product_names: items.map((item) => item.product_name).filter(Boolean).join('، ')
    };
  });
}

async function getSupplierReportData(query = {}) {
  const supplierId = parsePositiveId(query.supplier_id);
  const { dateFrom, dateTo } = getReportDateRange(query);
  const balanceFilter = String(query.balance_filter || '').trim();
  const journalConditions = [];
  const journalParams = [];
  const orderConditions = [];
  const orderParams = [];
  const supplierConditions = [];
  const supplierParams = [];
  addDateRangeWhere(journalConditions, journalParams, 'date', dateFrom, dateTo);
  addDateRangeWhere(orderConditions, orderParams, 'o.created_at', dateFrom, dateTo);
  addAccountingJournalOrderCutoff(journalConditions);
  addAccountingOrderCutoff(orderConditions, 'o');
  addAccountingDeliveredOrderOnly(orderConditions, 'o');
  if (supplierId) {
    journalConditions.push('supplier_id = ?');
    journalParams.push(supplierId);
    orderConditions.push('COALESCE(oi.supplier_id, p.supplier_id) = ?');
    orderParams.push(supplierId);
    supplierConditions.push('s.id = ?');
    supplierParams.push(supplierId);
  }
  const journalWhere = journalConditions.length ? `WHERE ${journalConditions.join(' AND ')}` : '';
  const orderWhere = orderConditions.length ? `WHERE ${orderConditions.join(' AND ')}` : '';
  if (balanceFilter === 'outstanding') {
    supplierConditions.push('ROUND(s.account_balance, 2) <> 0');
  } else if (balanceFilter === 'settled') {
    supplierConditions.push('ROUND(s.account_balance, 2) = 0');
  }
  const supplierWhere = supplierConditions.length ? `WHERE ${supplierConditions.join(' AND ')}` : '';

  const [summaryRows] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) AS total_purchases,
            COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) AS total_payments,
            COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END), 0) AS net_movement,
            COUNT(*) AS entries_count
       FROM journal_entries
       ${journalWhere}`,
    journalParams
  );

  const [rows] = await pool.query(
     `SELECT s.id AS supplier_id,
             s.name AS supplier_name,
             s.contact_info,
             s.account_balance AS current_outstanding_balance,
             COALESCE(pa.products_count, 0) AS products_count,
            COALESCE(ja.total_purchases, 0) AS total_purchases,
            COALESCE(ja.total_payments, 0) AS total_payments,
            COALESCE(ja.net_movement, 0) AS net_movement,
            COALESCE(ja.entries_count, 0) AS entries_count,
            COALESCE(os.total_sales, 0) AS total_sales,
            COALESCE(os.purchase_total, 0) AS purchase_total,
            COALESCE(os.net_profit, 0) AS net_profit,
            COALESCE(os.order_refs, '') AS order_refs,
            COALESCE(os.product_names, '') AS product_names
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id, COUNT(*) AS products_count
           FROM products
          WHERE supplier_id IS NOT NULL
          GROUP BY supplier_id
       ) pa ON pa.supplier_id = s.id
       LEFT JOIN (
         SELECT supplier_id,
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS total_purchases,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS total_payments,
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END) AS net_movement,
                COUNT(*) AS entries_count
            FROM journal_entries
           ${journalWhere}
           GROUP BY supplier_id
        ) ja ON ja.supplier_id = s.id
       LEFT JOIN (
         SELECT COALESCE(oi.supplier_id, p.supplier_id) AS supplier_id,
                ROUND(COALESCE(SUM(oi.line_total), 0), 2) AS total_sales,
                ROUND(COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price, 0)), 0), 2) AS purchase_total,
                ROUND(COALESCE(SUM(oi.line_total - (oi.quantity * COALESCE(oi.purchase_price, 0))), 0), 2) AS net_profit,
                GROUP_CONCAT(DISTINCT o.id ORDER BY o.id DESC SEPARATOR ' ') AS order_refs,
                GROUP_CONCAT(DISTINCT oi.product_name ORDER BY oi.product_name SEPARATOR '، ') AS product_names
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           JOIN orders o ON o.id = oi.order_id
          ${orderWhere}
          GROUP BY COALESCE(oi.supplier_id, p.supplier_id)
       ) os ON os.supplier_id = s.id
         ${supplierWhere}
      ORDER BY s.name ASC, s.id ASC`,
    [...journalParams, ...orderParams, ...supplierParams]
  );

  const summary = summaryRows[0] || {};
  summary.current_outstanding_balance = rows.reduce((total, row) => total + Number(row.current_outstanding_balance || 0), 0);
  summary.total_sales = rows.reduce((total, row) => total + Number(row.total_sales || 0), 0);
  summary.purchase_total = rows.reduce((total, row) => total + Number(row.purchase_total || 0), 0);
  summary.net_profit = rows.reduce((total, row) => total + Number(row.net_profit || 0), 0);
  return { summary, rows };
}

async function getSupplierStatementData(supplierId, query = {}) {
  const { dateFrom, dateTo } = getReportDateRange(query);
  const conditions = ['je.supplier_id = ?'];
  const params = [supplierId];
  addDateRangeWhere(conditions, params, 'je.date', dateFrom, dateTo);
  addAccountingJournalOrderCutoff(conditions, 'je');

  const [suppliers] = await pool.query(
    `SELECT s.id, s.name, s.contact_info, s.account_balance
       FROM suppliers s
      WHERE s.id = ?
      LIMIT 1`,
    [supplierId]
  );
  if (!suppliers[0]) return null;

  const voucherTypeSelect = await getSupplierVoucherTypeSelect('je');
  const [rows] = await pool.query(
    `SELECT je.id, je.order_id, je.transaction_type, ${voucherTypeSelect}, je.amount, je.reference_doc, je.note, je.date, je.created_at,
            SUM(CASE WHEN je.transaction_type = 'credit' THEN je.amount ELSE -je.amount END)
              OVER (ORDER BY je.date ASC, je.id ASC) AS running_balance
       FROM journal_entries je
      WHERE ${conditions.join(' AND ')}
      ORDER BY je.date ASC, je.id ASC`,
    params
  );

  const itemMap = await getOrderItemDetailsMap(rows.map((row) => row.order_id), { supplierId });
  return { supplier: suppliers[0], rows: attachOrderItemSummaries(rows, itemMap) };
}

async function getSupplierPurchaseInvoiceData(supplierId, entryId) {
  const [entries] = await pool.query(
    `SELECT je.id, je.supplier_id, je.order_id, je.transaction_type, je.amount, je.reference_doc, je.date, je.created_at,
            s.name AS supplier_name
       FROM journal_entries je
       JOIN suppliers s ON s.id = je.supplier_id
      WHERE je.id = ? AND je.supplier_id = ? AND je.transaction_type = 'credit'
      LIMIT 1`,
    [entryId, supplierId]
  );
  const invoice = entries[0];
  if (!invoice) return null;

  if (!invoice.order_id) {
    const orderMatch = String(invoice.reference_doc || '').match(/طلب\s*#\s*(\d+)/);
    invoice.order_id = orderMatch ? Number(orderMatch[1]) : null;
  }

  const rows = invoice.order_id
    ? await getSupplierOrderRows(supplierId, { order_id: invoice.order_id })
    : [];
  return { invoice, rows };
}

async function getClientReportData(query = {}) {
  const clientId = parsePositiveId(query.client_id);
  const { dateFrom, dateTo } = getReportDateRange(query);
  const balanceFilter = String(query.balance_filter || '').trim();
  const journalConditions = [];
  const journalParams = [];
  const orderConditions = ['o.client_id IS NOT NULL'];
  const orderParams = [];
  const clientConditions = [];
  const clientParams = [];
  addDateRangeWhere(journalConditions, journalParams, 'date', dateFrom, dateTo);
  addDateRangeWhere(orderConditions, orderParams, 'o.created_at', dateFrom, dateTo);
  addAccountingJournalOrderCutoff(journalConditions);
  addAccountingOrderCutoff(orderConditions, 'o');
  addAccountingDeliveredOrderOnly(orderConditions, 'o');
  if (clientId) {
    journalConditions.push('client_id = ?');
    journalParams.push(clientId);
    orderConditions.push('o.client_id = ?');
    orderParams.push(clientId);
    clientConditions.push('c.id = ?');
    clientParams.push(clientId);
  }
  if (balanceFilter === 'outstanding') {
    clientConditions.push('ROUND(c.account_balance, 2) <> 0');
  } else if (balanceFilter === 'settled') {
    clientConditions.push('ROUND(c.account_balance, 2) = 0');
  }
  const journalWhere = journalConditions.length ? `WHERE ${journalConditions.join(' AND ')}` : '';
  const orderWhere = orderConditions.length ? `WHERE ${orderConditions.join(' AND ')}` : '';
  const clientWhere = clientConditions.length ? `WHERE ${clientConditions.join(' AND ')}` : '';
  const hasClientSource = await hasClientSourceColumn();
  const clientSourceSelect = hasClientSource ? 'c.source' : "'manual' AS source";

  const [summaryRows] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) AS total_sales,
            COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) AS total_receipts,
            COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE -amount END), 0) AS net_movement,
            COUNT(*) AS entries_count
       FROM client_journal_entries
       ${journalWhere}`,
    journalParams
  );

  const [rows] = await pool.query(
     `SELECT c.id AS client_id,
             c.name AS client_name,
             c.contact_info,
             c.email,
             c.phone,
             ${clientSourceSelect},
             c.account_balance AS current_outstanding_balance,
             COUNT(DISTINCT o.id) AS orders_count,
            COALESCE(ja.total_sales, 0) AS total_sales,
            COALESCE(ja.total_receipts, 0) AS total_receipts,
            COALESCE(ja.net_movement, 0) AS net_movement,
            COALESCE(op.net_profit, 0) AS net_profit,
            COALESCE(op.purchase_total, 0) AS purchase_total,
            COALESCE(op.product_names, '') AS product_names,
            COALESCE(op.order_refs, '') AS order_refs,
            COALESCE(ja.entries_count, 0) AS entries_count
       FROM clients c
       LEFT JOIN orders o ON o.client_id = c.id AND o.created_at >= '${ACCOUNTING_ORDER_CUTOFF}' AND o.status = 'delivered'
       LEFT JOIN (
         SELECT client_id,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS total_sales,
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS total_receipts,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE -amount END) AS net_movement,
                COUNT(*) AS entries_count
           FROM client_journal_entries
          ${journalWhere}
          GROUP BY client_id
       ) ja ON ja.client_id = c.id
       LEFT JOIN (
         SELECT client_id,
                ROUND(SUM(order_profit), 2) AS net_profit,
                ROUND(SUM(purchase_total), 2) AS purchase_total,
                GROUP_CONCAT(DISTINCT order_id ORDER BY order_id DESC SEPARATOR ' ') AS order_refs,
                GROUP_CONCAT(DISTINCT product_names ORDER BY product_names SEPARATOR '، ') AS product_names
           FROM (
             SELECT o.id,
                    o.id AS order_id,
                    o.client_id,
                    COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price, 0)), 0) AS purchase_total,
                    COALESCE(o.total, 0) - COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price, 0)), 0) AS order_profit,
                    GROUP_CONCAT(DISTINCT oi.product_name ORDER BY oi.product_name SEPARATOR '، ') AS product_names
               FROM orders o
               LEFT JOIN order_items oi ON oi.order_id = o.id
               LEFT JOIN products p ON p.id = oi.product_id
              ${orderWhere}
              GROUP BY o.id, o.client_id, o.total
           ) order_profit_rows
          GROUP BY client_id
       ) op ON op.client_id = c.id
         ${clientWhere}
       GROUP BY c.id, c.name, c.contact_info, c.email, c.phone, c.account_balance,
                ${hasClientSource ? 'c.source,' : ''}
                ja.total_sales, ja.total_receipts, ja.net_movement, op.net_profit, op.purchase_total, op.product_names, op.order_refs, ja.entries_count
       ORDER BY ABS(c.account_balance) DESC, c.name ASC`,
    [...journalParams, ...orderParams, ...clientParams]
  );

  const summary = summaryRows[0] || {};
  summary.current_outstanding_balance = rows.reduce((total, row) => total + Number(row.current_outstanding_balance || 0), 0);
  summary.total_net_profit = rows.reduce((total, row) => total + Number(row.net_profit || 0), 0);
  summary.purchase_total = rows.reduce((total, row) => total + Number(row.purchase_total || 0), 0);
  return { summary, rows };
}

async function getClientStatementData(clientId, query = {}) {
  const { dateFrom, dateTo } = getReportDateRange(query);
  const conditions = ['cje.client_id = ?'];
  const params = [clientId];
  addDateRangeWhere(conditions, params, 'cje.date', dateFrom, dateTo);
  addAccountingJournalOrderCutoff(conditions, 'cje');

  const [clients] = await pool.query(
    `SELECT c.id, c.name, c.contact_info, c.email, c.phone, c.account_balance
       FROM clients c
      WHERE c.id = ?
      LIMIT 1`,
    [clientId]
  );
  if (!clients[0]) return null;

  const voucherTypeSelect = await getClientVoucherTypeSelect('cje');
  const [rows] = await pool.query(
    `SELECT cje.id, cje.order_id, cje.transaction_type, ${voucherTypeSelect}, cje.amount, cje.reference_doc, cje.note, cje.date, cje.created_at,
            SUM(CASE WHEN cje.transaction_type = 'debit' THEN cje.amount ELSE -cje.amount END)
              OVER (ORDER BY cje.date ASC, cje.id ASC) AS running_balance
       FROM client_journal_entries cje
      WHERE ${conditions.join(' AND ')}
      ORDER BY cje.date ASC, cje.id ASC`,
    params
  );

  const itemMap = await getOrderItemDetailsMap(rows.map((row) => row.order_id));
  return { client: clients[0], rows: attachOrderItemSummaries(rows, itemMap) };
}

async function getCustomerReportData(query = {}) {
  const { dateFrom, dateTo } = getReportDateRange(query);
  const clientType = String(query.client_type || 'all').trim();
  const conditions = ['o.supplier_buyer_id IS NULL'];
  const params = [];
  addAccountingOrderCutoff(conditions, 'o');
  addAccountingDeliveredOrderOnly(conditions, 'o');
  addDateRangeWhere(conditions, params, 'o.created_at', dateFrom, dateTo);
  addOrderStatusWhere(conditions, params, query.status);
  const hasClientSource = await hasClientSourceColumn();
  if (clientType === 'manual') {
    conditions.push(hasClientSource
      ? "(o.client_id IS NOT NULL AND EXISTS (SELECT 1 FROM clients type_c WHERE type_c.id = o.client_id AND COALESCE(type_c.source, 'manual') IN ('manual', 'mixed')))"
      : 'o.client_id IS NOT NULL');
  } else if (clientType === 'store') {
    conditions.push(hasClientSource
      ? "(o.client_id IS NULL OR EXISTS (SELECT 1 FROM clients type_c WHERE type_c.id = o.client_id AND COALESCE(type_c.source, 'manual') IN ('store', 'mixed')))"
      : 'o.client_id IS NULL');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const discountAmount = await hasOrderDiscountColumns() ? 'o.discount_amount' : '0';
  const clientSourceSelect = hasClientSource ? "MAX(COALESCE(c.source, 'manual'))" : "'manual'";

  const [summaryRows] = await pool.query(
    `SELECT COUNT(*) AS orders_count,
            COUNT(DISTINCT COALESCE(CONCAT('client:', o.client_id), NULLIF(TRIM(o.customer_phone), ''), NULLIF(TRIM(o.customer_email), ''), NULLIF(TRIM(o.customer_name), ''), CONCAT('order:', o.id))) AS customers_count,
            COALESCE(SUM(o.subtotal), 0) AS gross_sales,
            COALESCE(SUM(${discountAmount}), 0) AS discounts_total,
            COALESCE(SUM(o.total), 0) AS net_sales,
            ROUND(COALESCE(SUM(oc.purchase_total), 0), 2) AS purchase_total,
            ROUND(COALESCE(SUM(o.total - COALESCE(oc.purchase_total, 0)), 0), 2) AS net_profit,
            COALESCE(SUM(oi.items_quantity), 0) AS items_quantity
        FROM orders o
        LEFT JOIN (
         SELECT order_id, SUM(quantity) AS items_quantity
           FROM order_items
           GROUP BY order_id
        ) oi ON oi.order_id = o.id
        LEFT JOIN (
          SELECT oi.order_id, SUM(oi.quantity * COALESCE(oi.purchase_price, 0)) AS purchase_total
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
           GROUP BY oi.order_id
        ) oc ON oc.order_id = o.id
        ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT COALESCE(CONCAT('client:', o.client_id), NULLIF(TRIM(o.customer_phone), ''), NULLIF(TRIM(o.customer_email), ''), NULLIF(TRIM(o.customer_name), ''), CONCAT('order:', o.id)) AS customer_key,
            MAX(o.client_id) AS client_id,
            MAX(c.account_balance) AS manual_client_balance,
            ${clientSourceSelect} AS client_source,
            MAX(o.customer_name) AS customer_name,
            MAX(o.customer_phone) AS customer_phone,
            MAX(o.customer_email) AS customer_email,
            COUNT(*) AS orders_count,
            MIN(o.created_at) AS first_order_at,
            MAX(o.created_at) AS last_order_at,
            COALESCE(SUM(o.subtotal), 0) AS gross_sales,
            COALESCE(SUM(${discountAmount}), 0) AS discounts_total,
            COALESCE(SUM(o.total), 0) AS net_sales,
            ROUND(COALESCE(SUM(oc.purchase_total), 0), 2) AS purchase_total,
            ROUND(COALESCE(SUM(o.total - COALESCE(oc.purchase_total, 0)), 0), 2) AS net_profit,
            COALESCE(SUM(oi.items_quantity), 0) AS items_quantity,
            GROUP_CONCAT(DISTINCT o.id ORDER BY o.id DESC SEPARATOR ' ') AS order_refs,
            COALESCE(GROUP_CONCAT(DISTINCT oc.product_names ORDER BY oc.product_names SEPARATOR '، '), '') AS product_names
       FROM orders o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN (
         SELECT order_id, SUM(quantity) AS items_quantity
           FROM order_items
           GROUP BY order_id
        ) oi ON oi.order_id = o.id
       LEFT JOIN (
         SELECT oi.order_id,
                SUM(oi.quantity * COALESCE(oi.purchase_price, 0)) AS purchase_total,
                GROUP_CONCAT(DISTINCT oi.product_name ORDER BY oi.product_name SEPARATOR '، ') AS product_names
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
          GROUP BY oi.order_id
       ) oc ON oc.order_id = o.id
        ${where}
       GROUP BY customer_key
      ORDER BY last_order_at DESC, net_sales DESC, orders_count DESC
      LIMIT 500`,
    params
  );

  return { summary: summaryRows[0] || {}, rows };
}

async function getSupplierOrderRows(supplierId, query = {}) {
  const { dateFrom, dateTo } = getReportDateRange(query);
  const orderId = parsePositiveId(query.order_id);
  const conditions = ['COALESCE(oi.supplier_id, p.supplier_id) = ?'];
  const params = [supplierId];
  addAccountingOrderCutoff(conditions, 'o');
  addAccountingDeliveredOrderOnly(conditions, 'o');
  addDateRangeWhere(conditions, params, 'o.created_at', dateFrom, dateTo);
  addOrderStatusWhere(conditions, params, query.status);
  if (orderId) {
    conditions.push('o.id = ?');
    params.push(orderId);
  }

  const [rows] = await pool.query(
    `SELECT oi.id AS order_item_id,
            o.id AS order_id,
            o.customer_name,
            o.customer_phone,
            o.status,
            o.total AS order_total,
            o.created_at,
            oi.product_id,
            oi.product_name,
            oi.quantity,
            oi.unit_price,
            oi.line_total,
            COALESCE(oi.purchase_price, 0) AS purchase_price,
            ROUND(oi.quantity * COALESCE(oi.purchase_price, 0), 2) AS purchase_total,
            ROUND(oi.line_total - (oi.quantity * COALESCE(oi.purchase_price, 0)), 2) AS profit_total
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       JOIN orders o ON o.id = oi.order_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.created_at DESC, o.id DESC, oi.product_name ASC
      LIMIT 500`,
    params
  );
  return rows;
}

async function getCustomerOrderRows(customerKey, query = {}) {
  const key = String(customerKey || '').trim();
  if (!key) return [];

  const { dateFrom, dateTo } = getReportDateRange(query);
  const clientKeyMatch = key.match(/^client:(\d+)$/i);
  const conditions = clientKeyMatch
    ? ['o.client_id = ?', 'o.supplier_buyer_id IS NULL']
    : [`COALESCE(NULLIF(TRIM(o.customer_phone), ''), NULLIF(TRIM(o.customer_email), ''), NULLIF(TRIM(o.customer_name), ''), CONCAT('order:', o.id)) = ?`, 'o.supplier_buyer_id IS NULL'];
  const params = [clientKeyMatch ? Number(clientKeyMatch[1]) : key];
  addAccountingOrderCutoff(conditions, 'o');
  addAccountingDeliveredOrderOnly(conditions, 'o');
  addDateRangeWhere(conditions, params, 'o.created_at', dateFrom, dateTo);
  addOrderStatusWhere(conditions, params, query.status);
  const discountAmount = await hasOrderDiscountColumns() ? 'o.discount_amount' : '0';

  const [rows] = await pool.query(
    `SELECT o.id AS order_id,
            o.created_at,
            o.customer_name,
            o.customer_phone,
            o.customer_email,
            o.status,
            oi.product_id,
            oi.product_name,
            oi.quantity,
            oi.unit_price,
            oi.line_total,
            COALESCE(oi.purchase_price, 0) AS purchase_price,
            ROUND(oi.quantity * COALESCE(oi.purchase_price, 0), 2) AS purchase_total,
            ROUND(
              COALESCE(oi.line_total, 0)
              - CASE
                  WHEN COALESCE(o.subtotal, 0) > 0 THEN COALESCE(${discountAmount}, 0) * COALESCE(oi.line_total, 0) / o.subtotal
                  ELSE 0
                END
              - COALESCE(oi.quantity, 0) * COALESCE(oi.purchase_price, 0),
              2
            ) AS profit_total,
            o.subtotal,
            ${discountAmount} AS discount_amount,
            o.total
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
       WHERE ${conditions.join(' AND ')}
      ORDER BY o.created_at DESC, o.id DESC, oi.id ASC
      LIMIT 500`,
    params
  );
  return rows;
}

async function getOrderPurchasingRequirements(db, orderId, options = {}) {
  const deliveredOnly = options.deliveredOnly !== false;
  const orderSelectFields = await getOrderSelectFields();
  const conditions = [`id = ?`, `created_at >= '${ACCOUNTING_ORDER_CUTOFF}'`];
  if (deliveredOnly) conditions.push(`status = 'delivered'`);
  const [orders] = await db.query(`SELECT ${orderSelectFields} FROM orders WHERE ${conditions.join(' AND ')}`, [orderId]);
  const order = orders[0];
  if (!order) return null;

  const [rows] = await db.query(
    `SELECT oi.product_id,
            oi.product_name,
            oi.quantity AS quantity_needed,
            oi.unit_price AS selling_price,
            oi.line_total AS selling_total,
            COALESCE(oi.purchase_price, 0) AS purchase_price,
            COALESCE(oi.supplier_id, p.supplier_id) AS supplier_id,
            s.name AS supplier_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN suppliers s ON s.id = COALESCE(oi.supplier_id, p.supplier_id)
      WHERE oi.order_id = ?
      ORDER BY s.name ASC, oi.product_name ASC`,
    [orderId]
  );

  const items = rows.map((row) => {
      const purchasePrice = Number(row.purchase_price || 0);
      const sellingPrice = Number(row.selling_price || 0);
      const quantityNeeded = Number(row.quantity_needed || 0);
      const purchaseTotal = Math.round(quantityNeeded * purchasePrice * 100) / 100;
      const sellingTotal = Number(row.selling_total || Math.round(quantityNeeded * sellingPrice * 100) / 100);
      return {
        product_id: row.product_id,
        product_name: row.product_name,
        supplier_id: row.supplier_id || null,
        supplier_name: row.supplier_name || '',
        quantity_needed: quantityNeeded,
        selling_price: sellingPrice,
        selling_total: sellingTotal,
        purchase_price: purchasePrice,
        line_total: purchaseTotal,
        profit_total: Math.round((sellingTotal - purchaseTotal) * 100) / 100
      };
    });

  const suppliers = new Map();
  for (const item of items) {
    const key = item.supplier_id || 'unassigned';
    const current = suppliers.get(key) || {
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name || 'بدون مورد',
      total_amount: 0,
      items: []
    };
    current.total_amount = Math.round((current.total_amount + Number(item.line_total || 0)) * 100) / 100;
    current.items.push(item);
    suppliers.set(key, current);
  }

  const totalAmount = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  return {
    order,
    items,
    suppliers: [...suppliers.values()],
    total_amount: Math.round(totalAmount * 100) / 100
  };
}

async function createPurchasingInvoicesForOrder(conn, orderId, date) {
  const requirements = await getOrderPurchasingRequirements(conn, orderId);
  if (!requirements) return null;

  const created = [];
  const skipped = [];
  const supplierBuyerId = parsePositiveId(requirements.order?.supplier_buyer_id);
  const supplierBuyerAmount = parseMoney(requirements.order?.total);
  if (supplierBuyerId && !Number.isNaN(supplierBuyerAmount) && supplierBuyerAmount > 0) {
    const referenceDoc = `طلب #${orderId} / بيع للمورد #${supplierBuyerId}`;
    const [existing] = await conn.query(
      `SELECT id
         FROM journal_entries
        WHERE supplier_id = ?
          AND transaction_type = 'debit'
          AND reference_doc = ?
        LIMIT 1`,
      [supplierBuyerId, referenceDoc]
    );
    if (existing[0]) {
      skipped.push({ supplier_id: supplierBuyerId, total_amount: supplierBuyerAmount, existing_entry_id: existing[0].id, reason: 'already created' });
    } else {
      const [supplierRows] = await conn.query('SELECT id, name FROM suppliers WHERE id = ? FOR UPDATE', [supplierBuyerId]);
      if (!supplierRows[0]) {
        skipped.push({ supplier_id: supplierBuyerId, total_amount: supplierBuyerAmount, reason: 'supplier not found' });
      } else {
        const [result] = await conn.query(
          'INSERT INTO journal_entries (supplier_id, order_id, transaction_type, amount, reference_doc, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [supplierBuyerId, orderId, 'debit', supplierBuyerAmount, referenceDoc, 'بيع طلب لمورد', date]
        );
        await conn.query('UPDATE suppliers SET account_balance = account_balance - ? WHERE id = ?', [supplierBuyerAmount, supplierBuyerId]);
        created.push({
          id: result.insertId,
          supplier_id: supplierBuyerId,
          supplier_name: supplierRows[0].name,
          transaction_type: 'debit',
          amount: supplierBuyerAmount,
          reference_doc: referenceDoc,
          date
        });
      }
    }
  }

  for (const supplier of requirements.suppliers) {
    const supplierId = parsePositiveId(supplier.supplier_id);
    const amount = parseMoney(supplier.total_amount);
    if (!supplierId) {
      skipped.push({ ...supplier, reason: 'missing supplier' });
      continue;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      skipped.push({ ...supplier, reason: 'missing purchase price or amount' });
      continue;
    }

    const referenceDoc = `طلب #${orderId} / مورد #${supplierId}`;
    const [existing] = await conn.query(
      `SELECT id
         FROM journal_entries
        WHERE supplier_id = ?
          AND transaction_type = 'credit'
          AND reference_doc = ?
        LIMIT 1`,
      [supplierId, referenceDoc]
    );
    if (existing[0]) {
      skipped.push({ ...supplier, existing_entry_id: existing[0].id, reason: 'already created' });
      continue;
    }

    const [supplierRows] = await conn.query('SELECT id FROM suppliers WHERE id = ? FOR UPDATE', [supplierId]);
    if (!supplierRows[0]) {
      skipped.push({ ...supplier, reason: 'supplier not found' });
      continue;
    }

    const [result] = await conn.query(
      'INSERT INTO journal_entries (supplier_id, order_id, transaction_type, amount, reference_doc, date) VALUES (?, ?, ?, ?, ?, ?)',
      [supplierId, orderId, 'credit', amount, referenceDoc, date]
    );
    await conn.query('UPDATE suppliers SET account_balance = account_balance + ? WHERE id = ?', [amount, supplierId]);
    created.push({
      id: result.insertId,
      supplier_id: supplierId,
      supplier_name: supplier.supplier_name,
      transaction_type: 'credit',
      amount,
      reference_doc: referenceDoc,
      date
    });
  }

  return { requirements, created, skipped };
}

async function createClientInvoiceForOrder(conn, orderId, date) {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await conn.query(
    `SELECT ${orderSelectFields}
       FROM orders
      WHERE id = ?
        AND client_id IS NOT NULL
        AND created_at >= '${ACCOUNTING_ORDER_CUTOFF}'
        AND status = 'delivered'
      LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const clientId = parsePositiveId(order.client_id);
  const amount = parseMoney(order.total);
  if (!clientId || Number.isNaN(amount) || amount <= 0) return null;

  const referenceDoc = `طلب #${orderId} / فاتورة مبيعات`;
  const [existing] = await conn.query(
    `SELECT id, amount
       FROM client_journal_entries
      WHERE client_id = ?
        AND order_id = ?
        AND transaction_type = 'debit'
        AND reference_doc = ?
      LIMIT 1`,
    [clientId, orderId, referenceDoc]
  );
  if (existing[0]) {
    const existingAmount = parseMoney(existing[0].amount);
    if (!Number.isNaN(existingAmount) && existingAmount !== amount) {
      const delta = amount - existingAmount;
      await conn.query('UPDATE client_journal_entries SET amount = ?, date = ? WHERE id = ?', [amount, date, existing[0].id]);
      await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [delta, clientId]);
    }
    return { created: null, skipped: { client_id: clientId, total_amount: amount, existing_entry_id: existing[0].id, reason: 'already created' } };
  }

  const [clients] = await conn.query('SELECT id, name FROM clients WHERE id = ? FOR UPDATE', [clientId]);
  if (!clients[0]) {
    return { created: null, skipped: { client_id: clientId, total_amount: amount, reason: 'client not found' } };
  }

  const [result] = await conn.query(
    'INSERT INTO client_journal_entries (client_id, order_id, transaction_type, amount, reference_doc, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [clientId, orderId, 'debit', amount, referenceDoc, 'فاتورة بيع طلب مسلم', date]
  );
  await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [amount, clientId]);
  return {
    created: {
      id: result.insertId,
      client_id: clientId,
      client_name: clients[0].name,
      transaction_type: 'debit',
      amount,
      reference_doc: referenceDoc,
      date
    },
    skipped: null
  };
}

export async function ensureStoreOrderClientForAccounting(conn, orderId) {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await conn.query(
    `SELECT ${orderSelectFields}
       FROM orders
      WHERE id = ?
      LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order || order.supplier_buyer_id) return order?.client_id || null;

  const existingClientId = parsePositiveId(order.client_id);
  if (existingClientId) {
    const [existingClients] = await conn.query('SELECT id, name, email, phone FROM clients WHERE id = ? LIMIT 1 FOR UPDATE', [existingClientId]);
    if (existingClients[0] && doesClientMatchOrderCustomer(existingClients[0], order)) {
      await markClientOrderSource(conn, existingClientId, await inferStoreOrderSource(conn, order));
      return existingClientId;
    }
  }

  const name = normalizeCustomerLookupValue(order.customer_name);
  const phone = normalizeCustomerLookupValue(order.customer_phone);
  const email = normalizeCustomerLookupValue(order.customer_email);
  const hasClientSource = await hasClientSourceColumn();
  let client = null;

  if (name) {
    const [clients] = await conn.query('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ? ORDER BY id ASC LIMIT 1 FOR UPDATE', [normalizeCustomerLookupKey(name)]);
    client = clients[0] || null;
  }

  if (!client) {
    const name = normalizeCustomerLookupValue(order.customer_name) || `عميل طلب #${orderId}`;
    const isStoreOrder = await inferStoreOrderSource(conn, order);
    const columns = ['name', 'contact_info', 'email', 'phone', 'address_line1', 'city', 'state', 'country', 'account_balance'];
    const values = [
      name,
      phone || email || null,
      email || null,
      phone || null,
      order.address_line1 || null,
      order.city || null,
      order.state || null,
      order.country || 'فلسطين',
      0
    ];
    if (hasClientSource) {
      columns.push('source');
      values.push(isStoreOrder ? 'store' : 'manual');
    }
    const [result] = await conn.query(
      `INSERT INTO clients (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
    client = { id: result.insertId };
  } else if (hasClientSource) {
    await markClientOrderSource(conn, client.id, await inferStoreOrderSource(conn, order));
  }

  await conn.query('UPDATE orders SET client_id = ? WHERE id = ?', [client.id, orderId]);
  return client.id;
}

function getClientJournalBalanceEffect(entry) {
  const amount = parseMoney(entry?.amount);
  if (Number.isNaN(amount)) return 0;
  return String(entry?.transaction_type || '').trim() === 'credit' ? -amount : amount;
}

async function moveOrderClientJournalEntriesToClient(conn, orderId, targetClientId) {
  const clientId = parsePositiveId(targetClientId);
  if (!clientId) return [];

  const [entries] = await conn.query(
    `SELECT id, client_id, transaction_type, amount
       FROM client_journal_entries
      WHERE order_id = ?
      FOR UPDATE`,
    [orderId]
  );

  const moved = [];
  for (const entry of entries) {
    const oldClientId = parsePositiveId(entry.client_id);
    if (!oldClientId || oldClientId === clientId) continue;

    const effect = getClientJournalBalanceEffect(entry);
    if (effect !== 0) {
      await conn.query('UPDATE clients SET account_balance = account_balance - ? WHERE id = ?', [effect, oldClientId]);
      await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [effect, clientId]);
    }
    await conn.query('UPDATE client_journal_entries SET client_id = ? WHERE id = ?', [clientId, entry.id]);
    moved.push({
      entry_id: entry.id,
      from_client_id: oldClientId,
      to_client_id: clientId,
      transaction_type: entry.transaction_type,
      amount: parseMoney(entry.amount)
    });
  }

  return moved;
}

async function createClientPaymentForOrder(conn, orderId, date) {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await conn.query(
    `SELECT ${orderSelectFields}
       FROM orders
      WHERE id = ?
        AND client_id IS NOT NULL
        AND created_at >= '${ACCOUNTING_ORDER_CUTOFF}'
        AND status = 'delivered'
      LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const clientId = parsePositiveId(order.client_id);
  const amount = parseMoney(order.total);
  if (!clientId || Number.isNaN(amount) || amount <= 0) return null;

  const referenceDoc = `طلب #${orderId} / دفعة العميل`;
  const autoNote = 'دفعة تلقائية عند التسليم والدفع';
  const [existing] = await conn.query(
    `SELECT id, amount
       FROM client_journal_entries
      WHERE client_id = ?
        AND order_id = ?
        AND transaction_type = 'credit'
        AND reference_doc = ?
      LIMIT 1`,
    [clientId, orderId, referenceDoc]
  );
  if (existing[0]) {
    const existingAmount = parseMoney(existing[0].amount);
    if (!Number.isNaN(existingAmount) && existingAmount !== amount) {
      const delta = existingAmount - amount;
      await conn.query('UPDATE client_journal_entries SET amount = ?, note = ?, date = ? WHERE id = ?', [amount, autoNote, date, existing[0].id]);
      await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [delta, clientId]);
    }
    return { created: null, skipped: { client_id: clientId, total_amount: amount, existing_entry_id: existing[0].id, reason: 'already created' } };
  }

  const [clients] = await conn.query('SELECT id, name FROM clients WHERE id = ? FOR UPDATE', [clientId]);
  if (!clients[0]) {
    return { created: null, skipped: { client_id: clientId, total_amount: amount, reason: 'client not found' } };
  }

  const [result] = await conn.query(
    'INSERT INTO client_journal_entries (client_id, order_id, transaction_type, amount, reference_doc, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [clientId, orderId, 'credit', amount, referenceDoc, autoNote, date]
  );
  await conn.query('UPDATE clients SET account_balance = account_balance - ? WHERE id = ?', [amount, clientId]);
  return {
    created: {
      id: result.insertId,
      client_id: clientId,
      client_name: clients[0].name,
      transaction_type: 'credit',
      amount,
      reference_doc: referenceDoc,
      date
    },
    skipped: null
  };
}

async function hasPaidPaymentForOrder(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT id
       FROM payments
      WHERE order_id = ?
        AND LOWER(TRIM(status)) = 'paid'
      LIMIT 1`,
    [orderId]
  );
  return rows.length > 0;
}

async function inferStoreOrderSource(conn, order) {
  const source = String(order?.source || '').trim().toLowerCase();
  if (source === 'store') return true;
  if (source === 'admin') return false;
  return hasPaidPaymentForOrder(conn, order.id);
}

async function markClientOrderSource(conn, clientId, isStoreOrder) {
  if (!(await hasClientSourceColumn())) return;
  const normalizedClientId = parsePositiveId(clientId);
  if (!normalizedClientId) return;
  if (isStoreOrder) {
    await conn.query(
      `UPDATE clients
          SET source = CASE
            WHEN source = 'manual' THEN 'mixed'
            WHEN source = 'mixed' THEN 'mixed'
            ELSE 'store'
          END
        WHERE id = ?`,
      [normalizedClientId]
    );
    return;
  }

  await conn.query(
    `UPDATE clients
        SET source = CASE
          WHEN source = 'store' THEN 'mixed'
          WHEN source = 'mixed' THEN 'mixed'
          ELSE 'manual'
        END
      WHERE id = ?`,
    [normalizedClientId]
  );
}

function getDeliveryReferenceDoc(orderId) {
  return `طلب #${orderId} / ${CLIENT_DELIVERY_REFERENCE_SUFFIX}`;
}

function getSupplierDeliveryReferenceDoc(orderId) {
  return `طلب #${orderId} / ${SUPPLIER_DELIVERY_REFERENCE_SUFFIX}`;
}

async function getOrderDeliverySuppliers(connOrPool, orderId) {
  const [rows] = await connOrPool.query(
    `SELECT DISTINCT p.supplier_id, s.name AS supplier_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN suppliers s ON s.id = p.supplier_id
      WHERE oi.order_id = ?
        AND p.supplier_id IS NOT NULL
      ORDER BY s.name ASC`,
    [orderId]
  );
  return rows
    .map((row) => ({
      supplier_id: parsePositiveId(row.supplier_id),
      supplier_name: row.supplier_name || ''
    }))
    .filter((row) => row.supplier_id);
}

async function getSupplierDeliveriesForOrder(connOrPool, orderId) {
  const [rows] = await connOrPool.query(
    `SELECT osd.id, osd.order_id, osd.supplier_id, s.name AS supplier_name, osd.amount, osd.note
       FROM order_supplier_deliveries osd
       JOIN suppliers s ON s.id = osd.supplier_id
      WHERE osd.order_id = ?
      ORDER BY s.name ASC`,
    [orderId]
  );
  return rows.map((row) => ({
    ...row,
    amount: parseMoney(row.amount)
  }));
}

async function replaceOrderSupplierDeliveries(conn, orderId, deliveries = []) {
  await conn.query('DELETE FROM order_supplier_deliveries WHERE order_id = ?', [orderId]);
  for (const delivery of deliveries) {
    await conn.query(
      `INSERT INTO order_supplier_deliveries (order_id, supplier_id, amount, note)
       VALUES (?, ?, ?, ?)`,
      [orderId, delivery.supplier_id, delivery.amount, delivery.note]
    );
  }
}

async function reverseSupplierDeliveryVouchers(conn, orderId) {
  const referenceDoc = getSupplierDeliveryReferenceDoc(orderId);
  const hasVoucherType = await hasSupplierJournalVoucherType();
  const voucherWhere = hasVoucherType ? "AND voucher_type = 'supplier_service_credit'" : '';
  const [entries] = await conn.query(
    `SELECT id, supplier_id, amount
       FROM journal_entries
      WHERE order_id = ?
        AND transaction_type = 'credit'
        ${voucherWhere}
        AND reference_doc = ?
      FOR UPDATE`,
    [orderId, referenceDoc]
  );
  for (const entry of entries) {
    const amount = parseMoney(entry.amount);
    const supplierId = parsePositiveId(entry.supplier_id);
    if (!supplierId || Number.isNaN(amount) || amount <= 0) continue;
    await conn.query('UPDATE suppliers SET account_balance = account_balance - ? WHERE id = ?', [amount, supplierId]);
  }
  if (entries.length > 0) {
    await conn.query(`DELETE FROM journal_entries WHERE id IN (${entries.map(() => '?').join(',')})`, entries.map((entry) => entry.id));
  }
  return entries.length;
}

export async function syncSupplierDeliveryVouchersForOrder(conn, orderId, date) {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await conn.query(
    `SELECT ${orderSelectFields}
       FROM orders
      WHERE id = ?
      LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const shouldCreate = String(order.status || '').trim() === 'delivered'
    && normalizeDeliveryPayer(order.delivery_payer) === 'supplier';

  const reversed = await reverseSupplierDeliveryVouchers(conn, orderId);
  if (!shouldCreate) {
    return reversed ? { created: [], skipped: [], reversed } : null;
  }

  const deliveries = (await getSupplierDeliveriesForOrder(conn, orderId))
    .filter((delivery) => !Number.isNaN(parseMoney(delivery.amount)) && parseMoney(delivery.amount) > 0);
  if (deliveries.length === 0) {
    return reversed ? { created: [], skipped: [], reversed } : null;
  }

  const created = [];
  const skipped = [];
  const referenceDoc = getSupplierDeliveryReferenceDoc(orderId);
  const hasVoucherType = await hasSupplierJournalVoucherType();
  for (const delivery of deliveries) {
    const supplierId = parsePositiveId(delivery.supplier_id);
    const amount = parseMoney(delivery.amount);
    if (!supplierId || Number.isNaN(amount) || amount <= 0) continue;

    const [suppliers] = await conn.query('SELECT id, name FROM suppliers WHERE id = ? FOR UPDATE', [supplierId]);
    if (!suppliers[0]) {
      skipped.push({ supplier_id: supplierId, total_amount: amount, reason: 'supplier not found' });
      continue;
    }

    const note = String(delivery.note || order.delivery_note || '').trim() || SUPPLIER_DELIVERY_DEFAULT_NOTE;
    const [result] = await conn.query(
      `INSERT INTO journal_entries (supplier_id, order_id, transaction_type${hasVoucherType ? ', voucher_type' : ''}, amount, reference_doc, note, date)
       VALUES (?, ?, ?${hasVoucherType ? ', ?' : ''}, ?, ?, ?, ?)`,
      hasVoucherType
        ? [supplierId, orderId, 'credit', 'supplier_service_credit', amount, referenceDoc, note, date]
        : [supplierId, orderId, 'credit', amount, referenceDoc, note, date]
    );
    await conn.query('UPDATE suppliers SET account_balance = account_balance + ? WHERE id = ?', [amount, supplierId]);
    created.push({
      id: result.insertId,
      supplier_id: supplierId,
      supplier_name: suppliers[0].name,
      transaction_type: 'credit',
      voucher_type: 'supplier_service_credit',
      amount,
      reference_doc: referenceDoc,
      note,
      date
    });
  }

  return { created, skipped, reversed };
}

async function reverseClientDeliveryVoucher(conn, orderId) {
  const referenceDoc = getDeliveryReferenceDoc(orderId);
  const [entries] = await conn.query(
    `SELECT id, client_id, amount
       FROM client_journal_entries
      WHERE order_id = ?
        AND transaction_type = 'debit'
        AND reference_doc = ?
      FOR UPDATE`,
    [orderId, referenceDoc]
  );
  for (const entry of entries) {
    const amount = parseMoney(entry.amount);
    const clientId = parsePositiveId(entry.client_id);
    if (!clientId || Number.isNaN(amount) || amount <= 0) continue;
    await conn.query('UPDATE clients SET account_balance = account_balance - ? WHERE id = ?', [amount, clientId]);
  }
  if (entries.length > 0) {
    await conn.query(`DELETE FROM client_journal_entries WHERE id IN (${entries.map(() => '?').join(',')})`, entries.map((entry) => entry.id));
  }
  return entries.length;
}

export async function syncClientDeliveryVoucherForOrder(conn, orderId, date) {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await conn.query(
    `SELECT ${orderSelectFields}
       FROM orders
      WHERE id = ?
      LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const amount = parseMoney(order.delivery_fee_amount);
  const payer = String(order.delivery_payer || '').trim();
  const shouldCreate = String(order.status || '').trim() === 'delivered'
    && payer === 'customer'
    && !Number.isNaN(amount)
    && amount > 0;

  if (!shouldCreate) {
    const reversed = await reverseClientDeliveryVoucher(conn, orderId);
    return reversed ? { created: null, skipped: null, reversed } : null;
  }

  let clientId = parsePositiveId(order.client_id);
  if (!clientId && !order.supplier_buyer_id) {
    clientId = await ensureStoreOrderClientForAccounting(conn, orderId);
  }
  if (!clientId) {
    await reverseClientDeliveryVoucher(conn, orderId);
    return { created: null, skipped: { reason: 'client not found', total_amount: amount } };
  }

  const referenceDoc = getDeliveryReferenceDoc(orderId);
  const note = String(order.delivery_note || '').trim() || CLIENT_DELIVERY_DEFAULT_NOTE;
  const [existing] = await conn.query(
    `SELECT id, amount
       FROM client_journal_entries
      WHERE client_id = ?
        AND order_id = ?
        AND transaction_type = 'debit'
        AND reference_doc = ?
      LIMIT 1
      FOR UPDATE`,
    [clientId, orderId, referenceDoc]
  );

  if (existing[0]) {
    const existingAmount = parseMoney(existing[0].amount);
    const delta = amount - (Number.isNaN(existingAmount) ? 0 : existingAmount);
    const hasVoucherType = await hasClientJournalVoucherType();
    await conn.query(
      `UPDATE client_journal_entries
          SET amount = ?, note = ?, date = ?${hasVoucherType ? ', voucher_type = ?' : ''}
        WHERE id = ?`,
      hasVoucherType
        ? [amount, note, date, 'client_service_debit', existing[0].id]
        : [amount, note, date, existing[0].id]
    );
    if (delta !== 0) {
      await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [delta, clientId]);
    }
    return { created: null, skipped: { client_id: clientId, total_amount: amount, existing_entry_id: existing[0].id, reason: 'already created' } };
  }

  const [clients] = await conn.query('SELECT id, name FROM clients WHERE id = ? FOR UPDATE', [clientId]);
  if (!clients[0]) {
    return { created: null, skipped: { client_id: clientId, total_amount: amount, reason: 'client not found' } };
  }

  const hasVoucherType = await hasClientJournalVoucherType();
  const [result] = await conn.query(
    `INSERT INTO client_journal_entries (client_id, order_id, transaction_type${hasVoucherType ? ', voucher_type' : ''}, amount, reference_doc, note, date)
     VALUES (?, ?, ?${hasVoucherType ? ', ?' : ''}, ?, ?, ?, ?)`,
    hasVoucherType
      ? [clientId, orderId, 'debit', 'client_service_debit', amount, referenceDoc, note, date]
      : [clientId, orderId, 'debit', amount, referenceDoc, note, date]
  );
  await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [amount, clientId]);
  return {
    created: {
      id: result.insertId,
      client_id: clientId,
      client_name: clients[0].name,
      transaction_type: 'debit',
      voucher_type: 'client_service_debit',
      amount,
      reference_doc: referenceDoc,
      date
    },
    skipped: null
  };
}

export async function createDeliveredOrderAccounting(conn, orderId, date, options = {}) {
  const supplierAccounting = await createPurchasingInvoicesForOrder(conn, orderId, date);
  const clientId = await ensureStoreOrderClientForAccounting(conn, orderId);
  const movedClientEntries = await moveOrderClientJournalEntriesToClient(conn, orderId, clientId);
  const clientAccounting = await createClientInvoiceForOrder(conn, orderId, date);
  const shouldCreatePayment = options.markPaid || await hasPaidPaymentForOrder(conn, orderId);
  const clientPayment = shouldCreatePayment ? await createClientPaymentForOrder(conn, orderId, date) : null;
  const clientDelivery = await syncClientDeliveryVoucherForOrder(conn, orderId, date);
  const supplierDelivery = await syncSupplierDeliveryVouchersForOrder(conn, orderId, date);
  return {
    ...(supplierAccounting || { requirements: null, created: [], skipped: [] }),
    client: clientAccounting,
    clientPayment,
    clientDelivery,
    movedClientEntries,
    supplierDelivery
  };
}

export async function reverseOrderAccounting(conn, orderId) {
  const reversed = { supplier_entries: 0, client_entries: 0 };

  const [supplierEntries] = await conn.query(
    `SELECT id, supplier_id, transaction_type, amount
       FROM journal_entries
      WHERE order_id = ?
      FOR UPDATE`,
    [orderId]
  );
  for (const entry of supplierEntries) {
    const amount = parseMoney(entry.amount);
    if (!entry.supplier_id || Number.isNaN(amount) || amount <= 0) continue;
    const reverseDelta = entry.transaction_type === 'credit' ? -amount : amount;
    await conn.query('UPDATE suppliers SET account_balance = account_balance + ? WHERE id = ?', [reverseDelta, entry.supplier_id]);
  }
  if (supplierEntries.length > 0) {
    await conn.query('DELETE FROM journal_entries WHERE order_id = ?', [orderId]);
    reversed.supplier_entries = supplierEntries.length;
  }

  const [clientEntries] = await conn.query(
    `SELECT id, client_id, transaction_type, amount, note
       FROM client_journal_entries
      WHERE order_id = ?
      FOR UPDATE`,
    [orderId]
  );
  const clientDebitIds = [];
  const clientCreditIds = [];
  const autoClientCreditIds = [];
  for (const entry of clientEntries) {
    const amount = parseMoney(entry.amount);
    if (!entry.client_id || Number.isNaN(amount) || amount <= 0) continue;
    if (entry.transaction_type === 'debit') {
      await conn.query('UPDATE clients SET account_balance = account_balance - ? WHERE id = ?', [amount, entry.client_id]);
      clientDebitIds.push(entry.id);
    } else if (String(entry.note || '').trim() === 'دفعة تلقائية عند التسليم والدفع') {
      await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [amount, entry.client_id]);
      autoClientCreditIds.push(entry.id);
    } else {
      clientCreditIds.push(entry.id);
    }
  }
  if (clientDebitIds.length > 0) {
    await conn.query(`DELETE FROM client_journal_entries WHERE id IN (${clientDebitIds.map(() => '?').join(',')})`, clientDebitIds);
  }
  if (clientCreditIds.length > 0) {
    await conn.query(`UPDATE client_journal_entries SET order_id = NULL WHERE id IN (${clientCreditIds.map(() => '?').join(',')})`, clientCreditIds);
  }
  if (autoClientCreditIds.length > 0) {
    await conn.query(`DELETE FROM client_journal_entries WHERE id IN (${autoClientCreditIds.map(() => '?').join(',')})`, autoClientCreditIds);
  }
  reversed.client_entries = clientEntries.length;

  return reversed;
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

function parseImportVariants(row) {
  const hasVariantValue = hasImportValue(row, [
    'لون الخيار', 'Variant Color', 'variant_color',
    'كود لون الخيار', 'Variant Color Hex', 'variant_hex',
    'قياس الخيار', 'Variant Size', 'variant_size',
    'سعر بيع الخيار', 'Variant Price', 'variant_price',
    'سعر شراء الخيار', 'Variant Purchase Price', 'variant_purchase_price'
  ]);
  if (!hasVariantValue) return { provided: false, value: [] };

  const variant = {
    color_name: String(getImportValue(row, ['لون الخيار', 'Variant Color', 'variant_color']) || '').trim(),
    color_hex: String(getImportValue(row, ['كود لون الخيار', 'Variant Color Hex', 'variant_hex']) || '').trim(),
    size_name: String(getImportValue(row, ['قياس الخيار', 'Variant Size', 'variant_size']) || '').trim(),
    price: parseImportNumber(getImportValue(row, ['سعر بيع الخيار', 'Variant Price', 'variant_price'])),
    purchase_price: parseImportNumber(getImportValue(row, ['سعر شراء الخيار', 'Variant Purchase Price', 'variant_purchase_price']))
  };
  const normalized = normalizeVariantOptions([variant]);
  return { provided: true, value: normalized };
}

const PRODUCT_IMAGE_IMPORT_KEYS = ['صورة', 'الصورة', 'رابط الصورة', 'Image', 'image', 'image_url', 'Image URL'];
const FIXED_IMPORT_COLORS = new Map([
  ['0', { name: 'Chrome', hex: '#C0C0C0' }],
  ['1', { name: 'Brushed Nickel', hex: '#A7A9AC' }],
  ['2', { name: 'Brushed Rose Gold', hex: '#B76E79' }],
  ['3', { name: 'Brushed Gold', hex: '#D4AF37' }],
  ['4', { name: 'Gunmetal Gray', hex: '#4B5563' }],
  ['5', { name: 'Matte Black', hex: '#111827' }]
]);

function getImportImageSource(row) {
  const embeddedImage = String(row?.__image_data || '').trim();
  if (embeddedImage) return embeddedImage;
  return String(getImportValue(row, PRODUCT_IMAGE_IMPORT_KEYS) || '').trim();
}

function resolveImportedImageUrl(imageSource, rowNo, uploadsDir, saveImage) {
  const source = String(imageSource || '').trim();
  if (!source) return null;
  if (source.startsWith('data:image/')) {
    return saveImage(source, rowNo, uploadsDir);
  }
  return source;
}

function imageBufferToDataUrl(buffer, filePath) {
  const ext = path.posix.extname(String(filePath || '')).toLowerCase();
  const mime = IMAGE_MIME_BY_EXT[ext] || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function parseImportImageZip(imageZipBuffer) {
  const result = { byProductId: new Map(), warnings: [] };
  if (!imageZipBuffer || !Buffer.isBuffer(imageZipBuffer) || imageZipBuffer.length === 0) return result;
  const zip = new AdmZip(imageZipBuffer);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const entryName = String(entry.entryName || '').replace(/\\/g, '/');
    if (!entryName || entryName.includes('__MACOSX/') || entryName.endsWith('.DS_Store')) continue;
    const match = entryName.match(/^(\d+)\/(\d+)\.(png|jpe?g|webp|gif)$/i);
    if (!match) continue;
    const productId = match[1];
    const imageNo = match[2];
    const dataUrl = imageBufferToDataUrl(entry.getData(), entryName);
    const bucket = result.byProductId.get(productId) || { baseImage: '', variants: [] };
    if (imageNo === '0') {
      bucket.baseImage = dataUrl;
    } else {
      const color = FIXED_IMPORT_COLORS.get(imageNo);
      if (!color) {
        result.warnings.push({ productId, imageNo, file: entryName, reason: 'رقم لون غير معروف' });
      } else {
        bucket.variants.push({
          color_no: imageNo,
          color_name: color.name,
          color_hex: color.hex,
          image_url: dataUrl,
          image_urls: [dataUrl]
        });
      }
    }
    result.byProductId.set(productId, bucket);
  }
  return result;
}

function mergeVariantsByColor(existingVariants = [], zipVariants = [], { price = null, purchasePrice = null } = {}) {
  const next = [...(Array.isArray(existingVariants) ? existingVariants : [])];
  for (const zipVariant of zipVariants) {
    const index = next.findIndex((variant) =>
      !String(variant.size_name || '').trim()
      && String(variant.color_name || '').trim().toLowerCase() === String(zipVariant.color_name || '').trim().toLowerCase()
    );
    const merged = {
      id: index >= 0 ? next[index].id : `variant-${Date.now()}-${zipVariant.color_no}`,
      color_name: zipVariant.color_name,
      color_hex: zipVariant.color_hex,
      size_name: null,
      price: index >= 0 && next[index].price != null ? next[index].price : price,
      purchase_price: index >= 0 && next[index].purchase_price != null ? next[index].purchase_price : purchasePrice,
      image_url: zipVariant.image_url,
      image_urls: zipVariant.image_urls
    };
    if (index >= 0) next[index] = { ...next[index], ...merged };
    else next.push(merged);
  }
  return normalizeVariantOptions(next);
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

async function analyzeProductsImport(rows, { mode = 'update_existing', imageZip = null } = {}) {
  const normalizedMode = mode === 'create_only' ? 'create_only' : 'update_existing';
  const [existingProducts] = await pool.query('SELECT id, name, category, categories, price, variant_options FROM products');
  const existingProductIdMap = new Map(existingProducts.map((row) => [Number(row.id), row]));
  const existingProductExactNameMap = new Map(
    existingProducts
      .map((row) => [String(row?.name || '').trim(), row])
      .filter(([key]) => key)
  );
  const [existingCategoryRows] = await pool.query('SELECT id, name FROM categories');
  const knownCategories = new Map(
    existingCategoryRows
      .map((row) => [normalizeImportName(row?.name), String(row?.name || '').trim()])
      .filter(([key, value]) => key && value)
  );

  const groups = new Map();
  const groupKeyByName = new Map();
  const invalidRows = [];
  let skippedInvalid = 0;
  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const rowNo = idx + 2;
    const productId = parsePositiveId(getImportValue(row, ['المعرف', 'ID', 'id', 'المنتج']));
    const existingById = productId ? existingProductIdMap.get(productId) : null;
    const name = String(getImportValue(row, ['اسم المنتج', 'الاسم', 'Name', 'Product']) || getImportValue(row, ['المنتج']) || '').trim();
    const normalizedName = normalizeImportName(name);
    const exactName = String(name || '').trim();
    if (!exactName) {
      skippedInvalid += 1;
      invalidRows.push({ row: rowNo, reason: 'اسم المنتج أو المعرف مطلوب' });
      continue;
    }
    const idNameMatches = !!existingById && exactName === String(existingById.name || '').trim();
    const forceCreate = !!existingById && !idNameMatches;
    const matchedProductId = idNameMatches ? productId : null;
    let groupKey = matchedProductId
      ? `id:${matchedProductId}`
      : (forceCreate ? `new-from-id:${productId}:${exactName}` : `name:${exactName}`);
    if (!matchedProductId && !forceCreate && exactName && groupKeyByName.has(exactName)) {
      groupKey = groupKeyByName.get(exactName);
    }
    const exactNameGroupKey = exactName ? `name:${exactName}` : '';
    if (matchedProductId && exactNameGroupKey && groups.has(exactNameGroupKey) && !groups.has(groupKey)) {
      const existingNameGroup = groups.get(exactNameGroupKey);
      groups.delete(exactNameGroupKey);
      existingNameGroup.key = groupKey;
      existingNameGroup.productId = matchedProductId;
      groups.set(groupKey, existingNameGroup);
    }
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { key: groupKey, productId: matchedProductId, forceCreate, name, normalizedName, rows: [], rowNumbers: [] });
    }
    if (exactName && !forceCreate) groupKeyByName.set(exactName, groupKey);
    const group = groups.get(groupKey);
    group.rows.push(row);
    group.rowNumbers.push(rowNo);
    if (!group.name && name) group.name = name;
    if (!group.normalizedName && normalizedName) group.normalizedName = normalizedName;
  }

  const previewRows = [];
  const createdCategories = [];
  let skippedDuplicates = 0;
  let toCreate = 0;
  let toUpdate = 0;

  const textField = (row, keys) => ({
    provided: hasImportColumn(row, keys),
    value: String(getImportValue(row, keys) || '').trim() || null
  });
  const numberField = (row, keys) => ({
    provided: hasImportColumn(row, keys),
    value: parseImportNumber(getImportValue(row, keys))
  });
  const booleanField = (row, keys, fallback = false) => ({
    provided: hasImportColumn(row, keys),
    value: parseBoolean(getImportValue(row, keys), fallback)
  });
  const resolveCategories = (categories) => categories.map((categoryName) => {
    const normalizedCategory = normalizeImportName(categoryName);
    const existingCategory = knownCategories.get(normalizedCategory) || categoryName;
    if (!knownCategories.has(normalizedCategory) && !createdCategories.includes(categoryName)) {
      createdCategories.push(categoryName);
      knownCategories.set(normalizedCategory, categoryName);
    }
    return existingCategory;
  });

  for (const group of groups.values()) {
    const base = group.rows[0];
    const existing = group.forceCreate
      ? null
      : ((group.productId ? existingProductIdMap.get(group.productId) : null)
        || existingProductExactNameMap.get(String(group.name || '').trim())
        || null);
    const isUpdate = !!existing && normalizedMode === 'update_existing';
    if (existing && !isUpdate) {
      skippedDuplicates += 1;
      continue;
    }

    const nameField = textField(base, ['اسم المنتج', 'الاسم', 'Name', 'Product']);
    const name = nameField.value || (isUpdate ? String(existing.name || '').trim() : '');
    const categoryField = textField(base, ['الفئات', 'الفئة', 'Category', 'Categories']);
    const inputCategories = categoryField.provided ? normalizeCategoryNames(categoryField.value) : [];
    const categories = inputCategories.length
      ? resolveCategories(inputCategories)
      : (isUpdate ? parseStoredCategories(existing.categories, existing.category) : []);
    const priceField = numberField(base, ['سعر البيع', 'البيع', 'السعر', 'Price']);
    const price = priceField.value ?? (isUpdate ? Number(existing.price || 0) : null);

    if (!name) {
      skippedInvalid += 1;
      invalidRows.push({ row: group.rowNumbers[0], reason: 'اسم المنتج مطلوب' });
      continue;
    }
    if (!categories.length) {
      skippedInvalid += 1;
      invalidRows.push({ row: group.rowNumbers[0], name, reason: 'الفئة مطلوبة' });
      continue;
    }
    if (price == null || price <= 0) {
      skippedInvalid += 1;
      invalidRows.push({ row: group.rowNumbers[0], name, reason: 'السعر يجب أن يكون رقماً أكبر من صفر' });
      continue;
    }

    const variants = [];
    let hasVariants = false;
    for (let i = 0; i < group.rows.length; i += 1) {
      const variantInfo = parseImportVariants(group.rows[i]);
      if (!variantInfo.provided) continue;
      hasVariants = true;
      if (!variantInfo.value.length) {
        skippedInvalid += 1;
        invalidRows.push({ row: group.rowNumbers[i], name, reason: 'بيانات اللون/القياس غير صالحة' });
        continue;
      }
      variants.push(...variantInfo.value);
    }
    const normalizedVariants = hasVariants ? normalizeVariantOptions(variants) : [];
    if (hasVariants && !normalizedVariants.length) continue;

    const description = textField(base, ['الوصف', 'وصف المنتج', 'Description']);
    const technicalData = textField(base, ['بيانات فنية', 'بيانات فنية ', 'Technical Data']);
    const usage = textField(base, ['تعليمات الاستخدام', 'Usage']);
    const warnings = textField(base, ['تحذيرات', 'Warnings']);
    const purchasePrice = numberField(base, ['الشراء', 'سعر الشراء', 'Purchase Price', 'purchase_price']);
    const supplierName = textField(base, ['المورد', 'Supplier', 'supplier']);
    const supplierPhone = textField(base, ['الهاتف', 'Phone', 'phone']);
    if (supplierPhone.value) supplierPhone.value = supplierPhone.value.replace(/\.0$/, '');
    const mrp = numberField(base, ['السعر قبل الخصم', 'MRP', 'Compare Price']);
    const stock = numberField(base, ['المخزون', 'Stock', 'stock']);
    const brand = textField(base, ['الماركة', 'Brand', 'brand']);
    const type = textField(base, ['النوع', 'Type', 'type']);
    const available = booleanField(base, ['متوفر', 'متاح', 'Available', 'is_available'], true);
    const hidden = booleanField(base, ['مخفي', 'Hidden', 'is_hidden'], false);
    const productFolderId = String(getImportValue(base, ['المنتج', 'المعرف', 'ID', 'id']) || '').trim().replace(/\.0$/, '');
    const zipImages = imageZip?.byProductId?.get(productFolderId) || null;
    const imageSource = zipImages?.baseImage || getImportImageSource(base);
    const imageProvided = !!zipImages?.baseImage || !!String(base.__image_data || '').trim() || hasImportColumn(base, PRODUCT_IMAGE_IMPORT_KEYS);
    const zipVariants = Array.isArray(zipImages?.variants) ? zipImages.variants : [];
    const existingVariants = isUpdate ? parseProductVariantOptions(existing.variant_options) : [];
    const zipMergeBase = zipVariants.length && isUpdate
      ? normalizeVariantOptions([...existingVariants, ...normalizedVariants])
      : normalizedVariants;
    const variantsWithZip = zipVariants.length
      ? mergeVariantsByColor(zipMergeBase, zipVariants, { price, purchasePrice: purchasePrice.value })
      : normalizedVariants;
    const hasVariantsWithZip = hasVariants || zipVariants.length > 0;

    const action = isUpdate ? 'update' : 'create';
    if (isUpdate) toUpdate += 1;
    else toCreate += 1;

    previewRows.push({
      row: group.rowNumbers[0],
      rowNumbers: group.rowNumbers,
      action,
      existingId: existing?.id || null,
      name,
      nameProvided: nameField.provided && !!nameField.value,
      category: categories[0],
      categories,
      categoriesProvided: inputCategories.length > 0,
      price,
      priceProvided: priceField.provided && priceField.value != null,
      purchasePrice: purchasePrice.value,
      purchasePriceProvided: purchasePrice.provided,
      supplierName: supplierName.value,
      supplierProvided: supplierName.provided,
      supplierPhone: supplierPhone.value,
      description: description.value,
      descriptionProvided: description.provided,
      technical_data: technicalData.value,
      technicalDataProvided: technicalData.provided,
      usage: usage.value,
      usageProvided: usage.provided,
      warnings: warnings.value,
      warningsProvided: warnings.provided,
      mrp: mrp.value,
      mrpProvided: mrp.provided,
      stock: stock.value,
      stockProvided: stock.provided,
      brand: brand.value,
      brandProvided: brand.provided,
      type: type.value,
      typeProvided: type.provided,
      is_available: available.value,
      hasAvailable: available.provided,
      is_hidden: hidden.value,
      hasHidden: hidden.provided,
      imageSource,
      imageProvided,
      variants: variantsWithZip,
      hasVariants: hasVariantsWithZip,
      variantCount: variantsWithZip.length,
      zipImageCount: (zipImages?.baseImage ? 1 : 0) + zipVariants.length,
      normalizedName: normalizeImportName(name)
    });
  }

  return {
    mode: normalizedMode,
    totalRows: rows.length,
    previewRows,
    totalVariantCount: previewRows.reduce((total, row) => total + Number(row.variantCount || 0), 0),
    invalidRows,
    createdCategories,
    skippedDuplicates,
    skippedInvalid,
    toCreate,
    toUpdate,
    imageZipWarnings: Array.isArray(imageZip?.warnings) ? imageZip.warnings : [],
    errorExportBase64: buildImportErrorExport(invalidRows)
  };
}

export async function applyProductImportAnalysis(conn, analysis, uploadsDir, saveImage = saveImportedImage) {
  let imported = 0;
  let updated = 0;

  async function resolveSupplierId(name, phone) {
    const supplierName = String(name || '').trim();
    if (!supplierName) return null;
    const supplierPhone = String(phone || '').trim();
    const [existingRows] = await conn.query('SELECT id, contact_info FROM suppliers WHERE name = ? ORDER BY id ASC LIMIT 1', [supplierName]);
    if (existingRows[0]) {
      if (supplierPhone && !String(existingRows[0].contact_info || '').trim()) {
        await conn.query('UPDATE suppliers SET contact_info = ? WHERE id = ?', [supplierPhone, existingRows[0].id]);
      }
      return existingRows[0].id;
    }
    const [result] = await conn.query(
      'INSERT INTO suppliers (name, contact_info, account_balance) VALUES (?, ?, 0)',
      [supplierName, supplierPhone || null]
    );
    return result.insertId;
  }

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
      if (row.action === 'update' && row.existingId) {
        const supplierId = row.supplierProvided
          ? await resolveSupplierId(row.supplierName, row.supplierPhone)
          : undefined;
        const importedImageUrl = row.imageProvided
          ? resolveImportedImageUrl(row.imageSource, row.row, uploadsDir, saveImage)
          : undefined;
        const updates = [];
        const values = [];
        const addUpdate = (sql, value) => {
          updates.push(sql);
          values.push(value);
        };

        if (row.nameProvided) addUpdate('name = ?', row.name);
        if (row.descriptionProvided) addUpdate('description = ?', row.description);
        if (row.usageProvided) addUpdate('`usage` = ?', row.usage);
        if (row.technicalDataProvided) addUpdate('technical_data = ?', row.technical_data);
        if (row.warningsProvided) addUpdate('warnings = ?', row.warnings);
        if (row.priceProvided) addUpdate('price = ?', row.price);
        if (row.purchasePriceProvided) addUpdate('purchase_price = ?', row.purchasePrice);
        if (row.supplierProvided) addUpdate('supplier_id = ?', supplierId);
        if (row.mrpProvided) addUpdate('mrp = ?', row.mrp);
        if (row.stockProvided) addUpdate('stock = ?', row.stock);
        if (row.brandProvided) addUpdate('brand = ?', row.brand);
        if (row.typeProvided) addUpdate('type = ?', row.type);
        if (row.categoriesProvided) {
          addUpdate('category = ?', row.category);
          addUpdate('categories = ?', JSON.stringify(row.categories));
        }
        if (row.imageProvided) {
          addUpdate('image_url = ?', importedImageUrl);
          addUpdate('image_urls = ?', importedImageUrl ? JSON.stringify([importedImageUrl]) : null);
        }
        if (row.hasAvailable) addUpdate('is_available = ?', row.is_available ? 1 : 0);
        if (row.hasHidden) addUpdate('is_hidden = ?', row.is_hidden ? 1 : 0);
        if (row.hasVariants) addUpdate('variant_options = ?', row.variants.length ? JSON.stringify(row.variants) : null);

        if (updates.length) {
          values.push(row.existingId);
          await conn.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
        }
        updated += 1;
        continue;
      }

      const supplierId = await resolveSupplierId(row.supplierName, row.supplierPhone);
      const importedImageUrl = row.imageProvided
        ? resolveImportedImageUrl(row.imageSource, row.row, uploadsDir, saveImage)
        : null;
      await conn.query(
        `INSERT INTO products (name, description, \`usage\`, technical_data, warnings, price, mrp, stock, brand, type, supplier_id, purchase_price, category, categories, color_options, variant_options, image_url, image_urls, docs, links, is_available, is_hidden)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.name,
          row.description || null,
          row.usage || null,
          row.technical_data || null,
          row.warnings || null,
          row.price,
          row.mrp,
          row.stock ?? 0,
          row.brand,
          row.type,
          supplierId,
          row.purchasePrice,
          row.category,
          JSON.stringify(row.categories || [row.category]),
          null,
          row.hasVariants ? JSON.stringify(row.variants) : null,
          importedImageUrl,
          importedImageUrl ? JSON.stringify([importedImageUrl]) : null,
          null,
          null,
          row.is_available == null ? 1 : (row.is_available ? 1 : 0),
          row.is_hidden == null ? 0 : (row.is_hidden ? 1 : 0)
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
  if (['1', 'true', 'yes', 'on', 'نعم'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'لا'].includes(normalized)) return false;
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
        <!doctype html>
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body dir="rtl" style="margin:0; padding:0; background:linear-gradient(135deg, #f6f6f8 0%, #e4e4e9 100%); direction:rtl; text-align:right; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#364049;">
            <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; direction:rtl; text-align:right; background:linear-gradient(135deg, #f6f6f8 0%, #e4e4e9 100%);">
              <tr>
                <td align="center" style="padding:12px;">
                  <table role="presentation" dir="rtl" width="700" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:700px; max-width:700px; direction:rtl; text-align:right; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 24px rgba(58, 55, 65, 0.12);">
                    <tr>
                      <td style="padding:24px 16px; background:linear-gradient(135deg, #3a3741 0%, #2d2a34 100%); border-bottom:3px solid #f99d1c; text-align:center;">
                        <div style="color:#f99d1c; font-size:26px; line-height:1.35; font-weight:600;">شادي شري للهندسة والاستشارات</div>
                        <div style="color:#ffffff; font-size:15px; line-height:1.9; opacity:0.9; margin-top:6px;">استعادة كلمة المرور</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px;">
                        <div style="margin-bottom:16px; color:#1a1a1a; font-size:16px; line-height:1.8; font-weight:600; background:linear-gradient(135deg, #f6f6f8 0%, #e4e4e9 100%); padding:16px; border-radius:8px; border:1px solid #f99d1c;">تم طلب إعادة تعيين كلمة المرور لحساب الإدارة.</div>
                        <div style="color:#3a3741; font-size:16px; font-weight:700; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #f99d1c; text-align:right;">رمز التحقق</div>
                        <div style="background:linear-gradient(135deg, #3a3741 0%, #2d2a34 100%); border-radius:12px; padding:20px; text-align:center; color:white; box-shadow:0 4px 12px rgba(58, 55, 65, 0.25);">
                          <div style="font-size:34px; font-weight:700; letter-spacing:8px; color:#f99d1c;">${code}</div>
                        </div>
                        <div style="margin-top:16px; background:linear-gradient(135deg, #f6f6f8 0%, #e4e4e9 100%); padding:16px; border-radius:8px; border:1px solid #f99d1c; color:#1a1a1a; font-size:14px; line-height:1.8; text-align:right;">مدة صلاحية الرمز: ${RESET_CODE_EXPIRES_MINUTES} دقائق.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
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

router.get('/sharah/reels', requireAdmin, async (req, res) => {
  try {
    const data = await fetchSharahReadable('/reels', { limit: req.query.limit || 500, offset: req.query.offset, q: req.query.q });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to load Shara reels' });
  }
});

router.get('/sharah/reels/tiktok', requireAdmin, async (req, res) => {
  try {
    const data = await fetchSharahReadable('/reels/tiktok', { limit: req.query.limit || 500, q: req.query.q });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to load Shara TikTok reels' });
  }
});

router.get('/sharah/token', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const token = await getConfiguredSharahAdminToken();
    return res.json({ configured: !!token });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load Shara token status' });
  }
});

router.post('/sharah/token', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    await saveAdminGlobalSetting(SHARAH_ADMIN_TOKEN_KEY, token);
    return res.json({ configured: !!token });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save Shara token' });
  }
});

router.get('/sharah/popular-tags', requireAdmin, async (req, res) => {
  try {
    const data = await fetchSharahReadable('/popular-tags');
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to load Shara popular tags' });
  }
});

router.post('/sharah/popular-tags', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const data = await fetchSharah('/popular-tags', { method: 'POST', body: req.body, admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to update Shara popular tags' });
  }
});

router.get('/sharah/platform-settings', requireAdmin, async (req, res) => {
  try {
    const data = await fetchSharah('/platform-settings');
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to load Shara platform settings' });
  }
});

router.post('/sharah/platform-settings', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const data = await fetchSharah('/platform-settings', { method: 'POST', body: req.body, admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to update Shara platform settings' });
  }
});

router.get('/sharah/admin-tags', requireAdmin, async (req, res) => {
  try {
    const hasToken = !!(await getConfiguredSharahAdminToken());
    if (!hasToken) return res.json([]);
    const data = await fetchSharah('/admin-tags', { admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to load Shara admin tags' });
  }
});

router.post('/sharah/admin-tags', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const data = await fetchSharah('/admin-tags', { method: 'POST', body: req.body, admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to update Shara admin tags' });
  }
});

router.post('/sharah/reels/:platform/:reelId/visibility', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const platform = encodeURIComponent(String(req.params.platform || ''));
    const reelId = encodeURIComponent(String(req.params.reelId || ''));
    const data = await fetchSharah(`/reels/${platform}/${reelId}/visibility`, { method: 'POST', body: req.body, admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to update Shara reel visibility' });
  }
});

router.post('/sharah/reels/add-url', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const data = await fetchSharah('/reels/add-url', { method: 'POST', body: req.body, admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to add Shara reel' });
  }
});

router.post('/sharah/reels/:platform/:reelId/tags', requirePermission('sharah', 'manage'), async (req, res) => {
  try {
    const platform = encodeURIComponent(String(req.params.platform || ''));
    const reelId = encodeURIComponent(String(req.params.reelId || ''));
    const data = await fetchSharah(`/reels/${platform}/${reelId}/tags`, { method: 'POST', body: req.body, admin: true });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Failed to update Shara reel tags' });
  }
});

router.get('/orders', requireAdmin, async (req, res) => {
  const orderSelectFields = await getOrderSelectFields();
  const { status, limit = 50, offset = 0 } = req.query;
  const normalizedStatus = String(status || '').trim();

  if (normalizedStatus === 'pending_payment') {
    if (!hasPermission(req.admin, 'orders', 'read_unpaid') && !hasPermission(req.admin, 'orders', 'read_list')) {
      return res.status(403).json({ error: 'You do not have permission to access pending payment orders' });
    }
  } else if (!hasPermission(req.admin, 'orders', 'read_list')) {
    return res.status(403).json({ error: 'You do not have permission to access orders' });
  }

  const params = [];
  let sql = `SELECT ${orderSelectFields} FROM orders`;
  if (normalizedStatus) {
    sql += ' WHERE status = ?';
    params.push(normalizedStatus);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 50, Number(offset) || 0);

  const [rows] = await pool.query(sql, params);
  return res.json(rows);
});

router.post('/orders', requirePermission('orders', 'create'), adminIdempotency('POST /admin/orders'), async (req, res) => {
  try {
    const { client_id, supplier_buyer_id, customer, items, notes, status, discount } = req.body || {};
    const normalizedStatus = String(status || 'pending_payment').trim();
    if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const created = await createOrderFromDraft({ client_id, supplier_buyer_id, customer, items, notes, discount, source: 'admin' });
    if (normalizedStatus !== 'pending_payment') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('UPDATE orders SET status = ? WHERE id = ?', [normalizedStatus, created.order.id]);
        if (normalizedStatus === 'delivered') {
          created.accounting = await createDeliveredOrderAccounting(conn, created.order.id, new Date().toISOString().slice(0, 10));
        }
        const orderSelectFields = await getOrderSelectFields();
        const [rows] = await conn.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [created.order.id]);
        await conn.commit();
        created.order = rows[0] || created.order;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    const message = err.message || 'Order creation failed';
    const statusCode = /^Insufficient stock for /i.test(message) || /Invalid|not found|unavailable/i.test(message) ? 400 : 500;
    return res.status(statusCode).json({ error: message });
  }
});

router.put('/orders/:id/discount', requirePermission('orders', 'change_status'), adminIdempotency('PUT /admin/orders/:id/discount'), async (req, res) => {
  const orderId = parsePositiveId(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'invalid order id' });
  if (!(await hasOrderDiscountColumns())) {
    return res.status(500).json({ error: 'Order discount migration has not been applied' });
  }

  const [orders] = await pool.query('SELECT id, status, subtotal, tax, shipping FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const order = orders[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!['pending_payment', 'paid'].includes(String(order.status || '').trim())) {
    return res.status(400).json({ error: 'Discounts can only be changed while order is pending payment or paid' });
  }

  let discount;
  try {
    discount = calculateOrderDiscount(req.body || {}, order.subtotal);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid discount' });
  }

  const subtotal = Number(order.subtotal || 0);
  const tax = Number(order.tax || 0);
  const shipping = Number(order.shipping || 0);
  const total = Math.max(0, Math.round((subtotal + tax + shipping - Number(discount.amount || 0)) * 100) / 100);

  await pool.query(
    `UPDATE orders
        SET discount_type = ?, discount_value = ?, discount_amount = ?, discount_reason = ?, total = ?
      WHERE id = ?`,
    [discount.type, discount.value, discount.amount, discount.reason, total, orderId]
  );

  const orderSelectFields = await getOrderSelectFields();
  const [rows] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
  return res.json(rows[0]);
});

router.put('/orders/:id/delivery', requirePermission('orders', 'change_status'), adminIdempotency('PUT /admin/orders/:id/delivery'), async (req, res) => {
  const orderId = parsePositiveId(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'invalid order id' });
  if (!(await hasOrderColumn('delivery_fee_amount')) || !(await hasOrderColumn('delivery_payer')) || !(await hasOrderColumn('delivery_note'))) {
    return res.status(500).json({ error: 'Order delivery migration has not been applied' });
  }

  const payer = 'customer';
  const note = String(req.body?.note || '').trim() || null;
  const amount = parseMoney(req.body?.amount);
  if (Number.isNaN(amount) || amount < 0) {
    return res.status(400).json({ error: 'delivery amount must be zero or greater' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!orders[0]) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    await replaceOrderSupplierDeliveries(conn, orderId, []);
    if (amount > 0) {
      await conn.query(
        'UPDATE orders SET delivery_fee_amount = ?, delivery_payer = ?, delivery_note = ? WHERE id = ?',
        [amount, payer, note, orderId]
      );
    } else {
      await conn.query(
        'UPDATE orders SET delivery_fee_amount = 0, delivery_payer = NULL, delivery_note = NULL WHERE id = ?',
        [orderId]
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const clientDelivery = await syncClientDeliveryVoucherForOrder(conn, orderId, date);
    const supplierDelivery = await syncSupplierDeliveryVouchersForOrder(conn, orderId, date);
    const orderSelectFields = await getOrderSelectFields();
    const [rows] = await conn.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
    const supplierDeliveries = await getSupplierDeliveriesForOrder(conn, orderId);
    await conn.commit();
    return res.json({ order: rows[0], supplier_deliveries: supplierDeliveries, deliveryAccounting: { client: clientDelivery, supplier: supplierDelivery } });
  } catch (err) {
    await conn.rollback();
    return res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update delivery fee' });
  } finally {
    conn.release();
  }
});

router.put('/orders/:id/items', requirePermission('orders', 'change_status'), async (req, res) => {
  const orderId = parsePositiveId(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'invalid order id' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Invalid order items' });

  const hasDiscountColumns = await hasOrderDiscountColumns();
  const discountSelect = hasDiscountColumns ? ', discount_type, discount_value, discount_reason' : '';
  const [orders] = await pool.query(`SELECT id, status${discountSelect} FROM orders WHERE id = ? LIMIT 1`, [orderId]);
  const order = orders[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!['pending_payment', 'paid'].includes(String(order.status || '').trim())) {
    return res.status(400).json({ error: 'Order items can only be changed while order is pending payment or paid' });
  }

  const [oldItems] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);
  const stockAdjustments = oldItems.reduce((map, item) => {
    const productId = Number(item.product_id || 0);
    if (productId) map[productId] = (map[productId] || 0) + Number(item.quantity || 0);
    return map;
  }, {});

  let summary;
  try {
    summary = await buildOrderSummary({
      items,
      discount: hasDiscountColumns ? {
        type: order.discount_type,
        value: order.discount_value,
        reason: order.discount_reason
      } : undefined,
      stockAdjustments,
      allowCustomItems: true
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid order items' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [lockedOrders] = await conn.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const lockedOrder = lockedOrders[0];
    if (!lockedOrder) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!['pending_payment', 'paid'].includes(String(lockedOrder.status || '').trim())) {
      await conn.rollback();
      return res.status(400).json({ error: 'Order items can only be changed while order is pending payment or paid' });
    }

    await releaseStockForItems(conn, oldItems);
    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    for (const item of summary.orderItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, supplier_id, product_name, color_name, color_hex, variant_id, size_name, quantity, unit_price, purchase_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.supplierId, item.name, item.colorName, item.colorHex, item.variantId, item.sizeName, item.quantity, item.unitPrice, item.purchasePrice, item.lineTotal]
      );
    }
    await reserveStockForItems(conn, summary.orderItems);

    const updateColumns = ['subtotal = ?', 'tax = ?', 'shipping = ?', 'total = ?'];
    const updateValues = [summary.subtotal, summary.tax, summary.shipping, summary.total];
    if (hasDiscountColumns) {
      updateColumns.push('discount_type = ?', 'discount_value = ?', 'discount_amount = ?', 'discount_reason = ?');
      updateValues.push(summary.discount.type, summary.discount.value, summary.discount.amount, summary.discount.reason);
    }
    updateValues.push(orderId);
    await conn.query(`UPDATE orders SET ${updateColumns.join(', ')} WHERE id = ?`, updateValues);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    const message = err.message || 'Failed to update order items';
    const statusCode = /^Insufficient stock for /i.test(message) || /Invalid|not found|unavailable/i.test(message) ? 400 : 500;
    return res.status(statusCode).json({ error: message });
  } finally {
    conn.release();
  }

  const orderSelectFields = await getOrderSelectFields();
  const [updatedOrders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
  const [updatedItems] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ? ORDER BY id ASC`, [orderId]);
  return res.json({ order: updatedOrders[0], items: updatedItems });
});

router.get('/orders/:id', requirePermission('orders', 'read_details'), async (req, res) => {
  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
  const order = orders[0];
  if (!order) return res.status(404).json({ error: 'Not found' });

  const [items] = await pool.query(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.color_name, oi.color_hex, oi.variant_id, oi.size_name, oi.quantity, oi.unit_price, oi.line_total,
            COALESCE(oi.purchase_price, 0) AS purchase_price,
            ROUND(oi.quantity * COALESCE(oi.purchase_price, 0), 2) AS purchase_total,
            ROUND(oi.line_total - (oi.quantity * COALESCE(oi.purchase_price, 0)), 2) AS profit_total,
            COALESCE(oi.supplier_id, p.supplier_id) AS supplier_id,
            s.name AS supplier_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN suppliers s ON s.id = COALESCE(oi.supplier_id, p.supplier_id)
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC`,
    [req.params.id]
  );
  const supplierDeliveries = await getSupplierDeliveriesForOrder(pool, req.params.id);
  return res.json({ order, items, supplier_deliveries: supplierDeliveries });
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

router.get('/orders/:id/email-print', requireAdmin, async (req, res) => {
  const { type = 'internal' } = req.query;
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
  const printableHtml = html.replace('</body>', '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script></body>');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="order-${order.id}-${type}-email.html"`);
  return res.send(printableHtml);
});

router.get('/orders/:id/email-pdf', requireAdmin, async (req, res) => {
  const { type = 'internal' } = req.query;
  if (type !== 'customer' && type !== 'internal') {
    return res.status(400).json({ error: 'invalid type' });
  }

  const allowed = type === 'customer'
    ? hasPermission(req.admin, 'orders', 'preview_customer_email')
    : hasPermission(req.admin, 'orders', 'preview_internal_email');
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have permission to preview this PDF' });
  }

  try {
    const orderSelectFields = await getOrderSelectFields();
    const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
    const order = orders[0];
    if (!order) return res.status(404).json({ error: 'Not found' });

    const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [req.params.id]);
    const [payments] = await pool.query(
      'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );

    const pdf = await buildOrderEmailTemplatePdf({ type, order, items, payment: payments[0] || null });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="order-${order.id}-${type}-email.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdf);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to generate email PDF' });
  }
});

router.post('/orders/:id/send-pdf-email', requireAdmin, async (req, res) => {
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  if (!hasPermission(req.admin, 'orders', 'send_internal_email')) {
    return res.status(403).json({ error: 'You do not have permission to send this PDF' });
  }

  try {
    const to = String(req.body?.email || '').trim();
    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'Recipient email is invalid' });
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

    await sendOrderPdfEmail({ to, type: 'internal', order, items, payment: payments[0] || null });
    return res.json({ ok: true, sentTo: to });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Failed to send PDF email' });
  }
});

router.get('/orders/:id/internal-pdf', requireAdmin, async (req, res) => {
  if (!hasPermission(req.admin, 'orders', 'preview_internal_email')) {
    return res.status(403).json({ error: 'You do not have permission to preview this PDF' });
  }

  try {
    const orderSelectFields = await getOrderSelectFields();
    const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [req.params.id]);
    const order = orders[0];
    if (!order) return res.status(404).json({ error: 'Not found' });

    const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [req.params.id]);
    const [payments] = await pool.query(
      'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );

    const pdf = await buildInternalOrderPdf({ order, items, payment: payments[0] || null });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="order-${order.id}-internal.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdf);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to generate PDF' });
  }
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
  const orderId = parsePositiveId(req.params.id);
  const { status, note, mark_paid } = req.body || {};
  const normalizedStatus = String(status || '').trim();
  const normalizedNote = String(note || '').trim();
  const markPaid = mark_paid === true || mark_paid === 'true' || mark_paid === 1 || mark_paid === '1';
  if (!orderId) return res.status(400).json({ error: 'invalid order id' });
  if (!normalizedStatus) return res.status(400).json({ error: 'status required' });
  if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  if (!normalizedNote) {
    return res.status(400).json({ error: 'note required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existingRows] = await conn.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const existingOrder = existingRows[0];
    if (!existingOrder) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (await hasOrderAdminStatusNote()) {
      await conn.query('UPDATE orders SET status = ?, admin_status_note = ? WHERE id = ?', [normalizedStatus, normalizedNote, orderId]);
    } else {
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', [normalizedStatus, orderId]);
    }

    let accounting = null;
    const previousStatus = String(existingOrder.status || '').trim();
    if (normalizedStatus === 'delivered') {
      accounting = await createDeliveredOrderAccounting(conn, orderId, new Date().toISOString().slice(0, 10), { markPaid });
    } else if (previousStatus === 'delivered') {
      accounting = { reversed: await reverseOrderAccounting(conn, orderId) };
    }

    const orderSelectFields = await getOrderSelectFields();
    const [rows] = await conn.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
    await conn.commit();
    const updatedOrder = rows[0];

    let internalEmail = null;
    const shouldSendInternalEmail = previousStatus === 'pending_payment' && ['paid', 'delivered'].includes(normalizedStatus);
    if (shouldSendInternalEmail) {
      try {
        internalEmail = await sendInternalOrderEmailById(orderId, updatedOrder);
      } catch (emailError) {
        internalEmail = {
          sent: false,
          skipped: false,
          error: emailError.message || 'Failed to send internal order email'
        };
      }
    }

    return res.json({ order: updatedOrder, accounting, internalEmail });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to update order status' });
  } finally {
    conn.release();
  }
});

router.get('/suppliers', requirePermission('purchasing', 'read'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.contact_info, s.email, s.phone, s.address_line1, s.city, s.state, s.country,
            s.account_balance, s.created_at, s.updated_at,
            COUNT(p.id) AS product_count
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id = s.id
      GROUP BY s.id, s.name, s.contact_info, s.email, s.phone, s.address_line1, s.city, s.state, s.country, s.account_balance, s.created_at, s.updated_at
      ORDER BY s.name ASC, s.id ASC`
  );
  return res.json(rows);
});

router.get('/suppliers/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const format = normalizeExportFormat(req.query.format);
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.contact_info, s.email, s.phone, s.address_line1, s.city, s.state, s.country,
            s.account_balance, s.created_at, s.updated_at,
            COUNT(p.id) AS product_count
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id = s.id
      GROUP BY s.id, s.name, s.contact_info, s.email, s.phone, s.address_line1, s.city, s.state, s.country, s.account_balance, s.created_at, s.updated_at
      ORDER BY s.name ASC, s.id ASC`
  );

  return sendTableExport(res, {
    format,
    filename: 'suppliers',
    sheetName: 'الموردون',
    columns: [
      { key: 'id', label: 'المعرف' },
      { key: 'name', label: 'المورد' },
      { key: 'contact_info', label: 'التواصل', value: (row) => row.contact_info || '-' },
      { key: 'phone', label: 'الهاتف', value: (row) => row.phone || '-' },
      { key: 'email', label: 'البريد', value: (row) => row.email || '-' },
      { key: 'address_line1', label: 'العنوان', value: (row) => row.address_line1 || '-' },
      { key: 'city', label: 'المدينة', value: (row) => row.city || '-' },
      { key: 'product_count', label: 'عدد المنتجات' },
      { key: 'account_balance', label: 'الرصيد الحالي' },
      { key: 'created_at', label: 'تاريخ الإنشاء', value: (row) => formatExportDate(row.created_at) },
      { key: 'updated_at', label: 'آخر تحديث', value: (row) => formatExportDate(row.updated_at) }
    ],
    rows
  });
});

router.post('/suppliers', requirePermission('purchasing', 'create'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim() || null;
  const phone = String(req.body?.phone || '').trim() || null;
  const contactInfo = String(req.body?.contact_info || phone || '').trim() || null;
  const addressLine1 = String(req.body?.address_line1 || '').trim() || null;
  const city = String(req.body?.city || '').trim() || null;
  const state = String(req.body?.state || '').trim() || null;
  const country = String(req.body?.country || 'فلسطين').trim() || 'فلسطين';
  if (!name) return res.status(400).json({ error: 'name required' });

  const [result] = await pool.query(
    'INSERT INTO suppliers (name, contact_info, email, phone, address_line1, city, state, country, account_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [name, contactInfo, email, phone, addressLine1, city, state, country]
  );
  const [rows] = await pool.query('SELECT id, name, contact_info, email, phone, address_line1, city, state, country, account_balance, created_at, updated_at FROM suppliers WHERE id = ?', [result.insertId]);
  return res.status(201).json(rows[0]);
});

router.put('/suppliers/:id', requirePermission('purchasing', 'update'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.id);
  if (!supplierId) return res.status(400).json({ error: 'invalid supplier id' });
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim() || null;
  const phone = String(req.body?.phone || '').trim() || null;
  const contactInfo = String(req.body?.contact_info || phone || '').trim() || null;
  const addressLine1 = String(req.body?.address_line1 || '').trim() || null;
  const city = String(req.body?.city || '').trim() || null;
  const state = String(req.body?.state || '').trim() || null;
  const country = String(req.body?.country || 'فلسطين').trim() || 'فلسطين';
  if (!name) return res.status(400).json({ error: 'name required' });

  await pool.query('UPDATE suppliers SET name = ?, contact_info = ?, email = ?, phone = ?, address_line1 = ?, city = ?, state = ?, country = ? WHERE id = ?', [name, contactInfo, email, phone, addressLine1, city, state, country, supplierId]);
  const [rows] = await pool.query('SELECT id, name, contact_info, email, phone, address_line1, city, state, country, account_balance, created_at, updated_at FROM suppliers WHERE id = ?', [supplierId]);
  if (!rows[0]) return res.status(404).json({ error: 'Supplier not found' });
  return res.json(rows[0]);
});

router.delete('/suppliers/:id', requirePermission('purchasing', 'delete'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.id);
  if (!supplierId) return res.status(400).json({ error: 'invalid supplier id' });
  const [rows] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
  if (!rows[0]) return res.status(404).json({ error: 'Supplier not found' });
  await pool.query('DELETE FROM suppliers WHERE id = ?', [supplierId]);
  return res.status(204).end();
});

router.get('/clients', requirePermission('purchasing', 'read'), async (req, res) => {
  const hasSource = await hasClientSourceColumn();
  const sourceSelect = hasSource ? 'c.source,' : "'manual' AS source,";
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.contact_info, c.email, c.phone,
            c.address_line1, c.city, c.state, c.country,
            ${sourceSelect}
            c.account_balance, c.created_at, c.updated_at,
            COUNT(o.id) AS orders_count
       FROM clients c
       LEFT JOIN orders o ON o.client_id = c.id AND o.created_at >= '${ACCOUNTING_ORDER_CUTOFF}' AND o.status = 'delivered'
      GROUP BY c.id, c.name, c.contact_info, c.email, c.phone, c.address_line1, c.city, c.state, c.country, ${hasSource ? 'c.source,' : ''} c.account_balance, c.created_at, c.updated_at
      ORDER BY c.name ASC, c.id ASC`
  );
  return res.json(rows);
});

router.post('/clients', requirePermission('purchasing', 'create'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const contactInfo = String(req.body?.contact_info || '').trim() || null;
  const email = String(req.body?.email || '').trim() || null;
  const phone = String(req.body?.phone || '').trim() || null;
  const addressLine1 = String(req.body?.address_line1 || '').trim() || null;
  const city = String(req.body?.city || '').trim() || null;
  const state = String(req.body?.state || '').trim() || null;
  const country = String(req.body?.country || 'فلسطين').trim() || 'فلسطين';
  if (!name) return res.status(400).json({ error: 'name required' });

  const hasSource = await hasClientSourceColumn();
  const [result] = await pool.query(
    `INSERT INTO clients (name, contact_info, email, phone, address_line1, city, state, country, account_balance${hasSource ? ', source' : ''}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0${hasSource ? ', ?' : ''})`,
    hasSource
      ? [name, contactInfo, email, phone, addressLine1, city, state, country, 'manual']
      : [name, contactInfo, email, phone, addressLine1, city, state, country]
  );
  const [rows] = await pool.query(`SELECT id, name, contact_info, email, phone, address_line1, city, state, country, ${hasSource ? 'source,' : "'manual' AS source,"} account_balance, created_at, updated_at FROM clients WHERE id = ?`, [result.insertId]);
  return res.status(201).json(rows[0]);
});

router.put('/clients/:id', requirePermission('purchasing', 'update'), async (req, res) => {
  const clientId = parsePositiveId(req.params.id);
  if (!clientId) return res.status(400).json({ error: 'invalid client id' });
  const name = String(req.body?.name || '').trim();
  const contactInfo = String(req.body?.contact_info || '').trim() || null;
  const email = String(req.body?.email || '').trim() || null;
  const phone = String(req.body?.phone || '').trim() || null;
  const addressLine1 = String(req.body?.address_line1 || '').trim() || null;
  const city = String(req.body?.city || '').trim() || null;
  const state = String(req.body?.state || '').trim() || null;
  const country = String(req.body?.country || 'فلسطين').trim() || 'فلسطين';
  if (!name) return res.status(400).json({ error: 'name required' });

  await pool.query('UPDATE clients SET name = ?, contact_info = ?, email = ?, phone = ?, address_line1 = ?, city = ?, state = ?, country = ? WHERE id = ?', [name, contactInfo, email, phone, addressLine1, city, state, country, clientId]);
  const hasSource = await hasClientSourceColumn();
  const [rows] = await pool.query(`SELECT id, name, contact_info, email, phone, address_line1, city, state, country, ${hasSource ? 'source,' : "'manual' AS source,"} account_balance, created_at, updated_at FROM clients WHERE id = ?`, [clientId]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  return res.json(rows[0]);
});

router.delete('/clients/:id', requirePermission('purchasing', 'delete'), async (req, res) => {
  const clientId = parsePositiveId(req.params.id);
  if (!clientId) return res.status(400).json({ error: 'invalid client id' });
  const [rows] = await pool.query('SELECT id FROM clients WHERE id = ?', [clientId]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  await pool.query('DELETE FROM clients WHERE id = ?', [clientId]);
  return res.status(204).end();
});

router.get('/order-clients', requireAnyPermission([['orders', 'create'], ['purchasing', 'read']]), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, phone, email, contact_info, address_line1, city, state, country, account_balance
       FROM clients
      ORDER BY name ASC, id ASC`
  );
  return res.json(rows);
});

router.get('/suppliers/:id/orders', requirePermission('purchasing', 'read'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.id);
  if (!supplierId) return res.status(400).json({ error: 'invalid supplier id' });

  const [suppliers] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
  if (!suppliers[0]) return res.status(404).json({ error: 'Supplier not found' });

  const rows = await getSupplierOrderRows(supplierId, req.query);
  return res.json(rows);
});

router.get('/suppliers/:supplierId/purchase-invoices/:entryId', requirePermission('purchasing', 'read'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.supplierId);
  const entryId = parsePositiveId(req.params.entryId);
  if (!supplierId || !entryId) return res.status(400).json({ error: 'invalid invoice reference' });

  const result = await getSupplierPurchaseInvoiceData(supplierId, entryId);
  if (!result) return res.status(404).json({ error: 'Purchase invoice not found' });
  return res.json(result);
});

router.get('/suppliers/:id/orders/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.id);
  if (!supplierId) return res.status(400).json({ error: 'invalid supplier id' });

  const [suppliers] = await pool.query('SELECT id, name FROM suppliers WHERE id = ?', [supplierId]);
  const supplier = suppliers[0];
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const format = normalizeExportFormat(req.query.format);
  const rows = await getSupplierOrderRows(supplierId, req.query);
  return sendTableExport(res, {
    format,
    filename: `supplier-${supplierId}-orders`,
    sheetName: 'طلبات المورد',
    columns: [
      { key: 'order_id', label: 'رقم الطلب' },
      { key: 'created_at', label: 'التاريخ', value: (row) => formatExportDate(row.created_at) },
      { key: 'customer_name', label: 'العميل' },
      { key: 'customer_phone', label: 'الهاتف' },
      { key: 'status', label: 'حالة الطلب' },
      { key: 'product_name', label: 'المنتج' },
      { key: 'quantity', label: 'الكمية' },
      { key: 'unit_price', label: 'سعر البيع' },
      { key: 'line_total', label: 'إجمالي البيع' },
      { key: 'purchase_price', label: 'سعر الشراء' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'profit_total', label: 'إجمالي الربح' }
    ],
    rows
  });
});

router.get('/products/:id/purchasing', requirePermission('purchasing', 'read'), async (req, res) => {
  const productId = parsePositiveId(req.params.id);
  if (!productId) return res.status(400).json({ error: 'invalid product id' });
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.supplier_id, p.purchase_price, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = ?
      LIMIT 1`,
    [productId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  return res.json(rows[0]);
});

router.get('/purchasing/products', requirePermission('purchasing', 'read'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.stock, p.price, p.purchase_price, p.supplier_id, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY s.name ASC, p.name ASC`
  );
  return res.json(rows);
});

router.get('/purchasing/orders', requirePermission('purchasing', 'read'), async (req, res) => {
  const orderSelectFields = await getOrderSelectFields();
  const [rows] = await pool.query(
    `SELECT ${orderSelectFields}
       FROM orders
      WHERE created_at >= '${ACCOUNTING_ORDER_CUTOFF}' AND status = 'delivered'
      ORDER BY created_at DESC
      LIMIT 100`
  );
  return res.json(rows);
});

router.post('/purchasing/calculate', requirePermission('purchasing', 'read'), async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const requested = items
    .map((item) => ({ productId: parsePositiveId(item?.product_id), quantityNeeded: Number(item?.quantity_needed || 0) }))
    .filter((item) => item.productId && Number.isFinite(item.quantityNeeded) && item.quantityNeeded > 0);

  if (requested.length === 0) return res.json({ items: [], total_amount: 0 });

  const ids = requested.map((item) => item.productId);
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.price, p.purchase_price, p.supplier_id, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const rowMap = new Map(rows.map((row) => [Number(row.id), row]));
  const calculated = requested.map((item) => {
    const product = rowMap.get(item.productId) || {};
    const sellingPrice = Number(product.price || 0);
    const purchasePrice = Number(product.purchase_price || 0);
    const sellingTotal = Math.round(item.quantityNeeded * sellingPrice * 100) / 100;
    const lineTotal = Math.round(item.quantityNeeded * purchasePrice * 100) / 100;
    return {
      product_id: item.productId,
      product_name: product.name || '',
      supplier_id: product.supplier_id || null,
      supplier_name: product.supplier_name || '',
      quantity_needed: item.quantityNeeded,
      selling_price: sellingPrice,
      selling_total: sellingTotal,
      purchase_price: purchasePrice,
      line_total: lineTotal,
      profit_total: Math.round((sellingTotal - lineTotal) * 100) / 100
    };
  });
  const totalAmount = calculated.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  return res.json({ items: calculated, total_amount: Math.round(totalAmount * 100) / 100 });
});

router.get('/orders/:id/purchasing-requirements', requirePermission('purchasing', 'read'), async (req, res) => {
  const orderId = parsePositiveId(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'invalid order id' });

  const requirements = await getOrderPurchasingRequirements(pool, orderId, { deliveredOnly: false });
  if (!requirements) return res.status(404).json({ error: 'Order not found' });
  return res.json(requirements);
});

router.post('/orders/:id/purchasing-invoices', requirePermission('purchasing', 'create'), async (req, res) => {
  const orderId = parsePositiveId(req.params.id);
  const date = parseJournalDate(req.body?.date) || new Date().toISOString().slice(0, 10);
  if (!orderId) return res.status(400).json({ error: 'invalid order id' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await createPurchasingInvoicesForOrder(conn, orderId, date);
    if (!result) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    await conn.commit();
    return res.status(201).json(result);
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to create purchase invoices' });
  } finally {
    conn.release();
  }
});

router.get('/journal-entries', requirePermission('purchasing', 'read'), async (req, res) => {
  const supplierId = parsePositiveId(req.query.supplier_id);
  const conditions = [];
  const params = [];
  addAccountingJournalOrderCutoff(conditions, 'je');
  if (supplierId) {
    conditions.push('je.supplier_id = ?');
    params.push(supplierId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const voucherTypeSelect = await getSupplierVoucherTypeSelect('je');
  const [rows] = await pool.query(
    `SELECT je.id, je.supplier_id, s.name AS supplier_name, je.order_id, je.transaction_type, ${voucherTypeSelect}, je.amount, je.reference_doc, je.note, je.date, je.created_at,
            COALESCE(os.total_sales, 0) AS total_sales,
            COALESCE(os.purchase_total, 0) AS purchase_total,
            COALESCE(os.net_profit, 0) AS net_profit,
            COALESCE(os.product_names, '') AS product_names
       FROM journal_entries je
       JOIN suppliers s ON s.id = je.supplier_id
       LEFT JOIN (
         SELECT oi.order_id,
                COALESCE(oi.supplier_id, p.supplier_id) AS supplier_id,
                ROUND(COALESCE(SUM(oi.line_total), 0), 2) AS total_sales,
                ROUND(COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price, 0)), 0), 2) AS purchase_total,
                ROUND(COALESCE(SUM(oi.line_total - (oi.quantity * COALESCE(oi.purchase_price, 0))), 0), 2) AS net_profit,
                GROUP_CONCAT(DISTINCT oi.product_name ORDER BY oi.product_name SEPARATOR '، ') AS product_names
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
          GROUP BY oi.order_id, COALESCE(oi.supplier_id, p.supplier_id)
       ) os ON os.order_id = je.order_id AND os.supplier_id = je.supplier_id
       ${where}
      ORDER BY je.date DESC, je.id DESC`,
    params
  );
  return res.json(rows);
});

router.post('/journal-entries', requirePermission('purchasing', 'create'), adminIdempotency('POST /admin/journal-entries'), async (req, res) => {
  const supplierId = parsePositiveId(req.body?.supplier_id);
  const requestedVoucherType = String(req.body?.voucher_type || '').trim();
  let transactionType = String(req.body?.transaction_type || '').trim().toLowerCase();
  const amount = parseMoney(req.body?.amount);
  const referenceDoc = String(req.body?.reference_doc || '').trim() || null;
  const note = String(req.body?.note || '').trim() || null;
  const date = parseJournalDate(req.body?.date) || new Date().toISOString().slice(0, 10);
  const voucherType = requestedVoucherType || (transactionType === 'debit' ? 'supplier_payment' : 'purchase_invoice');
  const voucherTransactionType = SUPPLIER_VOUCHER_TRANSACTION_TYPES[voucherType];

  if (!supplierId) return res.status(400).json({ error: 'supplier_id required' });
  if (!voucherTransactionType) return res.status(400).json({ error: 'voucher_type invalid' });
  transactionType = voucherTransactionType;
  if (Number.isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be greater than zero' });
  const hasVoucherType = await hasSupplierJournalVoucherType();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [suppliers] = await conn.query('SELECT id FROM suppliers WHERE id = ? FOR UPDATE', [supplierId]);
    if (!suppliers[0]) {
      await conn.rollback();
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const [result] = await conn.query(
      `INSERT INTO journal_entries (supplier_id, transaction_type${hasVoucherType ? ', voucher_type' : ''}, amount, reference_doc, note, date)
       VALUES (?, ?${hasVoucherType ? ', ?' : ''}, ?, ?, ?, ?)`,
      hasVoucherType
        ? [supplierId, transactionType, voucherType, amount, referenceDoc, note, date]
        : [supplierId, transactionType, amount, referenceDoc, note, date]
    );
    const balanceDelta = transactionType === 'credit' ? amount : -amount;
    await conn.query('UPDATE suppliers SET account_balance = account_balance + ? WHERE id = ?', [balanceDelta, supplierId]);

    const voucherTypeSelect = await getSupplierVoucherTypeSelect('je');
    const [rows] = await conn.query(
      `SELECT je.id, je.supplier_id, s.name AS supplier_name, je.transaction_type, ${voucherTypeSelect}, je.amount, je.reference_doc, je.note, je.date, je.created_at, s.account_balance
         FROM journal_entries je
         JOIN suppliers s ON s.id = je.supplier_id
        WHERE je.id = ?`,
      [result.insertId]
    );
    await conn.commit();
    return res.status(201).json(rows[0]);
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to create journal entry' });
  } finally {
    conn.release();
  }
});

router.get('/client-journal-entries', requirePermission('purchasing', 'read'), async (req, res) => {
  const clientId = parsePositiveId(req.query.client_id);
  const conditions = [];
  const params = [];
  addAccountingJournalOrderCutoff(conditions, 'cje');
  if (clientId) {
    conditions.push('cje.client_id = ?');
    params.push(clientId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const voucherTypeSelect = await getClientVoucherTypeSelect('cje');
  const [rows] = await pool.query(
    `SELECT cje.id, cje.client_id, c.name AS client_name, cje.order_id, cje.transaction_type, ${voucherTypeSelect}, cje.amount, cje.reference_doc, cje.note, cje.date, cje.created_at,
            COALESCE(os.total_sales, 0) AS total_sales,
            COALESCE(os.purchase_total, 0) AS purchase_total,
            COALESCE(os.net_profit, 0) AS net_profit,
            COALESCE(os.product_names, '') AS product_names
       FROM client_journal_entries cje
       JOIN clients c ON c.id = cje.client_id
       LEFT JOIN (
         SELECT oi.order_id,
                ROUND(COALESCE(SUM(oi.line_total), 0), 2) AS total_sales,
                ROUND(COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price, 0)), 0), 2) AS purchase_total,
                ROUND(COALESCE(SUM(oi.line_total - (oi.quantity * COALESCE(oi.purchase_price, 0))), 0), 2) AS net_profit,
                GROUP_CONCAT(DISTINCT oi.product_name ORDER BY oi.product_name SEPARATOR '، ') AS product_names
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
          GROUP BY oi.order_id
       ) os ON os.order_id = cje.order_id
       ${where}
      ORDER BY cje.date DESC, cje.id DESC`,
    params
  );
  return res.json(rows);
});

router.post('/client-journal-entries', requirePermission('purchasing', 'create'), adminIdempotency('POST /admin/client-journal-entries'), async (req, res) => {
  const clientId = parsePositiveId(req.body?.client_id);
  const requestedVoucherType = String(req.body?.voucher_type || '').trim();
  let transactionType = String(req.body?.transaction_type || '').trim().toLowerCase();
  const amount = parseMoney(req.body?.amount);
  const referenceDoc = String(req.body?.reference_doc || '').trim() || null;
  const note = String(req.body?.note || '').trim() || null;
  const orderId = parsePositiveId(req.body?.order_id) || null;
  const date = parseJournalDate(req.body?.date) || new Date().toISOString().slice(0, 10);
  const voucherType = requestedVoucherType || (transactionType === 'credit' ? 'client_receipt' : 'sales_invoice');
  const voucherTransactionType = CLIENT_VOUCHER_TRANSACTION_TYPES[voucherType];

  if (!clientId) return res.status(400).json({ error: 'client_id required' });
  if (!voucherTransactionType) return res.status(400).json({ error: 'voucher_type invalid' });
  transactionType = voucherTransactionType;
  if (Number.isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be greater than zero' });
  const hasVoucherType = await hasClientJournalVoucherType();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [clients] = await conn.query('SELECT id FROM clients WHERE id = ? FOR UPDATE', [clientId]);
    if (!clients[0]) {
      await conn.rollback();
      return res.status(404).json({ error: 'Client not found' });
    }

    if (orderId) {
      const [orders] = await conn.query(`SELECT id FROM orders WHERE id = ? AND created_at >= '${ACCOUNTING_ORDER_CUTOFF}' AND status = 'delivered' LIMIT 1`, [orderId]);
      if (!orders[0]) {
        await conn.rollback();
        return res.status(404).json({ error: 'Order not found' });
      }
    }

    const [result] = await conn.query(
      `INSERT INTO client_journal_entries (client_id, order_id, transaction_type${hasVoucherType ? ', voucher_type' : ''}, amount, reference_doc, note, date)
       VALUES (?, ?, ?${hasVoucherType ? ', ?' : ''}, ?, ?, ?, ?)`,
      hasVoucherType
        ? [clientId, orderId, transactionType, voucherType, amount, referenceDoc, note, date]
        : [clientId, orderId, transactionType, amount, referenceDoc, note, date]
    );
    const balanceDelta = transactionType === 'debit' ? amount : -amount;
    await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [balanceDelta, clientId]);

    const voucherTypeSelect = await getClientVoucherTypeSelect('cje');
    const [rows] = await conn.query(
      `SELECT cje.id, cje.client_id, c.name AS client_name, cje.order_id, cje.transaction_type, ${voucherTypeSelect}, cje.amount, cje.reference_doc, cje.note, cje.date, cje.created_at, c.account_balance
         FROM client_journal_entries cje
         JOIN clients c ON c.id = cje.client_id
        WHERE cje.id = ?`,
      [result.insertId]
    );
    await conn.commit();
    return res.status(201).json(rows[0]);
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || 'Failed to create client journal entry' });
  } finally {
    conn.release();
  }
});

router.get('/purchasing/report', requirePermission('purchasing', 'read'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id AS supplier_id,
            s.name AS supplier_name,
            s.account_balance AS current_outstanding_balance,
            COALESCE(pa.products_count, 0) AS products_count,
            COALESCE(pa.products_assigned, '') AS products_assigned,
            COALESCE(ja.total_purchases, 0) AS total_purchases,
            COALESCE(ja.total_payments, 0) AS total_payments
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id,
                COUNT(*) AS products_count,
                GROUP_CONCAT(name ORDER BY name SEPARATOR '، ') AS products_assigned
           FROM products
          WHERE supplier_id IS NOT NULL
          GROUP BY supplier_id
       ) pa ON pa.supplier_id = s.id
       LEFT JOIN (
         SELECT supplier_id,
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS total_purchases,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS total_payments
            FROM journal_entries
           GROUP BY supplier_id
        ) ja ON ja.supplier_id = s.id
      ORDER BY s.name ASC, s.id ASC`
  );
  return res.json(rows);
});

router.get('/purchasing/reports/suppliers', requirePermission('purchasing', 'read'), async (req, res) => {
  return res.json(await getSupplierReportData(req.query));
});

router.get('/purchasing/reports/suppliers/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const format = normalizeExportFormat(req.query.format);
  const reportData = await getSupplierReportData(req.query);
  return sendTableExport(res, {
    format,
    filename: 'supplier-report',
    sheetName: 'تقرير الموردين',
    columns: [
      { key: 'supplier_name', label: 'المورد' },
      { key: 'contact_info', label: 'التواصل' },
      { key: 'products_count', label: 'عدد المنتجات' },
      { key: 'total_purchases', label: 'إجمالي المشتريات' },
      { key: 'total_sales', label: 'إجمالي البيع' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'net_profit', label: 'صافي الربح' },
      { key: 'total_payments', label: 'إجمالي الدفعات' },
      { key: 'net_movement', label: 'صافي الحركة' },
      { key: 'current_outstanding_balance', label: 'الرصيد الحالي' },
      { key: 'product_names', label: 'الأصناف' },
      { key: 'entries_count', label: 'عدد القيود' }
    ],
    rows: reportData.rows
  });
});

router.get('/purchasing/reports/suppliers/:id/statement', requirePermission('purchasing', 'read'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.id);
  if (!supplierId) return res.status(400).json({ error: 'invalid supplier id' });
  const result = await getSupplierStatementData(supplierId, req.query);
  if (!result) return res.status(404).json({ error: 'Supplier not found' });
  return res.json(result);
});

router.get('/purchasing/reports/suppliers/:id/statement/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const supplierId = parsePositiveId(req.params.id);
  if (!supplierId) return res.status(400).json({ error: 'invalid supplier id' });
  const result = await getSupplierStatementData(supplierId, req.query);
  if (!result) return res.status(404).json({ error: 'Supplier not found' });
  const format = normalizeExportFormat(req.query.format);
  return sendTableExport(res, {
    format,
    filename: `supplier-${supplierId}-statement`,
    sheetName: 'كشف حساب المورد',
    columns: [
      { key: 'date', label: 'التاريخ', value: (row) => formatExportDate(row.date) },
      { key: 'transaction_type', label: 'النوع', value: getSupplierVoucherLabel },
      { key: 'amount', label: 'المبلغ' },
      { key: 'total_sales', label: 'إجمالي البيع' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'net_profit', label: 'صافي الربح' },
      { key: 'running_balance', label: 'الرصيد التراكمي' },
      { key: 'reference_doc', label: 'المرجع' },
      { key: 'product_names', label: 'الأصناف' },
      { key: 'note', label: 'ملاحظة' }
    ],
    rows: result.rows
  });
});

router.get('/purchasing/reports/clients', requirePermission('purchasing', 'read'), async (req, res) => {
  return res.json(await getClientReportData(req.query));
});

router.get('/purchasing/reports/clients/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const format = normalizeExportFormat(req.query.format);
  const reportData = await getClientReportData(req.query);
  return sendTableExport(res, {
    format,
    filename: 'client-report',
    sheetName: 'تقرير العملاء اليدويين',
    columns: [
      { key: 'client_name', label: 'العميل' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'total_sales', label: 'إجمالي فواتير البيع' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'total_receipts', label: 'إجمالي المقبوضات' },
      { key: 'net_movement', label: 'صافي الحركة' },
      { key: 'net_profit', label: 'صافي الربح' },
      { key: 'current_outstanding_balance', label: 'الرصيد الحالي' },
      { key: 'orders_count', label: 'عدد الطلبات' },
      { key: 'product_names', label: 'الأصناف' },
      { key: 'entries_count', label: 'عدد القيود' }
    ],
    rows: reportData.rows
  });
});

router.get('/purchasing/reports/clients/:id/statement', requirePermission('purchasing', 'read'), async (req, res) => {
  const clientId = parsePositiveId(req.params.id);
  if (!clientId) return res.status(400).json({ error: 'invalid client id' });
  const result = await getClientStatementData(clientId, req.query);
  if (!result) return res.status(404).json({ error: 'Client not found' });
  return res.json(result);
});

router.get('/purchasing/reports/clients/:id/statement/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const clientId = parsePositiveId(req.params.id);
  if (!clientId) return res.status(400).json({ error: 'invalid client id' });
  const result = await getClientStatementData(clientId, req.query);
  if (!result) return res.status(404).json({ error: 'Client not found' });
  const format = normalizeExportFormat(req.query.format);
  return sendTableExport(res, {
    format,
    filename: `client-${clientId}-statement`,
    sheetName: 'كشف حساب العميل',
    columns: [
      { key: 'date', label: 'التاريخ', value: (row) => formatExportDate(row.date) },
      { key: 'transaction_type', label: 'النوع', value: getClientVoucherLabel },
      { key: 'amount', label: 'المبلغ' },
      { key: 'total_sales', label: 'إجمالي البيع' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'net_profit', label: 'صافي الربح' },
      { key: 'running_balance', label: 'الرصيد التراكمي' },
      { key: 'reference_doc', label: 'المرجع' },
      { key: 'order_id', label: 'رقم الطلب' },
      { key: 'product_names', label: 'الأصناف' },
      { key: 'note', label: 'ملاحظة' }
    ],
    rows: result.rows
  });
});

router.get('/purchasing/reports/customers', requirePermission('purchasing', 'read'), async (req, res) => {
  return res.json(await getCustomerReportData(req.query));
});

router.get('/purchasing/reports/customers/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const format = normalizeExportFormat(req.query.format);
  const reportData = await getCustomerReportData(req.query);
  return sendTableExport(res, {
    format,
    filename: 'customer-report',
    sheetName: 'تقرير العملاء',
    columns: [
      { key: 'customer_name', label: 'العميل' },
      { key: 'customer_phone', label: 'الهاتف' },
      { key: 'customer_email', label: 'البريد' },
      { key: 'orders_count', label: 'عدد الطلبات' },
      { key: 'items_quantity', label: 'عدد القطع' },
      { key: 'gross_sales', label: 'إجمالي قبل الخصم' },
      { key: 'discounts_total', label: 'الخصومات' },
      { key: 'net_sales', label: 'الصافي' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'net_profit', label: 'صافي الربح' },
      { key: 'product_names', label: 'الأصناف' },
      { key: 'first_order_at', label: 'أول طلب', value: (row) => formatExportDate(row.first_order_at) },
      { key: 'last_order_at', label: 'آخر طلب', value: (row) => formatExportDate(row.last_order_at) }
    ],
    rows: reportData.rows
  });
});

router.get('/purchasing/reports/customers/:customerKey/orders', requirePermission('purchasing', 'read'), async (req, res) => {
  const customerKey = String(req.params.customerKey || '').trim();
  if (!customerKey) return res.status(400).json({ error: 'customer key required' });

  const rows = await getCustomerOrderRows(customerKey, req.query);
  const summary = rows.reduce((totals, row) => {
    totals.items_quantity += Number(row.quantity || 0);
    totals.gross_sales += Number(row.line_total || 0);
    totals.orders.add(String(row.order_id));
    totals.orderTotals.set(String(row.order_id), {
      subtotal: Number(row.subtotal || 0),
      discount: Number(row.discount_amount || 0),
      total: Number(row.total || 0)
    });
    return totals;
  }, { items_quantity: 0, gross_sales: 0, orders: new Set(), orderTotals: new Map() });

  const orderTotals = Array.from(summary.orderTotals.values()).reduce((totals, order) => {
    totals.subtotal += order.subtotal;
    totals.discount_amount += order.discount;
    totals.total += order.total;
    return totals;
  }, { subtotal: 0, discount_amount: 0, total: 0 });

  return res.json({
    customer_key: customerKey,
    summary: {
      orders_count: summary.orders.size,
      items_quantity: summary.items_quantity,
      gross_sales: summary.gross_sales,
      subtotal: orderTotals.subtotal,
      discount_amount: orderTotals.discount_amount,
      total: orderTotals.total
    },
    rows
  });
});

router.get('/purchasing/reports/customers/:customerKey/orders/export', requirePermission('purchasing', 'read'), async (req, res) => {
  const customerKey = String(req.params.customerKey || '').trim();
  if (!customerKey) return res.status(400).json({ error: 'customer key required' });

  const format = normalizeExportFormat(req.query.format);
  const rows = await getCustomerOrderRows(customerKey, req.query);
  return sendTableExport(res, {
    format,
    filename: `customer-orders-${customerKey.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'customer'}`,
    sheetName: 'طلبات العميل',
    columns: [
      { key: 'order_id', label: 'رقم الطلب' },
      { key: 'created_at', label: 'التاريخ', value: (row) => formatExportDate(row.created_at) },
      { key: 'customer_name', label: 'العميل' },
      { key: 'customer_phone', label: 'الهاتف' },
      { key: 'customer_email', label: 'البريد' },
      { key: 'status', label: 'الحالة' },
      { key: 'product_name', label: 'المنتج' },
      { key: 'quantity', label: 'الكمية' },
      { key: 'unit_price', label: 'سعر القطعة' },
      { key: 'purchase_price', label: 'سعر الشراء' },
      { key: 'line_total', label: 'إجمالي المنتج' },
      { key: 'purchase_total', label: 'إجمالي الشراء' },
      { key: 'subtotal', label: 'قبل الخصم' },
      { key: 'discount_amount', label: 'الخصم' },
      { key: 'profit_total', label: 'صافي الربح' }
    ],
    rows
  });
});

router.get('/brands', requirePermission('products', 'read'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM brands ORDER BY name ASC');
  return res.json(rows);
});

router.get('/categories', requireAnyPermission([['categories', 'read'], ['categories', 'sort'], ['products', 'read'], ['products', 'sort']]), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, sort_order, is_hidden FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
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
  await pool.query('INSERT INTO categories (name, sort_order, is_hidden) VALUES (?, ?, 0)', [name.trim(), Number(lastRow?.maxSortOrder || 0) + 1]);
  const [rows] = await pool.query('SELECT id, name, sort_order, is_hidden FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
  return res.status(201).json(rows);
});

router.put('/categories/:id/visibility', requirePermission('categories', 'hide'), async (req, res) => {
  const categoryId = parsePositiveId(req.params.id);
  if (!categoryId) return res.status(400).json({ error: 'invalid category id' });

  const isHidden = req.body?.is_hidden ? 1 : 0;
  await pool.query('UPDATE categories SET is_hidden = ? WHERE id = ?', [isHidden, categoryId]);
  const [rows] = await pool.query('SELECT id, name, sort_order, is_hidden FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
  return res.json(rows);
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

    const [updatedRows] = await pool.query('SELECT id, name, sort_order, is_hidden FROM categories ORDER BY sort_order ASC, name ASC, id ASC');
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

  const [categoryRows] = await pool.query('SELECT id, name, sort_order, is_hidden FROM categories WHERE id = ? LIMIT 1', [categoryId]);
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

    const [categoryRows] = await conn.query('SELECT id, name, sort_order, is_hidden FROM categories WHERE id = ? LIMIT 1 FOR UPDATE', [categoryId]);
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
    const banner = await getSiteBanner(pool, 'store');
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load banner settings' });
  }
});

router.put('/banner', requirePermission('banner', 'update'), async (req, res) => {
  try {
    const { image_data_url, image_url } = req.body || {};
    const banner = await saveSiteBanner(pool, {
      imageDataUrl: image_data_url,
      imageUrl: image_url
    }, 'store');
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
    await deleteSiteBanner(pool, 'store');
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete banner' });
  }
});

router.get('/banner/shara', requirePermission('banner', 'read'), async (req, res) => {
  try {
    const banner = await getSiteBanner(pool, 'shara');
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load Shara banner' });
  }
});

router.put('/banner/shara', requirePermission('banner', 'update'), async (req, res) => {
  try {
    const { image_data_url, image_url } = req.body || {};
    const banner = await saveSiteBanner(pool, {
      imageDataUrl: image_data_url,
      imageUrl: image_url
    }, 'shara');
    return res.json(banner);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to save Shara banner' });
  }
});

router.delete('/banner/shara', requirePermission('banner', 'delete'), async (req, res) => {
  try {
    await deleteSiteBanner(pool, 'shara');
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete Shara banner' });
  }
});

router.get('/banner/shadi', requirePermission('banner', 'read'), async (req, res) => {
  try {
    const banner = await getSiteBanner(pool, 'shadi');
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load Shadi banner' });
  }
});

router.put('/banner/shadi', requirePermission('banner', 'update'), async (req, res) => {
  try {
    const { image_data_url, image_url } = req.body || {};
    const banner = await saveSiteBanner(pool, {
      imageDataUrl: image_data_url,
      imageUrl: image_url
    }, 'shadi');
    return res.json(banner);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to save Shadi banner' });
  }
});

router.delete('/banner/shadi', requirePermission('banner', 'delete'), async (req, res) => {
  try {
    await deleteSiteBanner(pool, 'shadi');
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete Shadi banner' });
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
  const { fileData, imageZipData, dryRun = false, mode = 'update_existing' } = req.body || {};
  if (!fileData) return res.status(400).json({ error: 'fileData required' });

  const base64 = fileData.includes(',')
    ? fileData.split(',')[1]
    : fileData;

  const buffer = Buffer.from(base64, 'base64');
  const imageZipBuffer = imageZipData
    ? Buffer.from(String(imageZipData).includes(',') ? String(imageZipData).split(',')[1] : String(imageZipData), 'base64')
    : null;
  const uploadsDir = getUploadSubdir('excel');
  fs.mkdirSync(uploadsDir, { recursive: true });

  try {
    const rows = parseProductsImportRows(buffer);
    if (!rows.length) {
      return res.status(400).json({ error: 'لم يتم العثور على أي صفوف صالحة في ملف Excel' });
    }
    const imageZip = imageZipBuffer ? parseImportImageZip(imageZipBuffer) : null;
    if (imageZipBuffer) await ensureFixedColorOptions();
    const analysis = await analyzeProductsImport(rows, { mode, imageZip });

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
        totalVariantCount: analysis.totalVariantCount,
        createdCategories: analysis.createdCategories,
        imageZipWarnings: analysis.imageZipWarnings.slice(0, 20),
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
      totalVariantCount: analysis.totalVariantCount,
      createdCategories: analysis.createdCategories,
      imageZipWarnings: analysis.imageZipWarnings.slice(0, 20),
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
