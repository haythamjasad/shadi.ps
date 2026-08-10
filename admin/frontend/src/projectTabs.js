const BASE_TABS = [
  { key: 'products', label: 'المنتجات', mode: 'internal', anyOf: [['products', 'read']] },
  {
    key: 'orders',
    label: 'الطلبات',
    mode: 'internal',
    anyOf: [
      ['orders', 'read_list'],
      ['orders', 'read_unpaid'],
      ['orders', 'read_details'],
      ['orders', 'preview_customer_email'],
      ['orders', 'preview_internal_email'],
      ['orders', 'send_customer_email'],
      ['orders', 'send_internal_email']
    ]
  },
  { key: 'shadi_transactions', label: 'الاستشارات', mode: 'internal', anyOf: [['shadi_transactions', 'read_list'], ['shadi_transactions', 'read_unpaid']] },
  { key: 'purchasing', label: 'المشتريات والمحاسبة', mode: 'internal', anyOf: [['purchasing', 'read']] },
  { key: 'shadi_join_requests', label: 'طلبات الانضمام', mode: 'internal', anyOf: [['shadi_join_requests', 'read_list']] },
  { key: 'smtp', label: 'SMTP', mode: 'internal', anyOf: [['smtp', 'read']] },
  { key: 'lahza', label: 'Lahza', mode: 'internal', anyOf: [['lahza', 'read']] },
  { key: 'store', label: 'المتجر', mode: 'internal', anyOf: [['store', 'read']] },
  { key: 'whatsapp', label: 'واتساب', mode: 'internal', anyOf: [['whatsapp', 'read']] },
  { key: 'banner', label: 'بانر الموقع', mode: 'internal', anyOf: [['banner', 'read']] },
  { key: 'recaptcha', label: 'reCAPTCHA', mode: 'internal', anyOf: [['recaptcha', 'read']] },
  { key: 'users', label: 'المستخدمون', mode: 'internal', anyOf: [['users', 'read']] },
  { key: 'sharah', label: 'Shara', mode: 'internal', anyOf: [['sharah', 'read']] },
  {
    key: 'categories',
    label: 'الفئات',
    mode: 'internal',
    anyOf: [
      ['categories', 'read'],
      ['categories', 'sort'],
      ['products', 'sort']
    ]
  },
  { key: 'cities', label: 'المدن', mode: 'internal', anyOf: [['cities', 'read']] }
];

function parseExtraTabs(rawValue) {
  const text = String(rawValue || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const key = String(item.key || '').trim();
        const label = String(item.label || '').trim();
        const url = String(item.url || '').trim();
        const permissions = Array.isArray(item.permissions)
          ? item.permissions
              .filter((pair) => Array.isArray(pair) && pair.length >= 2)
              .map((pair) => [String(pair[0] || '').trim(), String(pair[1] || '').trim()])
              .filter(([moduleName, action]) => moduleName && action)
          : [];

        if (!key || !label || !url) return null;

        return {
          key,
          label,
          mode: 'external',
          url,
          anyOf: permissions.length > 0 ? permissions : [['users', 'read']]
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getAdminTabs() {
  const extraTabs = parseExtraTabs(import.meta.env.VITE_EXTRA_PROJECT_TABS);
  return [...BASE_TABS, ...extraTabs];
}

export function getVisibleAdminTabs(currentAdmin, hasPermission, hasAnyPermission) {
  const tabs = getAdminTabs();
  return tabs.filter((tab) => {
    if (!Array.isArray(tab.anyOf) || tab.anyOf.length === 0) return true;
    if (tab.anyOf.length === 1) {
      const [moduleName, action] = tab.anyOf[0];
      return hasPermission(currentAdmin, moduleName, action);
    }
    return hasAnyPermission(currentAdmin, tab.anyOf);
  });
}

export function getAdminTabByKey(key) {
  return getAdminTabs().find((tab) => tab.key === key) || null;
}
