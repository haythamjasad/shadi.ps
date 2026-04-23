import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'sql', 'migrations');

function splitSqlStatements(sql) {
  return String(sql || '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function getAddColumnTarget(statement) {
  const match = statement.match(/^ALTER\s+TABLE\s+`?([^`\s]+)`?\s+ADD\s+COLUMN\s+`?([^`\s]+)`?/i);
  if (!match) return null;
  return { tableName: match[1], columnName: match[2] };
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

export async function runMigrations() {
  let files = [];
  try {
    files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }

  if (files.length === 0) return;

  const conn = await mysql.createConnection({
    host: config.dbHost,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    port: config.dbPort,
    multipleStatements: true
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_schema_migrations_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [rows] = await conn.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((row) => String(row.filename || '')));

    for (const file of files) {
      if (applied.has(file)) continue;
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, 'utf8');
      if (!sql.trim()) {
        await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        continue;
      }

      const statements = splitSqlStatements(sql);
      for (const statement of statements) {
        const addColumnTarget = getAddColumnTarget(statement);
        if (addColumnTarget) {
          const exists = await columnExists(conn, addColumnTarget.tableName, addColumnTarget.columnName);
          if (exists) continue;
        }
        await conn.query(statement);
      }

      await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    }
  } finally {
    await conn.end();
  }
}
