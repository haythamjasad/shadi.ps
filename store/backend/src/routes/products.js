import { Router } from 'express';
import pool from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { hasPermission } from '../utils/admin-permissions.js';
import { normalizeColorOptions, parseProductColorOptions } from '../utils/product-colors.js';
import {
  cleanupCreatedProductDocs,
  deleteProductDocs,
  hasLegacyInlineProductDocs,
  normalizeProductDocs,
  persistProductDocs,
  removeStaleProductDocs
} from '../utils/product-docs.js';

const router = Router();
const PRODUCT_LIST_FIELDS = 'id, name, description, price, mrp, stock, brand, type, category, categories, color_options, image_url, is_available, is_hidden, show_on_home, created_at, updated_at';
const PRODUCT_DETAIL_FIELDS = 'id, name, description, technical_data, warnings, `usage`, price, mrp, stock, brand, type, category, categories, color_options, image_url, image_urls, docs, links, is_available, is_hidden, show_on_home, created_at, updated_at';

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseIdsParam(value) {
  const seen = new Set();
  return String(value || '')
    .split(',')
    .map((item) => parsePositiveInteger(item.trim()))
    .filter((item) => item && !seen.has(item) && seen.add(item));
}

const normalizeName = (value) => String(value || '')
  .trim()
  .toLowerCase();

const normalizeCategoryNames = (value) => {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '').split(/[،,]+/);

  const seen = new Set();
  const cleaned = [];
  for (const entry of rawValues) {
    const name = String(entry || '').trim();
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(name);
  }

  return cleaned;
};

