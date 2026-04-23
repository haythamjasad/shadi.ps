import { Router } from 'express';
import pool from '../db.js';
import { sendOrderEmail, sendInternalOrderEmail, getSmtpSettings } from '../utils/mailer.js';
import { config } from '../config/env.js';
import { getAdminFromRequest } from '../middleware/auth.js';
import { buildOrderSummary, reserveStockForItems, validateCustomerAddress } from '../utils/order.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';
import { getClientIp, takeRateLimit } from '../utils/request-guard.js';
import {
  canAccessOrder,
  verifyCheckoutAccessToken
} from '../utils/checkout-access.js';
import { getOrderSelectFields } from '../utils/order-select-fields.js';

const router = Router();
const ORDER_ITEM_SELECT_FIELDS = 'id, order_id, product_id, product_name, color_name, color_hex, quantity, unit_price, line_total';

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

router.post('/', async (req, res) => {
  const { customer, items, notes, captchaToken } = req.body || {};
  const email = String(customer?.email || '').trim();
  const address = customer?.address || {};
  if (
    !customer?.name
    || !customer?.phone
    || !Array.isArray(items)
    || items.length === 0
  ) {
    return res.status(400).json({ error: 'Invalid order payload' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid customer email' });
  }

  const clientIp = getClientIp(req);
  const limitResult = takeRateLimit(`orders:create:${clientIp}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limitResult.ok) {
    return res.status(429).json({ error: 'Too many order attempts. Please try again later.' });
  }

  try {
    const captcha = await verifyRecaptchaToken(captchaToken, clientIp);
    if (!captcha.ok) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }
  } catch {
    return res.status(502).json({ error: 'Failed to verify reCAPTCHA' });
  }

  let orderSummary;
  let validatedAddress;
  try {
    validatedAddress = await validateCustomerAddress(address);
    orderSummary = await buildOrderSummary({ items });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid order items' });
  }

  const { orderItems, subtotal, tax, shipping, total } = orderSummary;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_name, customer_phone, customer_email, address_line1, address_line2, city, state, country, postal_code, notes, subtotal, tax, shipping, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        customer.name,
        customer.phone,
        customer.email || null,
        validatedAddress.line1,
        validatedAddress.line2 || null,
        validatedAddress.city,
        validatedAddress.state,
        validatedAddress.country,
        validatedAddress.postalCode || null,
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        , [orderId, item.productId, item.name, item.colorName, item.colorHex, item.quantity, item.unitPrice, item.lineTotal]
      );
    }

    await reserveStockForItems(conn, orderItems);

    await conn.commit();

    const orderSelectFields = await getOrderSelectFields();
    const [orderRows] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
    const [itemRows] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);

    const createdOrder = orderRows[0];
    if (createdOrder?.customer_email) {
      try {
        await sendOrderEmail({ to: createdOrder.customer_email, order: createdOrder, items: itemRows });
      } catch {
        // ignore email failures
      }
    }
    let notifyTo = config.orderNotifyEmail;
    if (!notifyTo) {
      try {
        const smtp = await getSmtpSettings();
        notifyTo = smtp?.notify_email || smtp?.from_email || smtp?.username;
      } catch {
        notifyTo = null;
      }
    }
    if (!notifyTo) {
      notifyTo = createdOrder?.customer_email;
    }
    if (notifyTo) {
      try {
        await sendInternalOrderEmail({ to: notifyTo, order: createdOrder, items: itemRows });
      } catch {
        // ignore email failures
      }
    }
    return res.status(201).json({ order: createdOrder, items: itemRows });
  } catch (err) {
    await conn.rollback();
    if (String(err?.message || '').startsWith('Insufficient stock for ')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Order creation failed' });
  } finally {
    conn.release();
  }
});

router.get('/:id', async (req, res) => {
  const orderId = parsePositiveInteger(req.params.id);
  if (!orderId) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  const isAdmin = !!getAdminFromRequest(req);
  if (!isAdmin) {
    const token = String(req.query?.token || req.get('x-checkout-token') || '').trim();
    const tokenPayload = verifyCheckoutAccessToken(token);

    let allowed = canAccessOrder(tokenPayload, orderId);
    if (!allowed && tokenPayload?.paymentId) {
      const [payRows] = await pool.query(
        'SELECT id FROM payments WHERE id = ? AND order_id = ? LIMIT 1',
        [tokenPayload.paymentId, orderId]
      );
      allowed = payRows.length > 0;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const orderSelectFields = await getOrderSelectFields();
  const [orders] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
  const order = orders[0];
  if (!order) return res.status(404).json({ error: 'Not found' });

  const [items] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);
  return res.json({ order, items });
});

export default router;
