function normalizeApiBase(value) {
  const text = String(value || '').trim();
  if (!text) return '/api/v01';
  const normalized = text.replace(/\/+$/, '');
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v01`;
  }
  return normalized;
}

const LOCAL_APP_PORTS = new Set(['3000', '4173', '5173', '5174']);

function buildOrigin(protocol, host, port) {
  const safeHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${protocol}//${safeHost}:${port}`;
}

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
  }
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const rawHost = String(window.location.hostname || '').trim();
    const port = String(window.location.port || '').trim();
    if (host === 'admin.shadi.ps' || host === 'store.shadi.ps') {
      return normalizeApiBase('https://store.shadi.ps/api/v01');
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || LOCAL_APP_PORTS.has(port)) {
      return normalizeApiBase(`${buildOrigin(window.location.protocol, rawHost || host, '4000')}/api/v01`);
    }
  }
  return normalizeApiBase('/api/v01');
}

function resolvePublicBase() {
  if (import.meta.env.VITE_PUBLIC_BASE_URL) {
    return String(import.meta.env.VITE_PUBLIC_BASE_URL).trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const rawHost = String(window.location.hostname || '').trim();
    const port = String(window.location.port || '').trim();
    if (host === 'admin.shadi.ps' || host === 'store.shadi.ps') {
      return 'https://store.shadi.ps';
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || LOCAL_APP_PORTS.has(port)) {
      return buildOrigin(window.location.protocol, rawHost || host, '4000');
    }
    return window.location.origin.replace(/\/+$/, '');
  }
  return '';
}

export const API_BASE = resolveApiBase();
export const PUBLIC_BASE = resolvePublicBase();

export function getToken() {
  return localStorage.getItem('admin_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('admin_token', token);
  else localStorage.removeItem('admin_token');
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders()
  });
  return handleResponse(res);
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return handleResponse(res);
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return handleResponse(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (res.status === 204) return null;
  return handleResponse(res);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}
