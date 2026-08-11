import { API_BASE, getToken, setToken } from './api.js';
import { createProjectApi } from './createProjectApi.js';
import { resolveProjectBase } from './projectRegistry.js';

const SHOULD_REFRESH_TOKEN = typeof window !== 'undefined'
  && /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(String(window.location.hostname || ''));

export const PROJECT_X_API_BASE = resolveProjectBase('projectX');

async function refreshAdminToken() {
  if (!SHOULD_REFRESH_TOKEN) return null;
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

export const projectXApi = createProjectApi({
  base: PROJECT_X_API_BASE,
  getToken,
  refreshToken: refreshAdminToken,
  messageExtractor: (data) => data?.message || data?.error || 'Project X request failed'
});
