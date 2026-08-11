import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlRoot = resolve(__dirname, '../sql');

function readSql(path) {
  return readFileSync(resolve(sqlRoot, path), 'utf8');
}

function assertIdempotencyTable(sql, label) {
  assert.match(sql, /admin_idempotency_keys/i, `${label} must define admin_idempotency_keys`);
  for (const column of [
    'admin_scope',
    'idempotency_key',
    'method',
    'route_key',
    'request_hash',
    'status_code',
    'response_json',
    'created_at',
    'updated_at'
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'), `${label} missing ${column}`);
  }
  assert.match(sql, /uniq_admin_idempotency_key/i, `${label} missing unique idempotency key`);
  assert.match(sql, /admin_scope[^)]*,[^)]*idempotency_key/i, `${label} unique key must scope by admin and key`);
}

test('admin idempotency table is represented consistently in migration and schema SQL', () => {
  const migration = readSql('migrations/027_admin_idempotency_keys.sql');
  const updateExisting = readSql('update-existing-db.sql');
  const schema = readSql('schema.sql');

  assertIdempotencyTable(migration, 'migration 027');
  assertIdempotencyTable(updateExisting, 'update-existing-db.sql');
  assertIdempotencyTable(schema, 'schema.sql');
});
