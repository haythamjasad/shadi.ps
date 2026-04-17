import { API_BASE, getToken, setToken } from './api.js';

function normalizeApiBase(value) {
  const text = String(value || '').trim();
  if (!text) return '/api/v0';
  return text.replace(/\/+$/, '');
}

const LOCAL_APP_PORTS = new Set(['3000', '4173', '5173', '5174']);
const SHOULD_REFRESH_SHADI_TOKEN = typeof window !== 'undefined'
  && /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(String(window.location.hostname || ''));

function buildOrigin(protocol, host, port) {
  const safeHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${protocol}//${safeHost}:${port}`;
}

function resolveShadiApiBase() {
  if (import.meta.env.VITE_SHADI_API_BASE_URL) {
    return normalizeApiBase(import.meta.env.VITE_SHADI_API_BASE_URL);
  }

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const rawHost = String(window.location.hostname || '').trim();
    const port = String(window.location.port || '').trim();

    if (host === 'admin.shadi.ps' || host === 'store.shadi.ps') {
      return 'https://shadi.ps/api/v0';
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || LOCAL_APP_PORTS.has(port)) {
      return normalizeApiBase(`${buildOrigin(window.location.protocol, rawHost || host, '5010')}/api/v0`);
    }
  }

  return '/api/v0';
}

function buildUrl(path, query = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(`${SHADI_API_BASE}${path}`, origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAdminToken() {
  if (!SHOULD_REFRESH_SHADI_TOKEN) return null;
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/admin/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (data?.token) {
    setToken(data.token);
    return data.token;
  }

  return token;
}

async function handleResponse(res) {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      // ignore invalid json bodies
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const SHADI_API_BASE = resolveShadiApiBase();

export async function shadiApiGet(path, query) {
  let requestHeaders = authHeaders();
  const refreshedBeforeRequest = await refreshAdminToken();
  if (refreshedBeforeRequest) {
    requestHeaders = { Authorization: `Bearer ${refreshedBeforeRequest}` };
  }

  let res = await fetch(buildUrl(path, query), {
    headers: requestHeaders
  });

  if (res.status === 401) {
    const refreshedToken = await refreshAdminToken();
    if (refreshedToken) {
      res = await fetch(buildUrl(path, query), {
        headers: {
          Authorization: `Bearer ${refreshedToken}`
        }
      });
    }
  }

  return handleResponse(res);
}

export async function shadiApiPost(path, body) {
  let requestHeaders = {
    ...authHeaders(),
    'Content-Type': 'application/json'
  };
  const refreshedBeforeRequest = await refreshAdminToken();
  if (refreshedBeforeRequest) {
    requestHeaders = {
      Authorization: `Bearer ${refreshedBeforeRequest}`,
      'Content-Type': 'application/json'
    };
  }

  let res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body || {})
  });

  if (res.status === 401) {
    const refreshedToken = await refreshAdminToken();
    if (refreshedToken) {
      res = await fetch(buildUrl(path), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
      });
    }
  }

  return handleResponse(res);
}

export async function shadiApiDelete(path) {
  let requestHeaders = authHeaders();
  const refreshedBeforeRequest = await refreshAdminToken();
  if (refreshedBeforeRequest) {
    requestHeaders = { Authorization: `Bearer ${refreshedBeforeRequest}` };
  }

  let res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: requestHeaders
  });

  if (res.status === 401) {
    const refreshedToken = await refreshAdminToken();
    if (refreshedToken) {
      res = await fetch(buildUrl(path), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${refreshedToken}`
        }
      });
    }
  }

  return handleResponse(res);
}
