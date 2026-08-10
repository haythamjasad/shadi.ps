import { API_BASE, getToken, setToken } from './api.js';
import { requestWithToken, resolveApiBase } from './projectApiClient.js';

const SHOULD_REFRESH_SHADI_TOKEN = typeof window !== 'undefined'
  && /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(String(window.location.hostname || ''));

function resolveShadiApiBase() {
  return resolveApiBase({
    envValue: import.meta.env.VITE_SHADI_API_BASE_URL,
    fallbackPath: '/api/v0',
    productionBase: 'https://shadi.ps/api/v0',
    localPort: 5010,
    localPath: '/api/v0'
  });
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

export const SHADI_API_BASE = resolveShadiApiBase();

export async function shadiApiGet(path, query) {
  return requestWithToken({
    base: SHADI_API_BASE,
    path,
    query,
    method: 'GET',
    getToken,
    refreshToken: refreshAdminToken,
    messageExtractor: (data) => data?.message || data?.error || 'Request failed'
  });
}

export async function shadiApiPost(path, body) {
  return requestWithToken({
    base: SHADI_API_BASE,
    path,
    method: 'POST',
    body,
    getToken,
    refreshToken: refreshAdminToken,
    messageExtractor: (data) => data?.message || data?.error || 'Request failed'
  });
}

export async function shadiApiDelete(path) {
  return requestWithToken({
    base: SHADI_API_BASE,
    path,
    method: 'DELETE',
    getToken,
    refreshToken: refreshAdminToken,
    messageExtractor: (data) => data?.message || data?.error || 'Request failed'
  });
}
