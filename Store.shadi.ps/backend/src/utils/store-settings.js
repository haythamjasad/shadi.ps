import pool from '../db.js';

const TABLE_NAME = 'store_settings';
const ROW_ID = 1;
const DEFAULT_CURRENCY = 'ILS';

const ALLOWED_CURRENCIES = new Set(['ILS', 'USD']);

export function normalizeStoreCurrency(value) {
  const currency = String(value || DEFAULT_CURRENCY).trim().toUpperCase();
  return ALLOWED_CURRENCIES.has(currency) ? currency : DEFAULT_CURRENCY;
}

export async function ensureStoreSettingsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT NOT NULL,
      currency VARCHAR(10) DEFAULT '${DEFAULT_CURRENCY}',
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function getStoreSettings() {
  const [rows] = await pool.query(
    `SELECT currency, updated_at FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`,
    [ROW_ID]
  );
  const row = rows[0];
  return {
    currency: normalizeStoreCurrency(row?.currency),
    updated_at: row?.updated_at || null
  };
}

export async function saveStoreSettings(payload = {}) {
  const currency = normalizeStoreCurrency(payload.currency);
  await pool.query(
    `INSERT INTO ${TABLE_NAME} (id, currency)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE currency = VALUES(currency)`,
    [ROW_ID, currency]
  );
  return getStoreSettings();
}
