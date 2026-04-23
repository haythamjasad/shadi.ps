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

export function buildEmptyPermissions() {
  return Object.fromEntries(
    Object.entries(ADMIN_PERMISSION_DEFINITIONS).map(([moduleName, actions]) => [
      moduleName,
      Object.fromEntries(actions.map((action) => [action, false]))
    ])
  );
}

export function normalizePermissions(value) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = buildEmptyPermissions();
  for (const [moduleName, actions] of Object.entries(ADMIN_PERMISSION_DEFINITIONS)) {
    const moduleSource = source[moduleName] && typeof source[moduleName] === 'object' ? source[moduleName] : {};
    for (const action of actions) {
      normalized[moduleName][action] = !!moduleSource[action];
    }
  }
  return normalized;
}

export function hasPermission(admin, moduleName, action) {
  if (!admin) return false;
  if (admin.is_super_admin) return true;
  return !!admin.permissions?.[moduleName]?.[action];
}

export function hasAnyPermission(admin, pairs = []) {
  return pairs.some(([moduleName, action]) => hasPermission(admin, moduleName, action));
}
