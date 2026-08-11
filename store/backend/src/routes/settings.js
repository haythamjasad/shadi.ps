import { Router } from 'express';
import pool from '../db.js';
import { getSiteBanner } from '../utils/site-banner.js';
import { getStoreSettings } from '../utils/store-settings.js';
import { config } from '../config/env.js';

const router = Router();

function setPublicStoreCache(res, seconds = 60) {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=300`);
}

router.get('/whatsapp', async (req, res) => {
  const [rows] = await pool.query('SELECT phone, message, qr_data_url FROM whatsapp_settings WHERE id = 1');
  const settings = rows[0] || {};
  setPublicStoreCache(res, 60);
  return res.json(settings);
});

router.get('/banner', async (req, res) => {
  try {
    const banner = await getSiteBanner(pool, 'store');
    setPublicStoreCache(res, 60);
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load banner' });
  }
});

router.get('/banner/shadi', async (req, res) => {
  try {
    const banner = await getSiteBanner(pool, 'shadi');
    setPublicStoreCache(res, 60);
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load Shadi banner' });
  }
});

router.get('/banner/shara', async (req, res) => {
  try {
    const banner = await getSiteBanner(pool, 'shara');
    setPublicStoreCache(res, 60);
    return res.json(banner);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load Shara banner' });
  }
});

router.get('/recaptcha', async (req, res) => {
  setPublicStoreCache(res, 300);
  return res.json({
    enabled: !!config.recaptchaEnabled,
    site_key: config.recaptchaSiteKey || ''
  });
});

router.get('/cities', async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM cities ORDER BY name ASC');
  setPublicStoreCache(res, 300);
  return res.json(rows);
});

router.get('/categories', async (req, res) => {
  const [rows, orderRows] = await Promise.all([
    pool.query('SELECT id, name, sort_order, is_hidden FROM categories WHERE is_hidden = 0 ORDER BY sort_order ASC, name ASC, id ASC'),
    pool.query('SELECT category_id, product_id FROM category_product_orders ORDER BY category_id ASC, sort_order ASC, product_id ASC')
  ]);

  const categories = rows[0] || [];
  const orderMap = new Map();
  for (const row of (orderRows[0] || [])) {
    const categoryId = Number(row.category_id);
    const productId = Number(row.product_id);
    if (!Number.isInteger(categoryId) || !Number.isInteger(productId)) continue;
    if (!orderMap.has(categoryId)) orderMap.set(categoryId, []);
    orderMap.get(categoryId).push(productId);
  }

  setPublicStoreCache(res, 60);
  return res.json(categories.map((category) => ({
    ...category,
    product_order_ids: orderMap.get(Number(category.id)) || []
  })));
});

router.get('/store', async (req, res) => {
  try {
    setPublicStoreCache(res, 60);
    return res.json(await getStoreSettings());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load store settings' });
  }
});

export default router;
