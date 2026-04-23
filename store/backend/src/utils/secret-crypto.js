import crypto from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1';
const MIN_SECRET_LENGTH = 16;

function buildKey(secret) {
  if (!secret || String(secret).trim().length < MIN_SECRET_LENGTH) return null;
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

export function encryptSecret(plainText, secret) {
  if (!plainText) return '';

  const key = buildKey(secret);
  if (!key) {
    throw new Error(`SMTP_ENCRYPTION_KEY must be set and at least ${MIN_SECRET_LENGTH} characters`);
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(secretText, secret) {
  if (!secretText) return '';
  if (!isEncryptedSecret(secretText)) return '';

  const key = buildKey(secret);
  if (!key) return '';

  const parts = String(secretText).split(':');
  if (parts.length < 5) return '';
  const prefix = `${parts[0]}:${parts[1]}`;
  const ivHex = parts[2];
  const tagHex = parts[3];
  const payloadHex = parts.slice(4).join(':');
  if (prefix !== ENCRYPTION_PREFIX || !ivHex || !tagHex || !payloadHex) return '';

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const payload = Buffer.from(payloadHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}
