import pool from '../db.js';
import { getOrderSelectFields, hasOrderColumn } from './order-select-fields.js';
import { ensureProductVariantSchema, resolveSelectedVariant } from './product-variants.js';

const DEFAULT_COUNTRY = 'فلسطين';
const orderItemSchemaState = { ready: false };
const ORDER_ITEM_SELECT_FIELDS = 'id, order_id, product_id, supplier_id, product_name, color_name, color_hex, variant_id, size_name, quantity, unit_price, purchase_price, line_total';

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

  try {
    await pool.query('ALTER TABLE order_items ADD COLUMN purchase_price DECIMAL(10,2) NULL AFTER unit_price');
  } catch {
    // column already exists
  }

  try {
    await pool.query('ALTER TABLE order_items ADD COLUMN supplier_id INT NULL AFTER product_id');
  } catch {
    // column already exists
  }

  try {
    await pool.query('ALTER TABLE order_items MODIFY COLUMN product_id INT NULL');
  } catch {
    // column may already be nullable or the database may enforce this through migrations
  }

  await ensureProductVariantSchema();

  await pool.query(
    `UPDATE order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
       SET oi.purchase_price = COALESCE(oi.purchase_price, p.purchase_price, 0)
     WHERE oi.purchase_price IS NULL`
  );

  await pool.query(
    `UPDATE order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
       SET oi.supplier_id = p.supplier_id
     WHERE oi.supplier_id IS NULL
       AND p.supplier_id IS NOT NULL`
  );

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

export function calculateOrderDiscount(discount, subtotal) {
  const baseSubtotal = Math.max(0, Math.round(Number(subtotal || 0) * 100) / 100);
  const rawType = String(discount?.type || discount?.discount_type || '').trim().toLowerCase();
  const type = rawType === 'percent' || rawType === 'fixed' ? rawType : null;
  const value = Number(discount?.value ?? discount?.discount_value ?? 0);
  const reason = String(discount?.reason ?? discount?.discount_reason ?? '').trim() || null;

  if (!type || !Number.isFinite(value) || value <= 0) {
    return { type: null, value: 0, amount: 0, reason: null };
  }

  if (type === 'percent' && value > 100) {
    throw new Error('Discount percent cannot exceed 100');
  }

  const rawAmount = type === 'percent' ? (baseSubtotal * value) / 100 : value;
  const amount = Math.min(baseSubtotal, Math.round(rawAmount * 100) / 100);
  return {
    type,
    value: Math.round(value * 100) / 100,
    amount,
    reason
  };
}

