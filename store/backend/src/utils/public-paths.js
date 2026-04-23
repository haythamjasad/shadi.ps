import path from 'path';
import { config } from '../config/env.js';

function normalizeApiPrefix(value) {
  const text = String(value || '').trim();
  if (!text) return '/api/v01';
  return `/${text.replace(/^\/+|\/+$/g, '')}`;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCanonicalApiPrefix() {
  return normalizeApiPrefix(config.apiPrefix);
}

export function getManagedUploadUrl(section, fileName) {
  return `${getCanonicalApiPrefix()}/uploads/${section}/${fileName}`;
}

export function isManagedUploadUrl(url, section) {
  const text = String(url || '').trim();
  if (!text) return false;
  const safeSection = escapeRegex(section);
  return new RegExp(`(^https?:\\/\\/[^/]+)?\\/(api(?:\\/v01)?)?\\/?uploads\\/${safeSection}\\/[^/?#]+$`, 'i').test(text);
}

export function canonicalizeManagedUploadUrl(url, section) {
  const text = String(url || '').trim();
  if (!isManagedUploadUrl(text, section)) return text;
  const fileName = path.basename(text.split('?')[0].split('#')[0]);
  return getManagedUploadUrl(section, fileName);
}
