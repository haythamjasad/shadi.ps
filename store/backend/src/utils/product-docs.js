import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getUploadSubdir } from './app-paths.js';
import { getManagedUploadUrl } from './public-paths.js';

const DOCS_SECTION = 'docs';
const DEFAULT_DOC_TYPE = 'application/pdf';

function getPublicDocUrl(fileName) {
  return getManagedUploadUrl(DOCS_SECTION, fileName);
}

function extractManagedDocFileName(url) {
  const text = String(url || '').trim();
  if (!text) return '';

  const match = text.match(/(?:https?:\/\/[^/]+)?\/(?:(?:api(?:\/v01)?)?\/?uploads\/docs|assets)\/([^/?#]+\.pdf)(?:[?#].*)?$/i);
  return match ? path.basename(match[1]) : '';
}

function isManagedDocUrl(url) {
  return Boolean(extractManagedDocFileName(url));
}

function canonicalizeManagedDocUrl(url) {
  const fileName = extractManagedDocFileName(url);
  return fileName ? getPublicDocUrl(fileName) : String(url || '').trim();
}

function getDocsDir() {
  return getUploadSubdir(DOCS_SECTION);
}

function isPdfDataUrl(value) {
  return /^data:application\/pdf(?:;[^,]*)?,/i.test(String(value || '').trim());
}

function parsePdfDataUrl(value) {
  const text = String(value || '').trim();
  const match = text.match(/^data:(application\/pdf)(?:;[^,]*)?,(.+)$/i);
  if (!match) return null;
  return {
    mime: DEFAULT_DOC_TYPE,
    payload: match[2]
  };
}

function sanitizeDocBaseName(value, fallback = 'document') {
  const name = String(value || '').trim().replace(/\.pdf$/i, '');
  const sanitized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return sanitized || fallback;
}

function inferDocName(entry, index) {
  const directName = typeof entry === 'object' && entry !== null ? entry.name : '';
  if (String(directName || '').trim()) return String(directName).trim();

  const url = typeof entry === 'object' && entry !== null
    ? String(entry.url || entry.href || entry.path || entry.dataUrl || '').trim()
    : String(entry || '').trim();
  const candidate = url && !isPdfDataUrl(url)
    ? path.basename(url.split('?')[0].split('#')[0])
    : '';

  return candidate || `document-${index + 1}.pdf`;
}

function normalizeDocEntry(entry, index) {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return {
      id: `doc-${index}`,
      name: inferDocName(entry, index),
      url: isManagedDocUrl(trimmed)
        ? canonicalizeManagedDocUrl(trimmed)
        : trimmed,
      type: DEFAULT_DOC_TYPE
    };
  }

  if (typeof entry !== 'object') return null;

  const dataUrl = String(entry.dataUrl || '').trim();
  const rawUrl = String(entry.url || entry.href || entry.path || dataUrl || '').trim();
  if (!rawUrl) return null;

  const type = String(entry.type || '').trim().toLowerCase() || DEFAULT_DOC_TYPE;
  const size = Number(entry.size);

  return {
    id: String(entry.id || `doc-${index}`),
    name: inferDocName(entry, index),
    url: isManagedDocUrl(rawUrl)
      ? canonicalizeManagedDocUrl(rawUrl)
      : rawUrl,
    type,
    size: Number.isFinite(size) && size > 0 ? size : undefined
  };
}

function collectManagedDocUrls(entries) {
  const urls = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const normalized = normalizeDocEntry(entry, 0);
    if (!normalized?.url) continue;
    if (isManagedDocUrl(normalized.url)) {
      urls.add(canonicalizeManagedDocUrl(normalized.url));
    }
  }
  return urls;
}

async function deleteManagedDocFile(url) {
  const fileName = extractManagedDocFileName(url);
  if (!fileName) return;
  try {
    await fs.unlink(path.join(getDocsDir(), fileName));
  } catch {
    // ignore missing files
  }
}

async function savePdfDocEntry(entry, index) {
  const normalized = normalizeDocEntry(entry, index);
  if (!normalized?.url) return null;

  const parsed = parsePdfDataUrl(normalized.url);
  if (!parsed) return normalized;

  const fileName = `${sanitizeDocBaseName(normalized.name, `document-${index + 1}`)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
  const filePath = path.join(getDocsDir(), fileName);
  const buffer = Buffer.from(parsed.payload, 'base64');

  await fs.mkdir(getDocsDir(), { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    id: normalized.id,
    name: normalized.name,
    type: DEFAULT_DOC_TYPE,
    size: buffer.length,
    url: getPublicDocUrl(fileName)
  };
}

export function normalizeProductDocs(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeDocEntry(entry, index))
    .filter(Boolean);
}

export function hasLegacyInlineProductDocs(value) {
  return normalizeProductDocs(value).some((entry) => isPdfDataUrl(entry?.url));
}

export async function persistProductDocs(nextDocs) {
  const createdUrls = [];

  try {
    const normalizedDocs = [];
    const sourceDocs = Array.isArray(nextDocs) ? nextDocs : [];
    for (let index = 0; index < sourceDocs.length; index += 1) {
      const saved = await savePdfDocEntry(sourceDocs[index], index);
      if (!saved) continue;
      normalizedDocs.push(saved);
      if (isManagedDocUrl(saved.url)) {
        createdUrls.push(saved.url);
      }
    }

    return {
      docs: normalizedDocs,
      createdUrls
    };
  } catch (error) {
    await Promise.all(createdUrls.map((url) => deleteManagedDocFile(url)));
    throw error;
  }
}

export async function removeStaleProductDocs(previousDocs, nextDocs) {
  const previousManagedUrls = collectManagedDocUrls(previousDocs);
  const nextManagedUrls = collectManagedDocUrls(nextDocs);

  for (const url of previousManagedUrls) {
    if (!nextManagedUrls.has(url)) {
      await deleteManagedDocFile(url);
    }
  }
}

export async function cleanupCreatedProductDocs(urls) {
  await Promise.all((Array.isArray(urls) ? urls : []).map((url) => deleteManagedDocFile(url)));
}

export async function deleteProductDocs(docs) {
  const managedUrls = collectManagedDocUrls(docs);
  await Promise.all(Array.from(managedUrls, (url) => deleteManagedDocFile(url)));
}
