import fs from 'fs/promises';
import path from 'path';
import { getUploadSubdir } from './app-paths.js';
import { canonicalizeManagedUploadUrl, getManagedUploadUrl, isManagedUploadUrl } from './public-paths.js';

const SITE_IDS = { store: 1, shara: 2, shadi: 3 };

function getSiteId(site) {
  const id = SITE_IDS[site];
  if (!id) throw new Error(`Unknown banner site: ${site}`);
  return id;
}

function parseDataUrl(dataUrl) {
  const text = String(dataUrl || '').trim();
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function mimeToExt(mime) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
}

function getUploadsDir() {
  return getUploadSubdir('banners');
}

function isManagedBannerUrl(url) {
  return isManagedUploadUrl(url, 'banners');
}

function bannerUrlToFilePath(url) {
  const name = path.basename(String(url || ''));
  return path.join(getUploadsDir(), name);
}

async function deleteManagedBannerFile(url) {
  if (!isManagedBannerUrl(url)) return;
  try {
    await fs.unlink(bannerUrlToFilePath(url));
  } catch {
  }
}

export async function ensureSiteBannerTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_banner (
      site_id INT NOT NULL,
      image_url TEXT NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (site_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.query('ALTER TABLE site_banner CHANGE COLUMN id site_id INT NOT NULL');
  } catch {
  }
  try {
    await pool.query('ALTER TABLE site_banner DROP COLUMN feature_tabs');
  } catch {
  }
}

export async function getSiteBanner(pool, site = 'store') {
  const siteId = getSiteId(site);
  const [rows] = await pool.query(
    'SELECT image_url, updated_at FROM site_banner WHERE site_id = ? LIMIT 1',
    [siteId]
  );
  const row = rows[0] || { image_url: null, updated_at: null };
  return {
    image_url: row.image_url ? canonicalizeManagedUploadUrl(row.image_url, 'banners') : null,
    updated_at: row.updated_at || null
  };
}

export async function saveSiteBanner(pool, { imageDataUrl, imageUrl }, site = 'store') {
  const siteId = getSiteId(site);
  const [existingRows] = await pool.query(
    'SELECT image_url FROM site_banner WHERE site_id = ? LIMIT 1',
    [siteId]
  );
  const previous = existingRows[0]?.image_url || null;

  let finalUrl = canonicalizeManagedUploadUrl(String(imageUrl || '').trim(), 'banners');
  if (imageDataUrl) {
    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) throw new Error('Invalid banner image format');

    const ext = mimeToExt(parsed.mime);
    const fileName = `${site}-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadsDir = getUploadsDir();
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, fileName), Buffer.from(parsed.base64, 'base64'));
    finalUrl = getManagedUploadUrl('banners', fileName);
  }

  if (!finalUrl && previous) {
    finalUrl = canonicalizeManagedUploadUrl(previous, 'banners');
  }

  if (!finalUrl) throw new Error('Banner image is required');

  await pool.query(
    `INSERT INTO site_banner (site_id, image_url)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
    [siteId, finalUrl]
  );

  if (previous && previous !== finalUrl) {
    await deleteManagedBannerFile(previous);
  }

  return getSiteBanner(pool, site);
}

export async function deleteSiteBanner(pool, site = 'store') {
  const siteId = getSiteId(site);
  const [existingRows] = await pool.query(
    'SELECT image_url FROM site_banner WHERE site_id = ? LIMIT 1',
    [siteId]
  );
  const previous = existingRows[0]?.image_url || null;

  await pool.query('DELETE FROM site_banner WHERE site_id = ?', [siteId]);
  await deleteManagedBannerFile(previous);
}
