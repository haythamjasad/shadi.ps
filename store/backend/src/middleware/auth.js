import pool from '../db.js';
import { verifyToken } from '../utils/jwt.js';
import { hasAnyPermission, hasPermission, resolveAdminAccess } from '../utils/admin-permissions.js';

export function getAdminFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin' || payload.purpose) return null;
    return payload;
  } catch {
    return null;
  }
}

async function loadAdmin(req) {
  const payload = getAdminFromRequest(req);
  if (!payload?.id) return null;

  const [rows] = await pool.query(
    'SELECT id, email, is_super_admin, permissions FROM admin_users WHERE id = ? LIMIT 1',
    [payload.id]
  );
  const admin = rows[0];
  if (!admin) return null;

  const access = resolveAdminAccess(admin, { fallbackFullAccess: !admin.permissions });
  return {
    id: admin.id,
    email: admin.email,
    role: 'admin',
    is_super_admin: access.is_super_admin,
    permissions: access.permissions
  };
}

export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const admin = req.admin || await loadAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.admin = admin;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePermission(moduleName, action) {
  return async (req, res, next) => {
    await requireAdmin(req, res, async () => {
      if (!hasPermission(req.admin, moduleName, action)) {
        return res.status(403).json({ error: 'You do not have permission to perform this action' });
      }
      return next();
    });
  };
}

export function requireAnyPermission(pairs = []) {
  return async (req, res, next) => {
    await requireAdmin(req, res, async () => {
      if (!hasAnyPermission(req.admin, pairs)) {
        return res.status(403).json({ error: 'You do not have permission to access this resource' });
      }
      return next();
    });
  };
}
