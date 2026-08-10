import { buildOrigin, requestWithToken, resolveApiBase as resolveProjectApiBase } from './projectApiClient.js';

const LOCAL_APP_PORTS = new Set(['3000', '4173', '5173', '5174', '5175']);

function normalizeStoreApiBase(value) {
  const text = String(value || '').trim();
  if (!text) return '/api/v01';
  const normalized = text.replace(/\/+$/, '');
  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return `${url.origin}/api/v01`;
    if (/\/api$/i.test(path)) return `${url.origin}${path}/v01`;
  } catch {
    // Relative API bases are handled below.
  }
  if (/^https?:\/\/[^/]+$/i.test(normalized)) {
    return `${normalized}/api/v01`;
  }
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v01`;
  }
  return normalized;
}

function resolveApiBase() {
  return normalizeStoreApiBase(
    resolveProjectApiBase({
      envValue: import.meta.env.VITE_API_BASE_URL,
      fallbackPath: '/api/v01',
      productionBase: 'https://store.shadi.ps/api/v01',
      localPort: 4000,
      localPath: '/api/v01'
    })
  );
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
  return requestWithToken({
    base: API_BASE,
    path,
    method: 'GET',
    getToken,
    messageExtractor: (data) => data?.error || 'Request failed'
  });
}

export async function apiPost(path, body, options = {}) {
  return requestWithToken({
    base: API_BASE,
    path,
    method: 'POST',
    body,
    headers: options.headers,
    getToken,
    messageExtractor: (data) => data?.error || 'Request failed'
  });
}

export async function apiPut(path, body, options = {}) {
  return requestWithToken({
    base: API_BASE,
    path,
    method: 'PUT',
    body,
    headers: options.headers,
    getToken,
    messageExtractor: (data) => data?.error || 'Request failed'
  });
}

export async function apiDelete(path) {
  return requestWithToken({
    base: API_BASE,
    path,
    method: 'DELETE',
    getToken,
    messageExtractor: (data) => data?.error || 'Request failed'
  });
}
