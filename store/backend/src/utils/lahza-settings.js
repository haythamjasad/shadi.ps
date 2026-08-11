import pool from '../db.js';
import { config } from '../config/env.js';
import { encryptSecret, decryptSecret } from './secret-crypto.js';
import { getStoreSettings } from './store-settings.js';

const TABLE_NAME = 'payment_gateway_settings';
const ROW_ID = 1;
const DEFAULT_API_URL = 'https://api.lahza.io/transaction';
const DEFAULT_CURRENCY = 'ILS';

const schemaState = {
  ready: false,
  columns: new Set()
};

function envPreview(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 10) return `${text.slice(0, 2)}...${text.slice(-2)}`;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function normalizeApiUrl(value) {
  return String(value || DEFAULT_API_URL).trim() || DEFAULT_API_URL;
}

function normalizeCurrency(value) {
  const text = String(value || DEFAULT_CURRENCY).trim().toUpperCase();
  return text || DEFAULT_CURRENCY;
}

function normalizeEnabled(value, fallback = true) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

async function loadSchemaState() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [TABLE_NAME]
  );
  schemaState.columns = new Set(rows.map((row) => row.COLUMN_NAME));
  schemaState.ready = true;
}

export async function ensureLahzaSettingsSchema() {
  if (schemaState.ready) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT NOT NULL,
      enabled TINYINT(1) DEFAULT 1,
      api_url VARCHAR(255) DEFAULT NULL,
      secret_key TEXT DEFAULT NULL,
      webhook_secret TEXT DEFAULT NULL,
      currency VARCHAR(10) DEFAULT 'ILS',
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await loadSchemaState();
}

function rowToAdminResponse(row) {
  return {
    enabled: normalizeEnabled(row?.enabled, true),
    api_url: normalizeApiUrl(row?.api_url),
    currency: normalizeCurrency(row?.currency),
    has_secret_key: !!String(row?.secret_key || '').trim(),
    has_webhook_secret: !!String(row?.webhook_secret || '').trim(),
    secret_key_preview: row?.secret_key ? envPreview(decryptSecret(row.secret_key, config.smtpEncryptionKey) || '') : '',
    webhook_secret_preview: row?.webhook_secret ? envPreview(decryptSecret(row.webhook_secret, config.smtpEncryptionKey) || '') : '',
    updated_at: row?.updated_at || null
  };
}

function envToAdminResponse() {
  const secretKey = String(config.lahzaSecretKey || '').trim();
  const webhookSecret = String(config.lahzaWebhookSecret || '').trim();
  return {
    enabled: true,
    api_url: normalizeApiUrl(config.lahzaApiUrl),
    currency: normalizeCurrency(config.lahzaCurrency),
    has_secret_key: !!secretKey,
    has_webhook_secret: !!webhookSecret,
    secret_key_preview: envPreview(secretKey),
    webhook_secret_preview: envPreview(webhookSecret),
    updated_at: null,
    source: 'env'
  };
}

export async function getLahzaSettingsForAdmin() {
  await ensureLahzaSettingsSchema();
  const [rows] = await pool.query(
    `SELECT id, enabled, api_url, secret_key, webhook_secret, currency, updated_at
       FROM ${TABLE_NAME}
      WHERE id = ?
      LIMIT 1`,
    [ROW_ID]
  );

  if (!rows[0]) {
    return {
      ...envToAdminResponse(),
      source: 'env'
    };
  }

  return {
    ...rowToAdminResponse(rows[0]),
    source: 'database'
  };
}

