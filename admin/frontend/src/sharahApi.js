import { resolveProjectBase } from './projectRegistry.js';
import { apiGet, apiPost } from './api.js';

function normalizeSharahApiBase(value) {
  const base = String(value || '').trim().replace(/\/+$/, '');
  try {
    const url = new URL(base);
    if (/^\/api\/sharah\/?$/i.test(url.pathname)) {
      return `${url.origin}/v01/api/sharah`;
    }
  } catch {
    if (/^\/api\/sharah\/?$/i.test(base)) return '/v01/api/sharah';
  }
  return base;
}

export const SHARAH_API_BASE = normalizeSharahApiBase(resolveProjectBase('sharah'));

function resolveSharahPublicBase() {
  const envBase = String(import.meta.env.VITE_SHARAH_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (envBase) return envBase;
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'admin.shadi.ps' || host === 'shara.shadi.ps') return 'https://shara.shadi.ps';
  }
  return SHARAH_API_BASE
    .replace(/\/v\d+\/api\/sharah\/?$/i, '')
    .replace(/\/api\/sharah\/?$/i, '')
    .replace(/\/api\/?$/i, '');
}

function isLocalAssetUrl(url) {
  const host = String(url.hostname || '').toLowerCase();
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

export const SHARAH_PUBLIC_BASE = resolveSharahPublicBase();

export function getSharahAssetUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^data:/i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (isLocalAssetUrl(url) && /^\/(images|videos|static)\//i.test(url.pathname)) {
        return `${SHARAH_PUBLIC_BASE}${url.pathname}${url.search}`;
      }
    } catch {
      return text;
    }
    return text;
  }
  return `${SHARAH_PUBLIC_BASE}${text.startsWith('/') ? text : `/${text}`}`;
}

export async function getSharedSharahAdminTokenStatus() {
  return apiGet('/admin/sharah/token');
}

export async function saveSharedSharahAdminToken(token) {
  return apiPost('/admin/sharah/token', { token });
}

export async function getSharahFacebookReels() {
  return apiGet('/admin/sharah/reels?limit=500');
}

export async function getSharahTiktokReels() {
  return apiGet('/admin/sharah/reels/tiktok?limit=500');
}

export async function updateSharahReelTags(platform, reelId, tags) {
  return apiPost(`/admin/sharah/reels/${encodeURIComponent(platform)}/${encodeURIComponent(reelId)}/tags`, { tags });
}

export async function addSharahReelUrl(url) {
  return apiPost('/admin/sharah/reels/add-url', { url });
}

export async function updateSharahReelVisibility(platform, reelId, hidden) {
  return apiPost(`/admin/sharah/reels/${encodeURIComponent(platform)}/${encodeURIComponent(reelId)}/visibility`, { hidden: !!hidden });
}

export async function getSharahPopularTags() {
  return apiGet('/admin/sharah/popular-tags');
}

export async function updateSharahPopularTags(tags) {
  return apiPost('/admin/sharah/popular-tags', tags);
}

export async function getSharahPlatformSettings() {
  return apiGet('/admin/sharah/platform-settings');
}

export async function updateSharahPlatformSettings(settings) {
  return apiPost('/admin/sharah/platform-settings', settings);
}

export async function getSharahAdminTags() {
  return apiGet('/admin/sharah/admin-tags');
}

export async function updateSharahAdminTags(tags) {
  return apiPost('/admin/sharah/admin-tags', { tags });
}
