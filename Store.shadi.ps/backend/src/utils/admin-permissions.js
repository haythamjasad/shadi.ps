export const PRIMARY_SUPERADMIN_EMAIL = 'haythemasad5@gmail.com';

export const ADMIN_PERMISSION_DEFINITIONS = {
  products: ['read', 'create', 'update', 'delete', 'hide', 'home', 'sort', 'import'],
  categories: ['read', 'create', 'delete', 'sort'],
  cities: ['read', 'create', 'delete'],
  orders: ['read_list', 'read_details', 'change_status', 'preview_customer_email', 'preview_internal_email', 'send_customer_email', 'send_internal_email'],
  shadi_transactions: ['read_list', 'update', 'delete'],
  shadi_join_requests: ['read_list', 'update', 'delete'],
  smtp: ['read', 'create', 'update', 'delete', 'activate', 'test'],
  lahza: ['read', 'update', 'check'],
  store: ['read', 'update'],
  whatsapp: ['read', 'update'],
  banner: ['read', 'update', 'delete'],
  recaptcha: ['read', 'update', 'check'],
  users: ['read', 'create', 'update_password', 'delete', 'manage_permissions']
};

export function buildFullPermissions() {
  return Object.fromEntries(
    Object.entries(ADMIN_PERMISSION_DEFINITIONS).map(([module, actions]) => [
      module,
      Object.fromEntries(actions.map((action) => [action, true]))
    ])
  );
}

function parsePermissions(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || 'null'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizePermissions(value) {
  const raw = parsePermissions(value);
  const normalized = {};

  for (const [module, actions] of Object.entries(ADMIN_PERMISSION_DEFINITIONS)) {
    const moduleSource = raw[module] && typeof raw[module] === 'object' && !Array.isArray(raw[module])
      ? raw[module]
      : {};
    normalized[module] = {};
    for (const action of actions) {
      normalized[module][action] = !!moduleSource[action];
    }
  }

  return normalized;
}

export function hasAnyStoredPermission(value) {
  const permissions = normalizePermissions(value);
  return Object.values(permissions).some((moduleActions) => Object.values(moduleActions).some(Boolean));
}

export function resolveAdminAccess(admin, { fallbackFullAccess = false } = {}) {
  const email = String(admin?.email || '').trim().toLowerCase();
  const explicitSuperAdmin = admin?.is_super_admin === 1 || admin?.is_super_admin === true;
  const isSuperAdmin = explicitSuperAdmin || email === PRIMARY_SUPERADMIN_EMAIL;
  if (isSuperAdmin) {
    return {
      is_super_admin: true,
      permissions: buildFullPermissions()
    };
  }

  const permissions = normalizePermissions(admin?.permissions);
  if (!hasAnyStoredPermission(admin?.permissions) && fallbackFullAccess) {
    return {
      is_super_admin: false,
      permissions: buildFullPermissions()
    };
  }

  return {
    is_super_admin: false,
    permissions
  };
}

export function hasPermission(admin, moduleName, action) {
  if (!admin) return false;
  if (admin.is_super_admin) return true;
  return !!admin.permissions?.[moduleName]?.[action];
}

export function hasAnyPermission(admin, pairs = []) {
  return pairs.some(([moduleName, action]) => hasPermission(admin, moduleName, action));
}

export function serializePermissions(value, { fallbackFullAccess = false } = {}) {
  const resolved = resolveAdminAccess(value, { fallbackFullAccess });
  return resolved.permissions;
}