const findDuplicateByName = async (name, excludeId = null) => {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const sql = excludeId
    ? 'SELECT id, name FROM products WHERE LOWER(TRIM(name)) = ? AND id <> ? LIMIT 1'
    : 'SELECT id, name FROM products WHERE LOWER(TRIM(name)) = ? LIMIT 1';
  const params = excludeId ? [normalized, excludeId] : [normalized];
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const validateCategories = async (categories) => {
  const cleanCategories = normalizeCategoryNames(categories);
  if (cleanCategories.length === 0) {
    return { ok: false, error: 'category is required' };
  }

  const [rows] = await pool.query(
    `SELECT name FROM categories WHERE name IN (${cleanCategories.map(() => '?').join(',')})`,
    cleanCategories
  );
  if (rows.length !== cleanCategories.length) {
    return { ok: false, error: 'category is invalid' };
  }

  return { ok: true, value: cleanCategories, primary: cleanCategories[0] };
};

const parseJsonField = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeProduct = (row, options = {}) => {
  if (!row) return row;
  const { includeDocs = true, includeImageUrls = true } = options;
  const {
    docs: _rawDocs,
    image_urls: _rawImageUrls,
    links: _rawLinks,
    color_options: _rawColorOptions,
    categories: _rawCategories,
    ...baseRow
  } = row;
  const imageUrls = parseJsonField(row.image_urls);
  const docs = parseJsonField(row.docs);
  const links = parseJsonField(row.links);
  const colorOptions = parseProductColorOptions(row.color_options);
  let categories = parseJsonField(row.categories);
  if (!Array.isArray(categories) || categories.length === 0) {
    categories = row.category ? [row.category] : [];
  }

  const product = {
    ...baseRow,
    links,
    color_options: colorOptions,
    categories,
    category: categories[0] || row.category || null,
    image_url: row.image_url || (Array.isArray(imageUrls) && imageUrls.length ? imageUrls[0] : null)
  };

  if (includeImageUrls) {
    product.image_urls = imageUrls;
  }

  if (includeDocs) {
    product.docs = normalizeProductDocs(docs);
  }

  return product;
};

router.get('/', async (req, res) => {
  const { featured, ids, type, category, excludeId, limit } = req.query;
  const filters = [];
  const params = [];
  const productIds = parseIdsParam(ids);

  if (ids && productIds.length === 0) {
    return res.json([]);
  }

  let sql = `SELECT ${PRODUCT_LIST_FIELDS} FROM products`;

  if (featured === '1') {
    filters.push('show_on_home = 1');
  }
  if (productIds.length > 0) {
    filters.push(`id IN (${productIds.map(() => '?').join(', ')})`);
    params.push(...productIds);
  }
  if (String(type || '').trim()) {
    filters.push('type = ?');
    params.push(String(type).trim());
  }
  if (String(category || '').trim()) {
    filters.push('category = ?');
    params.push(String(category).trim());
  }

  const excludedProductId = parsePositiveInteger(excludeId);
  if (excludedProductId) {
    filters.push('id <> ?');
    params.push(excludedProductId);
  }

  if (filters.length > 0) {
    sql += ` WHERE ${filters.join(' AND ')}`;
  }
  sql += ' ORDER BY id DESC';

  const safeLimit = parsePositiveInteger(limit);
  if (safeLimit) {
    sql += ' LIMIT ?';
    params.push(Math.min(safeLimit, 50));
  }

  const [rows] = await pool.query(sql, params);
  return res.json(rows.map((row) => normalizeProduct(row, { includeDocs: false, includeImageUrls: false })));
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query(`SELECT ${PRODUCT_DETAIL_FIELDS} FROM products WHERE id = ?`, [req.params.id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });

  const rawDocs = parseJsonField(row.docs);
  if (hasLegacyInlineProductDocs(rawDocs)) {
    const persisted = await persistProductDocs(rawDocs);

    try {
      await pool.query('UPDATE products SET docs = ? WHERE id = ?', [
        persisted.docs.length ? JSON.stringify(persisted.docs) : null,
        req.params.id
      ]);
      row.docs = persisted.docs.length ? JSON.stringify(persisted.docs) : null;
    } catch (error) {
      await cleanupCreatedProductDocs(persisted.createdUrls);
      throw error;
    }
  }

  const product = normalizeProduct(row);
  if (!product) return res.status(404).json({ error: 'Not found' });
  return res.json(product);
});

router.post('/', requireAdmin, async (req, res) => {
  if (!hasPermission(req.admin, 'products', 'create')) {
    return res.status(403).json({ error: 'You do not have permission to create products' });
  }

  const {
    name,
    description,
    usage,
    technical_data,
    warnings,
    price,
    mrp,
    stock,
    brand,
    type,
    category,
    categories,
    color_options,
    image_url,
    image_urls,
    docs,
    links,
    is_available = 1,
    is_hidden = 0,
    show_on_home = 0
  } = req.body || {};

  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ error: 'name is required' });

  const categoryCheck = await validateCategories(categories ?? category);
  if (!categoryCheck.ok) return res.status(400).json({ error: categoryCheck.error });
  const cleanColorOptions = normalizeColorOptions(color_options);

  const duplicate = await findDuplicateByName(cleanName);
  if (duplicate) {
    return res.status(409).json({ error: 'Product with this name already exists' });
  }

  const { docs: normalizedDocs, createdUrls } = await persistProductDocs(docs);

  try {
    const [result] = await pool.query(
      'INSERT INTO products (name, description, `usage`, technical_data, warnings, price, mrp, stock, brand, type, category, categories, color_options, image_url, image_urls, docs, links, is_available, is_hidden, show_on_home) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        cleanName,
        description,
        usage || null,
        technical_data || null,
        warnings || null,
        price,
        mrp,
        stock,
        brand,
        type,
        categoryCheck.primary,
        JSON.stringify(categoryCheck.value),
        cleanColorOptions.length ? JSON.stringify(cleanColorOptions) : null,
        image_url || (Array.isArray(image_urls) && image_urls.length ? image_urls[0] : null),
        image_urls ? JSON.stringify(image_urls) : null,
        normalizedDocs.length ? JSON.stringify(normalizedDocs) : null,
        links ? JSON.stringify(links) : null,
        is_available ? 1 : 0,
        is_hidden ? 1 : 0,
        show_on_home ? 1 : 0
      ]
    );

    const [rows] = await pool.query(`SELECT ${PRODUCT_DETAIL_FIELDS} FROM products WHERE id = ?`, [result.insertId]);
    return res.status(201).json(normalizeProduct(rows[0]));
  } catch (error) {
    await cleanupCreatedProductDocs(createdUrls);
    throw error;
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const touchesVisibility = 'is_available' in (req.body || {}) || 'is_hidden' in (req.body || {});
  const touchesHome = 'show_on_home' in (req.body || {});
  const touchesGeneralFields = ['name','description','usage','technical_data','warnings','price','mrp','stock','brand','type','category','categories','color_options','image_url','image_urls','docs','links']
    .some((field) => field in (req.body || {}));

  if (touchesGeneralFields && !hasPermission(req.admin, 'products', 'update')) {
    return res.status(403).json({ error: 'You do not have permission to update products' });
  }
  if (touchesVisibility && !hasPermission(req.admin, 'products', 'hide')) {
    return res.status(403).json({ error: 'You do not have permission to change product visibility' });
  }
  if (touchesHome && !hasPermission(req.admin, 'products', 'home')) {
    return res.status(403).json({ error: 'You do not have permission to change home visibility' });
  }

  const [existingRows] = await pool.query('SELECT docs FROM products WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows[0]) return res.status(404).json({ error: 'Not found' });
  const previousDocs = parseJsonField(existingRows[0].docs);
  let createdDocUrls = [];

  if ('name' in req.body) {
    const cleanName = String(req.body.name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'name is required' });

    const duplicate = await findDuplicateByName(cleanName, req.params.id);
    if (duplicate) {
      return res.status(409).json({ error: 'Product with this name already exists' });
    }
  }

  if ('category' in req.body || 'categories' in req.body) {
    const categoryCheck = await validateCategories(req.body.categories ?? req.body.category);
    if (!categoryCheck.ok) return res.status(400).json({ error: categoryCheck.error });
    req.body.category = categoryCheck.primary;
    req.body.categories = categoryCheck.value;
  }

  if ('color_options' in req.body) {
    req.body.color_options = normalizeColorOptions(req.body.color_options);
  }

  if ('docs' in req.body) {
    const persisted = await persistProductDocs(req.body.docs);
    req.body.docs = persisted.docs;
    createdDocUrls = persisted.createdUrls;
  }

  const fields = ['name','description','usage','technical_data','warnings','price','mrp','stock','brand','type','category','categories','color_options','image_url','image_urls','docs','links','is_available','is_hidden','show_on_home'];
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (!(field in req.body)) continue;

    if (field === 'show_on_home' || field === 'is_available' || field === 'is_hidden') {
      updates.push(`${field} = ?`);
      values.push(req.body[field] ? 1 : 0);
    } else if (field === 'image_urls' || field === 'docs' || field === 'links' || field === 'categories' || field === 'color_options') {
      updates.push(`${field} = ?`);
      values.push(Array.isArray(req.body[field]) && req.body[field].length ? JSON.stringify(req.body[field]) : null);
    } else if (field === 'usage') {
      updates.push('`usage` = ?');
      values.push(req.body[field]);
    } else if (field === 'technical_data' || field === 'warnings') {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    } else if (field === 'name') {
      updates.push('name = ?');
      values.push(String(req.body[field] || '').trim());
    } else {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    values.push(req.params.id);
    await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

    if ('docs' in req.body) {
      await removeStaleProductDocs(previousDocs, req.body.docs);
    }

    const [rows] = await pool.query(`SELECT ${PRODUCT_DETAIL_FIELDS} FROM products WHERE id = ?`, [req.params.id]);
    return res.json(normalizeProduct(rows[0]));
  } catch (error) {
    await cleanupCreatedProductDocs(createdDocUrls);
    throw error;
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (!hasPermission(req.admin, 'products', 'delete')) {
    return res.status(403).json({ error: 'You do not have permission to delete products' });
  }

  const [rows] = await pool.query('SELECT docs FROM products WHERE id = ? LIMIT 1', [req.params.id]);
  if (rows[0]) {
    await deleteProductDocs(parseJsonField(rows[0].docs));
  }
  await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  return res.status(204).send();
});

export default router;
