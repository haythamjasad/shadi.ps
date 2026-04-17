import pool from '../db.js';

const BASE_ORDER_FIELDS = [
  'id',
  'customer_name',
  'customer_phone',
  'customer_email',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'country',
  'postal_code',
  'notes',
  'subtotal',
  'tax',
  'shipping',
  'total',
  'status',
  'created_at'
];

let cachedHasAdminStatusNote = null;

export async function hasOrderAdminStatusNote() {
  if (cachedHasAdminStatusNote !== null) return cachedHasAdminStatusNote;

  try {
    const [rows] = await pool.query(
      `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME = 'admin_status_note'
        LIMIT 1`
    );
    cachedHasAdminStatusNote = rows.length > 0;
  } catch {
    cachedHasAdminStatusNote = false;
  }

  return cachedHasAdminStatusNote;
}

export async function getOrderSelectFields() {
  if (await hasOrderAdminStatusNote()) {
    return `${BASE_ORDER_FIELDS.slice(0, 16).join(', ')}, admin_status_note, ${BASE_ORDER_FIELDS.slice(16).join(', ')}`;
  }

  return `${BASE_ORDER_FIELDS.join(', ')}, '' AS admin_status_note`;
}
