import pool from '../db.js';

const BASE_ORDER_FIELDS = [
  'id',
  'client_id',
  'supplier_buyer_id',
  'source',
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
const cachedOrderColumns = new Map();

export async function hasOrderColumn(columnName) {
  if (cachedOrderColumns.has(columnName)) return cachedOrderColumns.get(columnName);
  try {
    const [rows] = await pool.query(
      `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME = ?
         LIMIT 1`
      , [columnName]
    );
    cachedOrderColumns.set(columnName, rows.length > 0);
  } catch {
    cachedOrderColumns.set(columnName, false);
  }

  return cachedOrderColumns.get(columnName);
}

export async function hasOrderAdminStatusNote() {
  if (cachedHasAdminStatusNote !== null) return cachedHasAdminStatusNote;
  cachedHasAdminStatusNote = await hasOrderColumn('admin_status_note');
  return cachedHasAdminStatusNote;
}

export async function hasOrderDiscountColumns() {
  return (await hasOrderColumn('discount_type'))
    && (await hasOrderColumn('discount_value'))
    && (await hasOrderColumn('discount_amount'))
    && (await hasOrderColumn('discount_reason'));
}

export async function getOrderSelectFields() {
  const fields = [...BASE_ORDER_FIELDS];
  if (!(await hasOrderColumn('source'))) {
    const sourceInsertIndex = fields.indexOf('source');
    fields.splice(sourceInsertIndex, 1, "NULL AS source");
  }

  const discountInsertIndex = fields.indexOf('total');
  if (await hasOrderDiscountColumns()) {
    fields.splice(discountInsertIndex, 0, 'discount_type', 'discount_value', 'discount_amount', 'discount_reason');
  } else {
    fields.splice(discountInsertIndex, 0, 'NULL AS discount_type', '0 AS discount_value', '0 AS discount_amount', 'NULL AS discount_reason');
  }

  if (await hasOrderAdminStatusNote()) {
    const statusInsertIndex = fields.indexOf('status');
    fields.splice(statusInsertIndex, 0, 'admin_status_note');
  } else {
    const statusInsertIndex = fields.indexOf('status');
    fields.splice(statusInsertIndex, 0, "'' AS admin_status_note");
  }

  if (!(await hasOrderColumn('client_id'))) {
    const clientInsertIndex = fields.indexOf('client_id');
    fields.splice(clientInsertIndex, 1, 'NULL AS client_id');
  }

  if (!(await hasOrderColumn('supplier_buyer_id'))) {
    const supplierBuyerInsertIndex = fields.indexOf('supplier_buyer_id');
    fields.splice(supplierBuyerInsertIndex, 1, 'NULL AS supplier_buyer_id');
  }

  const shippingInsertIndex = fields.indexOf('shipping') + 1;
  if (await hasOrderColumn('delivery_fee_amount')) {
    fields.splice(shippingInsertIndex, 0, 'delivery_fee_amount');
  } else {
    fields.splice(shippingInsertIndex, 0, '0 AS delivery_fee_amount');
  }

  if (await hasOrderColumn('delivery_payer')) {
    fields.splice(shippingInsertIndex + 1, 0, 'delivery_payer');
  } else {
    fields.splice(shippingInsertIndex + 1, 0, 'NULL AS delivery_payer');
  }

  if (await hasOrderColumn('delivery_note')) {
    fields.splice(shippingInsertIndex + 2, 0, 'delivery_note');
  } else {
    fields.splice(shippingInsertIndex + 2, 0, 'NULL AS delivery_note');
  }

  return fields.join(', ');
}