export async function buildOrderSummary({ items, discount, stockAdjustments, allowCustomItems = false } = {}) {
  await ensureOrderItemColorSchema();

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Invalid order items');
  }

  const quantityByItemKey = new Map();
  for (const item of items) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid product quantity');
    }
    const isCustom = item?.isCustom || item?.custom || item?.productId == null || String(item?.productId || '').trim() === '';
    if (isCustom) {
      if (!allowCustomItems) throw new Error('Invalid product ID');
      const name = String(item?.productName || item?.product_name || item?.name || '').trim();
      const unitPrice = Number(item?.unitPrice ?? item?.unit_price);
      const purchasePrice = Number(item?.purchasePrice ?? item?.purchase_price ?? 0);
      const supplierId = Number(item?.supplierId ?? item?.supplier_id ?? 0);
      if (!name) throw new Error('Custom product name is required');
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Custom product selling price must be zero or greater');
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) throw new Error('Custom product purchase price must be zero or greater');
      if (supplierId && (!Number.isInteger(supplierId) || supplierId <= 0)) throw new Error('Invalid supplier ID');
      const key = `custom::${name.toLowerCase()}::${supplierId || 0}::${unitPrice}::${purchasePrice}`;
      const current = quantityByItemKey.get(key);
      if (current) {
        current.quantity += quantity;
      } else {
        quantityByItemKey.set(key, {
          productId: null,
          supplierId: supplierId || null,
          productName: name,
          quantity,
          unitPrice: Math.round(unitPrice * 100) / 100,
          purchasePrice: Math.round(purchasePrice * 100) / 100,
          isCustom: true
        });
      }
      continue;
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error('Invalid product ID');
    }
    const variantId = String(item?.selectedVariantId || item?.variant_id || item?.variantId || '').trim();
    const colorName = String(item?.selectedColorName || item?.color_name || item?.selectedColor?.name || '').trim();
    const colorHex = String(item?.selectedColorHex || item?.color_hex || item?.selectedColor?.hex || '').trim().toUpperCase();
    const sizeName = String(item?.selectedSizeName || item?.size_name || item?.sizeName || item?.selectedSize?.name || '').trim();
    const key = `${productId}::${variantId}::${colorName.toLowerCase()}::${colorHex}::${sizeName.toLowerCase()}`;
    const current = quantityByItemKey.get(key);
    if (current) {
      current.quantity += quantity;
    } else {
      quantityByItemKey.set(key, {
        productId,
        quantity,
        selectedVariantId: variantId,
        selectedColorName: colorName,
        selectedColorHex: colorHex,
        selectedSizeName: sizeName
      });
    }
  }

  const groupedItems = Array.from(quantityByItemKey.values());
  const productIds = [...new Set(groupedItems.map((item) => item.productId).filter(Boolean))];
  if (groupedItems.length === 0) {
    throw new Error('Invalid order items');
  }

  const [products] = productIds.length
    ? await pool.query(
      `SELECT id, name, price, purchase_price, supplier_id, stock, is_available, is_hidden, color_options, variant_options FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
      productIds
    )
    : [[]];

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found');
  }

  const productById = new Map(products.map((product) => [Number(product.id), product]));
  let subtotal = 0;
  const orderItems = groupedItems.map((entry) => {
    if (entry.isCustom) {
      const lineTotal = entry.unitPrice * entry.quantity;
      subtotal += lineTotal;
      return {
        productId: null,
        supplierId: entry.supplierId || null,
        name: entry.productName,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        purchasePrice: entry.purchasePrice,
        lineTotal,
        variantId: null,
        colorName: null,
        colorHex: null,
        sizeName: null
      };
    }
    const product = productById.get(entry.productId);
    if (!product || !Number(product.is_available) || Number(product.is_hidden)) {
      throw new Error('One or more products are unavailable');
    }

    const quantity = entry.quantity || 0;

    const variantValidation = resolveSelectedVariant(product, entry);
    if (!variantValidation.ok) {
      throw new Error(variantValidation.error);
    }
    const selectedVariant = variantValidation.variant;
    const unitPrice = Number(selectedVariant?.price ?? product.price) || 0;
    const purchasePrice = Number(selectedVariant?.purchase_price ?? product.purchase_price) || 0;
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    return {
      productId: product.id,
      supplierId: product.supplier_id || null,
      name: product.name,
      quantity,
      unitPrice,
      purchasePrice,
      lineTotal,
      variantId: selectedVariant?.id || null,
      colorName: selectedVariant?.color_name || null,
      colorHex: selectedVariant?.color_hex || null,
      sizeName: selectedVariant?.size_name || null
    };
  });

  const tax = 0;
  const shipping = 0;
  const discountSummary = calculateOrderDiscount(discount, subtotal);
  const total = Math.max(0, Math.round((subtotal + tax + shipping - discountSummary.amount) * 100) / 100);

  return { orderItems, subtotal, tax, shipping, total, discount: discountSummary };
}

export async function reserveStockForItems(conn, items) {
  // Store checkout no longer enforces/decrements inventory quantities.
  return;
}

export async function releaseStockForItems(conn, items) {
  // Matching no-op for reserveStockForItems so status changes do not mutate stock.
  return;
}

export async function createOrderFromDraft({ client_id: clientIdInput, supplier_buyer_id: supplierBuyerIdInput, customer, items, notes, discount, source = 'store' }) {
  const clientId = Number(clientIdInput || 0);
  const supplierBuyerId = Number(supplierBuyerIdInput || 0);
  let linkedClient = null;
  let supplierBuyer = null;
  if (Number.isInteger(clientId) && clientId > 0 && Number.isInteger(supplierBuyerId) && supplierBuyerId > 0) {
    throw new Error('Order cannot have both client_id and supplier_buyer_id');
  }
  if (Number.isInteger(clientId) && clientId > 0) {
    const [clients] = await pool.query('SELECT id, name, phone, email, address_line1, city, state, country FROM clients WHERE id = ? LIMIT 1', [clientId]);
    linkedClient = clients[0] || null;
    if (!linkedClient) throw new Error('Client not found');
  }
  if (Number.isInteger(supplierBuyerId) && supplierBuyerId > 0) {
    const [suppliers] = await pool.query('SELECT id, name, contact_info FROM suppliers WHERE id = ? LIMIT 1', [supplierBuyerId]);
    supplierBuyer = suppliers[0] || null;
    if (!supplierBuyer) throw new Error('Supplier not found');
  }

  const normalizedCustomer = {
    ...(customer || {}),
    ...(linkedClient ? {
      name: linkedClient.name,
      phone: linkedClient.phone || customer?.phone,
      email: linkedClient.email || customer?.email || null,
      address: {
        ...(customer?.address || {}),
        line1: linkedClient.address_line1 || customer?.address?.line1 || '',
        city: linkedClient.city || customer?.address?.city || '',
        state: linkedClient.state || customer?.address?.state || '',
        country: linkedClient.country || customer?.address?.country || 'فلسطين'
      }
    } : {})
  };

  if (!normalizedCustomer?.name || !normalizedCustomer?.phone || !normalizedCustomer?.address || !Array.isArray(items) || items.length === 0) {
    throw new Error('Invalid order payload');
  }

  const address = await validateCustomerAddress(normalizedCustomer.address);

  const { orderItems, subtotal, tax, shipping, total, discount: discountSummary } = await buildOrderSummary({ items, discount, allowCustomItems: true });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hasDiscount = Number(discountSummary.amount || 0) > 0;
    const normalizedSource = String(source || '').trim() === 'admin' ? 'admin' : 'store';
    const orderColumns = ['customer_name', 'customer_phone', 'customer_email', 'address_line1', 'address_line2', 'city', 'state', 'country', 'postal_code', 'notes', 'subtotal', 'tax', 'shipping'];
    const orderValues = [normalizedCustomer.name, normalizedCustomer.phone, normalizedCustomer.email || null, address.line1, address.line2 || null, address.city, address.state, address.country, address.postalCode || null, notes || null, subtotal, tax, shipping];
    if (await hasOrderColumn('source')) {
      orderColumns.unshift('source');
      orderValues.unshift(normalizedSource);
    }
    if (linkedClient) {
      orderColumns.unshift('client_id');
      orderValues.unshift(linkedClient.id);
    }
    if (supplierBuyer) {
      orderColumns.unshift('supplier_buyer_id');
      orderValues.unshift(supplierBuyer.id);
    }
    if (hasDiscount) {
      orderColumns.push('discount_type', 'discount_value', 'discount_amount', 'discount_reason');
      orderValues.push(discountSummary.type, discountSummary.value, discountSummary.amount, discountSummary.reason);
    }
    orderColumns.push('total', 'status');
    orderValues.push(total, 'pending_payment');

    const [orderResult] = await conn.query(
      `INSERT INTO orders (${orderColumns.join(', ')}) VALUES (${orderColumns.map(() => '?').join(', ')})`,
      orderValues
    );

    const orderId = orderResult.insertId;

    for (const item of orderItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, supplier_id, product_name, color_name, color_hex, variant_id, size_name, quantity, unit_price, purchase_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.supplierId, item.name, item.colorName, item.colorHex, item.variantId, item.sizeName, item.quantity, item.unitPrice, item.purchasePrice, item.lineTotal]
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
