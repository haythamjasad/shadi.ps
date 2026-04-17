import pool from '../src/db.js';
import { buildFullPermissions } from '../src/utils/admin-permissions.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parsePermissions(value) {
  if (!value) return null;
  if (isPlainObject(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function backfillPermissions(source) {
  const permissions = parsePermissions(source);
  if (!permissions) return null;

  const next = JSON.parse(JSON.stringify(permissions));
  const orders = isPlainObject(next.orders) ? next.orders : {};

  if (!Object.prototype.hasOwnProperty.call(orders, 'send_customer_email')) {
    orders.send_customer_email = !!orders.preview_customer_email;
  }
  if (!Object.prototype.hasOwnProperty.call(orders, 'send_internal_email')) {
    orders.send_internal_email = !!orders.preview_internal_email;
  }

  next.orders = orders;
  return next;
}

async function main() {
  const [rows] = await pool.query('SELECT id, email, is_super_admin, permissions FROM admin_users ORDER BY id ASC');

  let updated = 0;

  for (const row of rows) {
    const nextPermissions = row.is_super_admin ? buildFullPermissions() : backfillPermissions(row.permissions);
    if (!nextPermissions) continue;

    const currentJson = JSON.stringify(parsePermissions(row.permissions));
    const nextJson = JSON.stringify(nextPermissions);
    if (currentJson === nextJson) continue;

    await pool.query('UPDATE admin_users SET permissions = ? WHERE id = ?', [nextJson, row.id]);
    updated += 1;
    console.log(`Updated admin ${row.id} <${row.email}>`);
  }

  console.log(`Done. Updated ${updated} admin user(s).`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
