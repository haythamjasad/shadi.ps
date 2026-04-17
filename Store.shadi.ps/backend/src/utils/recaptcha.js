import { config } from '../config/env.js';

export async function verifyRecaptchaToken(token, remoteIp) {
  if (!config.recaptchaEnabled) return { ok: true, skipped: true };

  const secret = String(config.recaptchaSecretKey || '').trim();
  if (!secret) return { ok: true, skipped: true };

  const responseToken = String(token || '').trim();
  if (!responseToken) return { ok: false };

  const verifyUrl = String(config.recaptchaVerifyUrl || 'https://www.google.com/recaptcha/api/siteverify').trim();
  const form = new URLSearchParams({
    secret,
    response: responseToken
  });
  if (remoteIp) form.set('remoteip', String(remoteIp));

  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  if (!verifyRes.ok) {
    throw new Error('Failed to verify reCAPTCHA');
  }

  const verifyData = await verifyRes.json();
  return { ok: !!verifyData?.success };
}
