const LOCAL_APP_PORTS = new Set(['3000', '4173', '5173', '5174', '5175']);

export function normalizeApiBase(value, fallbackPath) {
  const text = String(value || '').trim();
  if (!text) return fallbackPath;
  return text.replace(/\/+$/, '');
}

export function buildOrigin(protocol, host, port) {
  const safeHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${protocol}//${safeHost}:${port}`;
}

function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1|::1)$/i.test(host)
    || /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(host);
}

function isUnsafeProductionApiBase(value) {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') return false;
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' && isLocalHost(url.hostname);
  } catch {
    return false;
  }
}

export function resolveApiBase({
  envValue,
  fallbackPath,
  productionBase,
  localPort,
  localPath
}) {
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const rawHost = String(window.location.hostname || '').trim();
    const port = String(window.location.port || '').trim();

    if (envValue && !isUnsafeProductionApiBase(envValue)) {
      return normalizeApiBase(envValue, fallbackPath);
    }

    if (host === 'admin.shadi.ps' || host === 'store.shadi.ps') {
      return normalizeApiBase(productionBase, fallbackPath);
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || LOCAL_APP_PORTS.has(port)) {
      return normalizeApiBase(`${buildOrigin(window.location.protocol, rawHost || host, String(localPort))}${localPath}`, fallbackPath);
    }
  }

  if (envValue) {
    return normalizeApiBase(envValue, fallbackPath);
  }

  return normalizeApiBase(fallbackPath, fallbackPath);
}

export function buildUrl(base, path, query = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(`${base}${path}`, origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export async function handleJsonResponse(res, messageExtractor) {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      message = messageExtractor ? messageExtractor(data) : (data?.message || data?.error || message);
    } catch {
      // ignore parse issues
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function requestWithToken({
  base,
  path,
  method = 'GET',
  body,
  query,
  getToken,
  refreshToken,
  headers: extraHeaders,
  messageExtractor
}) {
  const buildHeaders = (token) => {
    const headers = { ...(extraHeaders || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (method !== 'GET' && method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  let token = getToken ? getToken() : null;
  if (refreshToken) {
    const refreshed = await refreshToken();
    if (refreshed) token = refreshed;
  }

  const run = (currentToken) => fetch(buildUrl(base, path, query), {
    method,
    headers: buildHeaders(currentToken),
    ...(body !== undefined ? { body: JSON.stringify(body || {}) } : {})
  });

  let res = await run(token);
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await run(refreshed);
    }
  }

  return handleJsonResponse(res, messageExtractor);
}
