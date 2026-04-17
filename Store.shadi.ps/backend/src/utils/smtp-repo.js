import pool from '../db.js';
import { config } from '../config/env.js';
import { encryptSecret, decryptSecret } from './secret-crypto.js';

const TABLE_NAME = 'smtp_settings';

const DEFAULT_CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(120) DEFAULT NULL,
  host VARCHAR(255) DEFAULT NULL,
  port INT DEFAULT 587,
  secure TINYINT(1) DEFAULT 0,
  username VARCHAR(255) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  from_name VARCHAR(255) DEFAULT NULL,
  from_email VARCHAR(255) DEFAULT NULL,
  notify_email VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const MIGRATIONS = [
  'ADD COLUMN label VARCHAR(120) DEFAULT NULL',
  'ADD COLUMN from_name VARCHAR(255) DEFAULT NULL',
  'ADD COLUMN from_email VARCHAR(255) DEFAULT NULL',
  'ADD COLUMN notify_email VARCHAR(255) DEFAULT NULL',
  'ADD COLUMN is_active TINYINT(1) DEFAULT 0',
  'ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
  'ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
];

const schemaState = {
  ready: false,
  columns: new Set(),
  idAutoIncrement: false
};

function hasColumn(columnName) {
  return schemaState.columns.has(columnName);
}

async function loadSchemaState() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [TABLE_NAME]
  );

  schemaState.columns = new Set(rows.map((row) => row.COLUMN_NAME));
  const idRow = rows.find((row) => row.COLUMN_NAME === 'id');
  schemaState.idAutoIncrement = !!(idRow && String(idRow.EXTRA || '').toLowerCase().includes('auto_increment'));
  schemaState.ready = true;
}

