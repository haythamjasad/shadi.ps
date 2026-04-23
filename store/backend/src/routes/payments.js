import crypto from 'crypto';
import { Router } from 'express';
import pool from '../db.js';
import { config } from '../config/env.js';
import { buildOrderSummary, reserveStockForItems, validateCustomerAddress } from '../utils/order.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';
import { sendOrderEmail, sendInternalOrderEmail, getSmtpSettings } from '../utils/mailer.js';
import { getResolvedLahzaSettings } from '../utils/lahza-settings.js';
import { getAdminFromRequest } from '../middleware/auth.js';
import {
  canAccessPayment,
  createCheckoutAccessToken,
  verifyCheckoutAccessToken
} from '../utils/checkout-access.js';
import { getOrderSelectFields } from '../utils/order-select-fields.js';

const router = Router();
const ORDER_ITEM_SELECT_FIELDS = 'id, order_id, product_id, product_name, color_name, color_hex, quantity, unit_price, line_total';
const PAYMENT_FINALIZE_FIELDS = 'id, order_id, amount, status, transaction_id, raw_response, order_payload';

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function stringifyJson(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function safeJsonParse(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeLahzaBaseUrl(settings = {}) {
  const fallback = 'https://api.lahza.io/transaction';
  const raw = String(settings.apiUrl || fallback).trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw);
    url.search = '';
    url.hash = '';

    let pathname = url.pathname.replace(/\/+$/, '');
    pathname = pathname
      .replace(/\/initialize$/i, '')
      .replace(/\/verify(?:\/[^/]+)?$/i, '');

    if (!pathname || pathname === '/') pathname = '/transaction';
    url.pathname = pathname;

    return url.toString().replace(/\/+$/, '');
  } catch {
    const clean = raw.split('?')[0].replace(/\/+$/, '');
    if (!clean) return fallback;
    return clean
      .replace(/\/initialize$/i, '')
      .replace(/\/verify(?:\/[^/]+)?$/i, '');
  }
}

function getLahzaInitializeUrl(settings) {
  return `${normalizeLahzaBaseUrl(settings)}/initialize`;
}

function getLahzaVerifyUrl(reference, settings) {
  return `${normalizeLahzaBaseUrl(settings)}/verify/${encodeURIComponent(String(reference))}`;
}

function toMinorUnits(amount) {
  const numeric = Number(amount) || 0;
  return Math.max(0, Math.round(numeric * 100));
}

function parseGatewayAmountMinor(amount) {
  if (amount == null) return null;
  const text = String(amount).trim();
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  if (text.includes('.')) return toMinorUnits(numeric);
  return Math.round(numeric);
}

function normalizePhoneNumber(phone) {
  return String(phone || '').replace(/[^0-9+]/g, '');
}

function normalizeApiBaseUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.replace(/\/+$/, '');
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v01`;
  }
  return normalized;
}

function splitCustomerName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { fullName: '', firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return {
      fullName: parts[0],
      firstName: parts[0],
      lastName: ''
    };
  }

  return {
    fullName: parts.join(' '),
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function buildLahzaMetadata({ customer, paymentId, reference }) {
  const email = String(customer?.email || '').trim();
  const mobile = normalizePhoneNumber(customer?.phone);
  const { fullName, firstName, lastName } = splitCustomerName(customer?.name);

  const customFields = [];
  if (fullName) {
    customFields.push({
      display_name: 'Customer Name',
      variable_name: 'customer_name',
      value: fullName
    });
  }
  if (firstName) {
    customFields.push({
      display_name: 'First Name',
      variable_name: 'first_name',
      value: firstName
    });
  }
  if (lastName) {
    customFields.push({
      display_name: 'Last Name',
      variable_name: 'last_name',
      value: lastName
    });
  }
  if (email) {
    customFields.push({
      display_name: 'Customer Email',
      variable_name: 'customer_email',
      value: email
    });
  }
  if (mobile) {
    customFields.push({
      display_name: 'Customer Phone',
      variable_name: 'customer_phone',
      value: mobile
    });
  }

  return {
    payment_id: String(paymentId || ''),
    reference: String(reference || paymentId || ''),
    customer_name: fullName,
    customer_email: email,
    customer_phone: mobile,
    custom_fields: customFields
  };
}

function getApiBaseUrl(req) {
  const configured = normalizeApiBaseUrl(config.hostApiUrl);
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}/api/v01`;
}