export async function getLahzaDiagnostics() {
  await ensureLahzaSettingsSchema();
  const settings = await getLahzaSettingsForAdmin();
  const warnings = [];
  if (!settings.enabled) warnings.push('بوابة Lahza معطلة حالياً');
  if (!settings.has_secret_key) warnings.push('Secret Key غير موجود');
  if (!['USD', 'ILS', 'JOD'].includes(settings.currency)) {
    warnings.push('العملة يجب أن تكون واحدة من USD / ILS / JOD حسب توثيق Lahza');
  }
  if (!/^https?:\/\//i.test(settings.api_url || '')) {
    warnings.push('رابط API يجب أن يكون رابطاً كاملاً');
  }

  return {
    ...settings,
    initialized: !!settings.has_secret_key,
    warnings,
    webhook_header: 'x-lahza-signature',
    recommended_webhook_ips: ['161.35.20.140', '209.38.219.189']
  };
}

export async function saveLahzaSettings(payload = {}) {
  await ensureLahzaSettingsSchema();
  const [rows] = await pool.query(
    `SELECT id, enabled, api_url, secret_key, webhook_secret, currency
       FROM ${TABLE_NAME}
      WHERE id = ?
      LIMIT 1`,
    [ROW_ID]
  );
  const current = rows[0] || null;

  const enabled = normalizeEnabled(payload.enabled, current ? !!current.enabled : true) ? 1 : 0;
  const apiUrl = normalizeApiUrl(payload.api_url ?? current?.api_url ?? config.lahzaApiUrl);
  const currency = normalizeCurrency(payload.currency ?? current?.currency ?? config.lahzaCurrency);

  let secretKey = current?.secret_key || null;
  if (payload.secret_key != null && String(payload.secret_key).trim()) {
    secretKey = encryptSecret(String(payload.secret_key).trim(), config.smtpEncryptionKey);
  }

  let webhookSecret = current?.webhook_secret || null;
  if (payload.webhook_secret != null) {
    const nextWebhook = String(payload.webhook_secret).trim();
    if (nextWebhook) {
      webhookSecret = encryptSecret(nextWebhook, config.smtpEncryptionKey);
    } else if (payload.clear_webhook_secret) {
      webhookSecret = null;
    }
  }

  if (!secretKey && String(config.lahzaSecretKey || '').trim()) {
    secretKey = encryptSecret(String(config.lahzaSecretKey).trim(), config.smtpEncryptionKey);
  }

  await pool.query(
    `INSERT INTO ${TABLE_NAME} (id, enabled, api_url, secret_key, webhook_secret, currency)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       api_url = VALUES(api_url),
       secret_key = VALUES(secret_key),
       webhook_secret = VALUES(webhook_secret),
       currency = VALUES(currency)`,
    [ROW_ID, enabled, apiUrl, secretKey, webhookSecret, currency]
  );

  return getLahzaSettingsForAdmin();
}

export async function getResolvedLahzaSettings() {
  await ensureLahzaSettingsSchema();
  const storeSettings = await getStoreSettings();
  const [rows] = await pool.query(
    `SELECT enabled, api_url, secret_key, webhook_secret, currency
       FROM ${TABLE_NAME}
      WHERE id = ?
      LIMIT 1`,
    [ROW_ID]
  );

  const row = rows[0];
  const envEnabled = true;
  const resolved = row
    ? {
        enabled: !!Number(row.enabled),
        apiUrl: normalizeApiUrl(row.api_url),
        secretKey: decryptSecret(row.secret_key || '', config.smtpEncryptionKey) || String(config.lahzaSecretKey || '').trim(),
        webhookSecret: decryptSecret(row.webhook_secret || '', config.smtpEncryptionKey) || String(config.lahzaWebhookSecret || '').trim(),
        currency: normalizeCurrency(storeSettings.currency || row.currency),
        source: 'database'
      }
    : {
        enabled: envEnabled,
        apiUrl: normalizeApiUrl(config.lahzaApiUrl),
        secretKey: String(config.lahzaSecretKey || '').trim(),
        webhookSecret: String(config.lahzaWebhookSecret || '').trim(),
        currency: normalizeCurrency(storeSettings.currency || config.lahzaCurrency),
        source: 'env'
      };

  return resolved;
}
