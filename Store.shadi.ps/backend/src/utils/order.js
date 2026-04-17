import pool from '../db.js';
import { parseProductColorOptions, resolveSelectedColor } from './product-colors.js';
import { getOrderSelectFields } from './order-select-fields.js';

const DEFAULT_COUNTRY = 'فلسطين';
const orderItemSchemaState = { ready: false };
const ORDER_ITEM_SELECT_FIELDS = 'id, order_id, product_id, product_name, color_name, color_hex, quantity, unit_price, line_total';

function normalizeStockValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function usesManagedStock(value) {
  return normalizeStockValue(value) > 0;
}

export async function ensureOrderItemColorSchema() {
  if (orderItemSchemaState.ready) return;

  try {
    await pool.query('ALTER TABLE order_items ADD COLUMN color_name VARCHAR(255) NULL AFTER product_name');
  } catch {
    // column already exists
  }

  try {
    await pool.query('ALTER TABLE order_items ADD COLUMN color_hex VARCHAR(20) NULL AFTER color_name');
  } catch {
    // column already exists
  }

  orderItemSchemaState.ready = true;
}

export async function validateCustomerAddress(address) {
  const normalizedAddress = address || {};
  const line1 = String(normalizedAddress.line1 || '').trim();
  const city = String(normalizedAddress.city || '').trim();

  if (!line1 || !city) {
    throw new Error('Invalid order payload');
  }

  const [rows] = await pool.query('SELECT id FROM cities WHERE name = ? LIMIT 1', [city]);
  if (!rows[0]) {
    throw new Error('Invalid city');
  }

  return {
    ...normalizedAddress,
    line1,
    city,
    country: String(normalizedAddress.country || DEFAULT_COUNTRY).trim() || DEFAULT_COUNTRY
  };
}

export async function buildOrderSummary({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Invalid order items');
  }

  const quantityByProductId = new Map();
  for (const item of items) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error('Invalid product ID');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid product quantity');
    }
    const colorName = String(item?.selectedColorName || item?.color_name || item?.selectedColor?.name || '').trim();
    const colorHex = String(item?.selectedColorHex || item?.color_hex || item?.selectedColor?.hex || '').trim().toUpperCase();
    const key = `${productId}::${colorName.toLowerCase()}::${colorHex}`;
    const current = quantityByProductId.get(key);
    if (current) {
      current.quantity += quantity;
    } else {
      quantityByProductId.set(key, {
        productId,
        quantity,
        selectedColorName: colorName,
        selectedColorHex: colorHex
      });
    }
  }

  const groupedItems = Array.from(quantityByProductId.values());
  const productIds = [...new Set(groupedItems.map((item) => item.productId))];
  if (productIds.length === 0) {
    throw new Error('Invalid order items');
  }

  const [products] = await pool.query(
    `SELECT id, name, price, stock, is_available, is_hidden, color_options FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
    productIds
  );

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found');
  }

  const productById = new Map(products.map((product) => [Number(product.id), product]));
  let subtotal = 0;
  const orderItems = groupedItems.map((entry) => {
    const product = productById.get(entry.productId);
    if (!product || !Number(product.is_available) || Number(product.is_hidden)) {
      throw new Error('One or more products are unavailable');
    }

    const quantity = entry.quantity || 0;
    const stock = normalizeStockValue(product.stock);
    if (usesManagedStock(stock) && stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    const colorValidation = resolveSelectedColor(parseProductColorOptions(product?.color_options), entry);
    if (!colorValidation.ok) {
      throw new Error(colorValidation.error);
    }
    const unitPrice = Number(product.price) || 0;
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    return {
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice,
      lineTotal,
      colorName: colorValidation.color?.name || null,
      colorHex: colorValidation.color?.hex || null
    };
  });

  const tax = 0;
  const shipping = 0;
  const total = subtotal + tax + shipping;

  return { orderItems, subtotal, tax, shipping, total };
}

export async function reserveStockForItems(conn, items) {
  const quantityByProductId = new Map();

  for (const item of items || []) {
    const productId = Number(item?.productId ?? item?.product_id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    quantityByProductId.set(productId, (quantityByProductId.get(productId) || 0) + quantity);
  }

  const productIds = [...quantityByProductId.keys()];
  if (productIds.length === 0) return;

  const [rows] = await conn.query(
    `SELECT id, name, stock FROM products WHERE id IN (${productIds.map(() => '?').join(',')}) FOR UPDATE`,
    productIds
  );

  const productById = new Map(rows.map((row) => [Number(row.id), row]));
  for (const productId of productIds) {
    const product = productById.get(productId);
    const required = quantityByProductId.get(productId) || 0;
    if (!product) {
      throw new Error('One or more products not found');
    }

    const stock = normalizeStockValue(product.stock);
    if (usesManagedStock(stock) && stock < required) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
  }

  for (const productId of productIds) {
    const product = productById.get(productId);
    const stock = normalizeStockValue(product?.stock);
    if (!usesManagedStock(stock)) continue;
    await conn.query(
      'UPDATE products SET stock = stock - ? WHERE id = ?',
      [quantityByProductId.get(productId), productId]
    );
  }
}

export async function createOrderFromDraft({ customer, items, notes }) {
  if (!customer?.name || !customer?.phone || !customer?.address || !Array.isArray(items) || items.length === 0) {
    throw new Error('Invalid order payload');
  }

  const address = await validateCustomerAddress(customer.address);

  const { orderItems, subtotal, tax, shipping, total } = await buildOrderSummary({ items });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_name, customer_phone, customer_email, address_line1, address_line2, city, state, country, postal_code, notes, subtotal, tax, shipping, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.name,
        customer.phone,
        customer.email || null,
        address.line1,
        address.line2 || null,
        address.city,
        address.state,
        address.country,
        address.postalCode || null,
        notes || null,
        subtotal,
        tax,
        shipping,
        total,
        'pending_payment'
      ]
    );

    const orderId = orderResult.insertId;

    for (const item of orderItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, color_name, color_hex, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.name, item.colorName, item.colorHex, item.quantity, item.unitPrice, item.lineTotal]
      );
    }

    await reserveStockForItems(conn, orderItems);

    await conn.commit();

    const orderSelectFields = await getOrderSelectFields();
    const [orderRows] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
    const [itemRows] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);

    return { order: orderRows[0], items: itemRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
