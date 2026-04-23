/**
 * Cloudflare Function for sending emails through Resend.
 * Security defaults:
 * - Explicitly disabled unless EMAIL_FUNCTION_ENABLED=1
 * - Requires Authorization: Bearer <EMAIL_FUNCTION_TOKEN>
 * - CORS restricted to configured origins
 */

function parseAllowedOrigins(env) {
  return String(env.EMAIL_ALLOWED_ORIGINS || 'https://store.shadi.ps')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(request, allowedOrigins) {
  const requestOrigin = String(request.headers.get('Origin') || '').trim();
  if (!requestOrigin) return allowedOrigins[0] || '';
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return '';
}

function getCorsHeaders(request, env) {
  const allowedOrigins = parseAllowedOrigins(env);
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    Vary: 'Origin'
  };

  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
  }

  return headers;
}

function isEmailFunctionEnabled(env) {
  const value = String(env.EMAIL_FUNCTION_ENABLED || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function isAuthorized(request, env) {
  const expectedToken = String(env.EMAIL_FUNCTION_TOKEN || '').trim();
  if (!expectedToken) return false;

  const authHeader = String(request.headers.get('Authorization') || '');
  if (!authHeader.startsWith('Bearer ')) return false;

  const providedToken = authHeader.slice(7).trim();
  return providedToken && providedToken === expectedToken;
}

function jsonResponse(request, env, status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: getCorsHeaders(request, env)
  });
}

function normalizeRecipients(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  const single = String(value || '').trim();
  return single ? [single] : [];
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request, env)
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
    });
  }

  if (!isEmailFunctionEnabled(env)) {
    return jsonResponse(request, env, 403, {
      error: { message: 'Email function is disabled', code: 'EMAIL_DISABLED' }
    });
  }

  if (!isAuthorized(request, env)) {
    return jsonResponse(request, env, 401, {
      error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
    });
  }

  const apiKey = String(env.RESEND_API_KEY || '').trim();
  if (!apiKey || !apiKey.startsWith('re_')) {
    return jsonResponse(request, env, 500, {
      error: { message: 'Missing or invalid RESEND_API_KEY', code: 'CONFIG_ERROR' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, env, 400, {
      error: { message: 'Invalid JSON body', code: 'INVALID_JSON' }
    });
  }

  const to = normalizeRecipients(body?.to);
  const subject = String(body?.subject || '').trim();
  const html = String(body?.html || '').trim();

  if (to.length === 0 || !subject || !html) {
    return jsonResponse(request, env, 400, {
      error: {
        message: 'to, subject and html are required',
        code: 'VALIDATION_ERROR'
      }
    });
  }

  const payload = {
    from: String(body?.from || 'Shadi Store <noreply@shadi.ps>').trim(),
    to,
    subject,
    html
  };

  if (body?.cc) payload.cc = normalizeRecipients(body.cc);
  if (body?.bcc) payload.bcc = normalizeRecipients(body.bcc);
  if (body?.reply_to) payload.reply_to = String(body.reply_to).trim();

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'ShadiStore-Shop/1.0.0'
      },
      body: JSON.stringify(payload)
    });

    const responseBody = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      return jsonResponse(request, env, resendResponse.status, {
        error: {
          message: responseBody?.error?.message || responseBody?.message || 'Email provider error',
          code: 'PROVIDER_ERROR'
        }
      });
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      data: responseBody
    });
  } catch (error) {
    return jsonResponse(request, env, 500, {
      error: {
        message: error?.message || 'Failed to send email',
        code: 'INTERNAL_ERROR'
      }
    });
  }
}