function normalizeSmtpRow(row, { includePassword = false } = {}) {
  if (!row) return null;
  const hasPassword = row.has_password != null
    ? !!Number(row.has_password)
    : !!(row.password || '').trim();

  return {
    id: Number(row.id),
    label: row.label || '',
    host: row.host || '',
    port: Number(row.port) || 587,
    secure: !!Number(row.secure),
    username: row.username || '',
    password: includePassword
      ? decryptSecret(row.password || '', config.smtpEncryptionKey)
      : '',
    has_password: hasPassword,
    from_name: row.from_name || '',
    from_email: row.from_email || '',
    notify_email: row.notify_email || '',
    is_active: !!Number(row.is_active),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function selectColumns({ includePassword = true } = {}) {
  const columns = ['id'];
  if (hasColumn('label')) columns.push('label');
  if (hasColumn('host')) columns.push('host');
  if (hasColumn('port')) columns.push('port');
  if (hasColumn('secure')) columns.push('secure');
  if (hasColumn('username')) columns.push('username');
  if (hasColumn('password')) {
    if (includePassword) columns.push('password');
    columns.push("CASE WHEN password IS NULL OR password = '' THEN 0 ELSE 1 END AS has_password");
  }
  if (hasColumn('from_name')) columns.push('from_name');
  if (hasColumn('from_email')) columns.push('from_email');
  if (hasColumn('notify_email')) columns.push('notify_email');
  if (hasColumn('is_active')) columns.push('is_active');
  if (hasColumn('created_at')) columns.push('created_at');
  if (hasColumn('updated_at')) columns.push('updated_at');
  return columns.join(', ');
}

function normalizeInput(payload = {}) {
  const parsedPort = Number(payload.port);
  return {
    label: String(payload.label || '').trim(),
    host: String(payload.host || '').trim(),
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 587,
    secure: payload.secure ? 1 : 0,
    username: String(payload.username || '').trim(),
    password: payload.password == null ? '' : String(payload.password),
    from_name: String(payload.from_name || '').trim(),
    from_email: String(payload.from_email || '').trim(),
    notify_email: String(payload.notify_email || '').trim(),
    is_active: payload.is_active ? 1 : 0
  };
}

async function ensureOneActiveIfPossible() {
  if (!hasColumn('is_active')) return;

  const [activeRows] = await pool.query(`SELECT id FROM ${TABLE_NAME} WHERE is_active = 1 LIMIT 1`);
  if (activeRows.length > 0) return;

  const [rows] = await pool.query(
    `SELECT id
       FROM ${TABLE_NAME}
      ORDER BY CASE WHEN id = 1 THEN 0 ELSE 1 END, id DESC
      LIMIT 1`
  );
  const candidate = rows[0];
  if (!candidate) return;

  await pool.query(
    `UPDATE ${TABLE_NAME}
        SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END`,
    [candidate.id]
  );
}

export async function ensureSmtpSettingsSchema() {
  if (schemaState.ready) return;

  try {
    await pool.query(DEFAULT_CREATE_TABLE_SQL);
  } catch {
    // Keep going for compatibility with restricted DB users.
  }

  await loadSchemaState();

  for (const migration of MIGRATIONS) {
    const columnName = migration.split(' ')[2];
    if (schemaState.columns.has(columnName)) continue;
    try {
      await pool.query(`ALTER TABLE ${TABLE_NAME} ${migration}`);
    } catch {
      // Keep going even if user lacks ALTER permission.
    }
  }

  await loadSchemaState();
  await ensureOneActiveIfPossible();
}

export async function listSmtpSettings({ includePassword = false } = {}) {
  await ensureSmtpSettingsSchema();
  const columns = selectColumns({ includePassword });
  const orderBy = hasColumn('is_active')
    ? 'ORDER BY is_active DESC, id DESC'
    : 'ORDER BY id DESC';
  const [rows] = await pool.query(`SELECT ${columns} FROM ${TABLE_NAME} ${orderBy}`);
  return rows.map((row) => normalizeSmtpRow(row, { includePassword }));
}

export async function getSmtpSettingsById(id, { includePassword = true } = {}) {
  await ensureSmtpSettingsSchema();
  const smtpId = Number(id);
  if (!smtpId) return null;
  const columns = selectColumns({ includePassword });
  const [rows] = await pool.query(
    `SELECT ${columns}
       FROM ${TABLE_NAME}
      WHERE id = ?
      LIMIT 1`,
    [smtpId]
  );
  return normalizeSmtpRow(rows[0], { includePassword });
}

export async function getActiveSmtpSettings({ includePassword = true } = {}) {
  await ensureSmtpSettingsSchema();
  const columns = selectColumns({ includePassword });

  if (hasColumn('is_active')) {
    const [activeRows] = await pool.query(
      `SELECT ${columns}
         FROM ${TABLE_NAME}
        WHERE is_active = 1
        ORDER BY id DESC
        LIMIT 1`
    );
    const active = normalizeSmtpRow(activeRows[0], { includePassword });
    if (active) return active;
  }

  const [rows] = await pool.query(
    `SELECT ${columns}
       FROM ${TABLE_NAME}
      ORDER BY CASE WHEN id = 1 THEN 0 ELSE 1 END, id DESC
      LIMIT 1`
  );
  return normalizeSmtpRow(rows[0], { includePassword });
}

export async function activateSmtpSettings(id) {
  await ensureSmtpSettingsSchema();
  if (!hasColumn('is_active')) {
    return getSmtpSettingsById(id, { includePassword: true });
  }

  const smtpId = Number(id);
  if (!smtpId) return null;

  await pool.query(`UPDATE ${TABLE_NAME} SET is_active = 0`);
  await pool.query(`UPDATE ${TABLE_NAME} SET is_active = 1 WHERE id = ?`, [smtpId]);
  return getSmtpSettingsById(smtpId, { includePassword: true });
}

export async function createSmtpSettings(payload = {}) {
  await ensureSmtpSettingsSchema();
  const data = normalizeInput(payload);

  const columns = [];
  const values = [];

  if (!schemaState.idAutoIncrement) {
    const [nextRows] = await pool.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${TABLE_NAME}`);
    columns.push('id');
    values.push(Number(nextRows[0]?.next_id) || 1);
  }

  if (hasColumn('label')) {
    columns.push('label');
    values.push(data.label || null);
  }
  columns.push('host');
  values.push(data.host);
  columns.push('port');
  values.push(data.port);
  columns.push('secure');
  values.push(data.secure);
  columns.push('username');
  values.push(data.username);
  columns.push('password');
  values.push(encryptSecret(data.password, config.smtpEncryptionKey));
  if (hasColumn('from_name')) {
    columns.push('from_name');
    values.push(data.from_name);
  }
  if (hasColumn('from_email')) {
    columns.push('from_email');
    values.push(data.from_email);
  }
  if (hasColumn('notify_email')) {
    columns.push('notify_email');
    values.push(data.notify_email);
  }
  if (hasColumn('is_active')) {
    columns.push('is_active');
    values.push(data.is_active);
  }

  const placeholders = columns.map(() => '?').join(', ');
  const [result] = await pool.query(
    `INSERT INTO ${TABLE_NAME} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );

  const insertedId = schemaState.idAutoIncrement
    ? result.insertId
    : values[0];

  if (hasColumn('is_active') && data.is_active) {
    await activateSmtpSettings(insertedId);
  } else {
    await ensureOneActiveIfPossible();
  }

  return getSmtpSettingsById(insertedId, { includePassword: true });
}

export async function updateSmtpSettings(id, payload = {}) {
  await ensureSmtpSettingsSchema();
  const smtpId = Number(id);
  if (!smtpId) return null;

  const current = await getSmtpSettingsById(smtpId, { includePassword: true });
  if (!current) return null;

  const data = normalizeInput(payload);
  const updates = [];
  const values = [];

  if (hasColumn('label')) {
    updates.push('label = ?');
    values.push(data.label || null);
  }
  updates.push('host = ?');
  values.push(data.host);
  updates.push('port = ?');
  values.push(data.port);
  updates.push('secure = ?');
  values.push(data.secure);
  updates.push('username = ?');
  values.push(data.username);

  if (data.password) {
    updates.push('password = ?');
    values.push(encryptSecret(data.password, config.smtpEncryptionKey));
  }

  if (hasColumn('from_name')) {
    updates.push('from_name = ?');
    values.push(data.from_name);
  }
  if (hasColumn('from_email')) {
    updates.push('from_email = ?');
    values.push(data.from_email);
  }
  if (hasColumn('notify_email')) {
    updates.push('notify_email = ?');
    values.push(data.notify_email);
  }

  if (updates.length > 0) {
    values.push(smtpId);
    await pool.query(
      `UPDATE ${TABLE_NAME}
          SET ${updates.join(', ')}
        WHERE id = ?`,
      values
    );
  }

  if (hasColumn('is_active') && data.is_active) {
    await activateSmtpSettings(smtpId);
  } else {
    await ensureOneActiveIfPossible();
  }

  return getSmtpSettingsById(smtpId, { includePassword: true });
}

export async function deleteSmtpSettings(id) {
  await ensureSmtpSettingsSchema();
  const smtpId = Number(id);
  if (!smtpId) return false;

  const current = await getSmtpSettingsById(smtpId, { includePassword: true });
  if (!current) return false;

  await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [smtpId]);

  if (current.is_active) {
    await ensureOneActiveIfPossible();
  }

  return true;
}