function getStoreBaseUrl(req) {
  const configured = String(config.baseUrl || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function buildLahzaCallbackUrl(req, paymentId) {
  return `${getApiBaseUrl(req)}/payments/verify/${encodeURIComponent(String(paymentId))}`;
}

function buildSummaryUrl(req, { paymentId, orderId, accessToken } = {}) {
  const params = new URLSearchParams();
  if (paymentId != null) params.set('paymentId', String(paymentId));
  if (orderId != null) params.set('orderId', String(orderId));
  const baseUrl = `${getStoreBaseUrl(req)}/summary?${params.toString()}`;
  if (!accessToken) return baseUrl;
  return `${baseUrl}#token=${encodeURIComponent(String(accessToken))}`;
}

function buildLahzaReference(paymentId, attempt = 0) {
  const nonce = `${Date.now()}${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`;
  return `shadi-${paymentId}-${nonce}${attempt ? `-${attempt}` : ''}`;
}

function isDuplicateReferenceError(message) {
  return /duplicate\s*transaction\s*reference/i.test(String(message || ''));
}

function getInitiateErrorStatus(error) {
  const message = String(error?.message || '').trim();
  if (!message) return 500;
  if (/^Insufficient stock for /i.test(message)) return 409;
  if (message === 'One or more products are unavailable') return 409;
  if (message === 'One or more products not found') return 404;
  if (message === 'Invalid order payload' || message === 'Invalid city' || message === 'Invalid order items' || message === 'Invalid product ID' || message === 'Invalid product quantity') {
    return 400;
  }
  return 500;
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSignature(signature) {
  const text = String(signature || '').trim();
  if (!text) return '';
  return text.startsWith('sha256=') ? text.slice(7) : text;
}

async function verifyWebhookSignature(req) {
  const settings = await getResolvedLahzaSettings();
  const secrets = [settings.webhookSecret, settings.secretKey]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (!secrets.length) {
    return { ok: false, message: 'Webhook secret is not configured' };
  }

  const receivedSignature = normalizeSignature(
    req.get('x-lahza-signature')
    || req.get('x-signature')
    || req.get('x-webhook-signature')
  );

  if (!receivedSignature) {
    return { ok: false, message: 'Missing webhook signature header' };
  }

  const rawBody = typeof req.rawBody === 'string'
    ? req.rawBody
    : JSON.stringify(req.body || {});

  const isValid = secrets.some((secret) => {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqualText(receivedSignature, expectedSignature);
  });

  if (!isValid) {
    return { ok: false, message: 'Invalid webhook signature' };
  }

  return { ok: true };
}

async function initiateLahzaTransaction({ req, paymentId, amount, customer, reference }) {
  const settings = await getResolvedLahzaSettings();
  if (!settings.enabled) {
    throw new Error('Lahza payment gateway is disabled');
  }

  const secret = String(settings.secretKey || '').trim();
  if (!secret) {
    throw new Error('LAHZA_SECRET_KEY is missing');
  }

  const email = String(customer?.email || '').trim();
  if (!email) {
    throw new Error('Customer email is required for Lahza payment');
  }

  const { firstName, lastName } = splitCustomerName(customer?.name);

  const amountMinor = toMinorUnits(amount);
  if (!amountMinor) {
    throw new Error('Payment amount must be greater than zero');
  }

  const paymentReference = String(reference || paymentId);
  const payload = {
    amount: String(amountMinor),
    email,
    reference: paymentReference,
    callback_url: buildLahzaCallbackUrl(req, paymentId),
    currency: String(settings.currency || 'ILS').trim() || 'ILS',
    metadata: buildLahzaMetadata({
      customer,
      paymentId,
      reference: paymentReference
    })
  };

  if (firstName) payload.first_name = firstName;
  if (lastName) payload.last_name = lastName;

  const mobile = normalizePhoneNumber(customer?.phone);
  if (mobile) payload.mobile = mobile;

  const initializeUrl = getLahzaInitializeUrl(settings);
  const response = await fetch(initializeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  const data = safeJsonParse(rawText);

  if (!response.ok || !data?.status) {
    const message = data?.message || `Lahza initialize failed (${response.status})`;
    throw new Error(message);
  }

  const redirectUrl = data?.data?.authorization_url || data?.data?.checkout_url || null;
  if (!redirectUrl) {
    throw new Error('Lahza did not return authorization_url');
  }

  return {
    redirectUrl,
    reference: String(data?.data?.reference || paymentReference),
    raw: data
  };
}

async function verifyLahzaTransaction(reference) {
  const settings = await getResolvedLahzaSettings();
  const secret = String(settings.secretKey || '').trim();
  if (!secret) {
    return { ok: false, message: 'LAHZA_SECRET_KEY is missing' };
  }

  const verifyUrl = getLahzaVerifyUrl(reference, settings);
  const response = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json'
    }
  });

  const rawText = await response.text();
  const data = safeJsonParse(rawText);

  if (!response.ok || !data?.status) {
    return {
      ok: false,
      message: data?.message || `Lahza verify failed (${response.status})`,
      raw: data
    };
  }

  const status = String(data?.data?.status || '').toLowerCase();
  const isPaid = status === 'success' || status === 'successful' || status === 'paid';

  return {
    ok: isPaid,
    message: data?.message || null,
    raw: data,
    transactionId: String(data?.data?.id || data?.data?.reference || reference),
    reference: String(data?.data?.reference || reference).trim(),
    currency: data?.data?.currency ? String(data.data.currency).trim().toUpperCase() : null,
    amountMinor: parseGatewayAmountMinor(data?.data?.amount)
  };
}

function validateVerifiedTransaction({ payment, verified, fallbackReference, settings }) {
  const expectedMinor = toMinorUnits(payment?.amount);
  if (!expectedMinor) {
    throw new Error('Stored payment amount is invalid');
  }

  if (!verified || !verified.ok) {
    throw new Error('Payment is not verified as paid');
  }

  if (!Number.isInteger(verified.amountMinor)) {
    throw new Error('Payment verification did not return an amount');
  }

  if (verified.amountMinor !== expectedMinor) {
    throw new Error('Payment amount mismatch');
  }

  const expectedCurrency = String(settings?.currency || 'ILS').trim().toUpperCase();
  if (verified.currency && expectedCurrency && verified.currency !== expectedCurrency) {
    throw new Error('Payment currency mismatch');
  }

  const storedReference = String(payment?.transaction_id || '').trim();
  const verifiedReference = String(
    verified.reference
    || fallbackReference
    || storedReference
    || payment?.id
  ).trim();

  if (storedReference && verifiedReference && storedReference !== verifiedReference) {
    throw new Error('Payment reference mismatch');
  }

  return verifiedReference || storedReference;
}

async function createOrderFromDraftWithConnection(conn, payload) {
  const { customer, items, notes } = payload || {};
  if (!customer?.name || !customer?.phone || !customer?.address || !Array.isArray(items) || items.length === 0) {
    throw new Error('Invalid order payload');
  }

  const address = await validateCustomerAddress(customer.address);

  const { orderItems, subtotal, tax, shipping, total } = await buildOrderSummary({ items });

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

  const orderSelectFields = await getOrderSelectFields();
  const [orderRows] = await conn.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
  const [itemRows] = await conn.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);

  return {
    order: orderRows[0],
    items: itemRows
  };
}

