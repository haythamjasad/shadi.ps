import { signToken, verifyToken } from './jwt.js';

const CHECKOUT_TOKEN_PURPOSE = 'checkout_summary';
const CHECKOUT_TOKEN_TTL = '48h';

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function createCheckoutAccessToken({ paymentId, orderId }, expiresIn = CHECKOUT_TOKEN_TTL) {
  const normalizedPaymentId = toPositiveInteger(paymentId);
  const normalizedOrderId = toPositiveInteger(orderId);
  if (!normalizedPaymentId && !normalizedOrderId) {
    throw new Error('checkout token requires paymentId or orderId');
  }
  return signToken(
    {
      purpose: CHECKOUT_TOKEN_PURPOSE,
      paymentId: normalizedPaymentId || undefined,
      orderId: normalizedOrderId || undefined
    },
    expiresIn
  );
}

export function verifyCheckoutAccessToken(token) {
  const text = String(token || '').trim();
  if (!text) return null;
  try {
    const payload = verifyToken(text);
    if (payload?.purpose !== CHECKOUT_TOKEN_PURPOSE) return null;
    const paymentId = toPositiveInteger(payload?.paymentId);
    const orderId = toPositiveInteger(payload?.orderId);
    if (!paymentId && !orderId) return null;
    return { paymentId, orderId };
  } catch {
    return null;
  }
}

export function canAccessPayment(tokenPayload, paymentId) {
  const normalizedPaymentId = toPositiveInteger(paymentId);
  if (!normalizedPaymentId || !tokenPayload) return false;
  return toPositiveInteger(tokenPayload.paymentId) === normalizedPaymentId;
}

export function canAccessOrder(tokenPayload, orderId) {
  const normalizedOrderId = toPositiveInteger(orderId);
  if (!normalizedOrderId || !tokenPayload) return false;
  return toPositiveInteger(tokenPayload.orderId) === normalizedOrderId;
}
