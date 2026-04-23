import fs from 'fs/promises';
import path from 'path';
import { getUploadSubdir } from './app-paths.js';
import { canonicalizeManagedUploadUrl, getManagedUploadUrl, isManagedUploadUrl } from './public-paths.js';

const BANNER_ROW_ID = 1;
const DEFAULT_FEATURE_TABS = [
  { title: 'مواد موثوقة', subtitle: 'سباكة وإنشاءات وعزل', icon: 'package' },
  { title: 'أسعار مناسبة', subtitle: '', icon: 'trending-up' },
  { title: 'جاهزون للمشاريع', subtitle: '', icon: 'star' }
];

function normalizeFeatureTabs(value) {
  const source = Array.isArray(value) ? value : [];
  return DEFAULT_FEATURE_TABS.map((item, index) => {
    const current = source[index] && typeof source[index] === 'object' ? source[index] : {};
    return {
      title: String(current.title || item.title || '').trim(),
      subtitle: String(current.subtitle || item.subtitle || '').trim(),
      icon: String(current.icon || item.icon || 'package').trim()
    };
  });
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
    // ignore missing/unreadable files
  }
}

export async function ensureSiteBannerTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_banner (
      id INT NOT NULL,
      image_url TEXT NULL,
      feature_tabs JSON NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.query('ALTER TABLE site_banner ADD COLUMN feature_tabs JSON NULL AFTER image_url');
  } catch {
    // column already exists
  }
}

export async function getSiteBanner(pool) {
  const [rows] = await pool.query(
    'SELECT image_url, feature_tabs, updated_at FROM site_banner WHERE id = ? LIMIT 1',
    [BANNER_ROW_ID]
  );
  const row = rows[0] || { image_url: null, feature_tabs: null, updated_at: null };
  let parsedTabs = DEFAULT_FEATURE_TABS;
  try {
    parsedTabs = normalizeFeatureTabs(typeof row.feature_tabs === 'string' ? JSON.parse(row.feature_tabs) : row.feature_tabs);
  } catch {
    parsedTabs = DEFAULT_FEATURE_TABS;
  }
  return {
    image_url: row.image_url ? canonicalizeManagedUploadUrl(row.image_url, 'banners') : null,
    feature_tabs: parsedTabs,
    updated_at: row.updated_at || null
  };
}

export async function saveSiteBanner(pool, { imageDataUrl, imageUrl, featureTabs }) {
  const [existingRows] = await pool.query(
    'SELECT image_url FROM site_banner WHERE id = ? LIMIT 1',
    [BANNER_ROW_ID]
  );
  const previous = existingRows[0]?.image_url || null;

  let finalUrl = canonicalizeManagedUploadUrl(String(imageUrl || '').trim(), 'banners');
  if (imageDataUrl) {
    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) throw new Error('Invalid banner image format');

    const ext = mimeToExt(parsed.mime);
    const fileName = `home-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadsDir = getUploadsDir();
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, fileName), Buffer.from(parsed.base64, 'base64'));
    finalUrl = getManagedUploadUrl('banners', fileName);
  }

  if (!finalUrl && previous) {
    finalUrl = canonicalizeManagedUploadUrl(previous, 'banners');
  }

  if (!finalUrl) throw new Error('Banner image is required');

  const normalizedTabs = normalizeFeatureTabs(featureTabs);

  await pool.query(
    `INSERT INTO site_banner (id, image_url, feature_tabs)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), feature_tabs = VALUES(feature_tabs)`,
    [BANNER_ROW_ID, finalUrl, JSON.stringify(normalizedTabs)]
  );

  if (previous && previous !== finalUrl) {
    await deleteManagedBannerFile(previous);
  }

  return getSiteBanner(pool);
}

export async function deleteSiteBanner(pool) {
  const [existingRows] = await pool.query(
    'SELECT image_url FROM site_banner WHERE id = ? LIMIT 1',
    [BANNER_ROW_ID]
  );
  const previous = existingRows[0]?.image_url || null;

  await pool.query('DELETE FROM site_banner WHERE id = ?', [BANNER_ROW_ID]);
  await deleteManagedBannerFile(previous);
}