async function getOrderWithItems(orderId) {
  const orderSelectFields = await getOrderSelectFields();
  const [orderRows] = await pool.query(`SELECT ${orderSelectFields} FROM orders WHERE id = ?`, [orderId]);
  const [itemRows] = await pool.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [orderId]);
  return { order: orderRows[0] || null, items: itemRows || [] };
}

async function sendOrderNotifications(order, items) {
  if (!order) return;

  let payment = null;
  try {
    const [paymentRows] = await pool.query(
      'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [order.id]
    );
    payment = paymentRows[0] || null;
  } catch {
    payment = null;
  }

  if (order.customer_email) {
    try {
      await sendOrderEmail({ to: order.customer_email, order, items, payment });
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
  if (!notifyTo) notifyTo = order.customer_email;

  if (notifyTo) {
    try {
      await sendInternalOrderEmail({ to: notifyTo, order, items, payment });
    } catch {
      // ignore email failures
    }
  }
}

export async function finalizePaidPaymentTransaction({ conn, paymentId, verified, fallbackReference, lahzaSettings, deps = {} }) {
  const reserveStock = deps.reserveStockForItems || reserveStockForItems;
  const createOrder = deps.createOrderFromDraftWithConnection || createOrderFromDraftWithConnection;
  let finalOrderId = null;
  let createdOrder = null;
  let createdItems = [];
  let shouldSendNotifications = false;

  try {
    await conn.beginTransaction();

    const [payRows] = await conn.query(`SELECT ${PAYMENT_FINALIZE_FIELDS} FROM payments WHERE id = ? FOR UPDATE`, [paymentId]);
    const payment = payRows[0];
    if (!payment) throw new Error('Payment not found');

    if (String(payment.status || '').toLowerCase() === 'paid' && payment.order_id) {
      await conn.commit();
      return { orderId: payment.order_id, alreadyPaid: true };
    }

    const confirmedReference = validateVerifiedTransaction({
      payment,
      verified,
      fallbackReference,
      settings: lahzaSettings
    });

    const serializedRaw = stringifyJson(verified?.raw || null);
    shouldSendNotifications = String(payment.status || '').toLowerCase() !== 'paid';

    if (payment.order_id) {
      finalOrderId = payment.order_id;
      const [existingItems] = await conn.query(`SELECT ${ORDER_ITEM_SELECT_FIELDS} FROM order_items WHERE order_id = ?`, [finalOrderId]);
      await reserveStock(conn, existingItems);

      await conn.query(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['paid', finalOrderId]
      );

      await conn.query(
        'UPDATE payments SET status = ?, transaction_id = ?, raw_response = ? WHERE id = ?',
        ['paid', confirmedReference || null, serializedRaw, paymentId]
      );
    } else {
      const payload = payment.order_payload ? safeJsonParse(payment.order_payload) : null;
      if (!payload?.customer || !payload?.items) {
        throw new Error('order payload missing');
      }

      const created = await createOrder(conn, payload);
      createdOrder = created.order;
      createdItems = created.items;
      finalOrderId = createdOrder.id;
      await reserveStock(conn, createdItems);

      await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['paid', finalOrderId]);
      createdOrder.status = 'paid';

      await conn.query(
        'UPDATE payments SET status = ?, transaction_id = ?, raw_response = ?, order_id = ?, amount = ? WHERE id = ?',
        [
          'paid',
          confirmedReference || null,
          serializedRaw,
          finalOrderId,
          createdOrder.total,
          paymentId
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  return {
    orderId: finalOrderId,
    createdOrder,
    createdItems,
    shouldSendNotifications
  };
}

async function finalizePaidPayment({ paymentId, verified, fallbackReference }) {
  const conn = await pool.getConnection();
  const lahzaSettings = await getResolvedLahzaSettings();

  let finalization;
  try {
    finalization = await finalizePaidPaymentTransaction({
      conn,
      paymentId,
      verified,
      fallbackReference,
      lahzaSettings
    });
  } finally {
    conn.release();
  }

  let {
    orderId: finalOrderId,
    createdOrder,
    createdItems,
    shouldSendNotifications
  } = finalization;

  if (shouldSendNotifications && finalOrderId) {
    if (!createdOrder) {
      const loaded = await getOrderWithItems(finalOrderId);
      createdOrder = loaded.order;
      createdItems = loaded.items;
    }
    await sendOrderNotifications(createdOrder, createdItems);
  }

  return { orderId: finalOrderId };
}

function parseCheckoutToken(req) {
  const token = String(req.query?.token || req.get('x-checkout-token') || '').trim();
  return verifyCheckoutAccessToken(token);
}

function safeCreateCheckoutToken(payload) {
  try {
    return createCheckoutAccessToken(payload);
  } catch {
    return '';
  }
}

router.post('/initiate', async (req, res) => {
  try {
    const { orderId, customer, items, notes, captchaToken } = req.body || {};

    let paymentId;
    let amount = 0;
    let customerPayload = null;

    if (orderId) {
      const [orders] = await pool.query(
        'SELECT id, total, customer_email, customer_phone, customer_name FROM orders WHERE id = ?',
        [orderId]
      );
      const order = orders[0];
      if (!order) return res.status(404).json({ error: 'Order not found' });

      amount = Number(order.total) || 0;
      customerPayload = {
        email: order.customer_email,
        phone: order.customer_phone,
        name: order.customer_name
      };

      const [result] = await pool.query(
        `INSERT INTO payments (order_id, amount, status, order_payload)
         VALUES (?, ?, ?, ?)`,
        [order.id, amount, 'initiated', null]
      );
      paymentId = result.insertId;
    } else {
      if (!customer || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'customer and items required' });
      }

      const captcha = await verifyRecaptchaToken(captchaToken, req.ip);
      if (!captcha.ok) {
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

      await validateCustomerAddress(customer?.address);
      const summary = await buildOrderSummary({ items });
      amount = Number(summary.total) || 0;
      customerPayload = customer;

      const [result] = await pool.query(
        `INSERT INTO payments (order_id, amount, status, order_payload)
         VALUES (?, ?, ?, ?)`,
        [null, amount, 'initiated', JSON.stringify({ customer, items, notes })]
      );
      paymentId = result.insertId;
    }

    const summaryToken = safeCreateCheckoutToken({ paymentId });

    try {
      let initiated = null;
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const reference = buildLahzaReference(paymentId, attempt);
        try {
          initiated = await initiateLahzaTransaction({
            req,
            paymentId,
            amount,
            customer: customerPayload,
            reference
          });
          break;
        } catch (err) {
          lastError = err;
          if (!isDuplicateReferenceError(err?.message) || attempt === 2) {
            throw err;
          }
        }
      }

      if (!initiated) {
        throw lastError || new Error('Payment initiation failed');
      }

      await pool.query(
        'UPDATE payments SET transaction_id = ?, raw_response = ? WHERE id = ?',
        [initiated.reference, stringifyJson(initiated.raw), paymentId]
      );

      return res.json({
        paymentId,
        redirectUrl: initiated.redirectUrl,
        reference: initiated.reference,
        summaryToken
      });
    } catch (gatewayErr) {
      await pool.query(
        'UPDATE payments SET status = ?, raw_response = ? WHERE id = ?',
        ['failed', stringifyJson({ message: gatewayErr.message || 'Gateway error' }), paymentId]
      );
      return res.status(502).json({ error: gatewayErr.message || 'Payment initiation failed' });
    }
  } catch (err) {
    return res.status(getInitiateErrorStatus(err)).json({ error: err.message || 'Payment initiation failed' });
  }
});

router.get('/verify/:paymentId', async (req, res) => {
  const paymentId = parsePositiveInteger(req.params.paymentId);
  if (!paymentId) {
    return res.status(400).send('Invalid payment ID');
  }

  const fallbackToken = safeCreateCheckoutToken({ paymentId });

  try {
    const [rows] = await pool.query(
      'SELECT id, transaction_id, status, order_id FROM payments WHERE id = ?',
      [paymentId]
    );
    const payment = rows[0];
    if (!payment) {
      return res.redirect(buildSummaryUrl(req, { paymentId, accessToken: fallbackToken }));
    }

    if (String(payment.status || '').toLowerCase() === 'paid' && payment.order_id) {
      const successToken = safeCreateCheckoutToken({
        paymentId,
        orderId: payment.order_id
      });
      return res.redirect(buildSummaryUrl(req, {
        paymentId,
        orderId: payment.order_id,
        accessToken: successToken || fallbackToken
      }));
    }

    const queryReference = String(req.query.reference || req.query.trxref || '').trim();
    const reference = String(payment.transaction_id || queryReference || payment.id).trim();

    const verified = await verifyLahzaTransaction(reference);
    if (!verified.ok) {
      await pool.query(
        'UPDATE payments SET status = ?, transaction_id = ?, raw_response = ? WHERE id = ?',
        ['failed', reference || null, stringifyJson(verified.raw || { message: verified.message }), paymentId]
      );
      return res.redirect(buildSummaryUrl(req, { paymentId, accessToken: fallbackToken }));
    }

    const finalized = await finalizePaidPayment({
      paymentId,
      verified,
      fallbackReference: reference
    });

    const successToken = safeCreateCheckoutToken({
      paymentId,
      orderId: finalized.orderId
    });

    return res.redirect(buildSummaryUrl(req, {
      paymentId,
      orderId: finalized.orderId,
      accessToken: successToken
    }));
  } catch {
    return res.redirect(buildSummaryUrl(req, { paymentId, accessToken: fallbackToken }));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const paymentId = parsePositiveInteger(req.params.id);
    if (!paymentId) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const isAdmin = !!getAdminFromRequest(req);
    if (!isAdmin) {
      const tokenPayload = parseCheckoutToken(req);
      if (!canAccessPayment(tokenPayload, paymentId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const [rows] = await pool.query(
      'SELECT id, order_id, amount, status, transaction_id, created_at FROM payments WHERE id = ?',
      [paymentId]
    );
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch payment' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const signatureResult = await verifyWebhookSignature(req);
    if (!signatureResult.ok) {
      return res.status(401).json({ error: signatureResult.message });
    }

    const body = req.body || {};
    let paymentId = parsePositiveInteger(body.paymentId);
    const incomingReference = String(
      body.reference
      || body.trxref
      || body.transactionId
      || ''
    ).trim();

    let payment = null;

    if (paymentId) {
      const [rows] = await pool.query(
        'SELECT id, transaction_id, status, order_id FROM payments WHERE id = ? LIMIT 1',
        [paymentId]
      );
      payment = rows[0] || null;
    }

    if (!payment && incomingReference) {
      const [rows] = await pool.query(
        'SELECT id, transaction_id, status, order_id FROM payments WHERE transaction_id = ? ORDER BY id DESC LIMIT 1',
        [incomingReference]
      );
      payment = rows[0] || null;
      paymentId = payment?.id || null;
    }

    if (!payment || !paymentId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const reference = String(payment.transaction_id || incomingReference || paymentId).trim();
    const verified = await verifyLahzaTransaction(reference);

    if (!verified.ok) {
      if (String(payment.status || '').toLowerCase() !== 'paid') {
        await pool.query(
          'UPDATE payments SET status = ?, transaction_id = ?, raw_response = ? WHERE id = ?',
          ['failed', reference || null, stringifyJson(verified.raw || { message: verified.message }), paymentId]
        );
      }
      return res.status(400).json({ error: verified.message || 'Payment verification failed' });
    }

    const finalized = await finalizePaidPayment({
      paymentId,
      verified,
      fallbackReference: reference
    });

    return res.json({ ok: true, orderId: finalized.orderId || null });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Webhook processing failed' });
  }
});

export default router;
