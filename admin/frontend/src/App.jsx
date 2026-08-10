import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE, apiGet, apiPost, apiPut, apiDelete, getToken, setToken } from './api.js';
import { ADMIN_PERMISSION_DEFINITIONS, buildEmptyPermissions, hasAnyPermission, hasPermission, normalizePermissions } from './permissions.js';
import { ShadiJoinRequests, ShadiTransactions } from './shadiTabs.jsx';
import { getAdminTabByKey, getVisibleAdminTabs } from './projectTabs.js';
import ProjectXDashboard from './ProjectXDashboard.jsx';
import SharahAdmin from './SharahAdmin.jsx';

const ADMIN_SESSION_MS = 60 * 60 * 1000;
const ADMIN_SESSION_KEY = 'admin_session_started_at';
const BUILD_STAMP = '2026-03-22-admin-token-fix-2';
const PERMISSION_MODULE_LABELS = {
  products: 'المنتجات',
  categories: 'الفئات',
  cities: 'المدن',
  orders: 'الطلبات',
  purchasing: 'المشتريات والمحاسبة',
  shadi_transactions: 'الاستشارات',
  shadi_join_requests: 'طلبات الانضمام',
  smtp: 'SMTP',
  lahza: 'Lahza',
  store: 'المتجر',
  whatsapp: 'واتساب',
  banner: 'البانر',
  recaptcha: 'reCAPTCHA',
  users: 'المستخدمون',
  project_x: 'Project X',
  sharah: 'Shara'
};
const PERMISSION_ACTION_LABELS = {
  read: 'قراءة',
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  hide: 'إخفاء',
  sort: 'ترتيب',
  import: 'استيراد',
  read_list: 'قائمة الطلبات',
  read_unpaid: 'بانتظار الدفع',
  read_details: 'تفاصيل الطلب',
  change_status: 'تغيير الحالة',
  preview_customer_email: 'معاينة بريد العميل',
  preview_internal_email: 'معاينة بريد التجهيز',
  send_customer_email: 'إرسال بريد العميل',
  send_internal_email: 'إرسال بريد التجهيز',
  activate: 'تفعيل',
  test: 'اختبار',
  check: 'فحص',
  update_password: 'تغيير كلمة المرور',
  manage_permissions: 'إدارة الصلاحيات',
  manage: 'إدارة'
};

function ResponsiveTableWrap({ children, className = '', minWidth = '760px', ariaLabel }) {
  const style = { '--responsive-table-min-width': minWidth };
  return (
    <div className={`responsive-table-wrap ${className}`.trim()} style={style} role="region" aria-label={ariaLabel} tabIndex="0">
      {children}
    </div>
  );
}

function createBlankOrderItem(overrides = {}) {
  return {
    productId: '',
    productSearch: '',
    isCustom: false,
    customName: '',
    supplierId: '',
    unitPrice: '',
    purchasePrice: '',
    selectedVariantId: '',
    selectedColorName: '',
    selectedColorHex: '',
    selectedSizeName: '',
    quantity: 1,
    ...overrides
  };
}

const ACCOUNTING_TABLE_COLUMNS = {
  suppliers: [
    { key: 'supplier', label: 'المورد' },
    { key: 'contact', label: 'التواصل', defaultVisible: false },
    { key: 'products', label: 'المنتجات' },
    { key: 'total_sales', label: 'إجمالي البيع', defaultVisible: false },
    { key: 'purchase_total', label: 'إجمالي الشراء', defaultVisible: false },
    { key: 'net_profit', label: 'صافي الربح' },
    { key: 'payments', label: 'الدفعات', defaultVisible: false },
    { key: 'net_movement', label: 'صافي الحركة', defaultVisible: false },
    { key: 'balance', label: 'الرصيد' },
    { key: 'statement', label: 'كشف الحساب' },
    { key: 'actions', label: 'إجراءات' }
  ],
  clients: [
    { key: 'client', label: 'العميل' },
    { key: 'type', label: 'النوع' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'email', label: 'البريد', defaultVisible: false },
    { key: 'orders', label: 'الطلبات' },
    { key: 'total_sales', label: 'إجمالي البيع', defaultVisible: false },
    { key: 'purchase_total', label: 'إجمالي الشراء', defaultVisible: false },
    { key: 'receipts', label: 'المقبوضات/الخصومات', defaultVisible: false },
    { key: 'net', label: 'الصافي', defaultVisible: false },
    { key: 'net_profit', label: 'صافي الربح' },
    { key: 'balance', label: 'الرصيد' },
    { key: 'last_order', label: 'آخر طلب', defaultVisible: false },
    { key: 'statement', label: 'كشف/تحميل' },
    { key: 'actions', label: 'إجراءات' }
  ],
  vouchers: [
    { key: 'scope', label: 'نوع الحساب' },
    { key: 'name', label: 'الاسم' },
    { key: 'date', label: 'التاريخ' },
    { key: 'type', label: 'نوع الحركة' },
    { key: 'amount', label: 'المبلغ' },
    { key: 'total_sales', label: 'إجمالي البيع', defaultVisible: false },
    { key: 'purchase_total', label: 'إجمالي الشراء', defaultVisible: false },
    { key: 'net_profit', label: 'صافي الربح', defaultVisible: false },
    { key: 'reference', label: 'المرجع' },
    { key: 'note', label: 'ملاحظة', defaultVisible: false },
    { key: 'order', label: 'الطلب' }
  ],
  statements: [
    { key: 'type', label: 'النوع' },
    { key: 'date', label: 'التاريخ' },
    { key: 'amount', label: 'المبلغ' },
    { key: 'total_sales', label: 'إجمالي البيع' },
    { key: 'purchase_total', label: 'إجمالي الشراء' },
    { key: 'net_profit', label: 'صافي الربح' },
    { key: 'balance', label: 'الرصيد' },
    { key: 'reference', label: 'المرجع' },
    { key: 'note', label: 'ملاحظة' }
  ]
};
const ACCOUNTING_COLUMNS_STORAGE_KEY = 'admin_accounting_columns';

function buildDefaultAccountingColumns() {
  return Object.fromEntries(
    Object.entries(ACCOUNTING_TABLE_COLUMNS).map(([tableKey, columns]) => [
      tableKey,
      Object.fromEntries(columns.map((column) => [column.key, column.defaultVisible !== false]))
    ])
  );
}

function loadSavedAccountingColumns() {
  const defaults = buildDefaultAccountingColumns();
  if (typeof window === 'undefined') return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNTING_COLUMNS_STORAGE_KEY) || '');
    if (!parsed || typeof parsed !== 'object') return defaults;
    return Object.fromEntries(
      Object.entries(defaults).map(([tableKey, columns]) => [
        tableKey,
        { ...columns, ...(parsed[tableKey] && typeof parsed[tableKey] === 'object' ? parsed[tableKey] : {}) }
      ])
    );
  } catch {
    return defaults;
  }
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function getDocPreviewName(doc, index) {
  if (doc && typeof doc === 'object') {
    return String(doc.name || doc.fileName || `document-${index + 1}.pdf`);
  }
  return `document-${index + 1}.pdf`;
}

function getDocPreviewUrl(doc) {
  if (typeof doc === 'string') return doc;
  if (doc && typeof doc === 'object') {
    return String(doc.url || doc.href || doc.path || doc.dataUrl || '');
  }
  return '';
}

function normalizeDocPayload(docs) {
  return (Array.isArray(docs) ? docs : []).map((doc, index) => {
    if (typeof doc === 'string') return doc;
    if (!doc || typeof doc !== 'object') return doc;

    const url = String(doc.url || doc.href || doc.path || doc.dataUrl || '').trim();
    return {
      id: String(doc.id || `doc-${index}`),
      name: getDocPreviewName(doc, index),
      type: String(doc.type || 'application/pdf').trim(),
      size: Number(doc.size) || undefined,
      url
    };
  });
}

function getDocPreviewTitle(doc, index) {
  return getDocPreviewName(doc, index).replace(/\.pdf$/i, '').trim() || `Document ${index + 1}`;
}

function getPublicDocUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';

  const match = text.match(/(?:https?:\/\/[^/]+)?\/(?:(?:api(?:\/v01)?)?\/?uploads\/docs|assets)\/([^/?#]+\.pdf)(?:[?#].*)?$/i);
  if (match) {
    return `${API_BASE}/uploads/docs/${match[1]}`;
  }

  return text;
}

function formatDocFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} kB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function buildPdfPreviewUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  const params = 'toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH';
  return text.includes('#') ? `${text}&${params}` : `${text}#${params}`;
}

function decodePdfDataUrl(url) {
  const text = String(url || '').trim();
  const match = text.match(/^data:application\/pdf(?:;[^,]*)?,(.+)$/i);
  if (!match) return null;

  const payload = match[1] || '';
  const binary = window.atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getPdfPageCount(bytes) {
  if (!bytes || bytes.length === 0) return null;
  try {
    const content = new TextDecoder('latin1').decode(bytes);
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return matches && matches.length > 0 ? matches.length : null;
  } catch {
    return null;
  }
}

async function readPdfDetails(url, fallbackSize) {
  const directBytes = decodePdfDataUrl(url);
  if (directBytes) {
    return {
      size: directBytes.length || fallbackSize || null,
      pages: getPdfPageCount(directBytes)
    };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load PDF preview');
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return {
    size: bytes.length || fallbackSize || null,
    pages: getPdfPageCount(bytes)
  };
}

function PdfBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h3" />
      <path d="M8 17h5" />
    </svg>
  );
}

function PdfPreviewCard({ doc, index, onRemove }) {
  const docName = getDocPreviewName(doc, index);
  const docUrl = getPublicDocUrl(getDocPreviewUrl(doc));
  const previewUrl = buildPdfPreviewUrl(docUrl);
  const initialSize = Number(doc?.size) || null;
  const [details, setDetails] = useState({ size: initialSize, pages: null });

  useEffect(() => {
    let cancelled = false;

    if (!docUrl) {
      setDetails({ size: initialSize, pages: null });
      return undefined;
    }

    readPdfDetails(docUrl, initialSize)
      .then((next) => {
        if (cancelled) return;
        setDetails({
          size: next?.size || initialSize,
          pages: next?.pages || null
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDetails((current) => ({
          size: current.size || initialSize,
          pages: current.pages || null
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [docUrl, initialSize]);

  const metaParts = [];
  if (details.pages) metaParts.push(`${details.pages} pages`);
  metaParts.push('PDF');
  if (details.size) metaParts.push(formatDocFileSize(details.size));

  return (
    <div className="preview-item pdf-preview-card">
      <button type="button" className="preview-remove" aria-label="حذف الملف" onClick={onRemove}>
        <TrashIcon />
      </button>

      <div className="pdf-preview-shell">
        <a className="pdf-preview-stage" href={docUrl || '#'} target="_blank" rel="noreferrer">
          {previewUrl ? (
            <iframe
              title={docName}
              src={previewUrl}
              className="pdf-preview-frame"
              loading="lazy"
            />
          ) : (
            <div className="pdf-preview-fallback">
              <div className="pdf-preview-fallback-badge">PDF</div>
              <div className="pdf-preview-fallback-title">{getDocPreviewTitle(doc, index)}</div>
            </div>
          )}
        </a>

        <div className="pdf-preview-footer">
          <div className="pdf-preview-badge">
            <PdfBadgeIcon />
            <span>PDF</span>
          </div>

          <div className="pdf-preview-meta">
            <a className="pdf-preview-name" href={docUrl || '#'} target="_blank" rel="noreferrer">
              {docName}
            </a>
            <div className="pdf-preview-details">{metaParts.join(' · ')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionMatrix({ value, onChange, disabled = false }) {
  const permissions = normalizePermissions(value);

  const togglePermission = (moduleName, action) => {
    if (disabled) return;
    onChange({
      ...permissions,
      [moduleName]: {
        ...permissions[moduleName],
        [action]: !permissions[moduleName][action]
      }
    });
  };

  return (
    <div className="permission-matrix">
      {Object.entries(ADMIN_PERMISSION_DEFINITIONS).map(([moduleName, actions]) => (
        <div key={moduleName} className="permission-module-card">
          <div className="permission-module-title">{PERMISSION_MODULE_LABELS[moduleName] || moduleName}</div>
          <div className="permission-grid">
            {actions.map((action) => (
              <label key={`${moduleName}-${action}`} className="checkbox permission-checkbox">
                <input
                  type="checkbox"
                  checked={!!permissions[moduleName]?.[action]}
                  onChange={() => togglePermission(moduleName, action)}
                  disabled={disabled}
                />
                <span>{PERMISSION_ACTION_LABELS[action] || action}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  useEffect(() => {
    window.__ADMIN_BUILD_STAMP__ = BUILD_STAMP;
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'products';
  const [token, setTokenState] = useState(getToken());
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (type, text) => {
    const next = { id: Date.now(), type, text };
    setToast(next);
    setTimeout(() => {
      setToast((current) => (current?.id === next.id ? null : current));
    }, 3000);
  };

  const handleLogout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setCurrentAdmin(null);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }, []);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return undefined;
    }

    let cancelled = false;
    setBooting(true);
    setError('');

    apiGet('/admin/me')
      .then((admin) => {
        if (cancelled) return;
        if (admin?.token) {
          setToken(admin.token);
        }
        setCurrentAdmin({
          ...admin,
          permissions: normalizePermissions(admin?.permissions)
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'انتهت الجلسة. سجل الدخول مرة أخرى.');
        if (!currentAdmin) {
          handleLogout();
        }
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, handleLogout]);

  useEffect(() => {
    if (!token) return undefined;

    const checkSession = () => {
      const startedAt = Number(localStorage.getItem(ADMIN_SESSION_KEY) || 0);
      if (!startedAt) {
        localStorage.setItem(ADMIN_SESSION_KEY, String(Date.now()));
        return;
      }
      if (Date.now() - startedAt > ADMIN_SESSION_MS) {
        setError('انتهت جلسة الإدارة بعد ساعة واحدة. سجل الدخول مرة أخرى.');
        handleLogout();
      }
    };

    checkSession();
    const timer = setInterval(checkSession, 15000);
    return () => clearInterval(timer);
  }, [token, handleLogout]);

  const visibleTabs = useMemo(
    () => getVisibleAdminTabs(currentAdmin, hasPermission, hasAnyPermission),
    [currentAdmin]
  );

  const activeTabVisible = visibleTabs.some((tab) => tab.key === requestedTab);
  const effectiveTab = activeTabVisible ? requestedTab : (visibleTabs[0]?.key || 'products');
  const activeTabConfig = useMemo(() => getAdminTabByKey(effectiveTab), [effectiveTab]);

  useEffect(() => {
    if (token && !booting && currentAdmin && visibleTabs.length > 0 && effectiveTab !== requestedTab) {
      setSearchParams({ tab: effectiveTab }, { replace: true });
    }
  }, [booting, currentAdmin, effectiveTab, requestedTab, setSearchParams, token, visibleTabs.length]);

  const handleAdminTabClick = useCallback((event, tabKey) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setSearchParams({ tab: tabKey });
  }, [setSearchParams]);

  const refreshAdminSession = useCallback(async () => {
    const admin = await apiGet('/admin/me');
    if (admin?.token) {
      setToken(admin.token);
      setTokenState(admin.token);
    }
    setCurrentAdmin({
      ...admin,
      permissions: normalizePermissions(admin?.permissions)
    });
    return admin;
  }, []);

  if (!token) {
    return (
      <Login
        onSuccess={({ token: nextToken, admin }) => {
          setToken(nextToken);
          setTokenState(nextToken);
          setCurrentAdmin({
            ...admin,
            permissions: normalizePermissions(admin?.permissions)
          });
          setBooting(false);
          localStorage.setItem(ADMIN_SESSION_KEY, String(Date.now()));
        }}
      />
    );
  }

  if (booting || !currentAdmin) {
    return <div className="login"><div className="card">جارٍ تحميل لوحة الإدارة...</div></div>;
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <button onClick={handleLogout} className="danger sidebar-logout">تسجيل الخروج</button>
            <div className="brand-copy">
              <div className="brand-title">لوحة الإدارة</div>
              <div className="brand-sub">مركز التحكم</div>
              <div className="brand-sub">{currentAdmin.email}</div>
            </div>
          </div>
        </aside>
        <div className="content">
          <main className="main">
            <section className="card">
              <h2>لا توجد صلاحيات متاحة</h2>
              <p className="muted">تم تسجيل الدخول بنجاح، لكن هذا الحساب لا يملك أي صلاحيات حالياً. تواصل مع المشرف لتفعيل الصلاحيات المطلوبة.</p>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <button onClick={handleLogout} className="danger sidebar-logout">تسجيل الخروج</button>
          <div className="brand-copy">
            <div className="brand-title">لوحة الإدارة</div>
            <div className="brand-sub">مركز التحكم</div>
            <div className="brand-sub">{currentAdmin.email}{currentAdmin.is_super_admin ? ' - Super Admin' : ''}</div>
          </div>
        </div>
        <nav className="nav">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              to={`?tab=${encodeURIComponent(tab.key)}`}
              onClick={(event) => handleAdminTabClick(event, tab.key)}
              className={effectiveTab === tab.key ? 'active' : ''}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="content">
        {error && <div className="error">{error}</div>}
        <Toast toast={toast} onClose={() => setToast(null)} />
        <main className="main">
          {effectiveTab === 'products' && <Products setError={setError} currentAdmin={currentAdmin} />}
            {effectiveTab === 'orders' && <Orders setError={setError} currentAdmin={currentAdmin} refreshSession={refreshAdminSession} />}
          {effectiveTab === 'purchasing' && <PurchasingAccounting setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'shadi_transactions' && <ShadiTransactions setError={setError} currentAdmin={currentAdmin} refreshSession={refreshAdminSession} />}
          {effectiveTab === 'shadi_join_requests' && <ShadiJoinRequests setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'smtp' && <SmtpSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'lahza' && <LahzaSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'store' && <StoreSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'whatsapp' && <WhatsappSettings setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'banner' && <SiteBannerSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'recaptcha' && <RecaptchaSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'users' && <AdminUsers setError={setError} currentAdmin={currentAdmin} refreshCurrentAdmin={setCurrentAdmin} />}
          {effectiveTab === 'sharah' && <SharahAdmin setError={setError} showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'categories' && <CategoriesManager setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'cities' && <CitiesManager setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'project_x_dashboard' && <ProjectXDashboard currentAdmin={currentAdmin} />}
          {activeTabConfig?.mode === 'external' && (
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #ececec', fontWeight: 600 }}>
                {activeTabConfig.label}
              </div>
              <iframe
                title={activeTabConfig.label}
                src={activeTabConfig.url}
                style={{ width: '100%', minHeight: '78vh', border: 0, background: '#fff' }}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpPassword, setFpPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpVerified, setFpVerified] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpMessage, setFpMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (import.meta.env.DEV) console.info('Admin login submit', { email, passwordLength: password.length });
      const data = await apiPost('/admin/login', { email, password });
      onSuccess({ token: data.token, admin: data.admin || {} });
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const localDevLogin = async () => {
    if (!import.meta.env.DEV) return;
    const devEmail = String(import.meta.env.VITE_DEV_ADMIN_EMAIL || '').trim();
    const devPassword = String(import.meta.env.VITE_DEV_ADMIN_PASSWORD || '');
    if (!devEmail || !devPassword) {
      setError('إعدادات الدخول المحلي غير مكتملة. أضف VITE_DEV_ADMIN_EMAIL و VITE_DEV_ADMIN_PASSWORD في ملف .env.local المحلي.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/admin/login', { email: devEmail, password: devPassword });
      onSuccess({ token: data.token, admin: data.admin || {} });
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول المحلي');
    } finally {
      setLoading(false);
    }
  };

  const openForgotDialog = () => {
    setShowForgot(true);
    setFpEmail(email || '');
    setFpCode('');
    setFpPassword('');
    setFpConfirmPassword('');
    setFpResetToken('');
    setFpVerified(false);
    setFpError('');
    setFpMessage('');
  };

  const requestResetCode = async () => {
    if (!fpEmail.trim()) {
      setFpError('أدخل بريد المدير أولاً');
      return;
    }
    setFpLoading(true);
    setFpError('');
    setFpMessage('');
    try {
      await apiPost('/admin/forgot-password/request', { email: fpEmail.trim() });
      setFpMessage('تم إرسال كود التفعيل إلى البريد الإلكتروني');
    } catch (err) {
      setFpError(err.message || 'فشل إرسال كود التفعيل');
    } finally {
      setFpLoading(false);
    }
  };

  const verifyResetCode = async () => {
    if (!fpEmail.trim() || !fpCode.trim()) {
      setFpError('أدخل البريد والكود');
      return;
    }
    setFpLoading(true);
    setFpError('');
    setFpMessage('');
    try {
      const data = await apiPost('/admin/forgot-password/verify', {
        email: fpEmail.trim(),
        code: fpCode.trim()
      });
      setFpResetToken(data.resetToken || '');
      setFpVerified(true);
      setFpMessage('تم تفعيل الكود. يمكنك الآن تغيير كلمة المرور.');
    } catch (err) {
      setFpError(err.message || 'الكود غير صحيح');
    } finally {
      setFpLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!fpResetToken) {
      setFpError('فعّل الكود أولاً');
      return;
    }
    if (!fpPassword || !fpConfirmPassword) {
      setFpError('أدخل كلمة المرور الجديدة وتأكيدها');
      return;
    }
    if (fpPassword !== fpConfirmPassword) {
      setFpError('كلمتا المرور غير متطابقتين');
      return;
    }
    setFpLoading(true);
    setFpError('');
    setFpMessage('');
    try {
      await apiPost('/admin/forgot-password/reset', {
        resetToken: fpResetToken,
        password: fpPassword,
        confirmPassword: fpConfirmPassword
      });
      setFpMessage('تم تغيير كلمة المرور بنجاح');
      setTimeout(() => {
        setShowForgot(false);
      }, 1000);
    } catch (err) {
      setFpError(err.message || 'فشل تغيير كلمة المرور');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <>
      <div className="login-shell">
        <div className="login-surface">
          <div className="login-hero">
            <img src="/logo.png" alt="Shadi Store" className="login-hero-logo" />
          </div>

          <form className="login-panel" onSubmit={handleSubmit} autoComplete="off">
            <h2>تسجيل دخول الإدارة</h2>
            <p className="muted">أدخل بياناتك للوصول إلى لوحة التحكم</p>
            {error && <div className="error">{error}</div>}

            <label>البريد الإلكتروني</label>
            <input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />

            <label>كلمة المرور</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <div className="login-meta">
              <button
                type="button"
                className="forgot-link as-button"
                onClick={openForgotDialog}
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
            </button>
            {import.meta.env.DEV && (
              <button type="button" className="secondary" onClick={localDevLogin} disabled={loading}>
                دخول محلي للتجربة
              </button>
            )}
          </form>
        </div>
      </div>

      {showForgot && (
        <Modal title="استعادة كلمة المرور" onClose={() => setShowForgot(false)}>
          <div className="form">
            {fpError && <div className="error">{fpError}</div>}
            {fpMessage && <div className="notice">{fpMessage}</div>}

            <label>البريد الإلكتروني</label>
            <div className="row forgot-row">
              <input
                placeholder="you@example.com"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
              />
              <button type="button" onClick={requestResetCode} disabled={fpLoading}>
                {fpLoading ? '...' : 'إرسال الكود'}
              </button>
            </div>

            <label>الكود</label>
            <div className="row forgot-row">
              <input
                placeholder="أدخل كود التفعيل"
                value={fpCode}
                onChange={(e) => setFpCode(e.target.value)}
              />
              <button type="button" className="secondary" onClick={verifyResetCode} disabled={fpLoading}>
                {fpLoading ? '...' : 'تفعيل الكود'}
              </button>
            </div>

            {fpVerified && (
              <>
                <div className="notice">
                  سيتم تغيير كلمة المرور للحساب: <strong>{fpEmail}</strong>
                </div>
                <input
                  type="password"
                  placeholder="كلمة المرور الجديدة"
                  value={fpPassword}
                  onChange={(e) => setFpPassword(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="تأكيد كلمة المرور"
                  value={fpConfirmPassword}
                  onChange={(e) => setFpConfirmPassword(e.target.value)}
                />
                <button type="button" onClick={resetPassword} disabled={fpLoading}>
                  {fpLoading ? '...' : 'تغيير كلمة المرور'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type || 'success'}`}>
      <span>{toast.text}</span>
      <button className="toast-close" onClick={onClose} aria-label="close">×</button>
    </div>
  );
}

function createIdempotencyKey(prefix) {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function getIdempotencyHeaders(ref, prefix) {
  if (!ref.current) ref.current = createIdempotencyKey(prefix);
  return { 'Idempotency-Key': ref.current };
}

function PurchasingAccounting({ setError, currentAdmin }) {
  const canCreate = hasPermission(currentAdmin, 'purchasing', 'create');
  const canUpdate = hasPermission(currentAdmin, 'purchasing', 'update');
  const canDelete = hasPermission(currentAdmin, 'purchasing', 'delete');
  const [suppliers, setSuppliers] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientCities, setClientCities] = useState([]);
  const [orders, setOrders] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [clientJournalEntries, setClientJournalEntries] = useState([]);
  const [supplierReport, setSupplierReport] = useState({ summary: {}, rows: [] });
  const [clientReport, setClientReport] = useState({ summary: {}, rows: [] });
  const [customerReport, setCustomerReport] = useState({ summary: {}, rows: [] });
  const [reportFilters, setReportFilters] = useState({ date_from: '', date_to: '', supplier_id: '', client_id: '', status: '', balance_filter: '', client_type: 'all' });
  const [accountingSearch, setAccountingSearch] = useState({ suppliers: '', clients: '', vouchers: '', journal: '', clientJournal: '', report: '', clientReport: '', customerReport: '' });
  const [accountingFilters, setAccountingFilters] = useState({ supplierBalance: '', clientBalance: '', voucherScope: '', voucherAccountKey: '', voucherType: '', journalSupplierId: '', journalType: '', clientJournalClientId: '', clientJournalType: '' });
  const [supplierStatement, setSupplierStatement] = useState(null);
  const [collapsedStatementEntryIds, setCollapsedStatementEntryIds] = useState([]);
  const [supplierInvoice, setSupplierInvoice] = useState(null);
  const [voucherCollapsedDetailKeys, setVoucherCollapsedDetailKeys] = useState([]);
  const [voucherDetailCache, setVoucherDetailCache] = useState({});
  const [clientStatement, setClientStatement] = useState(null);
  const [linkedOrderPreview, setLinkedOrderPreview] = useState(null);
  const [linkedOrderContextKey, setLinkedOrderContextKey] = useState('');
  const [customerStatement, setCustomerStatement] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState('');
  const [supplierForm, setSupplierForm] = useState({ id: null, name: '', contact_info: '', email: '', phone: '', address_line1: '', city: '', state: '', country: 'فلسطين' });
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ id: null, name: '', contact_info: '', email: '', phone: '', address_line1: '', city: '', state: '', country: 'فلسطين' });
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({ supplier_id: '', transaction_type: 'credit', voucher_type: 'purchase_invoice', amount: '', reference_doc: '', note: '', date: new Date().toISOString().slice(0, 10) });
  const [journalSupplierSearch, setJournalSupplierSearch] = useState('');
  const [journalSupplierPickerOpen, setJournalSupplierPickerOpen] = useState(false);
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [journalSaving, setJournalSaving] = useState(false);
  const [clientJournalForm, setClientJournalForm] = useState({ client_id: '', transaction_type: 'debit', voucher_type: 'sales_invoice', amount: '', reference_doc: '', note: '', date: new Date().toISOString().slice(0, 10) });
  const [clientJournalClientSearch, setClientJournalClientSearch] = useState('');
  const [clientJournalClientPickerOpen, setClientJournalClientPickerOpen] = useState(false);
  const [clientJournalDialogOpen, setClientJournalDialogOpen] = useState(false);
  const [clientJournalSaving, setClientJournalSaving] = useState(false);
  const journalIdempotencyKeyRef = useRef(null);
  const clientJournalIdempotencyKeyRef = useRef(null);
  const [accountingTab, setAccountingTab] = useState('suppliers');
  const [accountingFilterPanelsOpen, setAccountingFilterPanelsOpen] = useState({ suppliers: false, clients: false, vouchers: false });
  const [accountingColumns, setAccountingColumns] = useState(() => loadSavedAccountingColumns());

  useEffect(() => {
    try {
      window.localStorage.setItem(ACCOUNTING_COLUMNS_STORAGE_KEY, JSON.stringify(accountingColumns));
    } catch {
      // Column preferences are optional.
    }
  }, [accountingColumns]);

  const formatMoney = (value) => Number(value || 0).toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatContactInfo = (value) => {
    let text = String(value || '').trim();
    if (!text) return '-';
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.phone) {
        text = String(parsed.phone || '').trim();
      }
    } catch {
      // Plain text contact info is already supported.
    }
    const digits = text.replace(/\D/g, '');
    if (digits) return digits.startsWith('0') ? digits : `0${digits}`;
    return text;
  };

  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const matchesSearch = (query, values) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return true;
    return values.some((value) => normalizeText(value).includes(normalizedQuery));
  };
  const matchesBalanceFilter = (value, filter) => {
    if (!filter) return true;
    if (value === null || value === undefined || value === '') return false;
    const amount = Number(value || 0);
    if (filter === 'outstanding') return amount > 0;
    if (filter === 'settled') return amount === 0;
    if (filter === 'credit') return amount < 0;
    return true;
  };
  const CLIENT_VOUCHER_TYPE_LABELS = {
    sales_invoice: 'فاتورة بيع / مدين',
    client_receipt: 'قبض من العميل / دائن',
    client_service_debit: 'خدمات / مدين',
    client_discount_credit: 'خصم / دائن'
  };
  const CLIENT_VOUCHER_TRANSACTION_TYPES = {
    sales_invoice: 'debit',
    client_service_debit: 'debit',
    client_receipt: 'credit',
    client_discount_credit: 'credit'
  };
  const SUPPLIER_VOUCHER_TYPE_LABELS = {
    purchase_invoice: 'فاتورة شراء / دائن',
    supplier_payment: 'دفعة للمورد / مدين',
    supplier_service_credit: 'خدمات / دائن',
    supplier_discount_debit: 'خصم / مدين'
  };
  const SUPPLIER_VOUCHER_TRANSACTION_TYPES = {
    purchase_invoice: 'credit',
    supplier_service_credit: 'credit',
    supplier_payment: 'debit',
    supplier_discount_debit: 'debit'
  };
  const getSupplierVoucherLabel = (entry) => SUPPLIER_VOUCHER_TYPE_LABELS[entry?.voucher_type] || (entry?.transaction_type === 'credit' ? 'فاتورة شراء / دائن' : 'دفعة للمورد / مدين');
  const getClientVoucherLabel = (entry) => CLIENT_VOUCHER_TYPE_LABELS[entry?.voucher_type] || (entry?.transaction_type === 'debit' ? 'فاتورة بيع / مدين' : 'قبض / دائن');
  const setAccountingSearchValue = (key, value) => setAccountingSearch((current) => ({ ...current, [key]: value }));
  const setAccountingFilterValue = (key, value) => setAccountingFilters((current) => ({ ...current, [key]: value }));
  const renderSearchInput = (key, placeholder) => (
    <input
      type="search"
      value={accountingSearch[key] || ''}
      onChange={(event) => setAccountingSearchValue(key, event.target.value)}
      placeholder={placeholder}
    />
  );
  const isAccountingColumnVisible = (tableKey, columnKey) => accountingColumns[tableKey]?.[columnKey] !== false;
  const visibleAccountingColumns = (tableKey) => ACCOUNTING_TABLE_COLUMNS[tableKey].filter((column) => isAccountingColumnVisible(tableKey, column.key));
  const accountingColSpan = (tableKey) => visibleAccountingColumns(tableKey).length || 1;
  const accountingTableMinWidth = (tableKey) => {
    const visibleCount = accountingColSpan(tableKey);
    const minimumByTable = { suppliers: 620, clients: 760, vouchers: 660 };
    const widthByColumn = { suppliers: 72, clients: 76, vouchers: 72 };
    return `${Math.max(minimumByTable[tableKey] || 560, visibleCount * (widthByColumn[tableKey] || 72))}px`;
  };
  const toggleAccountingColumn = (tableKey, columnKey) => {
    setAccountingColumns((current) => ({
      ...current,
      [tableKey]: {
        ...current[tableKey],
        [columnKey]: !isAccountingColumnVisible(tableKey, columnKey)
      }
    }));
  };
  const resetAccountingColumns = (tableKey) => {
    const defaults = buildDefaultAccountingColumns();
    setAccountingColumns((current) => ({ ...current, [tableKey]: defaults[tableKey] }));
  };
  const showAllAccountingColumns = (tableKey) => {
    setAccountingColumns((current) => ({
      ...current,
      [tableKey]: Object.fromEntries(ACCOUNTING_TABLE_COLUMNS[tableKey].map((column) => [column.key, true]))
    }));
  };
  const renderAccountingColumnPicker = (tableKey, label = 'الأعمدة', extraClassName = '') => (
    <details className={`column-picker accounting-column-picker ${extraClassName}`.trim()}>
      <summary>{label}</summary>
      <div className="column-picker-menu">
        {ACCOUNTING_TABLE_COLUMNS[tableKey].map((column) => (
          <label key={column.key} className="checkbox column-picker-option">
            <input
              type="checkbox"
              checked={isAccountingColumnVisible(tableKey, column.key)}
              onChange={() => toggleAccountingColumn(tableKey, column.key)}
            />
            <span>{column.label}</span>
          </label>
        ))}
        <div className="row compact-row">
          <button type="button" className="secondary" onClick={() => resetAccountingColumns(tableKey)}>مختصر</button>
          <button type="button" className="secondary" onClick={() => showAllAccountingColumns(tableKey)}>الكل</button>
        </div>
      </div>
    </details>
  );
  const renderAccountingFilterToggle = (tableKey) => {
    const isOpen = !!accountingFilterPanelsOpen[tableKey];
    return (
      <button
        type="button"
        className="secondary mobile-filter-toggle"
        onClick={() => setAccountingFilterPanelsOpen((current) => ({ ...current, [tableKey]: !isOpen }))}
      >
        <span>البحث والفلاتر</span>
        <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
      </button>
    );
  };
  const formatOrderMetric = (row, key) => row?.order_id ? formatMoney(row[key]) : '-';
  const getEntryOrderId = (entry) => {
    const direct = Number(entry?.order_id || 0);
    if (Number.isInteger(direct) && direct > 0) return direct;
    const match = String(entry?.reference_doc || '').match(/(?:طلب|order)\s*#?\s*(\d+)/i);
    const parsed = match ? Number(match[1]) : 0;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };
  const renderStatementRows = (rows = [], emptyText, options = {}) => {
    if (!rows.length) return <p className="muted">{emptyText}</p>;
    const typeLabel = options.typeLabel || ((entry) => entry.transaction_type === 'credit' ? 'فاتورة شراء' : 'دفعة');
    const referenceRenderer = options.referenceRenderer || ((entry) => entry.reference_doc || '-');
    const collapsedEntryIds = (options.collapsedEntryIds || []).map((id) => String(id));
    const onToggleEntry = options.onToggleEntry;
    const statementColumns = visibleAccountingColumns('statements');
    const statementGridTemplate = statementColumns.map((column) => {
      if (column.key === 'reference') return '1.25fr';
      if (column.key === 'type' || column.key === 'note') return '1fr';
      return '0.8fr';
    }).join(' ');
    return (
      <div className="statement-row-list">
        <div className="statement-row statement-row-heading" style={{ '--statement-grid-template': statementGridTemplate, gridTemplateColumns: statementGridTemplate }}>
          {statementColumns.map((column) => <strong key={column.key}>{column.label}</strong>)}
        </div>
        {rows.map((entry) => {
          const isExpanded = !collapsedEntryIds.includes(String(entry.id));
          const hasItems = (entry.items || []).length > 0;
          const statementCellByKey = {
            type: <strong data-label="النوع">{typeLabel(entry)}</strong>,
            date: <span data-label="التاريخ">{String(entry.date || '').slice(0, 10)}</span>,
            amount: <span data-label="المبلغ">{formatMoney(entry.amount)}</span>,
            total_sales: <span data-label="إجمالي البيع">{entry.items?.length ? formatMoney(entry.total_sales) : '-'}</span>,
            purchase_total: <span data-label="إجمالي الشراء">{entry.items?.length ? formatMoney(entry.purchase_total) : '-'}</span>,
            net_profit: <span data-label="صافي الربح">{entry.items?.length ? formatMoney(entry.net_profit) : '-'}</span>,
            balance: <span data-label="الرصيد">{formatMoney(entry.running_balance)}</span>,
            reference: <span data-label="المرجع">{referenceRenderer(entry, { isExpanded, hasItems })}</span>,
            note: <span data-label="ملاحظة">{entry.note || '-'}</span>
          };
          return (
            <React.Fragment key={entry.id}>
              <div className="statement-row statement-row-main" style={{ '--statement-grid-template': statementGridTemplate, gridTemplateColumns: statementGridTemplate }}>
                {statementColumns.map((column) => (
                  <React.Fragment key={column.key}>{statementCellByKey[column.key]}</React.Fragment>
                ))}
              </div>
              {isExpanded && hasItems && (
                <>
                  <div className="statement-row statement-row-item statement-row-item-heading">
                    <strong>النوع</strong>
                    <strong>الصنف</strong>
                    <strong>الكمية</strong>
                    <strong>سعر البيع</strong>
                    <strong>سعر الشراء</strong>
                    <strong>صافي الربح</strong>
                  </div>
                  {(entry.items || []).map((item, index) => (
                    <div className="statement-row statement-row-item" key={`${entry.id}-${item.product_id || item.product_name || index}`}>
                      <span data-label="النوع">الصنف</span>
                      <span data-label="الصنف">{item.product_name || '-'}</span>
                      <span data-label="الكمية">{item.quantity || 0}</span>
                      <span data-label="سعر البيع">{formatMoney(item.unit_price)}</span>
                      <span data-label="سعر الشراء">{formatMoney(item.purchase_price)}</span>
                      <span data-label="صافي الربح">{formatMoney(item.profit_total)}</span>
                    </div>
                  ))}
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };
  const renderCustomerOrderRows = (rows = [], emptyText, contextKey = '') => {
    if (!rows.length) return <p className="muted">{emptyText}</p>;
    return (
      <div className="statement-row-list">
        <div className="statement-row customer-order-row statement-row-heading">
          <strong>الطلب</strong>
          <strong>التاريخ</strong>
          <strong>المنتج</strong>
          <strong>الكمية</strong>
          <strong>سعر البيع</strong>
          <strong>سعر الشراء</strong>
          <strong>إجمالي البيع</strong>
          <strong>إجمالي الشراء</strong>
          <strong>الخصم</strong>
          <strong>صافي الربح</strong>
        </div>
        {rows.map((entry, index) => (
          <div className="statement-row customer-order-row" key={`${entry.order_id}-${entry.product_id || 'item'}-${index}`}>
            <span data-label="الطلب"><button type="button" className="link-button" onClick={() => openLinkedOrder(entry.order_id, contextKey)}>{isLinkedOrderOpenFor(entry.order_id, contextKey) ? 'إخفاء التفاصيل' : `#${entry.order_id}`}</button></span>
            <span data-label="التاريخ">{String(entry.created_at || '').slice(0, 10)}</span>
            <span data-label="المنتج">{entry.product_name || '-'}</span>
            <span data-label="الكمية">{entry.quantity || 0}</span>
            <span data-label="سعر البيع">{formatMoney(entry.unit_price)}</span>
            <span data-label="سعر الشراء">{formatMoney(entry.purchase_price)}</span>
            <span data-label="إجمالي البيع">{formatMoney(entry.line_total)}</span>
            <span data-label="إجمالي الشراء">{formatMoney(entry.purchase_total)}</span>
            <span data-label="الخصم">{formatMoney(entry.discount_amount)}</span>
            <span data-label="صافي الربح">{formatMoney(entry.profit_total)}</span>
          </div>
        ))}
      </div>
    );
  };
  const renderSupplierInvoiceRows = (invoiceData) => {
    const rows = invoiceData?.rows || [];
    return (
      <div className="statement-row-list">
        <div className="statement-row supplier-invoice-row statement-row-heading">
          <strong>رقم الطلب</strong>
          <strong>التاريخ</strong>
          <strong>العميل</strong>
          <strong>المنتج</strong>
          <strong>الكمية</strong>
          <strong>سعر البيع</strong>
          <strong>سعر الشراء</strong>
          <strong>إجمالي الربح</strong>
          <strong>إجمالي الشراء</strong>
        </div>
        {rows.map((row) => (
          <div className="statement-row supplier-invoice-row" key={row.order_item_id || `${row.order_id}-${row.product_id}`}>
            <span data-label="رقم الطلب">#{row.order_id}</span>
            <span data-label="التاريخ">{String(row.created_at || '').slice(0, 10)}</span>
            <span data-label="العميل">{row.customer_name || '-'}</span>
            <span data-label="المنتج">{row.product_name || '-'}</span>
            <span data-label="الكمية">{row.quantity || 0}</span>
            <span data-label="سعر البيع">{formatMoney(row.unit_price)}</span>
            <span data-label="سعر الشراء">{formatMoney(row.purchase_price)}</span>
            <span data-label="إجمالي الربح">{formatMoney(row.profit_total)}</span>
            <span data-label="إجمالي الشراء">{formatMoney(row.purchase_total)}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="muted statement-empty-row">لا توجد تفاصيل طلب مرتبطة بهذا المرجع</p>}
      </div>
    );
  };
  const renderLinkedOrderRows = (orderData) => {
    const rows = orderData?.items || [];
    return (
      <div className="statement-row-list">
        <div className="statement-row linked-order-row statement-row-item-heading">
          <strong>النوع</strong>
          <strong>الصنف</strong>
          <strong>الكمية</strong>
          <strong>سعر البيع</strong>
          <strong>سعر الشراء</strong>
          <strong>صافي الربح</strong>
        </div>
        {rows.map((item) => (
          <div className="statement-row linked-order-row" key={item.id || `${item.product_id}-${item.product_name}`}>
            <span data-label="النوع">الصنف</span>
            <span data-label="الصنف">{item.product_name || '-'}</span>
            <span data-label="الكمية">{item.quantity || 0}</span>
            <span data-label="سعر البيع">{formatMoney(item.unit_price)}</span>
            <span data-label="سعر الشراء">{formatMoney(item.purchase_price)}</span>
            <span data-label="صافي الربح">{formatMoney(item.profit_total)}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="muted statement-empty-row">لا توجد منتجات لهذا الطلب</p>}
      </div>
    );
  };
  const isLinkedOrderOpenFor = (orderId, contextKey = '') => (
    Number(linkedOrderPreview?.order?.id) === Number(orderId)
    && String(linkedOrderContextKey || '') === String(contextKey || '')
  );
  const statementHasLinkedOrder = (rows = [], contextKey = '') => rows.some((row) => Number(row.order_id) === Number(linkedOrderPreview?.order?.id)) && (!contextKey || String(linkedOrderContextKey || '') === String(contextKey));
  const renderLinkedOrderSection = () => {
    if (!linkedOrderPreview) return null;
    return (
      <div className="inline-statement-section">
        {renderLinkedOrderRows(linkedOrderPreview)}
      </div>
    );
  };
  const toggleStatementEntryDetails = (entryId) => {
    const key = String(entryId || '');
    if (!key) return;
    setCollapsedStatementEntryIds((current) => (
      current.map((id) => String(id)).includes(key)
        ? current.filter((id) => String(id) !== key)
        : [...current, key]
    ));
  };
  const updateReportFilters = (patch, options = {}) => {
    const nextFilters = { ...reportFilters, ...patch };
    setReportFilters(nextFilters);
    setSupplierStatement(null);
    setSupplierInvoice(null);
    setClientStatement(null);
    setCustomerStatement(null);
    setCollapsedStatementEntryIds([]);
    setLinkedOrderPreview(null);
    setLinkedOrderContextKey('');
    if (options.clearSearchKey) setAccountingSearchValue(options.clearSearchKey, '');
    loadReports(nextFilters);
  };

  const supplierUnifiedRows = useMemo(() => {
    const reportBySupplierId = new Map(supplierReport.rows.map((row) => [String(row.supplier_id), row]));
    const supplierById = new Map(suppliers.map((supplier) => [String(supplier.id), supplier]));
    const rows = suppliers.map((supplier) => {
      const reportRow = reportBySupplierId.get(String(supplier.id)) || {};
      return {
        ...reportRow,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        contact_info: supplier.contact_info,
        products_count: reportRow.products_count ?? supplier.product_count ?? 0,
        current_outstanding_balance: reportRow.current_outstanding_balance ?? supplier.account_balance ?? 0,
        supplier
      };
    });
    supplierReport.rows.forEach((reportRow) => {
      if (!supplierById.has(String(reportRow.supplier_id))) rows.push({ ...reportRow, supplier_id: reportRow.supplier_id });
    });
    return rows.filter((row) => (
      (!reportFilters.supplier_id || String(row.supplier_id) === String(reportFilters.supplier_id))
      && matchesSearch(accountingSearch.suppliers, [row.supplier_name, row.contact_info, row.supplier_id, row.order_refs, row.product_names])
      && matchesBalanceFilter(row.current_outstanding_balance, accountingFilters.supplierBalance)
    ));
  }, [accountingFilters.supplierBalance, accountingSearch.suppliers, reportFilters.supplier_id, supplierReport.rows, suppliers]);

  const clientUnifiedRows = useMemo(() => {
    const reportByClientId = new Map(clientReport.rows.map((row) => [String(row.client_id), row]));
    const customerByClientId = new Map(
      customerReport.rows
        .filter((row) => row.client_id)
        .map((row) => [String(row.client_id), row])
    );
    const rows = clients.map((client) => {
      const reportRow = reportByClientId.get(String(client.id)) || {};
      const customerRow = customerByClientId.get(String(client.id)) || {};
      const sourceType = String(client.source || reportRow.source || customerRow.client_source || 'manual').trim();
      const type = sourceType === 'store' ? 'store' : (sourceType === 'mixed' ? 'mixed' : 'manual');
      return {
        type,
        key: `manual-${client.id}`,
        client_id: client.id,
        client_name: client.name,
        phone: client.phone,
        email: client.email,
        contact_info: client.contact_info,
        orders_count: reportRow.orders_count ?? customerRow.orders_count ?? client.orders_count ?? 0,
        total_sales: reportRow.total_sales ?? customerRow.net_sales ?? 0,
        total_receipts: reportRow.total_receipts ?? 0,
        net_movement: reportRow.net_movement ?? 0,
        net_profit: reportRow.net_profit ?? customerRow.net_profit ?? 0,
        purchase_total: reportRow.purchase_total ?? customerRow.purchase_total ?? 0,
        current_outstanding_balance: reportRow.current_outstanding_balance ?? customerRow.manual_client_balance ?? client.account_balance ?? 0,
        items_quantity: customerRow.items_quantity ?? 0,
        gross_sales: customerRow.gross_sales ?? 0,
        discounts_total: customerRow.discounts_total ?? 0,
        net_sales: customerRow.net_sales ?? reportRow.total_sales ?? 0,
        last_order_at: customerRow.last_order_at,
        order_refs: [reportRow.order_refs, customerRow.order_refs].filter(Boolean).join(' '),
        product_names: [reportRow.product_names, customerRow.product_names].filter(Boolean).join('، '),
        customer_key: customerRow.customer_key,
        customerRow,
        client
      };
    });
    customerReport.rows.forEach((customerRow) => {
      if (customerRow.client_id) return;
      rows.push({
        type: 'store',
        key: `store-${customerRow.customer_key}`,
        client_id: null,
        client_name: customerRow.customer_name,
        phone: customerRow.customer_phone,
        email: customerRow.customer_email,
        contact_info: '',
        orders_count: customerRow.orders_count || 0,
        total_sales: customerRow.net_sales || 0,
        total_receipts: customerRow.discounts_total || 0,
        net_movement: customerRow.net_sales || 0,
        net_profit: customerRow.net_profit || 0,
        purchase_total: customerRow.purchase_total || 0,
        current_outstanding_balance: null,
        items_quantity: customerRow.items_quantity || 0,
        gross_sales: customerRow.gross_sales || 0,
        discounts_total: customerRow.discounts_total || 0,
        net_sales: customerRow.net_sales || 0,
        last_order_at: customerRow.last_order_at,
        order_refs: customerRow.order_refs,
        product_names: customerRow.product_names,
        customer_key: customerRow.customer_key,
        customerRow
      });
    });
    return rows.filter((row) => (
      (!reportFilters.client_id || String(row.client_id) === String(reportFilters.client_id))
      && (!reportFilters.client_type || reportFilters.client_type === 'all' || (reportFilters.client_type === 'manual' ? row.type === 'manual' || row.type === 'mixed' : row.type === 'store' || row.type === 'mixed'))
      && matchesSearch(accountingSearch.clients, [row.client_name, row.phone, row.email, row.contact_info, row.client_id, row.customer_key, row.order_refs, row.product_names])
      && matchesBalanceFilter(row.type === 'store' ? null : row.current_outstanding_balance, accountingFilters.clientBalance)
    ));
  }, [accountingFilters.clientBalance, accountingSearch.clients, clientReport.rows, clients, customerReport.rows, reportFilters.client_id, reportFilters.client_type]);

  const voucherUnifiedRows = useMemo(() => {
    const rows = [
      ...journalEntries.map((entry) => ({ ...entry, voucherScope: 'supplier', key: `supplier-${entry.id}`, accountName: entry.supplier_name, accountKey: `supplier:${entry.supplier_id}` })),
      ...clientJournalEntries.map((entry) => ({ ...entry, voucherScope: 'client', key: `client-${entry.id}`, accountName: entry.client_name, accountKey: `client:${entry.client_id}` }))
    ];
    return rows
      .filter((entry) => (
        (!accountingFilters.voucherScope || entry.voucherScope === accountingFilters.voucherScope)
        && (!accountingFilters.voucherAccountKey || entry.accountKey === accountingFilters.voucherAccountKey)
        && (!accountingFilters.voucherType || entry.transaction_type === accountingFilters.voucherType)
        && matchesSearch(accountingSearch.vouchers, [entry.id, entry.accountName, entry.reference_doc, entry.note, entry.order_id, entry.product_names, entry.amount, entry.date])
      ))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 40);
  }, [accountingFilters.voucherAccountKey, accountingFilters.voucherScope, accountingFilters.voucherType, accountingSearch.vouchers, clientJournalEntries, journalEntries]);
  const getVoucherDetailKind = (entry) => {
    if (entry?.voucherScope === 'supplier' && entry?.transaction_type === 'credit' && entry?.supplier_id) return 'supplier_invoice';
    if (getEntryOrderId(entry)) return 'linked_order';
    return '';
  };
  const getVoucherDetailKey = (entry) => {
    const kind = getVoucherDetailKind(entry);
    return kind ? `${kind}:${entry.key}` : '';
  };
  const toggleVoucherDetail = (entry) => {
    const key = getVoucherDetailKey(entry);
    if (!key) return;
    setVoucherCollapsedDetailKeys((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  };
  const retryVoucherDetail = (entry) => {
    const key = getVoucherDetailKey(entry);
    if (!key) return;
    setVoucherCollapsedDetailKeys((current) => current.filter((item) => item !== key));
    setVoucherDetailCache((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  useEffect(() => {
    if (accountingTab !== 'vouchers') return;
    const activeDetailLoads = Object.values(voucherDetailCache).filter((state) => state?.loading).length;
    const availableDetailSlots = Math.max(0, 4 - activeDetailLoads);
    if (availableDetailSlots === 0) return;
    const entriesToLoad = voucherUnifiedRows.filter((entry) => {
      const key = getVoucherDetailKey(entry);
      return key && !voucherCollapsedDetailKeys.includes(key) && !voucherDetailCache[key];
    }).slice(0, availableDetailSlots);
    if (!entriesToLoad.length) return;
    setVoucherDetailCache((current) => {
      const next = { ...current };
      entriesToLoad.forEach((entry) => {
        const key = getVoucherDetailKey(entry);
        if (key && !next[key]) next[key] = { loading: true };
      });
      return next;
    });
    entriesToLoad.forEach(async (entry) => {
      const key = getVoucherDetailKey(entry);
      if (!key) return;
      try {
        const kind = getVoucherDetailKind(entry);
        const detailRequest = kind === 'supplier_invoice'
          ? apiGet(`/admin/suppliers/${entry.supplier_id}/purchase-invoices/${entry.id}`)
          : apiGet(`/admin/orders/${getEntryOrderId(entry)}`);
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('انتهت مهلة تحميل التفاصيل')), 12000);
        });
        const data = await Promise.race([detailRequest, timeout]);
        setVoucherDetailCache((current) => {
          if (!current[key]?.loading) return current;
          return { ...current, [key]: { loading: false, data } };
        });
      } catch (err) {
        setVoucherDetailCache((current) => {
          if (!current[key]?.loading) return current;
          return { ...current, [key]: { loading: false, error: err.message || 'فشل تحميل التفاصيل' } };
        });
      }
    });
  }, [accountingTab, voucherUnifiedRows, voucherCollapsedDetailKeys, voucherDetailCache]);
  const filteredClientJournalClients = useMemo(() => (
    clients.filter((client) => matchesSearch(clientJournalClientSearch, [
      client.name,
      client.phone,
      client.email,
      client.contact_info,
      client.address_line1,
      client.city
    ]))
  ), [clientJournalClientSearch, clients]);
  const filteredJournalSuppliers = useMemo(() => (
    suppliers.filter((supplier) => matchesSearch(journalSupplierSearch, [
      supplier.name,
      supplier.contact_info,
      supplier.phone,
      supplier.email
    ]))
  ), [journalSupplierSearch, suppliers]);
  const applyJournalSupplier = (supplier) => {
    setJournalForm((current) => ({ ...current, supplier_id: supplier.id }));
    setJournalSupplierSearch(supplier.name || '');
    setJournalSupplierPickerOpen(false);
  };
  const applyClientJournalClient = (client) => {
    setClientJournalForm((current) => ({ ...current, client_id: client.id }));
    setClientJournalClientSearch(client.name || '');
    setClientJournalClientPickerOpen(false);
  };

  const buildReportQuery = (filters = reportFilters) => {
    const params = new URLSearchParams();
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.supplier_id) params.set('supplier_id', filters.supplier_id);
    if (filters.client_id) params.set('client_id', filters.client_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.balance_filter) params.set('balance_filter', filters.balance_filter);
    if (filters.client_type && filters.client_type !== 'all') params.set('client_type', filters.client_type);
    const query = params.toString();
    return query ? `?${query}` : '';
  };

  const toDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyDatePreset = async (preset) => {
    const now = new Date();
    const nextFilters = { ...reportFilters };
    if (preset === 'today') {
      const today = toDateInputValue(now);
      nextFilters.date_from = today;
      nextFilters.date_to = today;
    } else if (preset === 'month') {
      nextFilters.date_from = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
      nextFilters.date_to = toDateInputValue(now);
    } else if (preset === 'year') {
      nextFilters.date_from = toDateInputValue(new Date(now.getFullYear(), 0, 1));
      nextFilters.date_to = toDateInputValue(now);
    } else {
      nextFilters.date_from = '';
      nextFilters.date_to = '';
    }
    setReportFilters(nextFilters);
    setSupplierStatement(null);
    setSupplierInvoice(null);
    setClientStatement(null);
    setCustomerStatement(null);
    await loadReports(nextFilters);
  };

  const downloadReport = async (path, format, filters = reportFilters) => {
    try {
      setLocalError('');
      const url = new URL(`${API_BASE}${path}`, window.location.origin);
      url.searchParams.set('format', format);
      if (filters.date_from) url.searchParams.set('date_from', filters.date_from);
      if (filters.date_to) url.searchParams.set('date_to', filters.date_to);
      if (filters.supplier_id) url.searchParams.set('supplier_id', filters.supplier_id);
      if (filters.client_id) url.searchParams.set('client_id', filters.client_id);
      if (filters.status) url.searchParams.set('status', filters.status);
      if (filters.balance_filter) url.searchParams.set('balance_filter', filters.balance_filter);
      if (filters.client_type && filters.client_type !== 'all') url.searchParams.set('client_type', filters.client_type);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) {
        let message = 'فشل تصدير التقرير';
        try {
          const data = await res.json();
          message = data?.error || message;
        } catch {
          // keep default message
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `report.${format}`;
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setLocalError(err.message || 'فشل تصدير التقرير');
    }
  };

  const loadReports = async (filters = reportFilters) => {
    setReportLoading(true);
    try {
      const supplierQuery = buildReportQuery(filters);
      const clientQuery = buildReportQuery(filters);
      const customerParams = new URLSearchParams();
      if (filters.date_from) customerParams.set('date_from', filters.date_from);
      if (filters.date_to) customerParams.set('date_to', filters.date_to);
      customerParams.set('status', 'delivered');
      if (filters.client_type && filters.client_type !== 'all') customerParams.set('client_type', filters.client_type);
      const customerQuery = customerParams.toString() ? `?${customerParams.toString()}` : '';
      const [supplierRows, clientRows, customerRows] = await Promise.all([
        apiGet(`/admin/purchasing/reports/suppliers${supplierQuery}`),
        apiGet(`/admin/purchasing/reports/clients${clientQuery}`),
        apiGet(`/admin/purchasing/reports/customers${customerQuery}`)
      ]);
      setSupplierReport({ summary: supplierRows?.summary || {}, rows: Array.isArray(supplierRows?.rows) ? supplierRows.rows : [] });
      setClientReport({ summary: clientRows?.summary || {}, rows: Array.isArray(clientRows?.rows) ? clientRows.rows : [] });
      setCustomerReport({ summary: customerRows?.summary || {}, rows: Array.isArray(customerRows?.rows) ? customerRows.rows : [] });
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل التقارير');
    } finally {
      setReportLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [supplierRows, clientRows, orderRows, journalRows, clientJournalRows, supplierReportRows, clientReportRows, customerReportRows] = await Promise.all([
        apiGet('/admin/suppliers'),
        apiGet('/admin/clients'),
        apiGet('/admin/purchasing/orders'),
        apiGet('/admin/journal-entries'),
        apiGet('/admin/client-journal-entries'),
        apiGet('/admin/purchasing/reports/suppliers'),
        apiGet('/admin/purchasing/reports/clients'),
        apiGet('/admin/purchasing/reports/customers?status=delivered')
      ]);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
      setClients(Array.isArray(clientRows) ? clientRows : []);
      setOrders(Array.isArray(orderRows) ? orderRows : []);
      setJournalEntries(Array.isArray(journalRows) ? journalRows : []);
      setClientJournalEntries(Array.isArray(clientJournalRows) ? clientJournalRows : []);
      setSupplierReport({ summary: supplierReportRows?.summary || {}, rows: Array.isArray(supplierReportRows?.rows) ? supplierReportRows.rows : [] });
      setClientReport({ summary: clientReportRows?.summary || {}, rows: Array.isArray(clientReportRows?.rows) ? clientReportRows.rows : [] });
      setCustomerReport({ summary: customerReportRows?.summary || {}, rows: Array.isArray(customerReportRows?.rows) ? customerReportRows.rows : [] });
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل بيانات المشتريات');
      if (setError) setError(err.message || 'فشل تحميل بيانات المشتريات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetSupplierForm = () => setSupplierForm({ id: null, name: '', contact_info: '', email: '', phone: '', address_line1: '', city: '', state: '', country: 'فلسطين' });
  const openCreateSupplierDialog = async () => {
    resetSupplierForm();
    await ensureOrderCitiesLoaded();
    setSupplierDialogOpen(true);
  };
  const resetClientForm = () => setClientForm({ id: null, name: '', contact_info: '', email: '', phone: '', address_line1: '', city: '', state: '', country: 'فلسطين' });
  const ensureOrderCitiesLoaded = async () => {
    if (clientCities.length > 0) return;
    try {
      const rows = await apiGet('/admin/cities');
      setClientCities(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل المدن');
    }
  };

  const openCreateClientDialog = async () => {
    resetClientForm();
    await ensureOrderCitiesLoaded();
    setClientDialogOpen(true);
  };

  const saveSupplier = async (event) => {
    event.preventDefault();
    if (!supplierForm.name.trim()) {
      setLocalError('اسم المورد مطلوب');
      return;
    }
    try {
      setLocalError('');
      const payload = {
        name: supplierForm.name.trim(),
        contact_info: supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        phone: supplierForm.phone.trim(),
        address_line1: supplierForm.address_line1.trim(),
        city: supplierForm.city.trim(),
        state: supplierForm.state.trim(),
        country: supplierForm.country.trim() || 'فلسطين'
      };
      if (supplierForm.id) await apiPut(`/admin/suppliers/${supplierForm.id}`, payload);
      else await apiPost('/admin/suppliers', payload);
      resetSupplierForm();
      setSupplierDialogOpen(false);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const editSupplier = (supplier) => {
    ensureOrderCitiesLoaded();
    setSupplierForm({
      id: supplier.id,
      name: supplier.name || '',
      contact_info: supplier.phone || (formatContactInfo(supplier.contact_info) === '-' ? '' : formatContactInfo(supplier.contact_info)),
      email: supplier.email || '',
      phone: supplier.phone || '',
      address_line1: supplier.address_line1 || '',
      city: supplier.city || '',
      state: supplier.state || '',
      country: supplier.country || 'فلسطين'
    });
    setSupplierDialogOpen(true);
  };

  const deleteSupplier = async (supplierId) => {
    if (!confirm('حذف المورد؟ سيتم إزالة ربطه من المنتجات وحذف قيوده.')) return;
    try {
      await apiDelete(`/admin/suppliers/${supplierId}`);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const saveClient = async (event) => {
    event.preventDefault();
    if (!clientForm.name.trim()) {
      setLocalError('اسم العميل مطلوب');
      return;
    }
    try {
      setLocalError('');
      const payload = {
        name: clientForm.name.trim(),
        contact_info: clientForm.contact_info.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim(),
        address_line1: clientForm.address_line1.trim(),
        city: clientForm.city.trim(),
        state: clientForm.state.trim(),
        country: clientForm.country.trim() || 'فلسطين'
      };
      if (clientForm.id) await apiPut(`/admin/clients/${clientForm.id}`, payload);
      else await apiPost('/admin/clients', payload);
      resetClientForm();
      setClientDialogOpen(false);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const editClient = async (client) => {
    setClientForm({
      id: client.id,
      name: client.name || '',
      contact_info: formatContactInfo(client.contact_info) === '-' ? '' : formatContactInfo(client.contact_info),
      email: client.email || '',
      phone: client.phone || '',
      address_line1: client.address_line1 || '',
      city: client.city || '',
      state: client.state || '',
      country: client.country || 'فلسطين'
    });
    await ensureOrderCitiesLoaded();
    setClientDialogOpen(true);
  };

  const deleteClient = async (clientId) => {
    if (!confirm('حذف العميل؟ سيتم حذف قيوده المحاسبية وفصل طلباته عنه.')) return;
    try {
      await apiDelete(`/admin/clients/${clientId}`);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const createJournalEntry = async (event) => {
    event.preventDefault();
    if (journalSaving) return;
    try {
      setLocalError('');
      if (!journalForm.supplier_id) {
        setLocalError('اختر المورد من نتائج البحث');
        return;
      }
      setJournalSaving(true);
      await apiPost('/admin/journal-entries', {
        supplier_id: Number(journalForm.supplier_id),
        transaction_type: journalForm.transaction_type,
        voucher_type: journalForm.voucher_type,
        amount: Number(journalForm.amount),
        reference_doc: journalForm.reference_doc,
        note: journalForm.note,
        date: journalForm.date
      }, { headers: getIdempotencyHeaders(journalIdempotencyKeyRef, 'admin-journal') });
      journalIdempotencyKeyRef.current = null;
      setJournalForm({ supplier_id: '', transaction_type: 'credit', voucher_type: 'purchase_invoice', amount: '', reference_doc: '', note: '', date: new Date().toISOString().slice(0, 10) });
      setJournalSupplierSearch('');
      setJournalDialogOpen(false);
      load();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setJournalSaving(false);
    }
  };

  const createClientJournalEntry = async (event) => {
    event.preventDefault();
    if (clientJournalSaving) return;
    try {
      setLocalError('');
      if (!clientJournalForm.client_id) {
        setLocalError('اختر العميل من نتائج البحث');
        return;
      }
      setClientJournalSaving(true);
      await apiPost('/admin/client-journal-entries', {
        client_id: Number(clientJournalForm.client_id),
        transaction_type: clientJournalForm.transaction_type,
        voucher_type: clientJournalForm.voucher_type,
        amount: Number(clientJournalForm.amount),
        reference_doc: clientJournalForm.reference_doc,
        note: clientJournalForm.note,
        date: clientJournalForm.date
      }, { headers: getIdempotencyHeaders(clientJournalIdempotencyKeyRef, 'admin-client-journal') });
      clientJournalIdempotencyKeyRef.current = null;
      setClientJournalForm({ client_id: '', transaction_type: 'debit', voucher_type: 'sales_invoice', amount: '', reference_doc: '', note: '', date: new Date().toISOString().slice(0, 10) });
      setClientJournalClientSearch('');
      setClientJournalDialogOpen(false);
      load();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setClientJournalSaving(false);
    }
  };

  const showSupplierStatement = async (supplierId) => {
    try {
      setLocalError('');
      if (Number(supplierStatement?.supplier?.id) === Number(supplierId)) {
        setSupplierStatement(null);
        setSupplierInvoice(null);
        setCollapsedStatementEntryIds([]);
        setLinkedOrderPreview(null);
        setLinkedOrderContextKey('');
        return;
      }
      const query = buildReportQuery({ ...reportFilters, supplier_id: '', status: '' });
      const result = await apiGet(`/admin/purchasing/reports/suppliers/${supplierId}/statement${query}`);
      setSupplierStatement(result);
      setSupplierInvoice(null);
      setCollapsedStatementEntryIds([]);
      setLinkedOrderPreview(null);
      setLinkedOrderContextKey('');
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل كشف المورد');
    }
  };

  const openSupplierInvoice = async (entry, supplierIdOverride) => {
    const supplierId = supplierIdOverride || supplierStatement?.supplier?.id || entry?.supplier_id;
    if (!supplierId || !entry?.id) return;
    try {
      setLocalError('');
      if (Number(supplierInvoice?.invoice?.id) === Number(entry.id) && Number(supplierInvoice?.invoice?.supplier_id) === Number(supplierId)) {
        setSupplierInvoice(null);
        return;
      }
      const result = await apiGet(`/admin/suppliers/${supplierId}/purchase-invoices/${entry.id}`);
      setSupplierInvoice(result);
      setLinkedOrderPreview(null);
      setLinkedOrderContextKey('');
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل تفاصيل فاتورة الشراء');
    }
  };

  const exportSupplierStatement = async (format) => {
    const supplierId = supplierStatement?.supplier?.id;
    if (!supplierId) return;
    await downloadReport(`/admin/purchasing/reports/suppliers/${supplierId}/statement/export`, format, {
      date_from: reportFilters.date_from,
      date_to: reportFilters.date_to,
      supplier_id: '',
      status: ''
    });
  };

  const showClientStatement = async (clientId) => {
    try {
      setLocalError('');
      if (Number(clientStatement?.client?.id) === Number(clientId)) {
        setClientStatement(null);
        setCollapsedStatementEntryIds([]);
        setLinkedOrderPreview(null);
        setLinkedOrderContextKey('');
        return;
      }
      const query = buildReportQuery({ ...reportFilters, client_id: '', supplier_id: '', status: '' });
      const result = await apiGet(`/admin/purchasing/reports/clients/${clientId}/statement${query}`);
      setClientStatement(result);
      setCollapsedStatementEntryIds([]);
      setLinkedOrderPreview(null);
      setLinkedOrderContextKey('');
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل كشف العميل');
    }
  };

  const exportClientStatement = async (format) => {
    const clientId = clientStatement?.client?.id;
    if (!clientId) return;
    await downloadReport(`/admin/purchasing/reports/clients/${clientId}/statement/export`, format, {
      date_from: reportFilters.date_from,
      date_to: reportFilters.date_to,
      client_id: '',
      supplier_id: '',
      status: ''
    });
  };

  const openLinkedOrder = async (orderId, contextKey = '') => {
    if (!orderId) return;
    try {
      setLocalError('');
      if (isLinkedOrderOpenFor(orderId, contextKey)) {
        setLinkedOrderPreview(null);
        setLinkedOrderContextKey('');
        return;
      }
      const result = await apiGet(`/admin/orders/${orderId}`);
      setLinkedOrderPreview(result);
      setLinkedOrderContextKey(contextKey);
      setSupplierInvoice(null);
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل تفاصيل الطلب');
    }
  };

  const showCustomerStatement = async (row) => {
    const customerKey = String(row?.customer_key || '').trim();
    if (!customerKey) return;
    try {
      setLocalError('');
      if (customerStatement?.customer?.customer_key === customerKey) {
        setCustomerStatement(null);
        setLinkedOrderPreview(null);
        setLinkedOrderContextKey('');
        return;
      }
      const query = buildReportQuery({
        date_from: reportFilters.date_from,
        date_to: reportFilters.date_to,
        supplier_id: '',
        status: 'delivered'
      });
      const result = await apiGet(`/admin/purchasing/reports/customers/${encodeURIComponent(customerKey)}/orders${query}`);
      setCustomerStatement({ customer: row, ...result });
      setLinkedOrderPreview(null);
      setLinkedOrderContextKey('');
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل كشف العميل');
    }
  };

  const accountingTabs = [
    { key: 'suppliers', label: 'الموردين' },
    { key: 'clients', label: 'العملاء' },
    { key: 'vouchers', label: 'السندات' }
  ];

  const switchAccountingTab = (tabKey) => {
    setAccountingTab(tabKey);
    setSupplierStatement(null);
    setClientStatement(null);
    setCustomerStatement(null);
    setSupplierInvoice(null);
    setLinkedOrderPreview(null);
    setLinkedOrderContextKey('');
  };

  const renderAccountingTabButton = (tab) => (
    <button
      key={tab.key}
      type="button"
      className={accountingTab === tab.key ? 'active' : ''}
      aria-selected={accountingTab === tab.key}
      data-accounting-tab={tab.key}
      onPointerDown={(event) => {
        event.preventDefault();
        switchAccountingTab(tab.key);
      }}
      onClick={(event) => {
        event.preventDefault();
        switchAccountingTab(tab.key);
      }}
    >
      {tab.label}
    </button>
  );

  const renderDetailGrid = (items, emptyMessage, renderItem) => (
    <div className="inline-detail-grid">
      {items.length === 0 && <p className="muted">{emptyMessage}</p>}
      {items.map(renderItem)}
    </div>
  );

  if (loading) return <section className="card"><p>جارٍ تحميل المشتريات والمحاسبة...</p></section>;

  return (
    <div className="grid single">
      <section className="card accounting-header">
        <div className="card-header">
          <div>
            <h2>المشتريات والمحاسبة</h2>
            <p className="muted">ثلاثة تبويبات رئيسية، وكل تبويب يعرض جدولاً موحداً يجمع بياناته الأساسية وتقاريره.</p>
          </div>
        </div>
        {localError && <div className="error">{localError}</div>}
        <div className="accounting-tabs" role="tablist" aria-label="أقسام المشتريات والمحاسبة">
          {accountingTabs.map(renderAccountingTabButton)}
        </div>
      </section>

      {accountingTab === 'suppliers' && <section className="card unified-accounting-card">
        <div className="card-header">
          <div>
            <h2>الموردون</h2>
            <p className="muted">جدول واحد يجمع بيانات الموردين مع أرقام تقارير المشتريات والدفعات.</p>
          </div>
          <div className="row">
            {canCreate && <button type="button" onClick={openCreateSupplierDialog}>إضافة مورد</button>}
            <button type="button" className="secondary" onClick={() => downloadReport('/admin/suppliers/export', 'xlsx')}>تصدير Excel</button>
            <button type="button" className="secondary" onClick={() => downloadReport('/admin/purchasing/reports/suppliers/export', 'xlsx')}>تصدير تقرير الموردين</button>
            {renderAccountingColumnPicker('suppliers')}
            {renderAccountingColumnPicker('statements', 'أعمدة الكشف', 'statement-column-picker')}
          </div>
        </div>
        {supplierDialogOpen && (
          <div className="modal-backdrop">
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{supplierForm.id ? 'تعديل المورد' : 'إضافة مورد'}</h3>
                <button className="modal-close" type="button" onClick={() => setSupplierDialogOpen(false)}>×</button>
              </div>
              <form className="form" onSubmit={saveSupplier}>
                <div className="grid single">
                  <label>
                    <span>اسم المورد</span>
                    <input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required />
                  </label>
                  <label>
                    <span>الهاتف</span>
                    <input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value, contact_info: e.target.value })} />
                  </label>
                  <label>
                    <span>البريد</span>
                    <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                  </label>
                  <label>
                    <span>العنوان</span>
                    <input value={supplierForm.address_line1} onChange={(e) => setSupplierForm({ ...supplierForm, address_line1: e.target.value })} />
                  </label>
                  <label>
                    <span>المدينة</span>
                    <select value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}>
                      <option value="">اختر المدينة</option>
                      {clientCities.map((city) => (
                        <option key={city.id || city.name} value={city.name}>{city.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>المنطقة/المحافظة</span>
                    <input value={supplierForm.state} onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value })} />
                  </label>
                  <label>
                    <span>الدولة</span>
                    <input value={supplierForm.country} onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })} />
                  </label>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary" onClick={() => setSupplierDialogOpen(false)}>إلغاء</button>
                  <button type="submit">{supplierForm.id ? 'تحديث المورد' : 'إضافة مورد'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {renderAccountingFilterToggle('suppliers')}
        <div className={`report-filters mobile-filter-panel ${accountingFilterPanelsOpen.suppliers ? 'open' : ''}`}>
          {renderSearchInput('suppliers', 'بحث عن مورد أو فاتورة أو صنف منتج')}
          <input type="date" value={reportFilters.date_from} onChange={(e) => updateReportFilters({ date_from: e.target.value })} />
          <input type="date" value={reportFilters.date_to} onChange={(e) => updateReportFilters({ date_to: e.target.value })} />
          <select value={reportFilters.supplier_id} onChange={(e) => updateReportFilters({ supplier_id: e.target.value })}>
            <option value="">كل الموردين</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select value={accountingFilters.supplierBalance} onChange={(e) => setAccountingFilterValue('supplierBalance', e.target.value)}>
            <option value="">كل الأرصدة</option>
            <option value="outstanding">رصيد مستحق</option>
            <option value="settled">رصيد صفر</option>
            <option value="credit">رصيد دائن</option>
          </select>
          <button type="button" className="secondary" onClick={() => { setAccountingSearchValue('suppliers', ''); updateReportFilters({ date_from: '', date_to: '', supplier_id: '', balance_filter: '' }); setAccountingFilterValue('supplierBalance', ''); }}>مسح</button>
          <div className="report-actions filters-inline-actions">
            <button type="button" className="secondary" onClick={() => applyDatePreset('today')}>اليوم</button>
            <button type="button" className="secondary" onClick={() => applyDatePreset('month')}>هذا الشهر</button>
            <button type="button" className="secondary" onClick={() => applyDatePreset('year')}>هذه السنة</button>
            <button type="button" className={accountingFilters.supplierBalance === 'outstanding' ? '' : 'secondary'} onClick={() => setAccountingFilterValue('supplierBalance', accountingFilters.supplierBalance === 'outstanding' ? '' : 'outstanding')}>ذمم قائمة</button>
            <button type="button" className={accountingFilters.supplierBalance === 'settled' ? '' : 'secondary'} onClick={() => setAccountingFilterValue('supplierBalance', accountingFilters.supplierBalance === 'settled' ? '' : 'settled')}>حسابات مسددة</button>
            {reportLoading && <span className="muted">جارٍ تحديث التقارير...</span>}
          </div>
        </div>
        <ResponsiveTableWrap className="unified-table-wrap" minWidth={accountingTableMinWidth('suppliers')} ariaLabel="جدول الموردين">
          <table className="unified-accounting-table suppliers-accounting-table responsive-table-card">
          <thead><tr>{visibleAccountingColumns('suppliers').map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {supplierUnifiedRows.map((row) => {
              const supplierId = row.supplier_id;
              const isSupplierStatementOpen = Number(supplierStatement?.supplier?.id) === Number(supplierId);
              const supplierStatementContextKey = `supplier-statement:${supplierId}`;

              return (
                <React.Fragment key={supplierId}>
                  <tr>
                    {isAccountingColumnVisible('suppliers', 'supplier') && <td data-label="المورد"><span className="accounting-badge supplier">مورد</span> <span className="accounting-name">{row.supplier_name}</span></td>}
                    {isAccountingColumnVisible('suppliers', 'contact') && <td data-label="التواصل">{formatContactInfo(row.contact_info)}</td>}
                    {isAccountingColumnVisible('suppliers', 'products') && <td data-label="المنتجات">{row.products_count || 0}</td>}
                    {isAccountingColumnVisible('suppliers', 'total_sales') && <td data-label="إجمالي البيع">{formatMoney(row.total_sales)}</td>}
                    {isAccountingColumnVisible('suppliers', 'purchase_total') && <td data-label="إجمالي الشراء">{formatMoney(row.purchase_total || row.total_purchases)}</td>}
                    {isAccountingColumnVisible('suppliers', 'net_profit') && <td data-label="صافي الربح">{formatMoney(row.net_profit)}</td>}
                    {isAccountingColumnVisible('suppliers', 'payments') && <td data-label="الدفعات">{formatMoney(row.total_payments)}</td>}
                    {isAccountingColumnVisible('suppliers', 'net_movement') && <td data-label="صافي الحركة">{formatMoney(row.net_movement)}</td>}
                    {isAccountingColumnVisible('suppliers', 'balance') && <td data-label="الرصيد"><strong>{formatMoney(row.current_outstanding_balance)}</strong></td>}
                    {isAccountingColumnVisible('suppliers', 'statement') && <td data-label="كشف الحساب" className="responsive-actions-cell"><button type="button" className="secondary mobile-icon-button" data-icon="⌕" aria-label={isSupplierStatementOpen ? 'إخفاء الكشف' : 'عرض الكشف'} title={isSupplierStatementOpen ? 'إخفاء الكشف' : 'عرض الكشف'} onClick={() => showSupplierStatement(supplierId)}>{isSupplierStatementOpen ? 'إخفاء الكشف' : 'عرض الكشف'}</button></td>}
                    {isAccountingColumnVisible('suppliers', 'actions') && <td data-label="إجراءات" className="responsive-actions-cell">
                      {row.supplier && canUpdate && <button type="button" className="secondary mobile-icon-button" data-icon="✎" aria-label="تعديل" title="تعديل" onClick={() => editSupplier(row.supplier)}>تعديل</button>}
                      {row.supplier && canDelete && <button type="button" className="danger mobile-icon-button" data-icon="×" aria-label="حذف" title="حذف" onClick={() => deleteSupplier(supplierId)}>حذف</button>}
                    </td>}
                  </tr>
                  {isSupplierStatementOpen && (
                    <tr>
                      <td colSpan={accountingColSpan('suppliers')} className="responsive-detail-cell">
                        <div className="notice statement-panel">
                          <div className="card-header compact">
                            <div>
                              <h3>كشف حساب المورد: {supplierStatement.supplier?.name}</h3>
                              <p className="muted">الرصيد الحالي: {formatMoney(supplierStatement.supplier?.account_balance)}</p>
                            </div>
                            <button type="button" className="secondary" onClick={() => setSupplierStatement(null)}>إغلاق</button>
                          </div>
                          <div className="report-actions compact">
                            <button type="button" onClick={() => exportSupplierStatement('xlsx')}>تصدير الكشف Excel</button>
                          </div>
                          {renderStatementRows(supplierStatement.rows || [], 'لا توجد حركة لهذا المورد ضمن الفترة', {
                            typeLabel: getSupplierVoucherLabel,
                            collapsedEntryIds: collapsedStatementEntryIds,
                            referenceRenderer: (entry, state) => {
                              const entryOrderId = getEntryOrderId(entry);
                              if (state.hasItems) return <button type="button" className="link-button" onClick={() => toggleStatementEntryDetails(entry.id)}>{state.isExpanded ? 'إخفاء التفاصيل' : 'إظهار التفاصيل'}</button>;
                              if (entryOrderId) return <button type="button" className="link-button" onClick={() => openLinkedOrder(entryOrderId, supplierStatementContextKey)}>{isLinkedOrderOpenFor(entryOrderId, supplierStatementContextKey) ? 'إخفاء التفاصيل' : (entry.reference_doc || `طلب #${entryOrderId}`)}</button>;
                              return entry.transaction_type === 'credit' ? <button type="button" className="link-button" onClick={() => openSupplierInvoice(entry)}>{entry.reference_doc || `فاتورة #${entry.id}`}</button> : (entry.reference_doc || '-');
                            }
                          })}
                          {statementHasLinkedOrder(supplierStatement.rows || [], supplierStatementContextKey) && renderLinkedOrderSection()}
                          {supplierInvoice && Number(supplierInvoice.invoice?.supplier_id) === Number(supplierId) && (
                            <div className="inline-statement-section">
                              <div className="card-header compact">
                                <div>
                                  <h3>تفاصيل فاتورة الشراء</h3>
                                  <p className="muted">المورد: {supplierInvoice.invoice?.supplier_name || '-'} · المرجع: {supplierInvoice.invoice?.reference_doc || '-'} · المبلغ: {formatMoney(supplierInvoice.invoice?.amount)}</p>
                                </div>
                                <button type="button" className="secondary" onClick={() => setSupplierInvoice(null)}>إغلاق</button>
                              </div>
                              {renderSupplierInvoiceRows(supplierInvoice)}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {supplierUnifiedRows.length === 0 && <tr className="responsive-empty-row"><td colSpan={accountingColSpan('suppliers')}>لا توجد بيانات موردين مطابقة</td></tr>}
          </tbody>
          </table>
        </ResponsiveTableWrap>
      </section>}

      {accountingTab === 'clients' && <section className="card unified-accounting-card">
        <div className="card-header">
          <div>
            <h2>العملاء</h2>
            <p className="muted">جدول واحد يجمع العملاء اليدويين وعملاء المتجر مع أرقام التقارير.</p>
          </div>
          <div className="row">
            {canCreate && <button type="button" onClick={openCreateClientDialog}>إضافة عميل</button>}
            <button type="button" className="secondary" onClick={() => downloadReport('/admin/purchasing/reports/clients/export', 'xlsx')}>تصدير العملاء اليدويين</button>
            <button type="button" className="secondary" onClick={() => downloadReport('/admin/purchasing/reports/customers/export', 'xlsx', { date_from: reportFilters.date_from, date_to: reportFilters.date_to, supplier_id: '', status: 'delivered', client_type: reportFilters.client_type })}>تصدير عملاء المتجر</button>
            {renderAccountingColumnPicker('clients')}
            {renderAccountingColumnPicker('statements', 'أعمدة الكشف', 'statement-column-picker')}
          </div>
        </div>
        {clientDialogOpen && (
          <div className="modal-backdrop">
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{clientForm.id ? 'تعديل العميل' : 'إضافة عميل'}</h3>
                <button className="modal-close" type="button" onClick={() => setClientDialogOpen(false)}>×</button>
              </div>
              <form className="form" onSubmit={saveClient}>
                <div className="grid single">
                  <label>
                    <span>اسم العميل</span>
                    <input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required />
                  </label>
                  <label>
                    <span>الهاتف</span>
                    <input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
                  </label>
                  <label>
                    <span>البريد</span>
                    <input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
                  </label>
                  <label>
                    <span>العنوان</span>
                    <input value={clientForm.address_line1} onChange={(e) => setClientForm({ ...clientForm, address_line1: e.target.value })} />
                  </label>
                  <label>
                    <span>المدينة</span>
                    <select value={clientForm.city} onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}>
                      <option value="">اختر المدينة</option>
                      {clientCities.map((city) => (
                        <option key={city.id || city.name} value={city.name}>{city.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>معلومات التواصل</span>
                    <input value={clientForm.contact_info} onChange={(e) => setClientForm({ ...clientForm, contact_info: e.target.value })} />
                  </label>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary" onClick={() => setClientDialogOpen(false)}>إلغاء</button>
                  <button type="submit">{clientForm.id ? 'تحديث العميل' : 'إضافة عميل'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {renderAccountingFilterToggle('clients')}
        <div className={`report-filters mobile-filter-panel ${accountingFilterPanelsOpen.clients ? 'open' : ''}`}>
          {renderSearchInput('clients', 'بحث عن عميل أو فاتورة أو صنف منتج')}
          <input type="date" value={reportFilters.date_from} onChange={(e) => updateReportFilters({ date_from: e.target.value })} />
          <input type="date" value={reportFilters.date_to} onChange={(e) => updateReportFilters({ date_to: e.target.value })} />
          <select value={reportFilters.client_id} onChange={(e) => updateReportFilters({ client_id: e.target.value })}>
            <option value="">كل العملاء اليدويين</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <select value={reportFilters.client_type} onChange={(e) => updateReportFilters({ client_type: e.target.value })}>
            <option value="all">كل الأنواع</option>
            <option value="manual">عملاء يدويون</option>
            <option value="store">عملاء المتجر</option>
          </select>
          <select value={accountingFilters.clientBalance} onChange={(e) => setAccountingFilterValue('clientBalance', e.target.value)}>
            <option value="">كل الأرصدة</option>
            <option value="outstanding">رصيد مستحق</option>
            <option value="settled">رصيد صفر</option>
            <option value="credit">رصيد دائن</option>
          </select>
          <button type="button" className="secondary" onClick={() => { setAccountingSearchValue('clients', ''); updateReportFilters({ date_from: '', date_to: '', client_id: '', status: '', balance_filter: '', client_type: 'all' }); setAccountingFilterValue('clientBalance', ''); }}>مسح</button>
          <div className="report-actions filters-inline-actions">
            <button type="button" className="secondary" onClick={() => applyDatePreset('today')}>اليوم</button>
            <button type="button" className="secondary" onClick={() => applyDatePreset('month')}>هذا الشهر</button>
            <button type="button" className="secondary" onClick={() => applyDatePreset('year')}>هذه السنة</button>
            <button type="button" className={accountingFilters.clientBalance === 'outstanding' ? '' : 'secondary'} onClick={() => setAccountingFilterValue('clientBalance', accountingFilters.clientBalance === 'outstanding' ? '' : 'outstanding')}>ذمم قائمة</button>
            <button type="button" className={accountingFilters.clientBalance === 'settled' ? '' : 'secondary'} onClick={() => setAccountingFilterValue('clientBalance', accountingFilters.clientBalance === 'settled' ? '' : 'settled')}>حسابات مسددة</button>
            {reportLoading && <span className="muted">جارٍ تحديث التقارير...</span>}
          </div>
        </div>
        <ResponsiveTableWrap className="unified-table-wrap" minWidth={accountingTableMinWidth('clients')} ariaLabel="جدول العملاء">
          <table className="unified-accounting-table clients-accounting-table responsive-table-card">
          <thead><tr>{visibleAccountingColumns('clients').map((column) => <th key={column.key} className={column.key === 'client' ? 'client-name-column' : undefined}>{column.label}</th>)}</tr></thead>
          <tbody>
            {clientUnifiedRows.map((row) => {
              const activeClientStatement = clientStatement?.client ? clientStatement : null;
              const activeCustomerStatement = customerStatement?.customer ? customerStatement : null;
              const isClientStatementOpen = !!row.client_id && Number(activeClientStatement?.client?.id) === Number(row.client_id);
              const isCustomerStatementOpen = !!row.customer_key && activeCustomerStatement?.customer?.customer_key === row.customer_key;
              const clientStatementContextKey = `client-statement:${row.key}`;
              const customerStatementContextKey = `customer-statement:${row.key}`;
              const statementMode = row.client_id ? 'manual' : (row.customer_key ? 'store' : '');
              const isUnifiedStatementOpen = statementMode === 'manual' ? isClientStatementOpen : isCustomerStatementOpen;
              const openUnifiedStatement = () => {
                if (statementMode === 'manual') {
                  showClientStatement(row.client_id);
                  return;
                }
                if (statementMode === 'store') {
                  showCustomerStatement(row.customerRow || row);
                }
              };

              return (
              <React.Fragment key={row.key}>
                <tr>
                  {isAccountingColumnVisible('clients', 'client') && <td data-label="العميل" className="client-name-column"><span className="accounting-name">{row.client_name || '-'}</span></td>}
                  {isAccountingColumnVisible('clients', 'type') && <td data-label="النوع"><span className={`accounting-badge ${row.type === 'manual' ? 'client' : 'store'}`}>{row.type === 'manual' ? 'عميل يدوي' : (row.type === 'mixed' ? 'عميل يدوي/متجر' : 'عميل متجر')}</span></td>}
                  {isAccountingColumnVisible('clients', 'phone') && <td data-label="الهاتف">{row.phone || formatContactInfo(row.contact_info)}</td>}
                  {isAccountingColumnVisible('clients', 'email') && <td data-label="البريد">{row.email || '-'}</td>}
                  {isAccountingColumnVisible('clients', 'orders') && <td data-label="الطلبات">{row.orders_count || 0}</td>}
                  {isAccountingColumnVisible('clients', 'total_sales') && <td data-label="إجمالي البيع">{formatMoney(row.type === 'manual' ? row.total_sales : row.gross_sales)}</td>}
                  {isAccountingColumnVisible('clients', 'purchase_total') && <td data-label="إجمالي الشراء">{formatMoney(row.purchase_total)}</td>}
                  {isAccountingColumnVisible('clients', 'receipts') && <td data-label="المقبوضات/الخصومات">{formatMoney(row.type === 'manual' ? row.total_receipts : row.discounts_total)}</td>}
                  {isAccountingColumnVisible('clients', 'net') && <td data-label="الصافي">{formatMoney(row.type === 'manual' ? row.net_movement : row.net_sales)}</td>}
                  {isAccountingColumnVisible('clients', 'net_profit') && <td data-label="صافي الربح">{formatMoney(row.net_profit)}</td>}
                  {isAccountingColumnVisible('clients', 'balance') && <td data-label="الرصيد">{row.type === 'manual' || row.type === 'mixed' ? <strong>{formatMoney(row.current_outstanding_balance)}</strong> : '-'}</td>}
                  {isAccountingColumnVisible('clients', 'last_order') && <td data-label="آخر طلب">{String(row.last_order_at || '').slice(0, 10) || '-'}</td>}
                  {isAccountingColumnVisible('clients', 'statement') && <td data-label="كشف/تحميل" className="responsive-actions-cell">
                    {statementMode && <button type="button" className="secondary mobile-icon-button" data-icon="⌕" aria-label={isUnifiedStatementOpen ? 'إخفاء الكشف' : 'عرض الكشف'} title={isUnifiedStatementOpen ? 'إخفاء الكشف' : 'عرض الكشف'} onClick={openUnifiedStatement}>{isUnifiedStatementOpen ? 'إخفاء الكشف' : 'عرض الكشف'}</button>}
                    {row.customer_key && <button type="button" className="mobile-icon-button" data-icon="XLS" aria-label="تصدير Excel" title="تصدير Excel" onClick={() => downloadReport(`/admin/purchasing/reports/customers/${encodeURIComponent(row.customer_key)}/orders/export`, 'xlsx', { date_from: reportFilters.date_from, date_to: reportFilters.date_to, supplier_id: '', status: 'delivered' })}>Excel</button>}
                  </td>}
                  {isAccountingColumnVisible('clients', 'actions') && <td data-label="إجراءات" className="responsive-actions-cell">
                    {row.client && canUpdate && <button type="button" className="secondary mobile-icon-button" data-icon="✎" aria-label="تعديل" title="تعديل" onClick={() => editClient(row.client)}>تعديل</button>}
                    {row.client && canDelete && <button type="button" className="danger mobile-icon-button" data-icon="×" aria-label="حذف" title="حذف" onClick={() => deleteClient(row.client_id)}>حذف</button>}
                  </td>}
                </tr>
                {isClientStatementOpen && (
                  <tr>
                    <td colSpan={accountingColSpan('clients')} className="responsive-detail-cell">
                      <div className="notice statement-panel">
                        <div className="card-header compact">
                          <div>
                            <h3>كشف حساب العميل: {activeClientStatement.client?.name || '-'}</h3>
                            <p className="muted">الرصيد الحالي: {formatMoney(activeClientStatement.client?.account_balance)}</p>
                          </div>
                          <button type="button" className="secondary" onClick={() => setClientStatement(null)}>إغلاق</button>
                        </div>
                        <div className="report-actions compact">
                          <button type="button" onClick={() => exportClientStatement('xlsx')}>تصدير الكشف Excel</button>
                        </div>
                        {renderStatementRows(activeClientStatement.rows || [], 'لا توجد حركة لهذا العميل ضمن الفترة', {
                          typeLabel: getClientVoucherLabel,
                          collapsedEntryIds: collapsedStatementEntryIds,
                          referenceRenderer: (entry, state) => {
                            const entryOrderId = getEntryOrderId(entry);
                            if (state.hasItems) return <button type="button" className="link-button" onClick={() => toggleStatementEntryDetails(entry.id)}>{state.isExpanded ? 'إخفاء التفاصيل' : 'إظهار التفاصيل'}</button>;
                            return entryOrderId ? <button type="button" className="link-button" onClick={() => openLinkedOrder(entryOrderId, clientStatementContextKey)}>{isLinkedOrderOpenFor(entryOrderId, clientStatementContextKey) ? 'إخفاء التفاصيل' : (entry.reference_doc || `طلب #${entryOrderId}`)}</button> : (entry.reference_doc || '-');
                          }
                        })}
                        {statementHasLinkedOrder(activeClientStatement.rows || [], clientStatementContextKey) && renderLinkedOrderSection()}
                      </div>
                    </td>
                  </tr>
                )}
                {isCustomerStatementOpen && (
                  <tr>
                    <td colSpan={accountingColSpan('clients')} className="responsive-detail-cell">
                      <div className="notice statement-panel">
                        <div className="card-header compact">
                          <div>
                            <h3>كشف حساب العميل: {activeCustomerStatement.customer?.customer_name || '-'}</h3>
                            <p className="muted">عدد الطلبات: {activeCustomerStatement.summary?.orders_count || 0} · عدد القطع: {activeCustomerStatement.summary?.items_quantity || 0} · الخصم: {formatMoney(activeCustomerStatement.summary?.discount_amount)} · الصافي: {formatMoney(activeCustomerStatement.summary?.total)}</p>
                          </div>
                          <button type="button" className="secondary" onClick={() => setCustomerStatement(null)}>إغلاق</button>
                        </div>
                        {renderCustomerOrderRows(activeCustomerStatement.rows || [], 'لا توجد طلبات لهذا العميل ضمن الفلاتر الحالية', customerStatementContextKey)}
                        {statementHasLinkedOrder(activeCustomerStatement.rows || [], customerStatementContextKey) && renderLinkedOrderSection()}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
            {clientUnifiedRows.length === 0 && <tr className="responsive-empty-row"><td colSpan={accountingColSpan('clients')}>لا توجد بيانات عملاء مطابقة</td></tr>}
          </tbody>
          </table>
        </ResponsiveTableWrap>
      </section>}

      {accountingTab === 'vouchers' && <section className="card unified-accounting-card">
        <div className="card-header">
          <div>
            <h2>السندات</h2>
            <p className="muted">جدول واحد يجمع سندات الموردين وسندات العملاء.</p>
          </div>
          <div className="row">
            {canCreate && <button type="button" onClick={() => { journalIdempotencyKeyRef.current = null; setJournalSupplierSearch(''); setJournalSupplierPickerOpen(false); setJournalSaving(false); setJournalDialogOpen(true); }}>إنشاء سند مورد</button>}
            {canCreate && <button type="button" onClick={() => { clientJournalIdempotencyKeyRef.current = null; setClientJournalClientSearch(''); setClientJournalClientPickerOpen(false); setClientJournalSaving(false); setClientJournalDialogOpen(true); }}>إنشاء سند عميل</button>}
            {renderAccountingColumnPicker('vouchers')}
          </div>
        </div>
        {journalDialogOpen && (
          <div className="modal-backdrop">
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>إنشاء سند قيد للمورد</h3>
                <button className="modal-close" type="button" disabled={journalSaving} onClick={() => { journalIdempotencyKeyRef.current = null; setJournalSupplierPickerOpen(false); setJournalDialogOpen(false); }}>×</button>
              </div>
              <form className="form" onSubmit={createJournalEntry}>
                <div className="grid single">
                  <label>
                    <span>المورد</span>
                    <div className="client-picker">
                      <input
                        value={journalSupplierSearch}
                        onFocus={() => setJournalSupplierPickerOpen(true)}
                        onClick={() => setJournalSupplierPickerOpen(true)}
                        onBlur={() => setTimeout(() => setJournalSupplierPickerOpen(false), 120)}
                        onChange={(event) => {
                          setJournalSupplierSearch(event.target.value);
                          setJournalForm((current) => ({ ...current, supplier_id: '' }));
                        }}
                        placeholder="ابحث واختر المورد"
                        required
                      />
                      {journalSupplierPickerOpen && (
                        <div className="client-picker-list">
                          {filteredJournalSuppliers.map((supplier) => (
                            <button
                              key={supplier.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyJournalSupplier(supplier);
                              }}
                            >
                              <strong>{supplier.name}</strong>
                              <span>{formatContactInfo(supplier.contact_info)}</span>
                            </button>
                          ))}
                          {filteredJournalSuppliers.length === 0 && <div className="client-picker-empty">لا يوجد موردون مطابقون</div>}
                        </div>
                      )}
                    </div>
                  </label>
                  <label>
                    <span>النوع</span>
                    <select
                      value={journalForm.voucher_type}
                      onChange={(e) => {
                        const voucherType = e.target.value;
                        setJournalForm({
                          ...journalForm,
                          voucher_type: voucherType,
                          transaction_type: SUPPLIER_VOUCHER_TRANSACTION_TYPES[voucherType] || 'credit'
                        });
                      }}
                    >
                      <option value="purchase_invoice">فاتورة شراء / دائن</option>
                      <option value="supplier_service_credit">خدمات / دائن</option>
                      <option value="supplier_payment">دفعة للمورد / مدين</option>
                      <option value="supplier_discount_debit">خصم / مدين</option>
                    </select>
                  </label>
                  <label>
                    <span>المبلغ</span>
                    <input value={journalForm.amount} onChange={(e) => setJournalForm({ ...journalForm, amount: e.target.value })} required />
                  </label>
                  <label>
                    <span>رقم المستند / المرجع</span>
                    <input value={journalForm.reference_doc} onChange={(e) => setJournalForm({ ...journalForm, reference_doc: e.target.value })} />
                  </label>
                  <label>
                    <span>ملاحظة</span>
                    <textarea value={journalForm.note} onChange={(e) => setJournalForm({ ...journalForm, note: e.target.value })} rows="3" />
                  </label>
                  <label>
                    <span>التاريخ</span>
                    <input type="date" value={journalForm.date} onChange={(e) => setJournalForm({ ...journalForm, date: e.target.value })} required />
                  </label>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary" disabled={journalSaving} onClick={() => { journalIdempotencyKeyRef.current = null; setJournalSupplierPickerOpen(false); setJournalDialogOpen(false); }}>إلغاء</button>
                  <button type="submit" disabled={journalSaving}>{journalSaving ? 'جارٍ الحفظ...' : 'إنشاء سند قيد'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {clientJournalDialogOpen && (
          <div className="modal-backdrop">
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>إنشاء سند قيد للعميل</h3>
                <button className="modal-close" type="button" disabled={clientJournalSaving} onClick={() => { clientJournalIdempotencyKeyRef.current = null; setClientJournalClientPickerOpen(false); setClientJournalDialogOpen(false); }}>×</button>
              </div>
              <form className="form" onSubmit={createClientJournalEntry}>
                <div className="grid single">
                  <label>
                    <span>العميل</span>
                    <div className="client-picker">
                      <input
                        value={clientJournalClientSearch}
                        onFocus={() => setClientJournalClientPickerOpen(true)}
                        onClick={() => setClientJournalClientPickerOpen(true)}
                        onBlur={() => setTimeout(() => setClientJournalClientPickerOpen(false), 120)}
                        onChange={(event) => {
                          setClientJournalClientSearch(event.target.value);
                          setClientJournalForm((current) => ({ ...current, client_id: '' }));
                        }}
                        placeholder="ابحث واختر العميل"
                        required
                      />
                      {clientJournalClientPickerOpen && (
                        <div className="client-picker-list">
                          {filteredClientJournalClients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyClientJournalClient(client);
                              }}
                            >
                              <strong>{client.name}</strong>
                              <span>{client.phone || client.contact_info || '-'}</span>
                              <small>{[client.email, client.address_line1, client.city].filter(Boolean).join(' · ')}</small>
                            </button>
                          ))}
                          {filteredClientJournalClients.length === 0 && <div className="client-picker-empty">لا يوجد عملاء مطابقون</div>}
                        </div>
                      )}
                    </div>
                  </label>
                  <label>
                    <span>النوع</span>
                    <select
                      value={clientJournalForm.voucher_type}
                      onChange={(e) => {
                        const voucherType = e.target.value;
                        setClientJournalForm({
                          ...clientJournalForm,
                          voucher_type: voucherType,
                          transaction_type: CLIENT_VOUCHER_TRANSACTION_TYPES[voucherType] || 'debit'
                        });
                      }}
                    >
                      <option value="sales_invoice">فاتورة بيع / مدين</option>
                      <option value="client_service_debit">خدمات / مدين</option>
                      <option value="client_receipt">قبض من العميل / دائن</option>
                      <option value="client_discount_credit">خصم / دائن</option>
                    </select>
                  </label>
                  <label>
                    <span>المبلغ</span>
                    <input value={clientJournalForm.amount} onChange={(e) => setClientJournalForm({ ...clientJournalForm, amount: e.target.value })} required />
                  </label>
                  <label>
                    <span>رقم المستند / المرجع</span>
                    <input value={clientJournalForm.reference_doc} onChange={(e) => setClientJournalForm({ ...clientJournalForm, reference_doc: e.target.value })} />
                  </label>
                  <label>
                    <span>ملاحظة</span>
                    <textarea value={clientJournalForm.note} onChange={(e) => setClientJournalForm({ ...clientJournalForm, note: e.target.value })} rows="3" />
                  </label>
                  <label>
                    <span>التاريخ</span>
                    <input type="date" value={clientJournalForm.date} onChange={(e) => setClientJournalForm({ ...clientJournalForm, date: e.target.value })} required />
                  </label>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary" disabled={clientJournalSaving} onClick={() => { clientJournalIdempotencyKeyRef.current = null; setClientJournalClientPickerOpen(false); setClientJournalDialogOpen(false); }}>إلغاء</button>
                  <button type="submit" disabled={clientJournalSaving}>{clientJournalSaving ? 'جارٍ الحفظ...' : 'إنشاء سند قيد'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {renderAccountingFilterToggle('vouchers')}
        <div className={`report-filters mobile-filter-panel ${accountingFilterPanelsOpen.vouchers ? 'open' : ''}`}>
          {renderSearchInput('vouchers', 'بحث في كل السندات أو الفاتورة أو صنف المنتج')}
          <select value={accountingFilters.voucherScope} onChange={(e) => setAccountingFilters((prev) => ({ ...prev, voucherScope: e.target.value, voucherAccountKey: '' }))}>
            <option value="">كل أنواع الحساب</option>
            <option value="supplier">سندات الموردين</option>
            <option value="client">سندات العملاء</option>
          </select>
          <select value={accountingFilters.voucherAccountKey} onChange={(e) => setAccountingFilterValue('voucherAccountKey', e.target.value)}>
            <option value="">{accountingFilters.voucherScope === 'supplier' ? 'كل الموردين' : accountingFilters.voucherScope === 'client' ? 'كل العملاء' : 'كل الأسماء'}</option>
            {accountingFilters.voucherScope === 'supplier' && suppliers.map((supplier) => <option key={`supplier-${supplier.id}`} value={`supplier:${supplier.id}`}>{supplier.name}</option>)}
            {accountingFilters.voucherScope === 'client' && clients.map((client) => <option key={`client-${client.id}`} value={`client:${client.id}`}>{client.name}</option>)}
            {!accountingFilters.voucherScope && (
              <>
                <optgroup label="الموردون">
                  {suppliers.map((supplier) => <option key={`supplier-${supplier.id}`} value={`supplier:${supplier.id}`}>{supplier.name}</option>)}
                </optgroup>
                <optgroup label="العملاء">
                  {clients.map((client) => <option key={`client-${client.id}`} value={`client:${client.id}`}>{client.name}</option>)}
                </optgroup>
              </>
            )}
          </select>
          <select value={accountingFilters.voucherType} onChange={(e) => setAccountingFilterValue('voucherType', e.target.value)}>
            <option value="">كل الحركات</option>
            <option value="credit">دائن</option>
            <option value="debit">مدين</option>
          </select>
          <button type="button" className="secondary" onClick={() => { setAccountingSearchValue('vouchers', ''); setAccountingSearchValue('journal', ''); setAccountingSearchValue('clientJournal', ''); setAccountingFilters((prev) => ({ ...prev, voucherScope: '', voucherAccountKey: '', voucherType: '', journalSupplierId: '', journalType: '', clientJournalClientId: '', clientJournalType: '' })); }}>مسح</button>
        </div>
        <ResponsiveTableWrap className="unified-table-wrap" minWidth={accountingTableMinWidth('vouchers')} ariaLabel="جدول السندات">
          <table className="unified-accounting-table responsive-table-card">
            <thead><tr>{visibleAccountingColumns('vouchers').map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>
              {voucherUnifiedRows.map((entry) => {
                const voucherContextKey = `voucher:${entry.key}`;
                const voucherDetailKind = getVoucherDetailKind(entry);
                const voucherDetailKey = getVoucherDetailKey(entry);
                const entryOrderId = getEntryOrderId(entry);
                const isVoucherDetailOpen = Boolean(voucherDetailKey) && !voucherCollapsedDetailKeys.includes(voucherDetailKey);
                const voucherDetailState = voucherDetailCache[voucherDetailKey] || {};
                return (
                  <React.Fragment key={entry.key}>
                    <tr>
                      {isAccountingColumnVisible('vouchers', 'scope') && <td data-label="نوع الحساب"><span className={`accounting-badge ${entry.voucherScope === 'supplier' ? 'supplier' : 'client'}`}>{entry.voucherScope === 'supplier' ? 'سند مورد' : 'سند عميل'}</span></td>}
                      {isAccountingColumnVisible('vouchers', 'name') && <td data-label="الاسم">{entry.accountName || '-'}</td>}
                      {isAccountingColumnVisible('vouchers', 'date') && <td data-label="التاريخ">{String(entry.date || '').slice(0, 10)}</td>}
                      {isAccountingColumnVisible('vouchers', 'type') && <td data-label="نوع الحركة">{entry.voucherScope === 'supplier' ? getSupplierVoucherLabel(entry) : getClientVoucherLabel(entry)}</td>}
                      {isAccountingColumnVisible('vouchers', 'amount') && <td data-label="المبلغ">{formatMoney(entry.amount)}</td>}
                      {isAccountingColumnVisible('vouchers', 'total_sales') && <td data-label="إجمالي البيع">{formatOrderMetric(entry, 'total_sales')}</td>}
                      {isAccountingColumnVisible('vouchers', 'purchase_total') && <td data-label="إجمالي الشراء">{formatOrderMetric(entry, 'purchase_total')}</td>}
                      {isAccountingColumnVisible('vouchers', 'net_profit') && <td data-label="صافي الربح">{formatOrderMetric(entry, 'net_profit')}</td>}
                      {isAccountingColumnVisible('vouchers', 'reference') && <td data-label="المرجع">{voucherDetailKey ? <button type="button" className="link-button" onClick={() => toggleVoucherDetail(entry)}>{isVoucherDetailOpen ? 'إخفاء التفاصيل' : 'إظهار التفاصيل'}</button> : (entry.reference_doc || '-')}</td>}
                      {isAccountingColumnVisible('vouchers', 'note') && <td data-label="ملاحظة">{entry.note || '-'}</td>}
                      {isAccountingColumnVisible('vouchers', 'order') && <td data-label="الطلب">{entryOrderId ? <button type="button" className="link-button" onClick={() => toggleVoucherDetail(entry)}>{isVoucherDetailOpen ? 'إخفاء' : `#${entryOrderId}`}</button> : '-'}</td>}
                    </tr>
                    {isVoucherDetailOpen && (
                      <tr>
                        <td colSpan={accountingColSpan('vouchers')} className="responsive-detail-cell">
                          <div className="notice statement-panel">
                            {voucherDetailState.loading && <p className="muted">جارٍ تحميل التفاصيل...</p>}
                            {voucherDetailState.error && (
                              <div className="inline-status-row">
                                <p className="error">{voucherDetailState.error}</p>
                                <button type="button" className="secondary" onClick={() => retryVoucherDetail(entry)}>إعادة المحاولة</button>
                              </div>
                            )}
                            {!voucherDetailState.loading && !voucherDetailState.error && !voucherDetailState.data && <p className="muted">بانتظار تحميل التفاصيل...</p>}
                            {!voucherDetailState.loading && !voucherDetailState.error && voucherDetailState.data && (
                              voucherDetailKind === 'supplier_invoice'
                                ? (
                                  <>
                                    <div className="card-header compact">
                                      <div>
                                        <h3>تفاصيل فاتورة الشراء</h3>
                                        <p className="muted">المورد: {voucherDetailState.data.invoice?.supplier_name || '-'} · المرجع: {voucherDetailState.data.invoice?.reference_doc || '-'} · المبلغ: {formatMoney(voucherDetailState.data.invoice?.amount)}</p>
                                      </div>
                                    </div>
                                    {renderSupplierInvoiceRows(voucherDetailState.data)}
                                  </>
                                )
                                : renderLinkedOrderRows(voucherDetailState.data)
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {voucherUnifiedRows.length === 0 && <tr className="responsive-empty-row"><td colSpan={accountingColSpan('vouchers')}>لا توجد سندات مطابقة</td></tr>}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      </section>}

    </div>
  );
}

function createVariantDraft() {
  return {
    color_name: '',
    color_hex: '#000000',
    image_url: '',
    image_urls: [],
    size_name: '',
    price: '',
    purchase_price: '',
    size_rows: []
  };
}

function Products({ setError, currentAdmin }) {
  const PRODUCT_FILTERS_KEY = 'admin_products_filters';
  const PRODUCT_COLUMNS_KEY = 'admin_products_visible_columns';
  const PRODUCT_SIZES_KEY = 'admin_product_size_values';
  const PRODUCT_SIZE_UNITS_KEY = 'admin_product_size_units';
  const PRODUCT_COLORS_KEY = 'admin_product_color_values';
  const DEFAULT_PRODUCT_COLOR_OPTIONS = [
    { id: 'fixed-color-0', name: 'Chrome', hex: '#C0C0C0' },
    { id: 'fixed-color-1', name: 'Brushed Nickel', hex: '#A7A9AC' },
    { id: 'fixed-color-2', name: 'Brushed Rose Gold', hex: '#B76E79' },
    { id: 'fixed-color-3', name: 'Brushed Gold', hex: '#D4AF37' },
    { id: 'fixed-color-4', name: 'Gunmetal Gray', hex: '#4B5563' },
    { id: 'fixed-color-5', name: 'Matte Black', hex: '#111827' }
  ];
  const normalizeProductColorList = (colors) => {
    const seen = new Set();
    const normalized = (Array.isArray(colors) ? colors : [])
      .map((color, index) => ({
        id: String(color?.id || `color-${index + 1}`),
        name: String(color?.name || '').trim(),
        hex: String(color?.hex || '#000000').trim() || '#000000'
      }))
      .filter((color) => {
        if (!color.name) return false;
        const key = color.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return normalized.length ? normalized : DEFAULT_PRODUCT_COLOR_OPTIONS;
  };
  const PRODUCT_COLUMN_DEFS = [
    { key: 'id', label: 'المعرف', sortable: true },
    { key: 'name', label: 'الاسم', sortable: true },
    { key: 'category', label: 'الفئة', sortable: true },
    { key: 'price', label: 'سعر البيع', sortable: true },
    { key: 'purchase_price', label: 'سعر الشراء', sortable: true },
    { key: 'supplier', label: 'المورد', sortable: true },
    { key: 'stock', label: 'المخزون', sortable: true },
    { key: 'brand', label: 'الماركة', sortable: true },
    { key: 'type', label: 'النوع', sortable: true },
    { key: 'status', label: 'الحالة', sortable: true },
    { key: 'visibility', label: 'الظهور', sortable: true },
    { key: 'created_at', label: 'تاريخ الإنشاء', sortable: true },
    { key: 'updated_at', label: 'آخر تحديث', sortable: true }
  ];
  const PRODUCT_COLUMN_KEYS = PRODUCT_COLUMN_DEFS.map((column) => column.key);
  const DEFAULT_PRODUCT_COLUMNS = ['id', 'name', 'category', 'price', 'status', 'visibility'];
  const getItemCategories = (item) => {
    const values = Array.isArray(item?.categories) ? item.categories : (item?.category ? [item.category] : []);
    return values.filter(Boolean);
  };
  const formatCategoryList = (item) => {
    const values = getItemCategories(item);
    return values.length ? values.join('، ') : '-';
  };
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [originalDocs, setOriginalDocs] = useState([]);
  const [docsTouched, setDocsTouched] = useState(false);
  const [visibleProductColumns, setVisibleProductColumns] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCT_COLUMNS_KEY) || 'null');
      const valid = Array.isArray(parsed)
        ? parsed.filter((key) => PRODUCT_COLUMN_KEYS.includes(key))
        : [];
      return valid.length ? valid : DEFAULT_PRODUCT_COLUMNS;
    } catch {
      return DEFAULT_PRODUCT_COLUMNS;
    }
  });
  const [localError, setLocalError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importFileData, setImportFileData] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMode, setImportMode] = useState('create_only');
  const [form, setForm] = useState({
    name: '',
    description: '',
    usage: '',
    technical_data: '',
    warnings: '',
    price: '',
    mrp: '',
    supplier_id: '',
    purchase_price: '',
    brand: '',
    type: '',
    categories: [],
    color_options: [],
    variant_options: [],
    image_urls: [],
    docs: [],
    links: [],
    is_available: true,
    is_hidden: false
  });
  const [docPreviews, setDocPreviews] = useState([]);
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [newColor, setNewColor] = useState({ name: '', hex: '#000000' });
  const [newVariant, setNewVariant] = useState(createVariantDraft());
  const [showColorList, setShowColorList] = useState(false);
  const [productOptionListsLoaded, setProductOptionListsLoaded] = useState(false);
  const [colorOptions, setColorOptions] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCT_COLORS_KEY) || '[]');
      return normalizeProductColorList(parsed);
    } catch {
      return DEFAULT_PRODUCT_COLOR_OPTIONS;
    }
  });
  const [editingColorId, setEditingColorId] = useState('');
  const [showSizeList, setShowSizeList] = useState(false);
  const [newSizeGroupName, setNewSizeGroupName] = useState('');
  const [selectedSizeGroupId, setSelectedSizeGroupId] = useState('');
  const [newSizeValue, setNewSizeValue] = useState('');
  const [newSizeUnit, setNewSizeUnit] = useState('');
  const [sizeUnitDropdownOpen, setSizeUnitDropdownOpen] = useState(false);
  const [sizeUnits, setSizeUnits] = useState(() => {
    const defaults = ['cm', 'm', 'ml', 'l'];
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCT_SIZE_UNITS_KEY) || '[]');
      const saved = Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
      return Array.from(new Set([...defaults, ...saved]));
    } catch {
      return defaults;
    }
  });
  const [sizeOptions, setSizeOptions] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCT_SIZES_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      const groups = parsed
        .filter((item) => item && typeof item === 'object' && Array.isArray(item.sizes))
        .map((group, index) => ({
          id: String(group.id || `size-group-${index + 1}`),
          name: String(group.name || '').trim(),
          sizes: group.sizes
            .map((size) => ({
              value: String(size?.value || '').trim(),
              unit: String(size?.unit || '').trim()
            }))
            .filter((size) => size.value)
        }))
        .filter((group) => group.name && group.sizes.length);
      if (groups.length) return groups;
      const legacySizes = parsed
        .map((item) => {
          if (item && typeof item === 'object') {
            return { value: String(item.value || '').trim(), unit: String(item.unit || '').trim() };
          }
          return { value: String(item || '').trim(), unit: '' };
        })
        .filter((item) => item.value);
      return legacySizes.length ? [{ id: 'default-sizes', name: 'قياسات عامة', sizes: legacySizes }] : [];
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const templateUrl = `${import.meta.env.BASE_URL || '/'}store-IT-26-import-template.xlsx`;
  const canCreateProduct = hasPermission(currentAdmin, 'products', 'create');
  const canUpdateProduct = hasPermission(currentAdmin, 'products', 'update');
  const canDeleteProduct = hasPermission(currentAdmin, 'products', 'delete');
  const canHideProduct = hasPermission(currentAdmin, 'products', 'hide');
  const canImportProducts = hasPermission(currentAdmin, 'products', 'import');
  const canReadPurchasing = hasPermission(currentAdmin, 'purchasing', 'read');
  const canUpdatePurchasing = hasPermission(currentAdmin, 'purchasing', 'update');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_FILTERS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setSearchTerm(String(saved.searchTerm || ''));
      setCategoryFilter(String(saved.categoryFilter || 'all'));
      setAvailabilityFilter(String(saved.availabilityFilter || 'all'));
      setVisibilityFilter(String(saved.visibilityFilter || 'all'));
      setSortBy(String(saved.sortBy || 'id'));
      setSortDirection(saved.sortDirection === 'asc' ? 'asc' : 'desc');
      setItemsPerPage([10, 25, 50].includes(Number(saved.itemsPerPage)) ? Number(saved.itemsPerPage) : 10);
    } catch {
      // ignore invalid saved filters
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PRODUCT_FILTERS_KEY, JSON.stringify({
      searchTerm,
      categoryFilter,
      availabilityFilter,
      visibilityFilter,
      sortBy,
      sortDirection,
      itemsPerPage
    }));
  }, [searchTerm, categoryFilter, availabilityFilter, visibilityFilter, sortBy, sortDirection, itemsPerPage]);

  useEffect(() => {
    localStorage.setItem(PRODUCT_COLUMNS_KEY, JSON.stringify(visibleProductColumns));
  }, [visibleProductColumns]);

  useEffect(() => {
    localStorage.setItem(PRODUCT_SIZES_KEY, JSON.stringify(sizeOptions));
  }, [sizeOptions]);

  useEffect(() => {
    localStorage.setItem(PRODUCT_COLORS_KEY, JSON.stringify(colorOptions));
  }, [colorOptions]);

  useEffect(() => {
    localStorage.setItem(PRODUCT_SIZE_UNITS_KEY, JSON.stringify(sizeUnits));
  }, [sizeUnits]);

  const loadProductOptionLists = async () => {
    if (productOptionListsLoaded) return;
    try {
      const [colorsResult, sizesResult] = await Promise.allSettled([
        apiGet('/admin/product-options/colors'),
        apiGet('/admin/product-options/sizes')
      ]);
      if (colorsResult.status === 'fulfilled' && Array.isArray(colorsResult.value)) {
        setColorOptions(normalizeProductColorList(colorsResult.value));
      }
      if (sizesResult.status === 'fulfilled' && Array.isArray(sizesResult.value) && sizesResult.value.length) {
        setSizeOptions(sizesResult.value);
      }
      setProductOptionListsLoaded(true);
    } catch {
      // keep local fallback if option lists are unavailable
    }
  };

  const saveColorOptions = async (nextColors) => {
    setColorOptions(normalizeProductColorList(nextColors));
    try {
      const saved = await apiPut('/admin/product-options/colors', { colors: nextColors });
      if (Array.isArray(saved)) setColorOptions(normalizeProductColorList(saved));
    } catch (err) {
      setLocalError(err.message || 'فشل حفظ قائمة الألوان');
    }
  };

  const saveSizeOptions = async (nextSizes) => {
    setSizeOptions(nextSizes);
    try {
      const saved = await apiPut('/admin/product-options/sizes', { groups: nextSizes });
      if (Array.isArray(saved)) setSizeOptions(saved);
    } catch (err) {
      setLocalError(err.message || 'فشل حفظ قائمة القياسات');
    }
  };

  const getSizeOptionLabel = (option) => {
    if (option && typeof option === 'object') {
      return [option.value, option.unit].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
    }
    return String(option || '').trim();
  };

  const selectedSizeGroup = sizeOptions.find((group) => group.id === selectedSizeGroupId) || sizeOptions[0] || null;
  const defaultSizeUnits = ['cm', 'm', 'ml', 'l'];
  const normalizedSizeUnitSearch = String(newSizeUnit || '').trim().toLowerCase();
  const filteredSizeUnits = sizeUnits.filter((unit) => (
    !normalizedSizeUnitSearch || unit.toLowerCase().includes(normalizedSizeUnitSearch)
  ));
  const isTypedSizeUnitNew = Boolean(normalizedSizeUnitSearch)
    && !sizeUnits.some((unit) => unit.toLowerCase() === normalizedSizeUnitSearch);

  const removeSizeUnit = (unit) => {
    if (defaultSizeUnits.includes(unit)) return;
    setSizeUnits((current) => current.filter((item) => item !== unit));
    if (newSizeUnit === unit) setNewSizeUnit('');
  };

  const addSizeGroup = () => {
    const name = String(newSizeGroupName || '').trim();
    if (!name) {
      setLocalError('أدخل اسم مجموعة القياسات أولاً');
      return;
    }
    if (sizeOptions.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
      setLocalError('هذه المجموعة موجودة بالفعل');
      return;
    }
    const group = { id: `size-group-${Date.now()}`, name, sizes: [] };
    setLocalError('');
    saveSizeOptions([...sizeOptions, group]);
    setSelectedSizeGroupId(group.id);
    setNewSizeGroupName('');
  };

  const removeSizeGroup = (groupId) => {
    saveSizeOptions(sizeOptions.filter((group) => group.id !== groupId));
    if (selectedSizeGroupId === groupId) setSelectedSizeGroupId('');
  };

  const addSizeOption = () => {
    if (!selectedSizeGroup) {
      setLocalError('أنشئ أو اختر مجموعة قياسات أولاً');
      return;
    }
    const value = String(newSizeValue || '').trim();
    const unit = String(newSizeUnit || '').trim();
    const label = [value, unit].filter(Boolean).join(' ');
    if (!value) {
      setLocalError('أدخل قيمة القياس أولاً');
      return;
    }
    if ((selectedSizeGroup.sizes || []).some((item) => getSizeOptionLabel(item).toLowerCase() === label.toLowerCase())) {
      setLocalError('هذا القياس موجود بالفعل داخل المجموعة');
      return;
    }
    setLocalError('');
    if (unit && !sizeUnits.some((item) => item.toLowerCase() === unit.toLowerCase())) {
      setSizeUnits((current) => [...current, unit]);
    }
    saveSizeOptions(sizeOptions.map((group) => (
      group.id === selectedSizeGroup.id
        ? { ...group, sizes: [...(group.sizes || []), { value, unit }] }
        : group
    )));
    setNewSizeValue('');
    setNewSizeUnit('');
  };

  const removeSizeOption = (groupId, option) => {
    const label = getSizeOptionLabel(option);
    saveSizeOptions(sizeOptions.map((group) => (
      group.id === groupId
        ? { ...group, sizes: (group.sizes || []).filter((item) => getSizeOptionLabel(item) !== label) }
        : group
    )));
  };

  const applySizeGroupToDraft = (group) => {
    const existing = getVariantSizeRows();
    const nextRows = [...existing];
    (group?.sizes || []).forEach((size) => {
      const label = getSizeOptionLabel(size);
      if (label && !nextRows.some((row) => row.size_name.toLowerCase() === label.toLowerCase())) {
        nextRows.push({ size_name: label, price: '', purchase_price: '' });
      }
    });
    setNewVariant((current) => ({ ...current, size_rows: nextRows }));
  };

  const resetColorDraft = () => {
    setNewColor({ name: '', hex: '#000000' });
    setEditingColorId('');
  };

  const saveColorDraft = () => {
    const name = String(newColor.name || '').trim();
    const hex = String(newColor.hex || '').trim() || '#000000';
    if (!name) {
      setLocalError('أدخل اسم اللون أولاً');
      return;
    }
    const duplicate = colorOptions.some((color) =>
      color.id !== editingColorId && String(color.name || '').trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setLocalError('هذا اللون موجود بالفعل');
      return;
    }
    const nextColor = { id: editingColorId || `color-${Date.now()}`, name, hex };
    const nextColors = editingColorId
      ? colorOptions.map((color) => color.id === editingColorId ? nextColor : color)
      : [...colorOptions, nextColor];
    setLocalError('');
    saveColorOptions(nextColors);
    resetColorDraft();
  };

  const editSavedColor = (color) => {
    setEditingColorId(color.id);
    setNewColor({ name: color.name || '', hex: color.hex || '#000000' });
  };

  const removeSavedColor = (colorId) => {
    saveColorOptions(colorOptions.filter((color) => color.id !== colorId));
    if (editingColorId === colorId) resetColorDraft();
  };

  const applySavedColorToVariant = (colorId) => {
    if (!colorId) {
      setNewVariant(createVariantDraft());
      return;
    }
    const color = colorOptions.find((item) => item.id === colorId);
    if (!color) return;
    setNewVariant((current) => ({
      ...current,
      color_name: color.name,
      color_hex: color.hex || '#000000'
    }));
  };

  const getSelectedVariantColorId = () => {
    const colorName = String(newVariant.color_name || '').trim().toLowerCase();
    const colorHex = String(newVariant.color_hex || '').trim().toUpperCase();
    const match = colorOptions.find((color) => (
      String(color.name || '').trim().toLowerCase() === colorName
      && String(color.hex || '').trim().toUpperCase() === colorHex
    ));
    return match?.id || '';
  };

  const isProductColumnVisible = (key) => visibleProductColumns.includes(key);
  const toggleProductColumn = (key) => {
    setVisibleProductColumns((current) => {
      if (current.includes(key)) {
        return current.length > 1 ? current.filter((item) => item !== key) : current;
      }
      return PRODUCT_COLUMN_KEYS.filter((item) => item === key || current.includes(item));
    });
  };
  const visibleProductColumnCount = visibleProductColumns.length + 1;
  const renderProductCell = (item, columnKey) => {
    switch (columnKey) {
      case 'id': return item.id;
      case 'name': return item.name;
      case 'category': return formatCategoryList(item);
      case 'price': return item.price ?? '-';
      case 'purchase_price': return item.purchase_price ?? '-';
      case 'supplier': return item.supplier_name || '-';
      case 'stock': return item.stock ?? 0;
      case 'brand': return item.brand || '-';
      case 'type': return item.type || '-';
      case 'status': return isAvailable(item) ? 'متوفر' : 'غير متوفر';
      case 'visibility': return isHidden(item) ? 'مخفي' : 'ظاهر';
      case 'created_at': return String(item.created_at || '').slice(0, 10) || '-';
      case 'updated_at': return String(item.updated_at || '').slice(0, 10) || '-';
      default: return '-';
    }
  };

  const openCreate = async () => {
    if (!canCreateProduct) return;
    setLocalError('');
    await loadProductOptionLists();
    setEditingId(null);
    setForm({ name:'', description:'', usage:'', technical_data:'', warnings:'', price:'', mrp:'', supplier_id:'', purchase_price:'', categories:[], color_options:[], variant_options:[], image_urls:[], docs:[], links:[], is_available:true, is_hidden:false });
    setImagePreviews([]);
    setOriginalDocs([]);
    setDocsTouched(false);
    setDocPreviews([]);
    setNewColor({ name: '', hex: '#000000' });
    setNewVariant(createVariantDraft());
    setCategoryDropdownOpen(false);
    setShowCreate(true);
  };

  const openEdit = async (item) => {
    if (!canUpdateProduct) return;
    setLocalError('');
    try {
      await loadProductOptionLists();
      const fullItem = await apiGet(`/products/${item.id}`);
      const purchasingInfo = canReadPurchasing
        ? await apiGet(`/admin/products/${item.id}/purchasing`).catch(() => null)
        : null;
      const source = fullItem || item;
      const docs = Array.isArray(source.docs) ? source.docs : [];
      const images = (source.image_urls && source.image_urls.length)
        ? source.image_urls
        : (source.image_url ? [source.image_url] : []);
      setEditingId(source.id);
      setForm({
        name: source.name || '',
        description: source.description || '',
        usage: source.usage || '',
        technical_data: source.technical_data || '',
        warnings: source.warnings || '',
        price: source.price ?? '',
        mrp: source.mrp ?? '',
        supplier_id: purchasingInfo?.supplier_id ?? '',
        purchase_price: purchasingInfo?.purchase_price ?? '',
        categories: Array.isArray(source.categories) && source.categories.length ? source.categories : (source.category ? [source.category] : []),
        color_options: Array.isArray(source.color_options) ? source.color_options : [],
        variant_options: Array.isArray(source.variant_options) ? source.variant_options : [],
        image_urls: images,
        docs,
        links: source.links || [],
        is_available: source.is_available !== 0 && source.is_available !== false,
        is_hidden: source.is_hidden === 1 || source.is_hidden === true
      });
      setImagePreviews(images);
      setOriginalDocs(docs);
      setDocsTouched(false);
      setDocPreviews(docs);
      setNewColor({ name: '', hex: '#000000' });
      setNewVariant(createVariantDraft());
      setCategoryDropdownOpen(false);
      setShowCreate(true);
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل بيانات المنتج');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [productsResult, categoriesResult, suppliersResult] = await Promise.allSettled([
        apiGet('/admin/products'),
        apiGet('/admin/categories'),
        canReadPurchasing ? apiGet('/admin/suppliers') : Promise.resolve([])
      ]);

      if (productsResult.status === 'fulfilled') {
        setItems(Array.isArray(productsResult.value) ? productsResult.value : []);
      } else {
        throw productsResult.reason;
      }

      if (categoriesResult.status === 'fulfilled') {
        setCategories(Array.isArray(categoriesResult.value) ? categoriesResult.value : []);
      } else {
        setCategories([]);
      }

      if (suppliersResult.status === 'fulfilled') {
        setSuppliers(Array.isArray(suppliersResult.value) ? suppliersResult.value : []);
      } else {
        setSuppliers([]);
      }
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseImportFile = async (file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setImportFileData(reader.result || '');
        setImportFileName(file.name || 'products.xlsx');
        setImportPreview(null);
      };
      reader.onerror = () => setLocalError('فشل قراءة ملف الإكسل');
      reader.readAsDataURL(file);
    } catch {
      setLocalError('فشل قراءة ملف الإكسل');
    }
  };

  const runImport = async () => {
    if (!canImportProducts) return;
    if (!importFileData) {
      setLocalError('يرجى رفع ملف الإكسل أولاً');
      return;
    }
    setImporting(true);
    try {
      setLocalError('');
      const result = await apiPost('/admin/import-products', { fileData: importFileData, mode: importMode });
      setImportResult(result);
      setImportPreview(null);
      setImportFileData('');
      setImportFileName('');
      setShowImport(false);
      load();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const previewImport = async () => {
    if (!canImportProducts) return;
    if (!importFileData) {
      setLocalError('يرجى رفع ملف الإكسل أولاً');
      return;
    }
    setPreviewingImport(true);
    try {
      setLocalError('');
      const preview = await apiPost('/admin/import-products', {
        fileData: importFileData,
        dryRun: true,
        mode: importMode
      });
      setImportPreview(preview);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setPreviewingImport(false);
    }
  };

  const downloadImportErrors = (base64, fileName = 'import-errors.csv') => {
    if (!base64) return;
    const link = document.createElement('a');
    link.href = `data:text/csv;base64,${base64}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatImportAction = (action) => {
    if (action === 'update') return 'تحديث';
    if (action === 'update_purchase') return 'تحديث شراء/مورد';
    return 'إنشاء';
  };

  useEffect(() => {
    load();
  }, []);
  const isAvailable = (item) => item?.is_available !== 0 && item?.is_available !== false;
  const isHidden = (item) => item?.is_hidden === 1 || item?.is_hidden === true;
  const filteredItems = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (categoryFilter !== 'all' && !(Array.isArray(item.categories) ? item.categories : [item.category]).filter(Boolean).includes(categoryFilter)) return false;
      if (availabilityFilter !== 'all') {
        const available = isAvailable(item);
        if ((availabilityFilter === 'available' && !available) || (availabilityFilter === 'unavailable' && available)) {
          return false;
        }
      }
      if (visibilityFilter !== 'all') {
        const hidden = isHidden(item);
        if ((visibilityFilter === 'visible' && hidden) || (visibilityFilter === 'hidden' && !hidden)) {
          return false;
        }
      }
      if (!query) return true;

      const haystack = [
        item.id,
        item.name,
        Array.isArray(item.categories) ? item.categories.join(' ') : item.category,
        item.price,
        isAvailable(item) ? 'متوفر' : 'غير متوفر',
        isHidden(item) ? 'مخفي' : 'ظاهر'
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });

    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const getValue = (item) => {
        switch (sortBy) {
          case 'name': return String(item.name || '').toLowerCase();
          case 'category': return String(Array.isArray(item.categories) ? item.categories.join(', ') : (item.category || '')).toLowerCase();
          case 'price': return Number(item.price || 0);
          case 'purchase_price': return Number(item.purchase_price || 0);
          case 'supplier': return String(item.supplier_name || '').toLowerCase();
          case 'stock': return Number(item.stock || 0);
          case 'brand': return String(item.brand || '').toLowerCase();
          case 'type': return String(item.type || '').toLowerCase();
          case 'status': return isAvailable(item) ? 1 : 0;
          case 'visibility': return isHidden(item) ? 1 : 0;
          case 'created_at': return String(item.created_at || '');
          case 'updated_at': return String(item.updated_at || '');
          case 'id':
          default:
            return Number(item.id || 0);
        }
      };

      const left = getValue(a);
      const right = getValue(b);
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right), 'ar', { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [items, searchTerm, categoryFilter, availabilityFilter, visibilityFilter, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, page, itemsPerPage]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, availabilityFilter, visibilityFilter, sortBy, sortDirection, itemsPerPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(column);
    setSortDirection(column === 'id' ? 'desc' : 'asc');
  };

  const sortIndicator = (column) => {
    if (sortBy !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const buildPageItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    if (page <= 3) {
      pages.add(2);
      pages.add(3);
      pages.add(4);
    }
    if (page >= totalPages - 2) {
      pages.add(totalPages - 1);
      pages.add(totalPages - 2);
      pages.add(totalPages - 3);
    }

    const ordered = [...pages]
      .filter((value) => value >= 1 && value <= totalPages)
      .sort((a, b) => a - b);

    const result = [];
    for (let i = 0; i < ordered.length; i += 1) {
      if (i > 0 && ordered[i] - ordered[i - 1] > 1) {
        result.push('ellipsis');
      }
      result.push(ordered[i]);
    }
    return result;
  };

  const pageItems = buildPageItems();

  const toggleAvailability = async (item) => {
    if (!canHideProduct) return;
    try {
      await apiPut(`/products/${item.id}`, { is_available: !isAvailable(item) });
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const toggleHidden = async (item) => {
    if (!canHideProduct) return;
    try {
      await apiPut(`/products/${item.id}`, { is_hidden: !isHidden(item) });
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };
  useEffect(() => {
    const closeMenu = (e) => {
      const target = e.target;
      if (target && target.closest && (target.closest('.dropdown') || target.closest('.category-dropdown'))) return;
      setOpenMenuId(null);
      setCategoryDropdownOpen(false);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!Array.isArray(form.categories) || form.categories.length === 0) {
      setLocalError('الفئة مطلوبة');
      return;
    }
    try {
      const variantOptions = Array.isArray(form.variant_options) ? form.variant_options : [];
      const hasProductImage = (Array.isArray(form.image_urls) && form.image_urls.some((url) => String(url || '').trim()))
        || String(form.image_url || '').trim();
      const hasVariantImage = variantOptions.some((variant) =>
        String(variant.image_url || '').trim()
        || (Array.isArray(variant.image_urls) && variant.image_urls.some((url) => String(url || '').trim()))
      );
      if (form.is_available && !form.is_hidden && !hasProductImage && !hasVariantImage) {
        setLocalError('أضف صورة أساسية للمنتج أو صورة واحدة على الأقل لأحد خيارات اللون/القياس قبل نشر المنتج');
        return;
      }
      const colorOptions = variantOptions
        .filter((variant) => String(variant.color_name || '').trim() && String(variant.color_hex || '').trim())
        .reduce((list, variant) => {
          const key = `${String(variant.color_name).trim().toLowerCase()}::${String(variant.color_hex).trim().toUpperCase()}`;
          if (!list.some((item) => item.key === key)) {
            list.push({ key, name: String(variant.color_name).trim(), hex: String(variant.color_hex).trim() });
          }
          return list;
        }, [])
        .map(({ key: _key, ...color }) => color);
      const payload = {
        ...form,
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : null,
        stock: 0,
        color_options: colorOptions.length ? colorOptions : form.color_options,
        variant_options: variantOptions,
        image_url: form.image_urls?.[0] || null
      };

      if (!editingId || docsTouched) {
        payload.docs = normalizeDocPayload(form.docs);
      }

      if (canUpdatePurchasing) {
        payload.supplier_id = form.supplier_id ? Number(form.supplier_id) : null;
        payload.purchase_price = form.purchase_price === '' ? null : Number(form.purchase_price);
      }

      if (editingId) {
        await apiPut(`/products/${editingId}`, payload);
      } else {
        await apiPost('/products', payload);
      }

      setForm({ name:'', description:'', usage:'', technical_data:'', warnings:'', price:'', mrp:'', supplier_id:'', purchase_price:'', categories:[], color_options:[], variant_options:[], image_urls:[], docs:[], links:[], is_available:true, is_hidden:false });
      setImagePreviews([]);
      setOriginalDocs([]);
      setDocsTouched(false);
      setDocPreviews([]);
      setNewColor({ name: '', hex: '#000000' });
      setNewVariant(createVariantDraft());
      setCategoryDropdownOpen(false);
      setShowCreate(false);
      setEditingId(null);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImages = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    try {
      const dataUrls = await Promise.all(list.map(fileToDataUrl));
      const merged = [...(form.image_urls || []), ...dataUrls];
      setForm({ ...form, image_urls: merged });
      setImagePreviews(merged);
    } catch (err) {
      setError('فشل قراءة الصورة');
    }
  };

  const handleVariantImage = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setNewVariant({ ...newVariant, image_url: dataUrl, image_urls: [dataUrl] });
    } catch {
      setError('فشل قراءة صورة الخيار');
    }
  };

  const getVariantSizeRows = () => {
    const rows = Array.isArray(newVariant.size_rows) ? newVariant.size_rows : [];
    return rows.map((row) => ({
      size_name: String(row.size_name || '').trim(),
      price: String(row.price || '').trim(),
      purchase_price: String(row.purchase_price || '').trim()
    })).filter((row) => row.size_name);
  };

  const updateVariantSizeRow = (index, field, value) => {
    const rows = getVariantSizeRows();
    rows[index] = { ...rows[index], [field]: value };
    setNewVariant({ ...newVariant, size_rows: rows });
  };

  const removeVariantSizeRow = (index) => {
    const rows = getVariantSizeRows().filter((_, rowIndex) => rowIndex !== index);
    setNewVariant({ ...newVariant, size_rows: rows });
  };

  const addColorOption = () => {
    const name = String(newColor.name || '').trim();
    const hex = String(newColor.hex || '').trim();
    if (!name || !hex) return;
    const exists = (form.color_options || []).some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setLocalError('هذا اللون موجود بالفعل');
      return;
    }
    setLocalError('');
    setForm({
      ...form,
      color_options: [...(form.color_options || []), { name, hex }]
    });
    setNewColor({ name: '', hex: '#000000' });
  };

  const removeColorOption = (index) => {
    setForm({
      ...form,
      color_options: (form.color_options || []).filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const addVariantOption = () => {
    const colorName = String(newVariant.color_name || '').trim();
    const colorHex = String(newVariant.color_hex || '').trim();
    const pendingRow = {
      size_name: String(newVariant.size_name || '').trim(),
      price: String(newVariant.price || '').trim(),
      purchase_price: String(newVariant.purchase_price || '').trim()
    };
    const rows = getVariantSizeRows().filter((row) => row.size_name || row.price || row.purchase_price);
    if (pendingRow.size_name || pendingRow.price || pendingRow.purchase_price) rows.push(pendingRow);
    if (!colorName) {
      setLocalError('اختر لوناً محفوظاً من قائمة الألوان أولاً');
      return;
    }
    if (colorName && !colorHex) {
      setLocalError('اختر كود اللون');
      return;
    }
    const invalidPrice = rows.some((row) =>
      (row.price && Number(row.price) < 0) || (row.purchase_price && Number(row.purchase_price) < 0)
    );
    if (invalidPrice) {
      setLocalError('سعر البيع أو الشراء غير صحيح');
      return;
    }
    const duplicateInDraft = rows.some((row, index) =>
      rows.findIndex((item) => item.size_name.toLowerCase() === row.size_name.toLowerCase()) !== index
    );
    if (duplicateInDraft) {
      setLocalError('يوجد قياس مكرر داخل نفس اللون');
      return;
    }
    const rowsForConflict = rows.length ? rows : [{ size_name: '' }];
    const conflicts = rowsForConflict.some((row) => (form.variant_options || []).some((item) =>
      String(item.color_name || '').trim().toLowerCase() === colorName.toLowerCase()
      && String(item.color_hex || '').trim().toUpperCase() === colorHex.toUpperCase()
      && String(item.size_name || '').trim().toLowerCase() === row.size_name.toLowerCase()
    ));
    if (conflicts) {
      setLocalError('هذا الخيار موجود بالفعل');
      return;
    }
    setLocalError('');
    const imageUrl = newVariant.image_url || null;
    const imageUrls = Array.isArray(newVariant.image_urls) && newVariant.image_urls.length ? newVariant.image_urls : null;
    const nextVariants = rows.length
      ? rows.map((row, index) => ({
        id: `variant-${Date.now()}-${index}`,
        color_name: colorName || null,
        color_hex: colorName ? colorHex : null,
        size_name: row.size_name || null,
        price: row.price === '' ? null : Number(row.price),
        purchase_price: row.purchase_price === '' ? null : Number(row.purchase_price),
        image_url: imageUrl,
        image_urls: imageUrls
      }))
      : [{
        id: `variant-${Date.now()}`,
        color_name: colorName || null,
        color_hex: colorName ? colorHex : null,
        size_name: null,
        price: null,
        purchase_price: null,
        image_url: imageUrl,
        image_urls: imageUrls
      }];
    setForm({
      ...form,
      variant_options: [
        ...(form.variant_options || []),
        ...nextVariants
      ]
    });
    setNewVariant(createVariantDraft());
  };

  const removeVariantOption = (index) => {
    setForm({
      ...form,
      variant_options: (form.variant_options || []).filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const editVariantOption = (index) => {
    const variant = (form.variant_options || [])[index];
    if (!variant) return;
    setNewVariant({
      color_name: variant.color_name || '',
      color_hex: variant.color_hex || '#000000',
      image_url: variant.image_url || variant.image_urls?.[0] || '',
      image_urls: Array.isArray(variant.image_urls) ? variant.image_urls : (variant.image_url ? [variant.image_url] : []),
      size_name: String(variant.size_name || ''),
      price: variant.price == null ? '' : String(variant.price),
      purchase_price: variant.purchase_price == null ? '' : String(variant.purchase_price),
      size_rows: variant.size_name
        ? [{
          size_name: String(variant.size_name || ''),
          price: variant.price == null ? '' : String(variant.price),
          purchase_price: variant.purchase_price == null ? '' : String(variant.purchase_price)
        }]
        : []
    });
    removeVariantOption(index);
  };

  const getGroupedVariantOptions = () => {
    const groups = [];
    (form.variant_options || []).forEach((variant, index) => {
      const key = [
        String(variant.color_name || '').trim().toLowerCase(),
        String(variant.color_hex || '').trim().toUpperCase(),
        String(variant.image_url || variant.image_urls?.[0] || '').trim()
      ].join('::');
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = {
          key,
          color_name: variant.color_name,
          color_hex: variant.color_hex,
          image_url: variant.image_url || variant.image_urls?.[0] || '',
          variants: []
        };
        groups.push(group);
      }
      group.variants.push({ ...variant, index });
    });
    return groups;
  };

  const removeImage = (idx) => {
    const next = (form.image_urls || []).filter((_, i) => i !== idx);
    setForm({ ...form, image_urls: next });
    setImagePreviews(next);
  };

  const handleDocs = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const uploadPdf = async (file) => {
      const response = await fetch(`${API_BASE}/admin/product-docs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/pdf',
          'X-File-Name': encodeURIComponent(file.name || 'document.pdf')
        },
        body: file
      });
      if (!response.ok) {
        let message = 'فشل رفع ملف PDF';
        try {
          const data = await response.json();
          message = data?.error || message;
        } catch {
          // keep default message
        }
        throw new Error(message);
      }
      return response.json();
    };
    try {
      const uploadedDocs = await Promise.all(list.map(uploadPdf));
      const merged = [...(form.docs || []), ...uploadedDocs];
      setForm({ ...form, docs: merged });
      setDocsTouched(true);
      setDocPreviews(merged);
    } catch (err) {
      setError(err.message || 'فشل رفع ملف PDF');
    }
  };

  const removeDoc = (idx) => {
    const next = (form.docs || []).filter((_, i) => i !== idx);
    setForm({ ...form, docs: next });
    setDocsTouched(true);
    setDocPreviews(next);
  };

  const addLink = (e) => {
    e.preventDefault();
    if (!newLink.url.trim()) return;
    const next = [...(form.links || []), { label: newLink.label.trim(), url: newLink.url.trim() }];
    setForm({ ...form, links: next });
    setNewLink({ label: '', url: '' });
  };

  const removeLink = (idx) => {
    const next = (form.links || []).filter((_, i) => i !== idx);
    setForm({ ...form, links: next });
  };

  const handleDelete = async (id) => {
    if (!canDeleteProduct) return;
    if (!confirm('حذف المنتج؟')) return;
    try {
      await apiDelete(`/products/${id}`);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setAvailabilityFilter('all');
    setVisibilityFilter('all');
    setSortBy('id');
    setSortDirection('desc');
    setItemsPerPage(10);
    setPage(1);
  };

  const exportProducts = async () => {
    try {
      setLocalError('');
      const url = new URL(`${API_BASE}/admin/products/export`, window.location.origin);
      url.searchParams.set('format', 'xlsx');
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!response.ok) {
        let message = 'فشل تصدير المنتجات';
        try {
          const data = await response.json();
          message = data?.error || message;
        } catch {
          // keep default message
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'products.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setLocalError(err.message || 'فشل تصدير المنتجات');
    }
  };

  const openColorList = async () => {
    setShowColorList(true);
    await loadProductOptionLists();
  };

  return (
    <div className="grid single">
      <section className="card">
        <div className="card-header">
          <h2>المنتجات</h2>
          <div className="row">
            <button type="button" className="secondary" onClick={resetFilters}>إعادة تعيين</button>
            <button type="button" className="secondary" onClick={exportProducts}>تصدير Excel</button>
            <button type="button" className="secondary" onClick={openColorList}>قائمة الألوان</button>
            <button type="button" className="secondary" onClick={() => setShowSizeList(true)}>قائمة القياسات</button>
            {canImportProducts && <button className="secondary" onClick={() => setShowImport(true)}>استيراد Excel</button>}
            {canCreateProduct && <button onClick={openCreate}>إضافة منتج</button>}
          </div>
        </div>
        {importResult && (
          <div className="notice">
            تم الاستيراد بنجاح. عدد المنتجات المستوردة: {importResult.imported ?? 0}
            {(importResult.updated ?? 0) > 0 ? ` | تم تحديثها: ${importResult.updated}` : ''}
            {(importResult.totalRows ?? 0) > 0 ? ` | إجمالي الصفوف: ${importResult.totalRows}` : ''}
            {(importResult.skippedDuplicates ?? 0) > 0 ? ` | المكررة: ${importResult.skippedDuplicates}` : ''}
            {(importResult.skippedInvalid ?? 0) > 0 ? ` | غير الصالحة: ${importResult.skippedInvalid}` : ''}
            {Array.isArray(importResult.imageZipWarnings) && importResult.imageZipWarnings.length > 0 ? ` | تحذيرات صور: ${importResult.imageZipWarnings.length}` : ''}
            {Array.isArray(importResult.createdCategories) && importResult.createdCategories.length > 0
              ? ` | فئات جديدة: ${importResult.createdCategories.length}`
              : ''}
            {Array.isArray(importResult.invalidRows) && importResult.invalidRows.length > 0 && (
              <>
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="secondary" onClick={() => downloadImportErrors(importResult.errorExportBase64, 'import-errors.csv')}>
                    تنزيل ملف الأخطاء
                  </button>
                </div>
                <div className="preview-list" style={{ marginTop: 10 }}>
                {importResult.invalidRows.map((row, index) => (
                  <div key={`${row.row}-${index}`} className="preview-row invalid">
                    <span>الصف {row.row}{row.name ? ` - ${row.name}` : ''}</span>
                    <span>{row.reason}</span>
                  </div>
                ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className="row table-toolbar">
          <input
            placeholder="بحث بالمعرف أو الاسم أو الفئة أو السعر"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">كل الفئات</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
          <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="available">متوفر</option>
            <option value="unavailable">غير متوفر</option>
          </select>
          <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)}>
            <option value="all">كل الظهور</option>
            <option value="visible">ظاهر</option>
            <option value="hidden">مخفي</option>
          </select>
          <details className="column-picker">
            <summary>تخصيص الأعمدة</summary>
            <div className="column-picker-menu">
              {PRODUCT_COLUMN_DEFS.map((column) => (
                <label key={column.key} className="checkbox column-picker-option">
                  <input
                    type="checkbox"
                    checked={isProductColumnVisible(column.key)}
                    onChange={() => toggleProductColumn(column.key)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
              <button type="button" className="secondary" onClick={() => setVisibleProductColumns(DEFAULT_PRODUCT_COLUMNS)}>
                إظهار الكل
              </button>
            </div>
          </details>
        </div>
        {loading ? <p>جارٍ التحميل...</p> : (
          <ResponsiveTableWrap minWidth="1120px" ariaLabel="جدول المنتجات">
          <table className="responsive-table-card">
            <thead>
              <tr>
                {PRODUCT_COLUMN_DEFS.filter((column) => isProductColumnVisible(column.key)).map((column) => (
                  <th key={column.key}>
                    <button type="button" className={`sortable-header ${sortBy === column.key ? 'active' : ''}`} onClick={() => toggleSort(column.key)}>
                      <span>{column.label}</span>
                      <span className="sort-icon">{sortIndicator(column.key)}</span>
                    </button>
                  </th>
                ))}
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id}>
                  {PRODUCT_COLUMN_DEFS.filter((column) => isProductColumnVisible(column.key)).map((column) => (
                    <td key={column.key} data-label={column.label}>{renderProductCell(item, column.key)}</td>
                  ))}
                  <td data-label="إجراءات" className="responsive-actions-cell">
                    <div className="actions-menu">
                      {canUpdateProduct && (
                        <button className="icon-button" aria-label="تعديل" onClick={() => openEdit(item)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58ZM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0l-1.13 1.12 3.75 3.75 1.13-1.13Z" fill="currentColor"/>
                          </svg>
                        </button>
                      )}
                      <div className={`dropdown ${openMenuId === item.id ? 'open' : ''}`}>
                        <button
                          className="dots"
                          aria-label="خيارات"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === item.id ? null : item.id);
                          }}
                        >
                          ⋯
                        </button>
                        <div className="menu" onClick={(e) => e.stopPropagation()}>
                          {canHideProduct && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAvailability(item);
                                setOpenMenuId(null);
                              }}
                            >
                              {isAvailable(item) ? 'اجعل غير متوفر' : 'اجعل متوفر'}
                            </button>
                          )}
                          {canHideProduct && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHidden(item);
                                setOpenMenuId(null);
                              }}
                            >
                              {isHidden(item) ? 'إظهار المنتج' : 'إخفاء المنتج'}
                            </button>
                          )}
                          {canDeleteProduct && (
                            <button
                              className="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                                setOpenMenuId(null);
                              }}
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr className="responsive-empty-row">
                  <td colSpan={visibleProductColumnCount}>لا توجد منتجات مطابقة للفلاتر الحالية</td>
                </tr>
              )}
            </tbody>
          </table>
          </ResponsiveTableWrap>
        )}
        {filteredItems.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-meta">
              <label className="pagination-page-size">
                <span>عدد الصفوف</span>
                <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value) || 10)}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
              <div className="muted">
                عرض {((page - 1) * itemsPerPage) + 1}-{Math.min(page * itemsPerPage, filteredItems.length)} من {filteredItems.length}
              </div>
            </div>
            <div className="pagination-controls">
              <button type="button" className="pagination-nav" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="الصفحة السابقة">&#8249;</button>
              <div className="pagination-numbers">
                {pageItems.map((item, index) => item === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`pagination-number ${page === item ? 'active' : ''}`}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button type="button" className="pagination-nav" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="الصفحة التالية">&#8250;</button>
            </div>
          </div>
        )}
      </section>

      {showColorList && (
        <Modal title="قائمة الألوان" onClose={() => { setShowColorList(false); resetColorDraft(); }}>
          <div className="form">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                placeholder="اسم اللون، مثال: Chrome"
                value={newColor.name}
                onChange={(e) => setNewColor({ ...newColor, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveColorDraft();
                  }
                }}
              />
              <input
                type="color"
                value={newColor.hex}
                onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })}
                style={{ width: 72, minWidth: 72, padding: 4 }}
              />
              <button type="button" onClick={saveColorDraft}>{editingColorId ? 'تحديث اللون' : 'إضافة لون'}</button>
              {editingColorId && <button type="button" className="secondary" onClick={resetColorDraft}>إلغاء التعديل</button>}
            </div>
            <p className="muted">هذه القائمة تحفظ اسم اللون وكود RGB فقط. السعر والصورة يتم تحديدهما داخل كل منتج.</p>
            {colorOptions.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {colorOptions.map((color) => (
                  <div key={color.id} className="preview-item">
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 9999, background: color.hex, border: '1px solid #d1d5db' }} />
                        <strong>{color.name}</strong>
                        <span className="muted">{color.hex}</span>
                      </span>
                      <span className="row" style={{ gap: 6 }}>
                        <button type="button" className="secondary small" onClick={() => editSavedColor(color)}>تعديل</button>
                        <button type="button" className="danger small" onClick={() => removeSavedColor(color.id)}>حذف</button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">لا توجد ألوان محفوظة بعد.</div>
            )}
          </div>
        </Modal>
      )}

      {showSizeList && (
        <Modal title="قائمة القياسات" onClose={() => setShowSizeList(false)}>
          <div className="form">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="اسم المجموعة، مثال: قياسات مصارف المياه"
                value={newSizeGroupName}
                onChange={(e) => setNewSizeGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSizeGroup();
                  }
                }}
              />
              <button type="button" onClick={addSizeGroup}>إضافة مجموعة</button>
            </div>
            <div className={`row size-entry-row ${sizeOptions.length > 0 ? 'has-group' : ''}`}>
              {sizeOptions.length > 0 && (
                <select
                  className="size-group-select"
                  value={selectedSizeGroup?.id || ''}
                  onChange={(e) => setSelectedSizeGroupId(e.target.value)}
                >
                  {sizeOptions.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              )}
              <input
                className="size-value-input"
                placeholder="قيمة القياس، مثال: 20 أو XL"
                value={newSizeValue}
                onChange={(e) => setNewSizeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSizeOption();
                  }
                }}
              />
              <div
                className={`size-unit-picker ${sizeUnitDropdownOpen ? 'open' : ''}`}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setSizeUnitDropdownOpen(false);
                  }
                }}
              >
                <div className="size-unit-trigger">
                  <input
                    placeholder="وحدة القياس"
                    value={newSizeUnit}
                    autoComplete="off"
                    spellCheck="false"
                    role="combobox"
                    aria-expanded={sizeUnitDropdownOpen}
                    aria-autocomplete="list"
                    onFocus={() => setSizeUnitDropdownOpen(true)}
                    onChange={(e) => {
                      setNewSizeUnit(e.target.value);
                      setSizeUnitDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSizeOption();
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSizeUnitDropdownOpen(true);
                      } else if (e.key === 'Escape') {
                        setSizeUnitDropdownOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label="فتح قائمة وحدات القياس"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSizeUnitDropdownOpen((value) => !value)}
                  >
                    ▾
                  </button>
                </div>
                {sizeUnitDropdownOpen && (
                  <div className="size-unit-menu" role="listbox">
                    {filteredSizeUnits.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        className={newSizeUnit.trim().toLowerCase() === unit.toLowerCase() ? 'active' : ''}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNewSizeUnit(unit);
                          setSizeUnitDropdownOpen(false);
                        }}
                        role="option"
                        aria-selected={newSizeUnit.trim().toLowerCase() === unit.toLowerCase()}
                      >
                        <span>{unit}</span>
                        {newSizeUnit.trim().toLowerCase() === unit.toLowerCase() && <span className="size-unit-check">✓</span>}
                      </button>
                    ))}
                    {isTypedSizeUnitNew && (
                      <button
                        type="button"
                        className="size-unit-create"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setSizeUnitDropdownOpen(false)}
                      >
                        إضافة "{newSizeUnit.trim()}" عند حفظ القياس
                      </button>
                    )}
                    {!filteredSizeUnits.length && !isTypedSizeUnitNew && (
                      <div className="size-unit-empty">لا توجد وحدات مطابقة</div>
                    )}
                  </div>
                )}
              </div>
              <button type="button" className="size-add-button" onClick={addSizeOption}>إضافة قياس</button>
            </div>
            <p className="muted">أنشئ مجموعة مثل "قياسات مصارف المياه"، ثم أضف تحتها أكثر من قياس. داخل المنتج يمكنك تطبيق المجموعة كاملة على اللون.</p>
            {sizeOptions.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {sizeOptions.map((group) => (
                  <div key={group.id} className="preview-item">
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <strong>{group.name}</strong>
                      <button type="button" className="secondary small" onClick={() => removeSizeGroup(group.id)}>حذف المجموعة</button>
                    </div>
                    {(group.sizes || []).length > 0 ? (
                      <div className="selected-chips">
                        {(group.sizes || []).map((size) => (
                          <span key={getSizeOptionLabel(size)} className="selected-chip" style={{ gap: 8 }}>
                            {getSizeOptionLabel(size)}
                            <button type="button" className="link-button" onClick={() => removeSizeOption(group.id, size)}>حذف</button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">لا توجد قياسات داخل هذه المجموعة.</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">لا توجد مجموعات قياسات محفوظة بعد.</div>
            )}
          </div>
        </Modal>
      )}

      {showCreate && (canCreateProduct || canUpdateProduct) && (
        <Modal title={editingId ? 'تعديل منتج' : 'منتج جديد'} onClose={() => setShowCreate(false)}>
          {localError && <div className="error">{localError}</div>}
          <form className="form" onSubmit={handleSubmit}>
              <input placeholder="الاسم" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} />
              <div className={`category-dropdown ${categoryDropdownOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="category-dropdown-trigger"
                  onClick={() => setCategoryDropdownOpen((value) => !value)}
                >
                  <div className="category-dropdown-value">
                    {(form.categories || []).length > 0 ? (
                      <div className="selected-chips">
                        {(form.categories || []).map((name) => (
                          <span key={name} className="selected-chip">{name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="category-placeholder">اختر الفئات</span>
                    )}
                  </div>
                  <span className="category-caret">▾</span>
                </button>
                {categoryDropdownOpen && (
                  <div className="multi-select-list category-dropdown-menu">
                    {categories.map((category) => {
                      const checked = (form.categories || []).includes(category.name);
                      return (
                        <label key={category.id} className={`checkbox category-option ${checked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...(form.categories || []), category.name]
                                : (form.categories || []).filter((name) => name !== category.name);
                              setForm({ ...form, categories: next });
                            }}
                          />
                          <span className="category-option-box">{checked ? '✓' : ''}</span>
                          <span>{category.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="upload">
                <label className="upload-label">خيارات اللون والقياس</label>
                <div style={{ display: 'grid', gap: 10, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#f8fafc' }}>
                  <select
                    value={getSelectedVariantColorId()}
                    onChange={(e) => applySavedColorToVariant(e.target.value)}
                  >
                    <option value="">اختر لوناً من قائمة الألوان</option>
                    {colorOptions.map((color) => (
                      <option key={color.id} value={color.id}>{color.name}</option>
                    ))}
                  </select>
                  {!newVariant.color_name ? (
                    <div className="notice">اختر لوناً محفوظاً أولاً، وبعدها ستظهر الصورة والسعر والقياسات لهذا اللون.</div>
                  ) : (
                    <>
                      <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 9999, background: newVariant.color_hex, border: '1px solid #d1d5db' }} />
                        <strong>{newVariant.color_name}</strong>
                        <span className="muted">{newVariant.color_hex}</span>
                        <label className="secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          صورة اللون
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleVariantImage(e.target.files?.[0])}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {newVariant.image_url && (
                          <img
                            src={newVariant.image_url}
                            alt="معاينة صورة اللون"
                            style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 10, border: '1px solid #d1d5db' }}
                          />
                        )}
                      </div>
                      <div className={`variant-size-row ${canReadPurchasing ? '' : 'no-purchase'}`}>
                        <span>سعر اللون بدون قياس</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="سعر البيع"
                          value={newVariant.price}
                          onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                        />
                        {canReadPurchasing && (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="سعر الشراء"
                            value={newVariant.purchase_price}
                            onChange={(e) => setNewVariant({ ...newVariant, purchase_price: e.target.value })}
                          />
                        )}
                        <span className="muted">اختياري</span>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <strong style={{ fontSize: 13 }}>القياسات تحت هذا اللون</strong>
                        {sizeOptions.length > 0 && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div className="selected-chips">
                              {sizeOptions.map((group) => (
                                <button key={group.id} type="button" className="selected-chip" onClick={() => applySizeGroupToDraft(group)}>
                                  إضافة مجموعة: {group.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {getVariantSizeRows().length > 0 && (
                          <div className="variant-size-editor">
                            <div className={`variant-size-row header ${canReadPurchasing ? '' : 'no-purchase'}`}>
                              <span>القياس</span>
                              <span>سعر البيع</span>
                              {canReadPurchasing && <span>سعر الشراء</span>}
                              <span>إجراء</span>
                            </div>
                            {getVariantSizeRows().map((row, rowIndex) => (
                              <div key={`${row.size_name}-${rowIndex}`} className={`variant-size-row ${canReadPurchasing ? '' : 'no-purchase'}`}>
                                <strong>{row.size_name}</strong>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="سعر البيع"
                                  value={row.price}
                                  onChange={(e) => updateVariantSizeRow(rowIndex, 'price', e.target.value)}
                                />
                                {canReadPurchasing && (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="سعر الشراء"
                                    value={row.purchase_price}
                                    onChange={(e) => updateVariantSizeRow(rowIndex, 'purchase_price', e.target.value)}
                                  />
                                )}
                                <button type="button" className="secondary small" onClick={() => removeVariantSizeRow(rowIndex)}>حذف</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={addVariantOption}>إضافة اللون والقياسات</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <p className="muted">أدخل اللون مرة واحدة، ثم أضف تحته قياساً أو أكثر. كل قياس سيظهر في المتجر كسعر مستقل. إذا لم تضف صورة للون سيستخدم صورة المنتج الأساسية.</p>
                {(form.variant_options || []).length > 0 && (
                  <div className="preview-grid variant-preview-grid">
                    {getGroupedVariantOptions().map((group) => (
                      <div key={group.key} className="preview-item variant-preview-card">
                        <div className="variant-preview-head">
                          <div className="variant-preview-title">
                            <strong>{group.color_name || 'بدون لون'}</strong>
                            {group.color_hex && <span className="variant-color-dot" style={{ background: group.color_hex }} />}
                          </div>
                          <div className="variant-preview-thumb">
                            {group.image_url ? (
                              <img src={group.image_url} alt="صورة اللون" />
                            ) : (
                              <span>الصورة الأساسية</span>
                            )}
                          </div>
                        </div>
                        <div className="variant-preview-list">
                          {group.variants.map((variant) => (
                            <div key={`${variant.id || variant.index}`} className="preview-row variant-preview-row">
                              <span className="variant-preview-size">{variant.size_name || 'لون فقط'}</span>
                              <span>بيع: {(variant.price ?? form.price) || '-'}</span>
                              {canReadPurchasing && <span>شراء: {(variant.purchase_price ?? form.purchase_price) || '-'}</span>}
                              <span className="variant-preview-actions">
                                <button type="button" className="secondary small" onClick={() => editVariantOption(variant.index)}>تعديل</button>
                                <button type="button" className="secondary small" onClick={() => removeVariantOption(variant.index)}>حذف</button>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="upload">
                <label className="upload-label">الصور</label>
                <input type="file" multiple accept="image/*" onChange={(e)=>handleImages(e.target.files)} />
                {imagePreviews.length > 0 && (
                  <div className="preview-grid">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="preview-item media-preview">
                        <button type="button" className="preview-remove" aria-label="حذف الصورة" onClick={() => removeImage(i)}>
                          <TrashIcon />
                        </button>
                        <div className="preview-media-frame">
                          <img src={src} alt={`preview-${i}`} className="preview-media" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input placeholder="السعر" value={form.price} onChange={(e)=>setForm({...form, price: e.target.value})} />
              <input placeholder="السعر قبل الخصم" value={form.mrp} onChange={(e)=>setForm({...form, mrp: e.target.value})} />
              {canReadPurchasing && canUpdatePurchasing && (
                <>
                  <select value={form.supplier_id} onChange={(e)=>setForm({...form, supplier_id: e.target.value})}>
                    <option value="">بدون مورد</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                  <input placeholder="سعر الشراء" value={form.purchase_price} onChange={(e)=>setForm({...form, purchase_price: e.target.value})} />
                </>
              )}
              <textarea placeholder="الوصف" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} />
              <textarea placeholder="آلية الاستخدام" value={form.usage} onChange={(e)=>setForm({...form, usage: e.target.value})} />
              <textarea placeholder="بيانات فنية" value={form.technical_data} onChange={(e)=>setForm({...form, technical_data: e.target.value})} />
              <textarea placeholder="تحذيرات" value={form.warnings} onChange={(e)=>setForm({...form, warnings: e.target.value})} />
              <div className="upload">
                <label className="upload-label">ملفات البيانات (PDF فقط)</label>
                <input type="file" multiple accept="application/pdf,.pdf" onChange={(e)=>handleDocs(e.target.files)} />
                {docPreviews.length > 0 && (
                  <div className="preview-grid pdf-preview-grid">
                    {docPreviews.map((doc, i) => {
                      return (
                        <PdfPreviewCard
                          key={`${getDocPreviewName(doc, i)}-${i}`}
                          doc={doc}
                          index={i}
                          onRemove={() => removeDoc(i)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="upload">
                <label className="upload-label">روابط</label>
                <div className="row">
                  <input
                    placeholder="عنوان الرابط (اختياري)"
                    value={newLink.label}
                    onChange={(e)=>setNewLink({ ...newLink, label: e.target.value })}
                  />
                  <input
                    placeholder="الرابط"
                    value={newLink.url}
                    onChange={(e)=>setNewLink({ ...newLink, url: e.target.value })}
                  />
                  <button type="button" onClick={addLink}>إضافة</button>
                </div>
                {(form.links || []).length > 0 && (
                  <div className="preview-grid">
                    {form.links.map((l, i) => (
                      <div key={i} className="preview-item">
                        <div className="text-sm text-gray-700 break-all">{l.label || l.url}</div>
                        <button type="button" className="secondary" onClick={() => removeLink(i)}>إزالة</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit">{editingId ? 'تحديث' : 'حفظ'}</button>
          </form>
        </Modal>
      )}

      {showImport && canImportProducts && (
        <Modal title="استيراد منتجات من Excel" onClose={() => setShowImport(false)}>
          {localError && <div className="error">{localError}</div>}
          <div className="form">
            <div className="notice">
              سيتم تحديث المنتجات المطابقة عبر المعرف أولاً ثم الاسم، وإضافة أي منتجات جديدة من نفس الملف. كرّر نفس المنتج في أكثر من صف لإضافة أكثر من لون أو قياس.
            </div>
            <div className="muted">
              الأعمدة المدعومة: اسم المنتج، الفئات، سعر البيع، سعر الشراء، المورد، الوصف، بيانات فنية، تعليمات الاستخدام، تحذيرات، متوفر، مخفي، لون الخيار، كود لون الخيار، قياس الخيار، سعر بيع الخيار، سعر شراء الخيار. إذا كان ملف Excel يحتوي صوراً مدمجة سيتم استخدامها من نفس الملف.
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={(e)=>parseImportFile(e.target.files?.[0])} />
            {importFileName && <div className="muted">الملف الحالي: {importFileName}</div>}
            <label className="checkbox">
              <input type="checkbox" checked={importMode === 'update_existing'} onChange={(e) => setImportMode(e.target.checked ? 'update_existing' : 'create_only')} />
              تحديث المنتجات الموجودة، مع إضافة المنتجات الجديدة
            </label>
            {importMode !== 'update_existing' && (
              <div className="muted">عند إلغاء هذا الخيار سيتم تجاهل المنتجات المطابقة وإضافة المنتجات الجديدة فقط.</div>
            )}
            <a className="secondary" href={templateUrl} download="store-IT-26-import-template.xlsx">تنزيل قالب Excel</a>
            {importPreview && (
              <div className="notice">
                معاينة قبل التنفيذ: إنشاء {importPreview.toCreate ?? 0} | تحديث {importPreview.toUpdate ?? 0} | مكرر {importPreview.skippedDuplicates ?? 0} | غير صالح {importPreview.skippedInvalid ?? 0}
                {` | خيارات: ${importPreview.totalVariantCount ?? (Array.isArray(importPreview.previewRows) ? importPreview.previewRows.reduce((total, row) => total + Number(row.variantCount || 0), 0) : 0)}`}
                {Array.isArray(importPreview.createdCategories) && importPreview.createdCategories.length > 0
                  ? ` | فئات ستُنشأ: ${importPreview.createdCategories.length}`
                  : ''}
                {Array.isArray(importPreview.imageZipWarnings) && importPreview.imageZipWarnings.length > 0
                  ? ` | تحذيرات صور: ${importPreview.imageZipWarnings.length}`
                  : ''}
              </div>
            )}
            {importPreview?.previewRows?.length > 0 && (
              <div className="preview-list">
                {importPreview.previewRows.map((row) => (
                  <div key={`${row.row}-${row.name}`} className="preview-row">
                    <span>الصف {row.row}{Array.isArray(row.rowNumbers) && row.rowNumbers.length > 1 ? ` (${row.rowNumbers.join(', ')})` : ''} - {row.name}</span>
                    <span>{formatImportAction(row.action)} | {row.category || '-'} | {row.price ?? '-'} | خيارات: {row.variantCount ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
            {importPreview?.imageZipWarnings?.length > 0 && (
              <div className="preview-list">
                {importPreview.imageZipWarnings.map((warning, index) => (
                  <div key={`${warning.file}-${index}`} className="preview-row invalid">
                    <span>{warning.file || `منتج ${warning.productId}`}</span>
                    <span>{warning.reason || 'تحذير صورة'}</span>
                  </div>
                ))}
              </div>
            )}
            {importPreview?.invalidRows?.length > 0 && (
              <>
                <div className="preview-list">
                  {importPreview.invalidRows.map((row, index) => (
                    <div key={`${row.row}-${index}`} className="preview-row invalid">
                      <span>الصف {row.row}{row.name ? ` - ${row.name}` : ''}</span>
                      <span>{row.reason}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className="secondary" onClick={() => downloadImportErrors(importPreview.errorExportBase64, 'import-preview-errors.csv')}>
                  تنزيل أخطاء المعاينة
                </button>
              </>
            )}
            <div className="row">
              <button type="button" className="secondary" onClick={previewImport} disabled={previewingImport || importing}>
                {previewingImport ? 'جاري التحليل...' : 'معاينة قبل الاستيراد'}
              </button>
              <button onClick={runImport} disabled={importing}>
                {importing ? 'جاري الاستيراد...' : 'تنفيذ الاستيراد'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Orders({ setError, currentAdmin, refreshSession }) {
  const ORDER_STATUS_LABELS = {
    pending_payment: 'بانتظار الدفع',
    paid: 'قيد التجهيز',
    delivered: 'تم التسليم',
    cancelled: 'ملغي'
  };

  const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[String(status || '').trim()] || String(status || '-');

  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [supplierDeliveries, setSupplierDeliveries] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(null);
  const [pdfEmailDialog, setPdfEmailDialog] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null);
  const [deliveryAccounting, setDeliveryAccounting] = useState(null);
  const [purchaseCalcLoading, setPurchaseCalcLoading] = useState(false);
  const [deliveryDialog, setDeliveryDialog] = useState(null);
  const [discountDialog, setDiscountDialog] = useState(null);
  const [editItemsDialog, setEditItemsDialog] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderProducts, setOrderProducts] = useState([]);
  const [orderCities, setOrderCities] = useState([]);
  const [orderClients, setOrderClients] = useState([]);
  const [orderSuppliers, setOrderSuppliers] = useState([]);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [productPickerOpenIndex, setProductPickerOpenIndex] = useState(null);
  const [manualOrder, setManualOrder] = useState({
    buyerType: 'client',
    client_id: '',
    supplier_buyer_id: '',
    clientSearch: '',
    supplierSearch: '',
    customer: { name: '', phone: '', email: '', address: { line1: '', city: '', country: 'فلسطين' } },
    notes: '',
    status: 'pending_payment',
    discount: { type: 'fixed', value: '', reason: '' },
    items: [createBlankOrderItem()]
  });
  const [message, setMessage] = useState('');
  const [sendingKey, setSendingKey] = useState('');
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const orderDetailsRef = useRef(null);
  const ordersRequestId = useRef(0);
  const createOrderIdempotencyKeyRef = useRef(null);
  const discountIdempotencyKeyRef = useRef(null);
  const deliveryIdempotencyKeyRef = useRef(null);
  const canReadList = hasPermission(currentAdmin, 'orders', 'read_list');
  const canReadUnpaid = hasPermission(currentAdmin, 'orders', 'read_unpaid');
  const defaultOrderStatus = canReadList ? 'paid' : (canReadUnpaid ? 'pending_payment' : 'paid');
  const [statusFilter, setStatusFilter] = useState(defaultOrderStatus);
  const canReadDetails = hasPermission(currentAdmin, 'orders', 'read_details');
  const canCreateOrder = hasPermission(currentAdmin, 'orders', 'create');
  const canChangeStatus = hasPermission(currentAdmin, 'orders', 'change_status');
  const canReadPurchasing = hasPermission(currentAdmin, 'purchasing', 'read');
  const canPreviewCustomerEmail = hasPermission(currentAdmin, 'orders', 'preview_customer_email');
  const canPreviewInternalEmail = hasPermission(currentAdmin, 'orders', 'preview_internal_email');
  const canSendCustomerEmail = hasPermission(currentAdmin, 'orders', 'send_customer_email');
  const canSendInternalEmail = hasPermission(currentAdmin, 'orders', 'send_internal_email');
  const formatMoney = (value) => Number(value || 0).toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getContactPhone = (value) => {
    let text = String(value || '').trim();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.phone) text = String(parsed.phone || '').trim();
    } catch {
      // Plain text contact info is supported.
    }
    const digits = text.replace(/\D/g, '');
    if (!digits) return text;
    return digits.startsWith('0') ? digits : `0${digits}`;
  };
  const getAccountingSkipReasonLabel = (reason) => {
    switch (String(reason || '').trim()) {
      case 'missing supplier': return 'لم يتم ربط المنتج بمورد';
      case 'missing purchase price or amount': return 'سعر الشراء غير محدد أو المبلغ صفر';
      case 'supplier not found': return 'المورد غير موجود';
      case 'already created': return 'السند موجود مسبقاً';
      default: return reason || 'تم التخطي';
    }
  };
  const getDiscountAmount = (order) => Number(order?.discount_amount || 0);
  const hasDiscount = (order) => getDiscountAmount(order) > 0;
  const DELIVERY_PAYER_LABELS = {
    customer: 'الزبون',
    store: 'المتجر',
    supplier: 'المورد',
    merchant: 'المتجر',
    me: 'المتجر'
  };
  const normalizeDeliveryPayer = (payer) => {
    const value = String(payer || '').trim();
    return value === 'merchant' || value === 'me' ? 'store' : value;
  };
  const getDeliveryAmount = (order) => Number(order?.delivery_fee_amount || 0);
  const hasDelivery = (order) => getDeliveryAmount(order) > 0;
  const getDeliveryPayerLabel = (payer) => DELIVERY_PAYER_LABELS[normalizeDeliveryPayer(payer)] || '-';
  const getCustomerDeliveryAmount = (order) => normalizeDeliveryPayer(order?.delivery_payer) === 'customer' ? getDeliveryAmount(order) : 0;
  const getBeforeDiscountPayableTotal = (order) => Math.max(0, Math.round((Number(order?.subtotal || 0) + getCustomerDeliveryAmount(order)) * 100) / 100);
  const getPayableTotal = (order) => Math.max(0, Math.round((Number(order?.total || 0) + getCustomerDeliveryAmount(order)) * 100) / 100);
  const canEditOrderDiscount = (order) => ['pending_payment', 'paid'].includes(String(order?.status || '').trim());
  const canEditOrderItems = (order) => ['pending_payment', 'paid'].includes(String(order?.status || '').trim());
  const getOrderItemSuppliers = (sourceItems = items) => {
    const suppliers = new Map();
    for (const item of Array.isArray(sourceItems) ? sourceItems : []) {
      const supplierId = Number(item?.supplier_id || 0);
      if (!Number.isInteger(supplierId) || supplierId <= 0 || suppliers.has(supplierId)) continue;
      suppliers.set(supplierId, {
        supplier_id: supplierId,
        supplier_name: item.supplier_name || `مورد #${supplierId}`
      });
    }
    return [...suppliers.values()];
  };
  const buildSupplierDeliveryRows = (sourceItems = items, existingRows = supplierDeliveries) => {
    const existingBySupplier = new Map((Array.isArray(existingRows) ? existingRows : []).map((row) => [Number(row.supplier_id), row]));
    return getOrderItemSuppliers(sourceItems).map((supplier) => {
      const existing = existingBySupplier.get(Number(supplier.supplier_id)) || {};
      return {
        supplier_id: supplier.supplier_id,
        supplier_name: existing.supplier_name || supplier.supplier_name,
        amount: Number(existing.amount || 0) > 0 ? String(existing.amount) : '',
        note: existing.note || ''
      };
    });
  };
  const orderStatusOptions = useMemo(() => {
    const options = [];
    if (canReadUnpaid) options.push(['pending_payment', ORDER_STATUS_LABELS.pending_payment]);
    if (canReadList) {
      options.push(
        ['paid', ORDER_STATUS_LABELS.paid],
        ['delivered', ORDER_STATUS_LABELS.delivered],
        ['cancelled', ORDER_STATUS_LABELS.cancelled]
      );
    }
    return options;
  }, [canReadList, canReadUnpaid]);

  const load = async (requestedStatus = statusFilter) => {
    if (!canReadList && !canReadUnpaid) {
      setOrders([]);
      return;
    }
    try {
      setMessage('');
      const requested = String(requestedStatus || '').trim();
      const nextStatus = canReadList
        ? (requested || 'paid')
        : 'pending_payment';
      const requestId = ordersRequestId.current + 1;
      ordersRequestId.current = requestId;
      const data = await apiGet(`/admin/orders?status=${encodeURIComponent(nextStatus)}&_=${Date.now()}`);
      if (requestId !== ordersRequestId.current) return;
      const rows = Array.isArray(data)
        ? data.filter((order) => String(order.status || '').trim() === nextStatus)
        : [];
      setOrders(rows);
      setSelected((current) => (current && rows.some((order) => String(order.id) === String(current.id)) ? current : null));
    } catch (err) {
      setError(err.message);
    }
  };

  const loadOrder = async (id) => {
    if (!canReadDetails) return;
    try {
      setMessage('');
      setDeliveryAccounting((current) => (String(current?.orderId || '') === String(id) ? current : null));
      const data = await apiGet(`/admin/orders/${id}`);
      setSelected(data.order);
      setItems(data.items || []);
      setSupplierDeliveries(data.supplier_deliveries || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const openCreateOrderDialog = async () => {
    if (!canCreateOrder) return;
    createOrderIdempotencyKeyRef.current = null;
    setCreatingOrder(false);
    setCreateDialogOpen(true);
    setManualOrder({
      buyerType: 'client',
      client_id: '',
      supplier_buyer_id: '',
      clientSearch: '',
      supplierSearch: '',
      customer: { name: '', phone: '', email: '', address: { line1: '', city: '', country: 'فلسطين' } },
      notes: '',
      status: 'pending_payment',
      discount: { type: 'fixed', value: '', reason: '' },
      items: [createBlankOrderItem()]
    });
    setProductPickerOpenIndex(null);
    try {
      const [productsResult, citiesResult, clientsResult, suppliersResult] = await Promise.allSettled([
        orderProducts.length === 0 ? apiGet('/products') : Promise.resolve(orderProducts),
        orderCities.length === 0 ? apiGet('/admin/cities') : Promise.resolve(orderCities),
        orderClients.length === 0 ? apiGet('/admin/order-clients') : Promise.resolve(orderClients),
        orderSuppliers.length === 0 ? apiGet('/admin/suppliers').catch(() => []) : Promise.resolve(orderSuppliers)
      ]);
      if (productsResult.status === 'fulfilled') {
        setOrderProducts(Array.isArray(productsResult.value) ? productsResult.value.filter((product) => !product.is_hidden && product.is_available !== false && product.is_available !== 0) : []);
      }
      if (citiesResult.status === 'fulfilled') {
        setOrderCities(Array.isArray(citiesResult.value) ? citiesResult.value : []);
      }
      if (clientsResult.status === 'fulfilled') {
        setOrderClients(Array.isArray(clientsResult.value) ? clientsResult.value : []);
      }
      if (suppliersResult.status === 'fulfilled') {
        setOrderSuppliers(Array.isArray(suppliersResult.value) ? suppliersResult.value : []);
      }
    } catch (err) {
      setError(err.message || 'فشل تحميل بيانات الطلب');
    }
  };

  const ensureOrderEditorData = async () => {
    const [productsResult, citiesResult, clientsResult, suppliersResult] = await Promise.allSettled([
      orderProducts.length === 0 ? apiGet('/products') : Promise.resolve(orderProducts),
      orderCities.length === 0 ? apiGet('/admin/cities') : Promise.resolve(orderCities),
      orderClients.length === 0 ? apiGet('/admin/order-clients') : Promise.resolve(orderClients),
      orderSuppliers.length === 0 ? apiGet('/admin/suppliers').catch(() => []) : Promise.resolve(orderSuppliers)
    ]);
    if (productsResult.status === 'fulfilled') {
      setOrderProducts(Array.isArray(productsResult.value) ? productsResult.value.filter((product) => !product.is_hidden && product.is_available !== false && product.is_available !== 0) : []);
    }
    if (citiesResult.status === 'fulfilled') setOrderCities(Array.isArray(citiesResult.value) ? citiesResult.value : []);
    if (clientsResult.status === 'fulfilled') setOrderClients(Array.isArray(clientsResult.value) ? clientsResult.value : []);
    if (suppliersResult.status === 'fulfilled') setOrderSuppliers(Array.isArray(suppliersResult.value) ? suppliersResult.value : []);
  };

  const updateManualCustomer = (field, value) => {
    setManualOrder((current) => ({
      ...current,
      customer: { ...current.customer, [field]: value }
    }));
  };

  const filteredOrderClients = useMemo(() => {
    const query = String(manualOrder.clientSearch || '').trim().toLowerCase();
    if (!query) return orderClients;
    return orderClients.filter((client) => [client.name, client.phone, client.email]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
      .includes(query));
  }, [manualOrder.clientSearch, orderClients]);

  const filteredOrderSuppliers = useMemo(() => {
    const query = String(manualOrder.supplierSearch || '').trim().toLowerCase();
    if (!query) return orderSuppliers;
    return orderSuppliers.filter((supplier) => [supplier.name, supplier.phone, supplier.email, supplier.contact_info]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
      .includes(query));
  }, [manualOrder.supplierSearch, orderSuppliers]);

  const applyManualClient = (client) => {
    setManualOrder((current) => ({
      ...current,
      buyerType: 'client',
      client_id: client?.id || '',
      supplier_buyer_id: '',
      clientSearch: client?.name || '',
      supplierSearch: '',
      customer: client ? {
        ...current.customer,
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        address: {
          ...current.customer.address,
          line1: client.address_line1 || '',
          city: client.city || '',
          state: client.state || '',
          country: client.country || 'فلسطين'
        }
      } : current.customer
    }));
    setClientPickerOpen(false);
  };

  const applyManualSupplier = (supplier) => {
    setManualOrder((current) => ({
      ...current,
      buyerType: 'supplier',
      client_id: '',
      supplier_buyer_id: supplier?.id || '',
      clientSearch: supplier?.name || '',
      supplierSearch: supplier?.name || '',
      customer: supplier ? {
        ...current.customer,
        name: supplier.name || '',
        phone: supplier.phone || getContactPhone(supplier.contact_info),
        email: supplier.email || '',
        address: {
          ...current.customer.address,
          line1: supplier.address_line1 || 'طلب مورد',
          city: supplier.city || current.customer.address?.city || orderCities[0]?.name || 'الداخل',
          state: supplier.state || '',
          country: supplier.country || 'فلسطين'
        }
      } : current.customer
    }));
    setClientPickerOpen(false);
    setSupplierPickerOpen(false);
  };

  const selectManualClient = (value) => {
    const text = String(value || '');
    const match = text.match(/^(\d+)\s+-\s+/);
    const selectedClient = match ? orderClients.find((client) => Number(client.id) === Number(match[1])) : null;
    if (selectedClient) {
      applyManualClient(selectedClient);
      return;
    }
    setManualOrder((current) => ({
      ...current,
      client_id: '',
      supplier_buyer_id: '',
      clientSearch: text,
      supplierSearch: '',
      customer: { ...current.customer, name: text }
    }));
    setClientPickerOpen(true);
  };

  const selectManualSupplier = (value) => {
    const text = String(value || '');
    const match = text.match(/^(\d+)\s+-\s+/);
    const selectedSupplier = match ? orderSuppliers.find((supplier) => Number(supplier.id) === Number(match[1])) : null;
    if (selectedSupplier) {
      applyManualSupplier(selectedSupplier);
      return;
    }
    setManualOrder((current) => ({
      ...current,
      buyerType: 'supplier',
      client_id: '',
      supplier_buyer_id: '',
      supplierSearch: text,
      clientSearch: text,
      customer: { ...current.customer, name: text }
    }));
    setSupplierPickerOpen(true);
  };

  const updateManualBuyerType = (buyerType) => {
    setClientPickerOpen(false);
    setSupplierPickerOpen(false);
    setManualOrder((current) => ({
      ...current,
      buyerType,
      client_id: '',
      supplier_buyer_id: '',
      clientSearch: '',
      supplierSearch: '',
      customer: { ...current.customer, name: '', phone: '', email: '' }
    }));
  };

  const updateManualAddress = (field, value) => {
    setManualOrder((current) => ({
      ...current,
      customer: {
        ...current.customer,
        address: { ...current.customer.address, [field]: value }
      }
    }));
  };

  const updateManualItem = (index, field, value) => {
    setManualOrder((current) => ({
      ...current,
      items: (() => {
        const nextItems = current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
        const selectedProduct = field === 'productId' && String(value || '').trim();
        const isLastRow = index === nextItems.length - 1;
        if (selectedProduct && isLastRow) {
          nextItems.push(createBlankOrderItem());
        }
        return nextItems;
      })()
    }));
  };

  const makeManualItemCustom = (index) => {
    setManualOrder((current) => ({
      ...current,
      items: (() => {
        const nextItems = current.items.map((item, itemIndex) => itemIndex === index
        ? createBlankOrderItem({
          ...item,
          productId: '',
          productSearch: '',
          customName: String(item.customName || item.productSearch || '').trim(),
          isCustom: true
        })
        : item);
        if (index === nextItems.length - 1) nextItems.push(createBlankOrderItem());
        return nextItems;
      })()
    }));
    setProductPickerOpenIndex(null);
  };

  const makeEditItemCustom = (index) => {
    setEditItemsDialog((current) => current ? {
      ...current,
      items: (() => {
        const nextItems = current.items.map((item, itemIndex) => itemIndex === index
          ? createBlankOrderItem({
            ...item,
            productId: '',
            productSearch: '',
            customName: String(item.customName || item.productSearch || '').trim(),
            isCustom: true
          })
          : item);
        if (index === nextItems.length - 1) nextItems.push(createBlankOrderItem());
        return nextItems;
      })()
    } : current);
    setProductPickerOpenIndex(null);
  };

  const getOrderProduct = (productId) => orderProducts.find((product) => Number(product.id) === Number(productId)) || null;
  const getOrderProductColors = (product) => {
    const normalizeVariant = (variant, index) => ({
      id: String(variant.id || `variant-${index + 1}`),
      name: String(variant.color_name || variant.colorName || variant.name || '').trim(),
      hex: String(variant.color_hex || variant.colorHex || variant.hex || '').trim(),
      size_name: String(variant.size_name || variant.sizeName || variant.size || '').trim(),
      price: variant.price
    });
    if (Array.isArray(product?.variant_options) && product.variant_options.length) {
      return product.variant_options.map(normalizeVariant);
    }
    if (typeof product?.variant_options === 'string') {
      try {
        const parsed = JSON.parse(product.variant_options);
        if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeVariant);
      } catch {
        // fall back to legacy colors
      }
    }
    if (Array.isArray(product?.color_options)) return product.color_options.map(normalizeVariant);
    if (typeof product?.color_options === 'string') {
      try {
        const parsed = JSON.parse(product.color_options);
        return Array.isArray(parsed) ? parsed.map(normalizeVariant) : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  const getOrderProductLabel = (product) => product ? `${product.name || ''} - ${formatMoney(product.price)}` : '';
  const getFilteredOrderProducts = (query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const rows = normalizedQuery
      ? orderProducts.filter((product) => [product.id, product.name, product.price, product.supplier_name, product.category, ...(Array.isArray(product.categories) ? product.categories : [])]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(normalizedQuery))
      : orderProducts;
    return rows.slice(0, 40);
  };

  const selectManualProduct = (index, product) => {
    setManualOrder((current) => ({
      ...current,
      items: (() => {
        const nextItems = current.items.map((item, itemIndex) => itemIndex === index
          ? {
            ...item,
            productId: product?.id || '',
            productSearch: getOrderProductLabel(product),
            isCustom: false,
            customName: '',
            supplierId: '',
            unitPrice: '',
            purchasePrice: '',
            selectedVariantId: '',
            selectedColorName: '',
            selectedColorHex: '',
            selectedSizeName: ''
          }
          : item);
        if (product?.id && index === nextItems.length - 1) {
          nextItems.push(createBlankOrderItem());
        }
        return nextItems;
      })()
    }));
    setProductPickerOpenIndex(null);
  };

  const updateManualProductSearch = (index, value) => {
    setProductPickerOpenIndex(index);
    setManualOrder((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, productSearch: value, productId: '', isCustom: false, selectedVariantId: '', selectedColorName: '', selectedColorHex: '', selectedSizeName: '' }
        : item)
    }));
  };

  const selectManualItemColor = (index, colorValue) => {
    const [variantId, name, hex, sizeName] = String(colorValue || '').split('::');
    setManualOrder((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, selectedVariantId: variantId || '', selectedColorName: name || '', selectedColorHex: hex || '', selectedSizeName: sizeName || '' }
        : item)
    }));
  };

  const addManualItem = () => {
    setManualOrder((current) => ({ ...current, items: [...current.items, createBlankOrderItem()] }));
  };

  const removeManualItem = (index) => {
    setManualOrder((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((_, itemIndex) => itemIndex !== index) : current.items
    }));
  };

  const updateManualDiscount = (field, value) => {
    setManualOrder((current) => ({
      ...current,
      discount: { ...current.discount, [field]: value }
    }));
  };

  const buildOrderItemsPayload = (sourceItems = []) => (Array.isArray(sourceItems) ? sourceItems : [])
    .filter((item) => String(item.productId || '').trim() || item.isCustom || String(item.customName || '').trim())
    .map((item) => {
      if (item.isCustom || !String(item.productId || '').trim()) {
        return {
          isCustom: true,
          productName: String(item.customName || item.productSearch || '').trim(),
          supplierId: item.supplierId ? Number(item.supplierId) : null,
          unitPrice: Number(item.unitPrice || 0),
          purchasePrice: Number(item.purchasePrice || 0),
          quantity: Number(item.quantity)
        };
      }
      return {
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        selectedVariantId: item.selectedVariantId || undefined,
        selectedColorName: item.selectedColorName || undefined,
        selectedColorHex: item.selectedColorHex || undefined,
        selectedSizeName: item.selectedSizeName || undefined
      };
    });

  const validateOrderItemsPayload = (payloadItems = []) => {
    if (payloadItems.length === 0) return 'اختر منتجاً واحداً على الأقل';
    const invalidQuantityItem = payloadItems.find((item) => !Number.isInteger(item.quantity) || item.quantity <= 0);
    if (invalidQuantityItem) return 'كمية المنتج يجب أن تكون رقماً صحيحاً أكبر من صفر';
    const invalidCustomItem = payloadItems.find((item) => item.isCustom && (!item.productName || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.purchasePrice) || item.purchasePrice < 0));
    if (invalidCustomItem) return 'أدخل اسم المنتج الحر وسعر البيع وسعر الشراء بشكل صحيح';
    return '';
  };

  const createManualOrder = async (event) => {
    event.preventDefault();
    if (!canCreateOrder) return;
    if (creatingOrder) return;
    setCreatingOrder(true);
    try {
      const fallbackCity = orderCities[0]?.name || 'الداخل';
      const normalizedCustomer = {
        ...manualOrder.customer,
        name: String(manualOrder.customer?.name || '').trim(),
        phone: String(manualOrder.customer?.phone || '').trim(),
        email: String(manualOrder.customer?.email || '').trim(),
        address: {
          ...(manualOrder.customer?.address || {}),
          line1: String(manualOrder.customer?.address?.line1 || '').trim() || (manualOrder.buyerType === 'supplier' ? 'طلب مورد' : ''),
          city: String(manualOrder.customer?.address?.city || '').trim() || (manualOrder.buyerType === 'supplier' ? fallbackCity : ''),
          country: String(manualOrder.customer?.address?.country || 'فلسطين').trim() || 'فلسطين'
        }
      };
      if (!normalizedCustomer.name) {
        setError(manualOrder.buyerType === 'supplier' ? 'اختر المورد أو أدخل اسم المورد' : 'اختر العميل أو أدخل اسم العميل');
        return;
      }
      if (!normalizedCustomer.phone) {
        setError('رقم الهاتف مطلوب لإنشاء الطلب');
        return;
      }
      if (!normalizedCustomer.address.line1) {
        setError('العنوان مطلوب لإنشاء الطلب');
        return;
      }
      if (!normalizedCustomer.address.city) {
        setError('المدينة مطلوبة لإنشاء الطلب');
        return;
      }
      const payload = {
        client_id: manualOrder.buyerType === 'client' && manualOrder.client_id ? Number(manualOrder.client_id) : null,
        supplier_buyer_id: manualOrder.buyerType === 'supplier' && manualOrder.supplier_buyer_id ? Number(manualOrder.supplier_buyer_id) : null,
        customer: normalizedCustomer,
        notes: manualOrder.notes,
        status: manualOrder.status,
        discount: String(manualOrder.discount?.value || '').trim()
          ? {
            type: manualOrder.discount.type,
            value: Number(manualOrder.discount.value),
            reason: manualOrder.discount.reason
          }
          : undefined,
        items: buildOrderItemsPayload(manualOrder.items)
      };
      const itemsError = validateOrderItemsPayload(payload.items);
      if (itemsError) {
        setError(itemsError);
        return;
      }
      const missingColorItem = manualOrder.items
        .filter((item) => String(item.productId || '').trim())
        .find((item) => getOrderProductColors(getOrderProduct(item.productId)).length > 0 && !String(item.selectedVariantId || item.selectedColorName || item.selectedSizeName || '').trim());
      if (missingColorItem) {
        setError(`اختر لون المنتج: ${getOrderProduct(missingColorItem.productId)?.name || missingColorItem.productSearch || ''}`);
        return;
      }
      const created = await apiPost('/admin/orders', payload, {
        headers: getIdempotencyHeaders(createOrderIdempotencyKeyRef, 'admin-order')
      });
      createOrderIdempotencyKeyRef.current = null;
      setCreateDialogOpen(false);
      setMessage(`تم إنشاء الطلب #${created?.order?.id || '-'}`);
      setStatusFilter(manualOrder.status);
      await load(manualOrder.status);
    } catch (err) {
      setError(err.message || 'فشل إنشاء الطلب');
    } finally {
      setCreatingOrder(false);
    }
  };

  const updateStatus = async () => {
    if (!canChangeStatus || !statusDialog) return;
    try {
      setMessage('');
      const result = await apiPut(`/admin/orders/${statusDialog.orderId}/status`, { status: statusDialog.status, note: statusDialog.note, mark_paid: !!statusDialog.markPaid });
      const updatedOrder = result?.order || result;
      setSelected(updatedOrder || null);
      const nextDeliveryAccounting = statusDialog.status === 'delivered' && result?.accounting
        ? { orderId: statusDialog.orderId, ...result.accounting }
        : null;
      await load();
      await loadOrder(statusDialog.orderId);
      setDeliveryAccounting(nextDeliveryAccounting);
      const emailMessage = result?.internalEmail
        ? result.internalEmail.sent
          ? ` تم إرسال بريد التجهيز إلى ${result.internalEmail.sentTo || '-'}.`
          : result.internalEmail.skipped
            ? ` لم يتم إرسال بريد التجهيز: ${result.internalEmail.reason || 'إعدادات البريد غير مكتملة'}.`
            : ` فشل إرسال بريد التجهيز: ${result.internalEmail.error || 'خطأ غير معروف'}.`
        : '';
      if (nextDeliveryAccounting) {
        const createdCount = nextDeliveryAccounting.created?.length || 0;
        const skippedCount = nextDeliveryAccounting.skipped?.length || 0;
        const totalDue = Number(nextDeliveryAccounting.requirements?.total_amount || 0);
        const paymentMessage = statusDialog.markPaid
          ? nextDeliveryAccounting.clientPayment?.created
            ? ' وتم تسجيل دفعة العميل تلقائياً.'
            : nextDeliveryAccounting.clientPayment?.skipped
              ? ' ولم يتم إنشاء دفعة جديدة للعميل لأنها موجودة أو غير متاحة.'
              : ' ولم يتم تسجيل دفعة عميل تلقائية لهذا الطلب.'
          : '';
        setMessage(`تم تحديث الحالة إلى تم التسليم. مستحق الموردين لهذا الطلب: ${formatMoney(totalDue)}. تم إنشاء ${createdCount} سند مورد، وتخطي ${skippedCount}.${paymentMessage}${emailMessage}`);
      } else {
        setMessage(`تم تحديث الحالة إلى ${getOrderStatusLabel(statusDialog.status)}.${emailMessage}`);
      }
      setStatusDialog(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const openStatusDialog = (orderId, status, options = {}) => {
    if (!canChangeStatus) return;
    setStatusDialog({ orderId, status, note: '', markPaid: !!options.markPaid });
  };

  const calculatePurchaseRequirements = async (order) => {
    if (!order?.id) return;
    try {
      setMessage('');
      setPurchaseCalcLoading(true);
      const requirements = await apiGet(`/admin/orders/${order.id}/purchasing-requirements`);
      setDeliveryAccounting({
        orderId: order.id,
        requirements,
        created: [],
        skipped: [],
        previewOnly: true
      });
      setMessage(`تم احتساب الشراء لهذا الطلب للعرض فقط: ${formatMoney(requirements?.total_amount || 0)}`);
    } catch (err) {
      setError(err.message || 'فشل احتساب الشراء لهذا الطلب');
    } finally {
      setPurchaseCalcLoading(false);
    }
  };

  const captureOrderDetailsScreenshot = async () => {
    if (!selected?.id || !orderDetailsRef.current) return;
    try {
      setError('');
      setScreenshotLoading(true);
      const target = orderDetailsRef.current;
      const { default: html2canvas } = await import('html2canvas');
      target.classList.add('order-details-capturing');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        width: target.offsetWidth,
        height: target.scrollHeight,
        windowWidth: document.documentElement.clientWidth,
        ignoreElements: (element) => Boolean(element.closest?.('.order-details-screenshot-hide'))
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `order-${selected.id}-details.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.message || 'فشل التقاط صورة تفاصيل الطلب');
    } finally {
      orderDetailsRef.current?.classList.remove('order-details-capturing');
      setScreenshotLoading(false);
    }
  };

  const openDiscountDialog = (order) => {
    if (!canChangeStatus || !order) return;
    discountIdempotencyKeyRef.current = null;
    setDiscountDialog({
      orderId: order.id,
      type: order.discount_type || 'fixed',
      value: Number(order.discount_value || 0) > 0 ? String(order.discount_value) : '',
      reason: order.discount_reason || '',
      saving: false
    });
  };

  const openDeliveryDialog = async (order) => {
    if (!canChangeStatus || !order) return;
    deliveryIdempotencyKeyRef.current = null;
    let sourceItems = items;
    let existingSupplierDeliveries = supplierDeliveries;
    if (String(selected?.id || '') !== String(order.id) || sourceItems.length === 0) {
      try {
        const data = await apiGet(`/admin/orders/${order.id}`);
        setSelected(data.order);
        sourceItems = data.items || [];
        existingSupplierDeliveries = data.supplier_deliveries || [];
        setItems(sourceItems);
        setSupplierDeliveries(existingSupplierDeliveries);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setDeliveryDialog({
      orderId: order.id,
      amount: getDeliveryAmount(order) > 0 ? String(order.delivery_fee_amount) : '',
      payer: 'customer',
      note: order.delivery_note || '',
      supplierDeliveries: [],
      saving: false
    });
  };

  const saveDelivery = async () => {
    if (!deliveryDialog) return;
    if (deliveryDialog.saving) return;
    try {
      setMessage('');
      const amount = Number(deliveryDialog.amount || 0);
      if (Number.isNaN(amount) || amount < 0) {
        setError('مبلغ التوصيل يجب أن يكون صفراً أو أكثر');
        return;
      }
      setDeliveryDialog((current) => current ? { ...current, saving: true } : current);
      const result = await apiPut(`/admin/orders/${deliveryDialog.orderId}/delivery`, {
        amount,
        payer: 'customer',
        note: deliveryDialog.note,
        supplier_deliveries: []
      }, {
        headers: getIdempotencyHeaders(deliveryIdempotencyKeyRef, 'admin-delivery')
      });
      deliveryIdempotencyKeyRef.current = null;
      setSelected(result?.order || null);
      setSupplierDeliveries(result?.supplier_deliveries || []);
      await load();
      await loadOrder(deliveryDialog.orderId);
      setDeliveryDialog(null);
      const deliveryMessage = result?.deliveryAccounting?.client?.created
        ? ' وتم إنشاء سند خدمات للعميل.'
        : result?.deliveryAccounting?.client?.reversed
          ? ' وتم عكس سند التوصيل من ذمة العميل.'
          : '';
      setMessage(amount > 0 ? `تم تحديث رسوم التوصيل${deliveryMessage}` : `تم حذف رسوم التوصيل${deliveryMessage}`);
    } catch (err) {
      setError(err.message || 'فشل تحديث رسوم التوصيل');
      setDeliveryDialog((current) => current ? { ...current, saving: false } : current);
    }
  };

  const applyDiscount = async () => {
    if (!discountDialog) return;
    if (discountDialog.saving) return;
    try {
      setMessage('');
      setDiscountDialog((current) => current ? { ...current, saving: true } : current);
      const updated = await apiPut(`/admin/orders/${discountDialog.orderId}/discount`, {
        type: discountDialog.type,
        value: Number(discountDialog.value || 0),
        reason: discountDialog.reason
      }, {
        headers: getIdempotencyHeaders(discountIdempotencyKeyRef, 'admin-discount')
      });
      discountIdempotencyKeyRef.current = null;
      setSelected(updated || null);
      await load();
      await loadOrder(discountDialog.orderId);
      setDiscountDialog(null);
      setMessage('تم تحديث خصم الطلب');
    } catch (err) {
      setError(err.message || 'فشل تحديث الخصم');
      setDiscountDialog((current) => current ? { ...current, saving: false } : current);
    }
  };

  const removeDiscount = async () => {
    if (!discountDialog) return;
    if (discountDialog.saving) return;
    try {
      setMessage('');
      setDiscountDialog((current) => current ? { ...current, saving: true } : current);
      const updated = await apiPut(`/admin/orders/${discountDialog.orderId}/discount`, { type: '', value: 0, reason: '' }, {
        headers: getIdempotencyHeaders(discountIdempotencyKeyRef, 'admin-discount')
      });
      discountIdempotencyKeyRef.current = null;
      setSelected(updated || null);
      await load();
      await loadOrder(discountDialog.orderId);
      setDiscountDialog(null);
      setMessage('تم حذف خصم الطلب');
    } catch (err) {
      setError(err.message || 'فشل حذف الخصم');
      setDiscountDialog((current) => current ? { ...current, saving: false } : current);
    }
  };

  const mapOrderItemToEditable = (item) => ({
    productId: item.product_id || '',
    productSearch: item.product_name ? `${item.product_name} - ${formatMoney(item.unit_price)}` : '',
    isCustom: !item.product_id,
    customName: !item.product_id ? item.product_name || '' : '',
    supplierId: item.supplier_id || '',
    unitPrice: !item.product_id ? String(item.unit_price || '') : '',
    purchasePrice: !item.product_id ? String(item.purchase_price || '') : '',
    selectedVariantId: item.variant_id || '',
    selectedColorName: item.color_name || '',
    selectedColorHex: item.color_hex || '',
    selectedSizeName: item.size_name || '',
    quantity: item.quantity || 1
  });

  const openEditItemsDialog = async (order) => {
    if (!canChangeStatus || !canEditOrderItems(order)) return;
    try {
      setMessage('');
      await ensureOrderEditorData();
      const data = selected?.id === order.id && items.length ? { order: selected, items } : await apiGet(`/admin/orders/${order.id}`);
      setEditItemsDialog({
        orderId: order.id,
        items: (data.items || []).map(mapOrderItemToEditable).concat([createBlankOrderItem()]),
        saving: false
      });
      setProductPickerOpenIndex(null);
    } catch (err) {
      setError(err.message || 'فشل تحميل منتجات الطلب');
    }
  };

  const updateEditItem = (index, field, value) => {
    setEditItemsDialog((current) => current ? {
      ...current,
      items: (() => {
        const nextItems = current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
        const selectedProduct = field === 'productId' && String(value || '').trim();
        if (selectedProduct && index === nextItems.length - 1) {
          nextItems.push(createBlankOrderItem());
        }
        return nextItems;
      })()
    } : current);
  };

  const updateEditProductSearch = (index, value) => {
    setProductPickerOpenIndex(index);
    setEditItemsDialog((current) => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, productSearch: value, productId: '', isCustom: false, selectedVariantId: '', selectedColorName: '', selectedColorHex: '', selectedSizeName: '' }
        : item)
    } : current);
  };

  const selectEditProduct = (index, product) => {
    setEditItemsDialog((current) => current ? {
      ...current,
      items: (() => {
        const nextItems = current.items.map((item, itemIndex) => itemIndex === index
          ? {
            ...item,
            productId: product?.id || '',
            productSearch: getOrderProductLabel(product),
            isCustom: false,
            customName: '',
            supplierId: '',
            unitPrice: '',
            purchasePrice: '',
            selectedVariantId: '',
            selectedColorName: '',
            selectedColorHex: '',
            selectedSizeName: ''
          }
          : item);
        if (product?.id && index === nextItems.length - 1) {
          nextItems.push(createBlankOrderItem());
        }
        return nextItems;
      })()
    } : current);
    setProductPickerOpenIndex(null);
  };

  const selectEditItemColor = (index, colorValue) => {
    const [variantId, name, hex, sizeName] = String(colorValue || '').split('::');
    setEditItemsDialog((current) => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, selectedVariantId: variantId || '', selectedColorName: name || '', selectedColorHex: hex || '', selectedSizeName: sizeName || '' }
        : item)
    } : current);
  };

  const addEditItem = () => {
    setEditItemsDialog((current) => current ? {
      ...current,
      items: [...current.items, createBlankOrderItem()]
    } : current);
  };

  const removeEditItem = (index) => {
    setEditItemsDialog((current) => current ? {
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index).length
        ? current.items.filter((_, itemIndex) => itemIndex !== index)
        : [createBlankOrderItem()]
    } : current);
  };

  const saveEditedItems = async () => {
    if (!editItemsDialog) return;
    try {
      const payloadItems = buildOrderItemsPayload(editItemsDialog.items);
      const itemsError = validateOrderItemsPayload(payloadItems);
      if (itemsError) {
        setError(itemsError);
        return;
      }
      const missingColorItem = editItemsDialog.items
        .filter((item) => String(item.productId || '').trim())
        .find((item) => getOrderProductColors(getOrderProduct(item.productId)).length > 0 && !String(item.selectedVariantId || item.selectedColorName || item.selectedSizeName || '').trim());
      if (missingColorItem) {
        setError(`اختر لون المنتج: ${getOrderProduct(missingColorItem.productId)?.name || missingColorItem.productSearch || ''}`);
        return;
      }

      setEditItemsDialog((current) => current ? { ...current, saving: true } : current);
      const updated = await apiPut(`/admin/orders/${editItemsDialog.orderId}/items`, { items: payloadItems });
      setSelected(updated.order || null);
      setItems(updated.items || []);
      await load();
      await loadOrder(editItemsDialog.orderId);
      setEditItemsDialog(null);
      setMessage('تم تحديث منتجات الطلب');
    } catch (err) {
      setError(err.message || 'فشل تحديث منتجات الطلب');
      setEditItemsDialog((current) => current ? { ...current, saving: false } : current);
    }
  };

  const openPreview = async (orderId, type) => {
    if ((type === 'customer' && !canPreviewCustomerEmail) || (type === 'internal' && !canPreviewInternalEmail)) return;
    setPreviewOpen(true);
    setPreviewTitle(type === 'customer' ? 'معاينة بريد العميل' : 'معاينة بريد التجهيز');
    setPreviewHtml('');
    setPreviewLoading(true);
    try {
      const previewUrl = `${API_BASE}/admin/orders/${orderId}/email-preview?type=${type}&_=${Date.now()}`;
      const res = await fetch(previewUrl, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });
      if (!res.ok) {
        let msg = 'Request failed';
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const data = await res.json();
      setPreviewHtml(data.html || '');
    } catch (err) {
      setPreviewHtml(`<div style="padding:12px; color:#b91c1c;">${err.message}</div>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openEmailPdf = async (orderId, type = 'internal') => {
    if ((type === 'customer' && !canPreviewCustomerEmail) || (type === 'internal' && !canPreviewInternalEmail)) return;
    const popup = window.open('', '_blank');
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/email-pdf?type=${type}&_=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });
      if (!res.ok) {
        let msg = 'Request failed';
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // ignore non-JSON error responses
        }
        throw new Error(msg);
      }
      const pdf = await res.blob();
      const blobUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      if (popup) {
        popup.location.href = blobUrl;
      } else {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      if (popup) popup.close();
      setError(err.message);
    }
  };

  const openSendDialog = (order, type) => {
    if ((type === 'customer' && !canSendCustomerEmail) || (type === 'internal' && !canSendInternalEmail)) return;
    setSendDialog({
      orderId: order.id,
      type,
      email: type === 'customer' ? String(order.customer_email || '').trim() : ''
    });
  };

  const openPdfEmailDialog = (order) => {
    if (!canSendInternalEmail) return;
    setPdfEmailDialog({ orderId: order.id, email: '' });
  };

  const sendPdfEmail = async () => {
    if (!pdfEmailDialog) return;
    const key = `${pdfEmailDialog.orderId}:pdf-email`;
    setSendingKey(key);
    setMessage('');
    try {
      const data = await apiPost(`/admin/orders/${pdfEmailDialog.orderId}/send-pdf-email`, {
        email: pdfEmailDialog.email
      });
      setMessage(`تم إرسال PDF التجهيز إلى ${data.sentTo || '-'}`);
      setPdfEmailDialog(null);
    } catch (err) {
      setError(err.message || 'فشل إرسال PDF بالبريد');
    } finally {
      setSendingKey('');
    }
  };

  const sendEmail = async () => {
    if (!sendDialog) return;
    const key = `${sendDialog.orderId}:${sendDialog.type}`;
    setSendingKey(key);
    setMessage('');
    try {
      const data = await apiPost(`/admin/orders/${sendDialog.orderId}/send-email`, {
        type: sendDialog.type,
        email: sendDialog.email
      });
      setMessage(sendDialog.type === 'customer'
        ? `تم إرسال بريد العميل إلى ${data.sentTo || '-'}`
        : `تم إرسال بريد التجهيز إلى ${data.sentTo || '-'}`);
      setSendDialog(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingKey('');
    }
  };

  useEffect(() => { load(statusFilter); }, [statusFilter, canReadList, canReadUnpaid]);
  useEffect(() => {
    if (!canReadList && canReadUnpaid && statusFilter !== 'pending_payment') {
      setStatusFilter('pending_payment');
    }
  }, [canReadList, canReadUnpaid, statusFilter]);
  useEffect(() => {
    const closeMenu = (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('.dropdown')) return;
      setOpenMenuId(null);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const filteredOrders = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();

    return orders.filter((order) => {
      if (!query) return true;

      const haystack = [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.customer_email,
        order.city,
        order.status,
        getOrderStatusLabel(order.status),
        getPayableTotal(order)
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [orders, searchTerm]);

  return (
    <div className="grid">
      <section className="card">
        <div className="card-header compact">
          <h2>الطلبات</h2>
          {canCreateOrder && (
            <button type="button" onClick={openCreateOrderDialog}>إضافة طلب</button>
          )}
        </div>
        <div className="row table-toolbar">
          <input
            placeholder="بحث بالمعرف أو اسم العميل أو الهاتف أو البريد"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {canReadList ? (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {orderStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          ) : (
            <div className="readonly-filter">{ORDER_STATUS_LABELS.pending_payment}</div>
          )}
        </div>
        {message && <p className="success-text">{message}</p>}
          <ResponsiveTableWrap className="fit-table-wrap" minWidth="100%" ariaLabel="جدول الطلبات">
          <table className="responsive-table-card fit-table orders-fit-table">
            <thead>
              <tr>
                <th>المعرف</th>
                <th>الاسم</th>
                <th>الإجمالي</th>
                <th>الخصم</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
            {filteredOrders.map(o => (
              <tr key={o.id}>
                <td data-label="المعرف">{o.id}</td>
                <td data-label="الاسم">{o.customer_name} {o.supplier_buyer_id ? <span className="status-badge warn">مورد</span> : null}</td>
                <td data-label="الإجمالي">{formatMoney(getPayableTotal(o))}</td>
                <td data-label="الخصم">{hasDiscount(o) ? formatMoney(o.discount_amount) : '-'}</td>
                <td data-label="الحالة">{getOrderStatusLabel(o.status)}</td>
                <td data-label="إجراءات" className="responsive-actions-cell">
                  <div className="actions-menu">
                    {canReadDetails && <button onClick={() => loadOrder(o.id)}>عرض</button>}
                    <div className={`dropdown ${openMenuId === o.id ? 'open' : ''}`}>
                      <button
                        className="dots"
                        aria-label="خيارات"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === o.id ? null : o.id);
                        }}
                      >
                        ⋯
                      </button>
                      <div className="menu" onClick={(e) => e.stopPropagation()}>
                        {canPreviewCustomerEmail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              openPreview(o.id, 'customer');
                            }}
                          >
                            عرض بريد العميل
                          </button>
                        )}
                        {canSendCustomerEmail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                               openSendDialog(o, 'customer');
                             }}
                            disabled={sendingKey === `${o.id}:customer`}
                          >
                            {sendingKey === `${o.id}:customer` ? 'جارٍ الإرسال...' : 'إرسال بريد العميل'}
                          </button>
                        )}
                        {canPreviewInternalEmail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              openPreview(o.id, 'internal');
                            }}
                          >
                            عرض بريد التجهيز
                          </button>
                        )}
                        {canPreviewInternalEmail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              openEmailPdf(o.id, 'internal');
                            }}
                          >
                            PDF بريد التجهيز
                          </button>
                        )}
                        {canSendInternalEmail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              openPdfEmailDialog(o);
                            }}
                          >
                            إرسال PDF بالبريد
                          </button>
                        )}
                        {canSendInternalEmail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                               openSendDialog(o, 'internal');
                             }}
                            disabled={sendingKey === `${o.id}:internal`}
                          >
                            {sendingKey === `${o.id}:internal` ? 'جارٍ الإرسال...' : 'إرسال بريد التجهيز'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr className="responsive-empty-row">
                <td colSpan="6">لا توجد طلبات مطابقة للفلاتر الحالية.</td>
              </tr>
            )}
          </tbody>
        </table>
        </ResponsiveTableWrap>
      </section>

      {createDialogOpen && (
        <div className="modal-backdrop">
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>إضافة طلب</h3>
              <button className="modal-close" type="button" onClick={() => setCreateDialogOpen(false)}>×</button>
            </div>
            <form className="form" onSubmit={createManualOrder} noValidate>
              <div className="grid single">
                <label>
                  <span>نوع المشتري</span>
                  <select value={manualOrder.buyerType} onChange={(event) => updateManualBuyerType(event.target.value)}>
                    <option value="client">عميل</option>
                    <option value="supplier">مورد</option>
                  </select>
                </label>
                {manualOrder.buyerType === 'client' && (
                  <label>
                    <span>اسم العميل</span>
                    <div className="client-picker">
                      <input
                        value={manualOrder.clientSearch}
                        onFocus={() => setClientPickerOpen(true)}
                        onClick={() => setClientPickerOpen(true)}
                        onBlur={() => setTimeout(() => setClientPickerOpen(false), 120)}
                        onChange={(event) => selectManualClient(event.target.value)}
                        placeholder="ابحث واختر عميل يدوي"
                        required
                      />
                      {clientPickerOpen && (
                        <div className="client-picker-list">
                          {filteredOrderClients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyManualClient(client);
                              }}
                            >
                              <strong>{client.name}</strong>
                              <span>عميل يدوي · {client.phone || '-'}</span>
                              <small>{[client.email, client.address_line1, client.city].filter(Boolean).join(' · ')}</small>
                            </button>
                          ))}
                          {filteredOrderClients.length === 0 && <div className="client-picker-empty">لا يوجد عملاء مطابقون</div>}
                        </div>
                      )}
                    </div>
                  </label>
                )}
                {manualOrder.buyerType === 'supplier' && (
                  <label>
                    <span>اسم المورد</span>
                    <div className="client-picker">
                      <input
                        value={manualOrder.supplierSearch}
                        onFocus={() => setSupplierPickerOpen(true)}
                        onClick={() => setSupplierPickerOpen(true)}
                        onBlur={() => setTimeout(() => setSupplierPickerOpen(false), 120)}
                        onChange={(event) => selectManualSupplier(event.target.value)}
                        placeholder="ابحث واختر مورد"
                        required
                      />
                      {supplierPickerOpen && (
                        <div className="client-picker-list">
                          {filteredOrderSuppliers.map((supplier) => (
                            <button
                              key={supplier.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyManualSupplier(supplier);
                              }}
                            >
                              <strong>{supplier.name}</strong>
                              <span>مورد · {supplier.phone || getContactPhone(supplier.contact_info) || '-'}</span>
                              <small>{[supplier.email, supplier.address_line1, supplier.city].filter(Boolean).join(' · ')}</small>
                            </button>
                          ))}
                          {filteredOrderSuppliers.length === 0 && <div className="client-picker-empty">لا يوجد موردون مطابقون</div>}
                        </div>
                      )}
                    </div>
                  </label>
                )}
                <label>
                  <span>الهاتف</span>
                  <input value={manualOrder.customer.phone} onChange={(event) => updateManualCustomer('phone', event.target.value)} required />
                </label>
                <label>
                  <span>البريد</span>
                  <input type="email" value={manualOrder.customer.email} onChange={(event) => updateManualCustomer('email', event.target.value)} />
                </label>
                <label>
                  <span>العنوان</span>
                  <input value={manualOrder.customer.address.line1} onChange={(event) => updateManualAddress('line1', event.target.value)} required />
                </label>
                <label>
                  <span>المدينة</span>
                  <select value={manualOrder.customer.address.city} onChange={(event) => updateManualAddress('city', event.target.value)} required>
                    <option value="">اختر المدينة</option>
                    {orderCities.map((city) => (
                      <option key={city.id || city.name} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>الحالة</span>
                  <select value={manualOrder.status} onChange={(event) => setManualOrder((current) => ({ ...current, status: event.target.value }))}>
                    {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <div className="order-discount-box">
                  <div className="card-header compact">
                    <h3>خصم إداري</h3>
                    <p className="muted">اختياري، لا يظهر ككود على المتجر.</p>
                  </div>
                  <div className="grid two">
                    <label>
                      <span>نوع الخصم</span>
                      <select value={manualOrder.discount.type} onChange={(event) => updateManualDiscount('type', event.target.value)}>
                        <option value="fixed">مبلغ ثابت</option>
                        <option value="percent">نسبة مئوية</option>
                      </select>
                    </label>
                    <label>
                      <span>قيمة الخصم</span>
                      <input type="number" min="0" step="0.01" value={manualOrder.discount.value} onChange={(event) => updateManualDiscount('value', event.target.value)} />
                    </label>
                  </div>
                  <label>
                    <span>سبب الخصم</span>
                    <input value={manualOrder.discount.reason} onChange={(event) => updateManualDiscount('reason', event.target.value)} placeholder="مثال: خصم خاص للعميل" />
                  </label>
                </div>
                <label>
                  <span>ملاحظات</span>
                  <textarea value={manualOrder.notes} onChange={(event) => setManualOrder((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </div>
              <div className="manual-order-items">
                <div className="card-header compact">
                  <h3>المنتجات</h3>
                  <p className="muted">اختر منتجاً لإضافة صف جديد تلقائياً.</p>
                </div>
                {manualOrder.items.map((item, index) => (
                  <div key={index} className={`manual-order-item-row ${item.isCustom ? 'custom-order-item-row' : ''}`.trim()}>
                    <div className="manual-product-cell">
                      {item.isCustom ? (
                        <div className="custom-order-item-fields">
                          <input value={item.customName || ''} onChange={(event) => updateManualItem(index, 'customName', event.target.value)} placeholder="اسم المنتج" required />
                          <select value={item.supplierId || ''} onChange={(event) => updateManualItem(index, 'supplierId', event.target.value)}>
                            <option value="">بدون مورد</option>
                            {orderSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                          </select>
                          <input type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={(event) => updateManualItem(index, 'unitPrice', event.target.value)} placeholder="سعر البيع" required />
                          <input type="number" min="0" step="0.01" value={item.purchasePrice || ''} onChange={(event) => updateManualItem(index, 'purchasePrice', event.target.value)} placeholder="سعر الشراء" required />
                        </div>
                      ) : (
                        <div className="client-picker">
                          <input
                            value={item.productSearch || ''}
                            onFocus={() => setProductPickerOpenIndex(index)}
                            onClick={() => setProductPickerOpenIndex(index)}
                            onBlur={() => setTimeout(() => setProductPickerOpenIndex((current) => current === index ? null : current), 120)}
                            onChange={(event) => updateManualProductSearch(index, event.target.value)}
                            placeholder="ابحث عن منتج بالاسم أو الرقم أو المورد"
                            required={index === 0 || !!String(item.productId || item.productSearch || item.customName || '').trim()}
                          />
                          {productPickerOpenIndex === index && (
                            <div className="client-picker-list product-picker-list">
                              {getFilteredOrderProducts(item.productSearch).map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectManualProduct(index, product);
                                  }}
                                >
                                  <strong>{product.name}</strong>
                                  <span>{formatMoney(product.price)}</span>
                                  <small>{[`#${product.id}`, product.supplier_name, product.category, product.stock != null ? `المخزون: ${product.stock}` : ''].filter(Boolean).join(' · ')}</small>
                                </button>
                              ))}
                              {getFilteredOrderProducts(item.productSearch).length === 0 && <div className="client-picker-empty">لا توجد منتجات مطابقة</div>}
                              <button type="button" onMouseDown={(event) => { event.preventDefault(); makeManualItemCustom(index); }}>
                                <strong>منتج غير موجود بالقائمة</strong>
                                <small>أدخل الاسم والمورد والأسعار يدوياً</small>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {item.productId && (
                      getOrderProductColors(getOrderProduct(item.productId)).length > 0 ? (
                        <div className="manual-color-picker">
                          <span className="manual-color-label">اللون / القياس</span>
                          <select value={item.selectedVariantId ? `${item.selectedVariantId}::${item.selectedColorName || ''}::${item.selectedColorHex || ''}::${item.selectedSizeName || ''}` : ''} onChange={(event) => selectManualItemColor(index, event.target.value)} required>
                            <option value="">اختر اللون / القياس</option>
                            {getOrderProductColors(getOrderProduct(item.productId)).map((color) => (
                              <option key={`${color.id}-${color.name}-${color.hex}-${color.size_name}`} value={`${color.id || ''}::${color.name || ''}::${color.hex || ''}::${color.size_name || ''}`}>
                                {[color.name, color.size_name].filter(Boolean).join(' / ')} {color.price != null ? `- ${formatMoney(color.price)}` : ''}
                              </option>
                            ))}
                          </select>
                          {item.selectedColorHex && <span className="manual-color-swatch" style={{ background: item.selectedColorHex }} />}
                        </div>
                      ) : (
                        <div className="manual-color-empty">لا توجد ألوان</div>
                      )
                    )}
                    <input type="number" min="1" value={item.quantity} onChange={(event) => updateManualItem(index, 'quantity', event.target.value)} required />
                    <button type="button" className="secondary" onClick={() => removeManualItem(index)} disabled={manualOrder.items.length <= 1}>حذف</button>
                    {item.productId && (
                      <div className="manual-product-meta">
                        <span>{formatMoney(getOrderProduct(item.productId)?.price)}</span>
                        {getOrderProduct(item.productId)?.stock != null && <span>المخزون: {getOrderProduct(item.productId)?.stock}</span>}
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" className="secondary" onClick={addManualItem}>إضافة منتج</button>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" disabled={creatingOrder} onClick={() => { createOrderIdempotencyKeyRef.current = null; setCreateDialogOpen(false); }}>إلغاء</button>
                <button type="submit" disabled={creatingOrder}>{creatingOrder ? 'جارٍ الإنشاء...' : 'إنشاء الطلب'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="card order-details-card" ref={orderDetailsRef}>
        <div className="order-details-title">
          <h2>تفاصيل الطلب</h2>
          <div className="order-details-title-actions">
            {selected && (
              <button
                type="button"
                className="secondary order-details-screenshot-hide"
                onClick={captureOrderDetailsScreenshot}
                disabled={screenshotLoading}
              >
                {screenshotLoading ? 'جارٍ التصوير...' : 'تصوير الطلب'}
              </button>
            )}
          </div>
        </div>
        {!selected ? (
          <p>اختر طلبًا لعرض التفاصيل.</p>
        ) : (
          <div>
            <div className="order-details-info">
              <div className="order-details-info-text">
                <p><strong>الطلب:</strong> #{selected.id}</p>
                <p><strong>{selected.supplier_buyer_id ? 'المورد' : 'العميل'}:</strong> {selected.customer_name} {selected.supplier_buyer_id ? <span className="status-badge warn">مورد</span> : null} ({selected.customer_phone})</p>
                <p><strong>العنوان:</strong> {selected.address_line1}, {selected.city}, {selected.state}, {selected.country}</p>
                <p><strong>الحالة:</strong> {getOrderStatusLabel(selected.status)}</p>
                <p><strong>ملاحظة الحالة:</strong> {selected.admin_status_note || '-'}</p>
              </div>
              <img src="/admin-tab-icon.png" alt="" className="order-details-logo" />
            </div>
            <div className="order-totals-box">
              <div><span>إجمالي المنتجات</span><strong>{formatMoney(selected.subtotal)}</strong></div>
              {hasDelivery(selected) ? <div><span>رسوم التوصيل</span><strong>{formatMoney(selected.delivery_fee_amount)}</strong></div> : null}
              {hasDelivery(selected) && selected.delivery_note ? <div><span>ملاحظة التوصيل</span><strong>{selected.delivery_note}</strong></div> : null}
              {getCustomerDeliveryAmount(selected) > 0 ? <div><span>المجموع قبل الخصم</span><strong>{formatMoney(getBeforeDiscountPayableTotal(selected))}</strong></div> : null}
              {hasDiscount(selected) ? <div><span>الخصم</span><strong>-{formatMoney(selected.discount_amount)}</strong></div> : null}
              {hasDiscount(selected) && selected.discount_reason ? <div><span>سبب الخصم</span><strong>{selected.discount_reason}</strong></div> : null}
              <div className="total"><span>الإجمالي النهائي</span><strong>{formatMoney(getPayableTotal(selected))}</strong></div>
            </div>
            {normalizeDeliveryPayer(selected.delivery_payer) === 'supplier' && supplierDeliveries.length > 0 ? (
              <div className="delivery-supplier-list">
                <h3>توصيل الموردين</h3>
                {supplierDeliveries.map((row) => (
                  <div className="delivery-supplier-line" key={row.supplier_id}>
                    <strong>{row.supplier_name || `مورد #${row.supplier_id}`}</strong>
                    <span>{formatMoney(row.amount)}</span>
                    {row.note ? <small>{row.note}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {canChangeStatus && (
              <div className="row order-details-screenshot-hide">
                <button type="button" className="secondary" onClick={() => openDiscountDialog(selected)} disabled={!canEditOrderDiscount(selected)}>
                  {hasDiscount(selected) ? 'تعديل الخصم' : 'إضافة خصم'}
                </button>
                <button type="button" className="secondary" onClick={() => openDeliveryDialog(selected)}>
                  {hasDelivery(selected) ? 'تعديل التوصيل' : 'إضافة توصيل'}
                </button>
                <button type="button" className="secondary" onClick={() => openEditItemsDialog(selected)} disabled={!canEditOrderItems(selected)}>
                  تعديل المنتجات
                </button>
                {canReadPurchasing && (
                  <button type="button" className="secondary" onClick={() => calculatePurchaseRequirements(selected)} disabled={purchaseCalcLoading}>
                    {purchaseCalcLoading ? 'جارٍ الاحتساب...' : 'احتساب الشراء'}
                  </button>
                )}
                {!canEditOrderDiscount(selected) && <span className="muted">يمكن تعديل الخصم قبل الدفع أو أثناء قيد التجهيز، والتوصيل متاح من زر التوصيل.</span>}
              </div>
            )}
            <div className="status-actions order-details-screenshot-hide">
              {[
                { key: 'pending_payment', label: ORDER_STATUS_LABELS.pending_payment },
                { key: 'paid', label: ORDER_STATUS_LABELS.paid },
                { key: 'delivered', label: ORDER_STATUS_LABELS.delivered },
                { key: 'cancelled', label: ORDER_STATUS_LABELS.cancelled }
              ].map(s => (
                <button key={s.key} onClick={() => openStatusDialog(selected.id, s.key)} disabled={!canChangeStatus}>
                  {s.label}
                </button>
              ))}
              <button onClick={() => openStatusDialog(selected.id, 'delivered', { markPaid: true })} disabled={!canChangeStatus}>
                تم التسليم والدفع
              </button>
            </div>
            {deliveryAccounting && String(deliveryAccounting.orderId || '') === String(selected.id) && (
              <div className="delivery-accounting-box">
                <div className="card-header compact">
                  <div>
                    <h3>مستحقات الموردين لهذا الطلب</h3>
                    <p className="muted">{deliveryAccounting.previewOnly ? 'احتساب للعرض فقط، بدون إنشاء سندات أو تغيير المحاسبة.' : 'تم احتسابها تلقائياً عند تحويل الطلب إلى تم التسليم.'}</p>
                  </div>
                  <strong>{formatMoney(deliveryAccounting.requirements?.total_amount)}</strong>
                </div>
                <ResponsiveTableWrap minWidth="640px" ariaLabel="جدول مستحقات الموردين">
                <table className="responsive-table-card">
                  <thead><tr><th>المورد</th><th>المبلغ المستحق</th><th>الحالة المحاسبية</th></tr></thead>
                  <tbody>
                    {(deliveryAccounting.requirements?.suppliers || []).map((supplier) => {
                      const created = (deliveryAccounting.created || []).find((entry) => Number(entry.supplier_id) === Number(supplier.supplier_id));
                      const skipped = (deliveryAccounting.skipped || []).find((entry) => Number(entry.supplier_id) === Number(supplier.supplier_id));
                      const statusText = deliveryAccounting.previewOnly
                        ? 'احتساب فقط'
                        : created
                          ? 'تم إنشاء سند مورد'
                          : getAccountingSkipReasonLabel(skipped?.reason);
                      return (
                        <React.Fragment key={supplier.supplier_id || supplier.supplier_name}>
                          <tr>
                            <td data-label="المورد">{supplier.supplier_name || '-'}</td>
                            <td data-label="المبلغ المستحق">{formatMoney(supplier.total_amount)}</td>
                            <td data-label="الحالة المحاسبية">{statusText}</td>
                          </tr>
                          {(!created && supplier.items?.length > 0 && (!deliveryAccounting.previewOnly || !supplier.supplier_id)) && (
                            <tr>
                              <td colSpan="3" className="responsive-detail-cell">
                                <div className="delivery-accounting-missing">
                                  <strong>منتجات تحتاج ضبط بيانات الشراء:</strong>
                                  <ul>
                                    {supplier.items.map((item) => (
                                      <li key={`${item.product_id}-${item.product_name}`}>
                                        {item.product_name} × {item.quantity_needed} - المورد: {item.supplier_name || 'غير محدد'} - سعر الشراء: {formatMoney(item.purchase_price)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {(deliveryAccounting.requirements?.suppliers || []).length === 0 && <tr className="responsive-empty-row"><td colSpan="3">لا توجد مستحقات موردين لهذا الطلب</td></tr>}
                  </tbody>
                </table>
                </ResponsiveTableWrap>
              </div>
            )}
            <h3>المنتجات</h3>
            <ul className="order-products-list">
              {items.map(i => (
                <li key={i.id}>
                  <span className="order-product-text">
                    {i.product_name}{[i.color_name, i.size_name].filter(Boolean).length ? ` - ${[i.color_name, i.size_name].filter(Boolean).join(' / ')}` : ''} × {i.quantity} = {i.line_total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {previewOpen && (
        <Modal title={previewTitle} onClose={() => setPreviewOpen(false)}>
          {previewLoading && <p>جارٍ التحميل...</p>}
          {!previewLoading && (
            <div className="email-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </Modal>
      )}

      {sendDialog && (
        <Modal title={sendDialog.type === 'customer' ? 'إرسال بريد العميل' : 'إرسال بريد التجهيز'} onClose={() => setSendDialog(null)}>
          <div className="send-email-dialog">
            <label htmlFor="send-order-email">البريد الإلكتروني</label>
            <input
              id="send-order-email"
              type="email"
              placeholder="name@example.com"
              value={sendDialog.email}
              onChange={(e) => setSendDialog((current) => current ? { ...current, email: e.target.value } : current)}
            />
            <p className="muted">اكتب البريد الذي تريد إرسال الطلب إليه.</p>
            <div className="send-email-actions">
              <button
                onClick={sendEmail}
                disabled={sendingKey === `${sendDialog.orderId}:${sendDialog.type}`}
              >
                {sendingKey === `${sendDialog.orderId}:${sendDialog.type}` ? 'جارٍ الإرسال...' : 'إرسال'}
              </button>
              <button className="secondary" onClick={() => setSendDialog(null)}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {pdfEmailDialog && (
        <Modal title={`إرسال PDF التجهيز للطلب #${pdfEmailDialog.orderId}`} onClose={() => setPdfEmailDialog(null)}>
          <div className="send-email-dialog">
            <label htmlFor="send-order-pdf-email">البريد الإلكتروني</label>
            <input
              id="send-order-pdf-email"
              type="email"
              placeholder="name@example.com"
              value={pdfEmailDialog.email}
              onChange={(e) => setPdfEmailDialog((current) => current ? { ...current, email: e.target.value } : current)}
            />
            <p className="muted">سيتم إرسال PDF التجهيز فقط كمرفق إلى هذا البريد.</p>
            <div className="send-email-actions">
              <button
                onClick={sendPdfEmail}
                disabled={sendingKey === `${pdfEmailDialog.orderId}:pdf-email`}
              >
                {sendingKey === `${pdfEmailDialog.orderId}:pdf-email` ? 'جارٍ الإرسال...' : 'إرسال PDF'}
              </button>
              <button className="secondary" onClick={() => setPdfEmailDialog(null)}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {statusDialog && (
        <Modal title={`تحديث حالة الطلب #${statusDialog.orderId}`} onClose={() => setStatusDialog(null)}>
          <div className="send-email-dialog">
            <p className="notice">
              الحالة الجديدة: {statusDialog.markPaid ? 'تم التسليم والدفع' : getOrderStatusLabel(statusDialog.status)}
            </p>
            <label htmlFor="order-status-note">ملاحظة الحالة</label>
            <textarea
              id="order-status-note"
              placeholder="اكتب ملاحظة توضح سبب أو تفاصيل تغيير الحالة"
              value={statusDialog.note}
              onChange={(e) => setStatusDialog((current) => current ? { ...current, note: e.target.value } : current)}
            />
            <p className="muted">يجب إدخال ملاحظة قبل حفظ أي حالة جديدة.</p>
            <div className="send-email-actions">
              <button onClick={updateStatus} disabled={!String(statusDialog.note || '').trim()}>
                حفظ الحالة
              </button>
              <button className="secondary" onClick={() => setStatusDialog(null)}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {discountDialog && (
        <Modal title={`خصم الطلب #${discountDialog.orderId}`} onClose={() => { if (!discountDialog.saving) setDiscountDialog(null); }}>
          <div className="send-email-dialog">
            <label>
              نوع الخصم
              <select value={discountDialog.type} onChange={(e) => setDiscountDialog((current) => current ? { ...current, type: e.target.value } : current)}>
                <option value="fixed">مبلغ ثابت</option>
                <option value="percent">نسبة مئوية</option>
              </select>
            </label>
            <label>
              قيمة الخصم
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountDialog.value}
                onChange={(e) => setDiscountDialog((current) => current ? { ...current, value: e.target.value } : current)}
              />
            </label>
            <label>
              سبب الخصم
              <input
                value={discountDialog.reason}
                onChange={(e) => setDiscountDialog((current) => current ? { ...current, reason: e.target.value } : current)}
                placeholder="مثال: خصم خاص للعميل"
              />
            </label>
            <p className="muted">الخصم إداري فقط ولا يوجد كود خصم في المتجر. يمكن تعديله قبل الدفع أو أثناء قيد التجهيز.</p>
            <div className="send-email-actions">
              <button onClick={applyDiscount} disabled={discountDialog.saving || !Number(discountDialog.value || 0)}>
                {discountDialog.saving ? 'جارٍ الحفظ...' : 'تطبيق الخصم'}
              </button>
              <button className="secondary" onClick={removeDiscount} disabled={discountDialog.saving}>
                {discountDialog.saving ? 'جارٍ الحفظ...' : 'إزالة الخصم'}
              </button>
              <button className="secondary" disabled={discountDialog.saving} onClick={() => { discountIdempotencyKeyRef.current = null; setDiscountDialog(null); }}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {deliveryDialog && (
        <Modal title={`توصيل الطلب #${deliveryDialog.orderId}`} onClose={() => { if (!deliveryDialog.saving) setDeliveryDialog(null); }}>
          <div className="send-email-dialog">
            <label>
              المبلغ
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliveryDialog.amount}
                onChange={(e) => setDeliveryDialog((current) => current ? { ...current, amount: e.target.value } : current)}
                placeholder="0.00"
              />
            </label>
            <label>
              ملاحظة عامة
              <textarea
                value={deliveryDialog.note}
                onChange={(e) => setDeliveryDialog((current) => current ? { ...current, note: e.target.value } : current)}
                placeholder="مثال: رسوم توصيل على الزبون"
                rows="2"
              />
            </label>
            <p className="muted">رسوم التوصيل الجديدة تُضاف تلقائياً على الزبون.</p>
            <div className="send-email-actions">
              <button onClick={saveDelivery} disabled={deliveryDialog.saving}>
                {deliveryDialog.saving ? 'جارٍ الحفظ...' : 'حفظ التوصيل'}
              </button>
              <button className="secondary" disabled={deliveryDialog.saving} onClick={() => setDeliveryDialog((current) => current ? {
                ...current,
                amount: '0',
                note: '',
                supplierDeliveries: (current.supplierDeliveries || []).map((row) => ({ ...row, amount: '', note: '' }))
              } : current)}>
                تصفير التوصيل
              </button>
              <button className="secondary" disabled={deliveryDialog.saving} onClick={() => { deliveryIdempotencyKeyRef.current = null; setDeliveryDialog(null); }}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {editItemsDialog && (
        <Modal title={`تعديل منتجات الطلب #${editItemsDialog.orderId}`} onClose={() => { setProductPickerOpenIndex(null); setEditItemsDialog(null); }}>
          <div className="manual-order-items">
            <div className="card-header compact">
              <h3>المنتجات</h3>
              <p className="muted">التعديل متاح فقط عندما يكون الطلب بانتظار الدفع.</p>
            </div>
            {editItemsDialog.items.map((item, index) => (
              <div key={index} className={`manual-order-item-row ${item.isCustom ? 'custom-order-item-row' : ''}`.trim()}>
                <div className="manual-product-cell">
                  {item.isCustom ? (
                    <div className="custom-order-item-fields">
                      <input value={item.customName || ''} onChange={(event) => updateEditItem(index, 'customName', event.target.value)} placeholder="اسم المنتج" required />
                      <select value={item.supplierId || ''} onChange={(event) => updateEditItem(index, 'supplierId', event.target.value)}>
                        <option value="">بدون مورد</option>
                        {orderSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={(event) => updateEditItem(index, 'unitPrice', event.target.value)} placeholder="سعر البيع" required />
                      <input type="number" min="0" step="0.01" value={item.purchasePrice || ''} onChange={(event) => updateEditItem(index, 'purchasePrice', event.target.value)} placeholder="سعر الشراء" required />
                    </div>
                  ) : (
                    <div className="client-picker">
                      <input
                        value={item.productSearch || ''}
                        onFocus={() => setProductPickerOpenIndex(index)}
                        onClick={() => setProductPickerOpenIndex(index)}
                        onBlur={() => setTimeout(() => setProductPickerOpenIndex((current) => current === index ? null : current), 120)}
                        onChange={(event) => updateEditProductSearch(index, event.target.value)}
                        placeholder="ابحث عن منتج بالاسم أو الرقم أو المورد"
                        required={index === 0 || !!String(item.productId || item.productSearch || item.customName || '').trim()}
                      />
                      {productPickerOpenIndex === index && (
                        <div className="client-picker-list product-picker-list">
                          {getFilteredOrderProducts(item.productSearch).map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectEditProduct(index, product);
                              }}
                            >
                              <strong>{product.name}</strong>
                              <span>{formatMoney(product.price)}</span>
                              <small>{[`#${product.id}`, product.supplier_name, product.category, product.stock != null ? `المخزون: ${product.stock}` : ''].filter(Boolean).join(' · ')}</small>
                            </button>
                          ))}
                          {getFilteredOrderProducts(item.productSearch).length === 0 && <div className="client-picker-empty">لا توجد منتجات مطابقة</div>}
                          <button type="button" onMouseDown={(event) => { event.preventDefault(); makeEditItemCustom(index); }}>
                            <strong>منتج غير موجود بالقائمة</strong>
                            <small>أدخل الاسم والمورد والأسعار يدوياً</small>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {item.productId && (
                  getOrderProductColors(getOrderProduct(item.productId)).length > 0 ? (
                    <div className="manual-color-picker">
                      <span className="manual-color-label">اللون / القياس</span>
                      <select value={item.selectedVariantId ? `${item.selectedVariantId}::${item.selectedColorName || ''}::${item.selectedColorHex || ''}::${item.selectedSizeName || ''}` : ''} onChange={(event) => selectEditItemColor(index, event.target.value)} required>
                        <option value="">اختر اللون / القياس</option>
                        {getOrderProductColors(getOrderProduct(item.productId)).map((color) => (
                          <option key={`${color.id}-${color.name}-${color.hex}-${color.size_name}`} value={`${color.id || ''}::${color.name || ''}::${color.hex || ''}::${color.size_name || ''}`}>
                            {[color.name, color.size_name].filter(Boolean).join(' / ')} {color.price != null ? `- ${formatMoney(color.price)}` : ''}
                          </option>
                        ))}
                      </select>
                      {item.selectedColorHex && <span className="manual-color-swatch" style={{ background: item.selectedColorHex }} />}
                    </div>
                  ) : (
                    <div className="manual-color-empty">لا توجد ألوان</div>
                  )
                )}
                <input type="number" min="1" value={item.quantity} onChange={(event) => updateEditItem(index, 'quantity', event.target.value)} required />
                <button type="button" className="secondary" onClick={() => removeEditItem(index)}>حذف</button>
                {item.productId && (
                  <div className="manual-product-meta">
                    <span>{formatMoney(getOrderProduct(item.productId)?.price)}</span>
                    {getOrderProduct(item.productId)?.stock != null && <span>المخزون: {getOrderProduct(item.productId)?.stock}</span>}
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="secondary" onClick={addEditItem}>إضافة منتج</button>
            <div className="send-email-actions">
              <button onClick={saveEditedItems} disabled={editItemsDialog.saving}>
                {editItemsDialog.saving ? 'جارٍ الحفظ...' : 'حفظ المنتجات'}
              </button>
              <button className="secondary" onClick={() => { setProductPickerOpenIndex(null); setEditItemsDialog(null); }}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CategoriesManager({ setError, currentAdmin }) {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [message, setMessage] = useState('');
  const [categoryReorderingId, setCategoryReorderingId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productReordering, setProductReordering] = useState(false);
  const [draggedProductId, setDraggedProductId] = useState(null);
  const [dragOverProductId, setDragOverProductId] = useState(null);
  const draggedProductIdRef = useRef(null);
  const dragPointerCleanupRef = useRef(() => {});
  const canCreateCategory = hasPermission(currentAdmin, 'categories', 'create');
  const canDeleteCategory = hasPermission(currentAdmin, 'categories', 'delete');
  const canSortCategories = hasPermission(currentAdmin, 'categories', 'sort');
  const canHideCategory = hasPermission(currentAdmin, 'categories', 'hide');
  const canSortProducts = hasPermission(currentAdmin, 'products', 'sort');

  const formatProductPrice = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    return amount.toFixed(2);
  };

  const load = async () => {
    try {
      setMessage('');
      const categoriesList = await apiGet('/admin/categories');
      const nextCategories = Array.isArray(categoriesList) ? categoriesList : [];
      setCategories(nextCategories);
      setSelectedCategoryId((current) => {
        if (nextCategories.some((category) => category.id === current)) return current;
        return nextCategories[0]?.id || null;
      });
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const loadCategoryProducts = async (categoryId) => {
    if (!categoryId) {
      setCategoryProducts([]);
      return;
    }

    setProductsLoading(true);
    try {
      const result = await apiGet(`/admin/categories/${categoryId}/products`);
      setCategoryProducts(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      setError(err.message);
      setCategoryProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    loadCategoryProducts(selectedCategoryId);
  }, [selectedCategoryId]);

  const addCategory = async (e) => {
    if (!canCreateCategory) return;
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await apiPost('/admin/categories', { name: newCategory.trim() });
      setNewCategory('');
      setMessage('تمت إضافة الفئة بنجاح');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCategory = async (id) => {
    if (!canDeleteCategory) return;
    if (!confirm('حذف الفئة؟ سيتم حذفها من القائمة وإزالة ربطها من المنتجات الحالية.')) return;
    try {
      const result = await apiDelete(`/admin/categories/${id}`);
      const clearedProducts = Number(result?.clearedProducts || 0);
      setMessage(clearedProducts > 0
        ? `تم حذف الفئة وإزالة ربطها من ${clearedProducts} منتج`
        : 'تم حذف الفئة بنجاح');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleCategoryVisibility = async (category) => {
    if (!canHideCategory || !category?.id) return;
    try {
      const updated = await apiPut(`/admin/categories/${category.id}/visibility`, {
        is_hidden: !category.is_hidden
      });
      setCategories(Array.isArray(updated) ? updated : categories);
      setMessage(category.is_hidden ? 'تم إظهار الفئة' : 'تم إخفاء الفئة');
    } catch (err) {
      setError(err.message);
    }
  };

  const moveCategory = async (index, direction) => {
    if (!canSortCategories) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;

    const nextCategories = [...categories];
    const [moved] = nextCategories.splice(index, 1);
    nextCategories.splice(nextIndex, 0, moved);

    setCategories(nextCategories);
    setCategoryReorderingId(moved.id);
    setMessage('');

    try {
      const updated = await apiPut('/admin/categories/reorder', {
        ids: nextCategories.map((category) => category.id)
      });
      setCategories(Array.isArray(updated) ? updated : nextCategories);
      setMessage('تم تحديث ترتيب الفئات');
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setCategoryReorderingId(null);
    }
  };

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null;

  const saveCategoryProductOrder = async (nextProducts) => {
    if (!selectedCategoryId || !canSortProducts) return;

    setCategoryProducts(nextProducts);
    setProductReordering(true);
    setMessage('');

    try {
      const result = await apiPost(`/admin/categories/${selectedCategoryId}/products/reorder`, {
        ids: nextProducts.map((product) => product.id)
      });
      setCategoryProducts(Array.isArray(result?.items) ? result.items : nextProducts);
      setMessage('تم تحديث ترتيب منتجات الفئة');
    } catch (err) {
      setError(err.message);
      loadCategoryProducts(selectedCategoryId);
    } finally {
      setProductReordering(false);
    }
  };

  const clearDraggedProductState = () => {
    draggedProductIdRef.current = null;
    setDraggedProductId(null);
    setDragOverProductId(null);
  };

  const cleanupPointerDrag = useCallback(() => {
    dragPointerCleanupRef.current();
    dragPointerCleanupRef.current = () => {};
  }, []);

  useEffect(() => () => cleanupPointerDrag(), [cleanupPointerDrag]);

  const resolveDraggedProductId = (event) => {
    const fromTransfer = Number(event?.dataTransfer?.getData('text/plain') || 0);
    if (Number.isInteger(fromTransfer) && fromTransfer > 0) return fromTransfer;
    const fromRef = Number(draggedProductIdRef.current || 0);
    if (Number.isInteger(fromRef) && fromRef > 0) return fromRef;
    const fromState = Number(draggedProductId || 0);
    return Number.isInteger(fromState) && fromState > 0 ? fromState : null;
  };

  const moveDraggedProduct = async (sourceProductId, targetProductId) => {
    if (!sourceProductId || !targetProductId || sourceProductId === targetProductId || productReordering) return;

    const currentIndex = categoryProducts.findIndex((product) => product.id === sourceProductId);
    const targetIndex = categoryProducts.findIndex((product) => product.id === targetProductId);
    if (currentIndex < 0 || targetIndex < 0) return;

    const nextProducts = [...categoryProducts];
    const [movedProduct] = nextProducts.splice(currentIndex, 1);
    nextProducts.splice(targetIndex, 0, movedProduct);
    clearDraggedProductState();
    await saveCategoryProductOrder(nextProducts);
  };

  const moveDraggedProductToEnd = async (sourceProductId) => {
    if (!sourceProductId || productReordering) return;

    const currentIndex = categoryProducts.findIndex((product) => product.id === sourceProductId);
    if (currentIndex < 0 || currentIndex === categoryProducts.length - 1) return;

    const nextProducts = [...categoryProducts];
    const [movedProduct] = nextProducts.splice(currentIndex, 1);
    nextProducts.push(movedProduct);
    clearDraggedProductState();
    await saveCategoryProductOrder(nextProducts);
  };

  const resolvePointerDropTarget = (clientX, clientY) => {
    if (typeof document === 'undefined') return null;
    const target = document.elementFromPoint(clientX, clientY);
    const dropzone = target?.closest?.('[data-dropzone-end="true"]');
    if (dropzone) return { type: 'end' };

    const card = target?.closest?.('[data-product-card-id]');
    if (!card) return null;

    const productId = Number(card.getAttribute('data-product-card-id') || 0);
    if (!Number.isInteger(productId) || productId <= 0) return null;
    return { type: 'card', productId };
  };

  const startPointerDrag = (event, productId) => {
    if (productReordering) return;
    event.preventDefault();
    event.stopPropagation();

    cleanupPointerDrag();
    draggedProductIdRef.current = productId;
    setDraggedProductId(productId);
    setDragOverProductId(productId);

    const handlePointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      const target = resolvePointerDropTarget(moveEvent.clientX, moveEvent.clientY);
      if (!target) {
        setDragOverProductId(null);
        return;
      }
      setDragOverProductId(target.type === 'end' ? '__end__' : target.productId);
    };

    const finishPointerDrag = async (pointerEvent) => {
      const sourceProductId = draggedProductIdRef.current;
      const target = resolvePointerDropTarget(pointerEvent.clientX, pointerEvent.clientY);
      cleanupPointerDrag();

      if (!target || !sourceProductId) {
        clearDraggedProductState();
        return;
      }

      if (target.type === 'end') {
        await moveDraggedProductToEnd(sourceProductId);
        return;
      }

      await moveDraggedProduct(sourceProductId, target.productId);
    };

    const handlePointerUp = (pointerEvent) => {
      finishPointerDrag(pointerEvent);
    };

    const handlePointerCancel = () => {
      cleanupPointerDrag();
      clearDraggedProductState();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerCancel, { once: true });

    dragPointerCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  };

  const moveProductByStep = async (productId, direction) => {
    if (!canSortProducts || productReordering) return;

    const currentIndex = categoryProducts.findIndex((product) => product.id === productId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= categoryProducts.length) return;

    const nextProducts = [...categoryProducts];
    const [movedProduct] = nextProducts.splice(currentIndex, 1);
    nextProducts.splice(targetIndex, 0, movedProduct);
    await saveCategoryProductOrder(nextProducts);
  };

  return (
    <div className="grid single">
      <section className="card">
        <div className="card-header">
          <h2>الفئات</h2>
        </div>
        {message && <div className="notice">{message}</div>}
        <form className="row" onSubmit={addCategory}>
          {canCreateCategory && (
            <>
              <input
                placeholder="إضافة فئة"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button type="submit">إضافة</button>
            </>
          )}
        </form>
        <ResponsiveTableWrap minWidth="680px" ariaLabel="جدول الفئات">
        <table className="responsive-table-card">
          <thead>
            <tr>
              <th>الترتيب</th>
              <th>الاسم</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category.id}>
                <td data-label="الترتيب">{index + 1}</td>
                <td data-label="الاسم">{category.name}</td>
                <td data-label="الحالة">{category.is_hidden ? 'مخفية' : 'ظاهرة'}</td>
                <td data-label="إجراءات" className="responsive-actions-cell">
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                    {canHideCategory && <button type="button" className="secondary" onClick={() => toggleCategoryVisibility(category)}>{category.is_hidden ? 'إظهار' : 'إخفاء'}</button>}
                    {canSortCategories && <button type="button" className="secondary" disabled={index === 0 || categoryReorderingId === category.id} onClick={() => moveCategory(index, -1)}>↑</button>}
                    {canSortCategories && <button type="button" className="secondary" disabled={index === categories.length - 1 || categoryReorderingId === category.id} onClick={() => moveCategory(index, 1)}>↓</button>}
                    {canDeleteCategory && <button className="danger" onClick={() => deleteCategory(category.id)}>حذف</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ResponsiveTableWrap>
      </section>

      {canSortProducts && <section className="card">
        <div className="card-header">
          <div>
            <h2>ترتيب منتجات الفئة</h2>
            <div className="muted">اسحب البطاقة وأفلتها لتغيير ترتيب المنتجات داخل الفئة المحددة.</div>
          </div>
        </div>

        <div className="category-products-toolbar">
          <select value={selectedCategoryId || ''} onChange={(e) => setSelectedCategoryId(Number(e.target.value) || null)}>
            <option value="">اختر فئة</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={() => loadCategoryProducts(selectedCategoryId)} disabled={!selectedCategoryId || productsLoading || productReordering}>
            تحديث
          </button>
        </div>

        {!selectedCategory && <p className="muted">اختر فئة لعرض منتجاتها وترتيبها.</p>}
        {selectedCategory && productsLoading && <p>جارٍ تحميل منتجات الفئة...</p>}
        {selectedCategory && !productsLoading && categoryProducts.length === 0 && <p className="muted">لا توجد منتجات مرتبطة بهذه الفئة حالياً.</p>}

        {selectedCategory && !productsLoading && categoryProducts.length > 0 && (
          <>
            <div className="muted" style={{ marginBottom: 10 }}>
              الفئة الحالية: <strong>{selectedCategory.name}</strong>
              {productReordering ? ' - جارٍ حفظ الترتيب...' : ''}
            </div>

            <div className="category-product-grid">
              {categoryProducts.map((product, index) => {
                const isDragging = draggedProductId === product.id;
                const isDropTarget = dragOverProductId === product.id && draggedProductId !== product.id;

                return (
                  <div
                    key={product.id}
                    data-product-card-id={product.id}
                    className={`category-product-card ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                    draggable={!productReordering}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(product.id));
                      draggedProductIdRef.current = product.id;
                      setDraggedProductId(product.id);
                      setDragOverProductId(product.id);
                    }}
                    onDragEnd={() => {
                      window.setTimeout(() => {
                        clearDraggedProductState();
                      }, 0);
                    }}
                    onDragEnter={() => {
                      if (!draggedProductIdRef.current || draggedProductIdRef.current === product.id) return;
                      setDragOverProductId(product.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      const sourceProductId = resolveDraggedProductId(event);
                      if (!sourceProductId || sourceProductId === product.id) return;
                      setDragOverProductId(product.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceProductId = resolveDraggedProductId(event);
                      moveDraggedProduct(sourceProductId, product.id);
                    }}
                  >
                    <div className="category-product-order">#{index + 1}</div>
                    <div className="category-product-media">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} draggable="false" />
                      ) : (
                        <div className="category-product-placeholder">بدون صورة</div>
                      )}
                    </div>
                    <div className="category-product-body">
                      <div className="category-product-name">{product.name}</div>
                      <div className="category-product-meta">{formatProductPrice(product.price)}</div>
                      <div className="category-product-badges">
                        <span className={`status-badge ${product.is_available ? 'ok' : 'warn'}`}>{product.is_available ? 'متوفر' : 'غير متوفر'}</span>
                        <span className={`status-badge ${product.is_hidden ? 'muted' : 'ok-soft'}`}>{product.is_hidden ? 'مخفي' : 'ظاهر'}</span>
                      </div>
                    </div>
                    <div className="category-product-footer">
                      <button
                        type="button"
                        className="category-product-drag"
                        onPointerDown={(event) => startPointerDrag(event, product.id)}
                      >
                        اسحب
                      </button>
                      <div className="category-product-move-actions">
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() => moveProductByStep(product.id, -1)}
                          disabled={index === 0 || productReordering}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() => moveProductByStep(product.id, 1)}
                          disabled={index === categoryProducts.length - 1 || productReordering}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              data-dropzone-end="true"
              className={`category-product-dropzone ${dragOverProductId === '__end__' ? 'active' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (!resolveDraggedProductId(event)) return;
                setDragOverProductId('__end__');
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceProductId = resolveDraggedProductId(event);
                moveDraggedProductToEnd(sourceProductId);
              }}
            >
              اسحب البطاقة هنا لوضعها في آخر ترتيب الفئة
            </div>
          </>
        )}
      </section>}
    </div>
  );
}

function CitiesManager({ setError, currentAdmin }) {
  const [cities, setCities] = useState([]);
  const [newCity, setNewCity] = useState('');
  const [message, setMessage] = useState('');
  const canCreateCity = hasPermission(currentAdmin, 'cities', 'create');
  const canDeleteCity = hasPermission(currentAdmin, 'cities', 'delete');

  const load = async () => {
    try {
      setMessage('');
      const citiesList = await apiGet('/admin/cities');
      setCities(citiesList);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const addCity = async (e) => {
    if (!canCreateCity) return;
    e.preventDefault();
    if (!newCity.trim()) return;
    try {
      await apiPost('/admin/cities', { name: newCity.trim() });
      setNewCity('');
      setMessage('تمت إضافة المدينة بنجاح');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCity = async (id) => {
    if (!canDeleteCity) return;
    if (!confirm('حذف المدينة من القائمة؟')) return;
    try {
      await apiDelete(`/admin/cities/${id}`);
      setMessage('تم حذف المدينة بنجاح');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid single">
      <section className="card">
        <div className="card-header">
          <h2>المدن</h2>
        </div>
        {message && <div className="notice">{message}</div>}
        <form className="row" onSubmit={addCity}>
          {canCreateCity && (
            <>
              <input
                placeholder="إضافة مدينة"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
              />
              <button type="submit">إضافة</button>
            </>
          )}
        </form>
        <ResponsiveTableWrap minWidth="520px" ariaLabel="جدول المدن">
        <table className="responsive-table-card">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city.id}>
                <td data-label="الاسم">{city.name}</td>
                <td data-label="إجراءات" className="responsive-actions-cell">
                  {canDeleteCity && <button className="danger" onClick={() => deleteCity(city.id)}>حذف</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ResponsiveTableWrap>
      </section>
    </div>
  );
}

function SmtpSettings({ showToast, currentAdmin }) {
  const emptyForm = () => ({
    label: '',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    has_password: false,
    from_name: '',
    from_email: '',
    notify_email: '',
    is_active: false
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [actionItem, setActionItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [testItem, setTestItem] = useState(null);
  const [testType, setTestType] = useState('smtp');
  const [testTo, setTestTo] = useState('');
  const [saving, setSaving] = useState(false);
  const canCreateSmtp = hasPermission(currentAdmin, 'smtp', 'create');
  const canUpdateSmtp = hasPermission(currentAdmin, 'smtp', 'update');
  const canDeleteSmtp = hasPermission(currentAdmin, 'smtp', 'delete');
  const canActivateSmtp = hasPermission(currentAdmin, 'smtp', 'activate');
  const canTestSmtp = hasPermission(currentAdmin, 'smtp', 'test');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/admin/smtp-settings');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('error', err.message || 'فشل تحميل إعدادات SMTP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    if (!canCreateSmtp) return;
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = async (item) => {
    if (!canUpdateSmtp) return;
    try {
      const data = await apiGet(`/admin/smtp-settings/${item.id}`);
      setEditingId(item.id);
      setForm({
        label: data.label || '',
        host: data.host || '',
        port: data.port || 587,
        secure: !!data.secure,
        username: data.username || '',
        password: '',
        has_password: !!data.has_password,
        from_name: data.from_name || '',
        from_email: data.from_email || '',
        notify_email: data.notify_email || '',
        is_active: !!data.is_active
      });
      setFormOpen(true);
    } catch (err) {
      showToast('error', err.message || 'فشل تحميل إعدادات SMTP');
    }
  };

  const save = async () => {
    if ((editingId && !canUpdateSmtp) || (!editingId && !canCreateSmtp)) return;
    if (!form.host || !form.username) {
      showToast('error', 'SMTP Host و Username مطلوبان');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/admin/smtp-settings/${editingId}`, form);
        showToast('success', 'تم تحديث إعداد SMTP');
      } else {
        await apiPost('/admin/smtp-settings', form);
        showToast('success', 'تم إضافة إعداد SMTP');
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      showToast('error', err.message || 'فشل حفظ إعداد SMTP');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id) => {
    if (!canActivateSmtp) return;
    try {
      await apiPost(`/admin/smtp-settings/${id}/activate`, {});
      showToast('success', 'تم تفعيل إعداد SMTP');
      setActionItem(null);
      await load();
    } catch (err) {
      showToast('error', err.message || 'فشل تفعيل إعداد SMTP');
    }
  };

  const remove = async () => {
    if (!canDeleteSmtp) return;
    if (!deleteItem) return;
    try {
      await apiDelete(`/admin/smtp-settings/${deleteItem.id}`);
      showToast('success', 'تم حذف إعداد SMTP');
      setDeleteItem(null);
      setActionItem(null);
      await load();
    } catch (err) {
      showToast('error', err.message || 'فشل حذف إعداد SMTP');
    }
  };

  const runTest = async () => {
    if (!canTestSmtp) return;
    if (!testItem) return;
    try {
      await apiPost('/admin/smtp-settings/test', {
        smtpId: testItem.id,
        type: testType,
        to: testTo || undefined
      });
      if (testType === 'customer') showToast('success', 'تم إرسال اختبار بريد العميل');
      else if (testType === 'internal') showToast('success', 'تم إرسال اختبار بريد التجهيز');
      else if (testType === 'both') showToast('success', 'تم إرسال الاختبارين (عميل + تجهيز)');
      else showToast('success', 'تم إرسال اختبار SMTP');
      setTestItem(null);
      setActionItem(null);
      setTestTo('');
      setTestType('smtp');
    } catch (err) {
      showToast('error', err.message || 'فشل اختبار SMTP');
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>إعدادات SMTP</h2>
        {canCreateSmtp && <button onClick={openCreate}>إضافة SMTP</button>}
      </div>

      {loading && <div className="muted">جارٍ التحميل...</div>}

      {!loading && items.length === 0 && (
        <div className="notice">لا توجد إعدادات SMTP محفوظة بعد.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="smtp-carousel">
          {items.map((item) => (
            <article key={item.id} className={`smtp-card ${item.is_active ? 'active' : ''}`}>
              <div className="smtp-card-header">
                <h3>{item.label || item.host || `SMTP #${item.id}`}</h3>
                {item.is_active && <span className="badge-success">المستخدم الآن</span>}
              </div>
              <div className="smtp-card-body">
                <div><strong>Host:</strong> {item.host || '-'}</div>
                <div><strong>Port:</strong> {item.port || 587}</div>
                <div><strong>Username:</strong> {item.username || '-'}</div>
                <div><strong>From:</strong> {item.from_email || '-'}</div>
                <div><strong>إشعارات الإدارة:</strong> {item.notify_email || '-'}</div>
              </div>
              <div className="smtp-card-footer">
                {(canUpdateSmtp || canDeleteSmtp || canActivateSmtp || canTestSmtp) && <button className="secondary" onClick={() => setActionItem(item)}>إدارة</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <Modal title={editingId ? 'تعديل SMTP' : 'إضافة SMTP'} onClose={() => setFormOpen(false)}>
          <div className="form">
            <input
              placeholder="اسم الإعداد (مثال: SMTP الرئيسي)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <input
              placeholder="SMTP Host"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
            />
            <input
              placeholder="Port"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => setForm({ ...form, secure: e.target.checked })}
              />
              اتصال آمن (SSL/TLS)
            </label>
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              placeholder={editingId
                ? (form.has_password ? 'Password محفوظة (اتركه فارغًا لعدم التغيير)' : 'Password')
                : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value, has_password: !!e.target.value || form.has_password })}
            />
            <input
              placeholder="اسم المرسل (From Name)"
              value={form.from_name}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
            />
            <input
              placeholder="بريد المرسل (From Email)"
              value={form.from_email}
              onChange={(e) => setForm({ ...form, from_email: e.target.value })}
            />
            <input
              placeholder="بريد إشعارات الإدارة (اختياري)"
              value={form.notify_email}
              onChange={(e) => setForm({ ...form, notify_email: e.target.value })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              اجعل هذا SMTP هو المعتمد
            </label>
            <div className="row">
              <button onClick={save} disabled={saving}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {actionItem && (
        <Modal title="إدارة SMTP" onClose={() => setActionItem(null)}>
          <div className="form">
            <div className="notice">الإعداد المحدد: {actionItem.label || actionItem.host || `SMTP #${actionItem.id}`}</div>
            <div className="status-actions">
              {!actionItem.is_active && canActivateSmtp && (
                <button className="secondary" onClick={() => activate(actionItem.id)}>تفعيل هذا الإعداد</button>
              )}
              {canUpdateSmtp && <button className="secondary" onClick={() => {
                setActionItem(null);
                openEdit(actionItem);
              }}>
                تعديل
              </button>}
              {canTestSmtp && <button className="secondary" onClick={() => {
                setTestItem(actionItem);
                setActionItem(null);
              }}>
                اختبار الإرسال
              </button>}
              {canDeleteSmtp && <button className="danger" onClick={() => {
                setDeleteItem(actionItem);
                setActionItem(null);
              }}>
                حذف
              </button>}
            </div>
          </div>
        </Modal>
      )}

      {testItem && canTestSmtp && (
        <Modal title="اختبار SMTP" onClose={() => setTestItem(null)}>
          <div className="form">
            <div className="muted">سيتم الاختبار باستخدام: {testItem.label || testItem.host || `SMTP #${testItem.id}`}</div>
            <select value={testType} onChange={(e) => setTestType(e.target.value)}>
              <option value="smtp">اختبار SMTP فقط</option>
              <option value="customer">اختبار بريد العميل</option>
              <option value="internal">اختبار بريد التجهيز</option>
              <option value="both">اختبار البريدين معًا</option>
            </select>
            <input
              placeholder="إيميل الاختبار (اختياري)"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <div className="row">
              <button onClick={runTest}>تشغيل الاختبار</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteItem && canDeleteSmtp && (
        <Modal title="تأكيد حذف SMTP" onClose={() => setDeleteItem(null)}>
          <div className="form">
            <div className="error">
              هل أنت متأكد من حذف الإعداد: {deleteItem.label || deleteItem.host || `SMTP #${deleteItem.id}`}؟
            </div>
            <div className="row">
              <button className="danger" onClick={remove}>نعم، حذف</button>
              <button className="secondary" onClick={() => setDeleteItem(null)}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function WhatsappSettings({ setError, currentAdmin }) {
  const [form, setForm] = useState({
    phone: '',
    message: '',
    qr_data_url: ''
  });
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [localError, setLocalError] = useState('');
  const canUpdateWhatsapp = hasPermission(currentAdmin, 'whatsapp', 'update');

  const load = async () => {
    try {
      const data = await apiGet('/admin/whatsapp-settings');
      const exists = !!(data && (data.phone || data.message || data.qr_data_url));
      setHasConfig(exists);
      setForm({
        phone: data.phone || '',
        message: data.message || '',
        qr_data_url: data.qr_data_url || ''
      });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!canUpdateWhatsapp) return;
    try {
      const data = await apiPut('/admin/whatsapp-settings', form);
      setMessage('تم الحفظ.');
      setHasConfig(true);
      setForm({
        phone: data.phone || '',
        message: data.message || '',
        qr_data_url: data.qr_data_url || ''
      });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleQr = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, qr_data_url: reader.result });
    reader.onerror = () => setLocalError('فشل قراءة صورة QR');
    reader.readAsDataURL(file);
  };

  return (
    <section className="card">
        <div className="card-header">
          <h2>إعدادات واتساب</h2>
          {canUpdateWhatsapp && <button onClick={() => setOpen(true)}>{hasConfig ? 'تعديل الإعدادات' : 'إضافة إعدادات'}</button>}
        </div>
      {!hasConfig && (
        <div className="notice">لا توجد إعدادات واتساب محفوظة بعد.</div>
      )}
      {message && <div className="notice">{message}</div>}
      {open && (
        <Modal title="إعدادات واتساب" onClose={() => setOpen(false)}>
          {localError && <div className="error">{localError}</div>}
          <div className="form">
            <input
              placeholder="رقم واتساب (مثال: +972568114114)"
              value={form.phone}
              onChange={(e)=>setForm({...form, phone: e.target.value})}
            />
            <textarea
              placeholder="نص الرسالة التي ستظهر للعميل"
              value={form.message}
              onChange={(e)=>setForm({...form, message: e.target.value})}
            />
            <div className="upload">
              <label className="upload-label">صورة QR</label>
              <input type="file" accept="image/*" onChange={(e)=>handleQr(e.target.files?.[0])} />
              {form.qr_data_url && (
                <div className="preview-item">
                  <img src={form.qr_data_url} alt="qr" />
                </div>
              )}
            </div>
            <div className="row">
              {canUpdateWhatsapp && <button onClick={save}>حفظ</button>}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function BannerSection({ site, label, endpoint, showToast, currentAdmin }) {
  const [banner, setBanner] = useState({ image_url: '', updated_at: null });
  const [uploadDataUrl, setUploadDataUrl] = useState('');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const canUpdate = hasPermission(currentAdmin, 'banner', 'update');
  const canDelete = hasPermission(currentAdmin, 'banner', 'delete');

  const load = async () => {
    try {
      const data = await apiGet(endpoint);
      setBanner({ image_url: data?.image_url || '', updated_at: data?.updated_at || null });
    } catch (err) {
      setLocalError(err.message || `تعذر تحميل بانر ${label}`);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadDataUrl(String(reader.result || ''));
      setPreview(String(reader.result || ''));
      setLocalError('');
    };
    reader.onerror = () => setLocalError('فشل قراءة ملف الصورة');
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!canUpdate) return;
    if (!uploadDataUrl && !banner.image_url) {
      setLocalError('اختر صورة البانر أولاً');
      return;
    }
    setSaving(true);
    setLocalError('');
    try {
      const saved = await apiPut(endpoint, {
        image_data_url: uploadDataUrl,
        image_url: banner.image_url
      });
      setBanner({ image_url: saved?.image_url || '', updated_at: saved?.updated_at || null });
      setUploadDataUrl('');
      setPreview('');
      showToast?.('success', `تم حفظ بانر ${label}`);
    } catch (err) {
      setLocalError(err.message || 'تعذر حفظ البانر');
      showToast?.('error', err.message || 'تعذر حفظ البانر');
    } finally {
      setSaving(false);
    }
  };

  const deleteBanner = async () => {
    if (!canDelete) return;
    if (!confirm(`هل تريد حذف بانر ${label}؟`)) return;
    setSaving(true);
    setLocalError('');
    try {
      await apiDelete(endpoint);
      setBanner({ image_url: '', updated_at: null });
      setUploadDataUrl('');
      setPreview('');
      showToast?.('success', `تم حذف بانر ${label}`);
    } catch (err) {
      setLocalError(err.message || 'تعذر حذف البانر');
      showToast?.('error', err.message || 'تعذر حذف البانر');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-section">
      <h3>{label}</h3>
      {localError && <div className="error">{localError}</div>}
      {!banner.image_url && <div className="notice">لا يوجد بانر ظاهر حالياً.</div>}
      {banner.image_url && (
        <div className="banner-preview-wrap">
          <img src={banner.image_url} alt="current banner" className="banner-preview" />
          <div className="muted">آخر تحديث: {banner.updated_at ? new Date(banner.updated_at).toLocaleString() : '-'}</div>
        </div>
      )}
      <div className="form">
        <div className="upload">
          <label className="upload-label">صورة بانر جديدة</label>
          {canUpdate && <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />}
        </div>
        {preview && (
          <div className="banner-preview-wrap">
            <img src={preview} alt="new banner preview" className="banner-preview" />
          </div>
        )}
        <div className="row">
          {canUpdate && <button onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ البانر'}</button>}
          {canDelete && <button className="danger" onClick={deleteBanner} disabled={saving || !banner.image_url}>حذف البانر</button>}
        </div>
      </div>
    </div>
  );
}

function SiteBannerSettings({ showToast, currentAdmin }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>إعدادات البانرات</h2>
      </div>
      <BannerSection site="store" label="المتجر" endpoint="/admin/banner" showToast={showToast} currentAdmin={currentAdmin} />
      <BannerSection site="shara" label="شعرة" endpoint="/admin/banner/shara" showToast={showToast} currentAdmin={currentAdmin} />
      <BannerSection site="shadi" label="الاستشارات" endpoint="/admin/banner/shadi" showToast={showToast} currentAdmin={currentAdmin} />
    </section>
  );
}

function LahzaSettings({ showToast, currentAdmin }) {
  const [form, setForm] = useState({
    enabled: true,
    api_url: 'https://api.lahza.io/transaction',
    currency: 'ILS',
    secret_key: '',
    webhook_secret: ''
  });
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [localError, setLocalError] = useState('');
  const canUpdateLahza = hasPermission(currentAdmin, 'lahza', 'update');
  const canCheckLahza = hasPermission(currentAdmin, 'lahza', 'check');

  const loadDiagnostics = async () => {
    if (!canCheckLahza) return;
    setChecking(true);
    try {
      setDiagnostics(await apiGet('/admin/lahza-settings/check'));
    } catch (err) {
      setLocalError(err.message || 'تعذر فحص إعدادات Lahza');
    } finally {
      setChecking(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setLocalError('');
    try {
      const data = await apiGet('/admin/lahza-settings');
      setForm((current) => ({
        ...current,
        enabled: !!data?.enabled,
        api_url: data?.api_url || 'https://api.lahza.io/transaction',
        currency: data?.currency || 'ILS',
        secret_key: '',
        webhook_secret: ''
      }));
      await loadDiagnostics();
    } catch (err) {
      setLocalError(err.message || 'تعذر تحميل إعدادات Lahza');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!canUpdateLahza) return;
    setSaving(true);
    setLocalError('');
    try {
      const saved = await apiPut('/admin/lahza-settings', form);
      setForm({
        enabled: !!saved?.enabled,
        api_url: saved?.api_url || 'https://api.lahza.io/transaction',
        currency: saved?.currency || 'ILS',
        secret_key: '',
        webhook_secret: ''
      });
      await loadDiagnostics();
      showToast?.('success', 'تم حفظ إعدادات Lahza');
    } catch (err) {
      setLocalError(err.message || 'تعذر حفظ إعدادات Lahza');
      showToast?.('error', err.message || 'تعذر حفظ إعدادات Lahza');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <h2>إعدادات Lahza</h2>
        <p className="muted">جارٍ التحميل...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>إعدادات Lahza</h2>
        <div className="row">
          {canCheckLahza && <button className="secondary" onClick={loadDiagnostics} disabled={checking || saving}>
            {checking ? 'جارٍ الفحص...' : 'فحص الإعدادات'}
          </button>}
        </div>
      </div>

      {localError && <div className="error">{localError}</div>}
      {diagnostics && (
        <div className="notice recaptcha-status">
          <div><strong>المصدر:</strong> {diagnostics.source === 'database' ? 'قاعدة البيانات' : 'متغيرات البيئة'}</div>
          <div><strong>الحالة:</strong> {diagnostics.enabled ? 'مفعلة' : 'معطلة'}</div>
          <div><strong>API URL:</strong> {diagnostics.api_url || '-'}</div>
          <div><strong>Currency:</strong> {diagnostics.currency || '-'}</div>
          <div><strong>Secret Key:</strong> {diagnostics.secret_key_preview || 'غير موجود'}</div>
          <div><strong>Webhook Secret:</strong> {diagnostics.webhook_secret_preview || 'غير موجود'}</div>
          <div><strong>Webhook Header:</strong> {diagnostics.webhook_header}</div>
          <div><strong>IP Allowlist:</strong> {(diagnostics.recommended_webhook_ips || []).join(' , ')}</div>
          {Array.isArray(diagnostics.warnings) && diagnostics.warnings.length > 0 && (
            <div className="recaptcha-warnings">
              {diagnostics.warnings.map((warning) => (
                <div key={warning}>- {warning}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form">
        <label>API URL</label>
        <input
          value={form.api_url}
           onChange={(e) => setForm({ ...form, api_url: e.target.value })}
           disabled={!canUpdateLahza}
          placeholder="https://api.lahza.io/transaction"
          dir="ltr"
        />

        <label>Currency</label>
        <select
          value={form.currency}
           onChange={(e) => setForm({ ...form, currency: e.target.value })}
           disabled={!canUpdateLahza}
          dir="ltr"
        >
          <option value="USD">USD</option>
          <option value="ILS">ILS</option>
          <option value="JOD">JOD</option>
        </select>

        <label>Secret Key</label>
        <input
          type={showSecret ? 'text' : 'password'}
          value={form.secret_key}
           onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
           disabled={!canUpdateLahza}
          placeholder="اتركه فارغاً للإبقاء على المفتاح الحالي"
          dir="ltr"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={showSecret}
            onChange={(e) => setShowSecret(e.target.checked)}
            disabled={!canUpdateLahza}
          />
          عرض Secret Key
        </label>

        <label>Webhook Secret</label>
        <input
          type={showWebhookSecret ? 'text' : 'password'}
          value={form.webhook_secret}
           onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
           disabled={!canUpdateLahza}
          placeholder="اتركه فارغاً للإبقاء على المفتاح الحالي"
          dir="ltr"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={showWebhookSecret}
            onChange={(e) => setShowWebhookSecret(e.target.checked)}
            disabled={!canUpdateLahza}
          />
          عرض Webhook Secret
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            disabled={!canUpdateLahza}
          />
          تفعيل Lahza
        </label>

        <div className="notice">
          يتم حفظ المفاتيح بشكل مشفر في قاعدة البيانات. اترك حقل المفتاح فارغاً إذا كنت لا تريد تغييره.
        </div>

        <div className="row">
          {canUpdateLahza && <button onClick={save} disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>}
        </div>
      </div>
    </section>
  );
}

function StoreSettings({ showToast, currentAdmin }) {
  const [form, setForm] = useState({ currency: 'ILS' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const canUpdateStore = hasPermission(currentAdmin, 'store', 'update');

  const load = async () => {
    setLoading(true);
    setLocalError('');
    try {
      const data = await apiGet('/admin/store-settings');
      setForm({ currency: data?.currency || 'ILS' });
    } catch (err) {
      setLocalError(err.message || 'تعذر تحميل إعدادات المتجر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!canUpdateStore) return;
    setSaving(true);
    setLocalError('');
    try {
      const saved = await apiPut('/admin/store-settings', form);
      setForm({ currency: saved?.currency || 'ILS' });
      showToast?.('success', 'تم حفظ عملة المتجر');
    } catch (err) {
      setLocalError(err.message || 'تعذر حفظ عملة المتجر');
      showToast?.('error', err.message || 'تعذر حفظ عملة المتجر');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <h2>إعدادات المتجر</h2>
        <p className="muted">جارٍ التحميل...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>إعدادات المتجر</h2>
      </div>

      {localError && <div className="error">{localError}</div>}

      <div className="form">
        <label>عملة عرض الأسعار في المتجر</label>
        <select
          value={form.currency}
          onChange={(e) => setForm({ currency: e.target.value })}
          disabled={!canUpdateStore}
          dir="ltr"
        >
          <option value="ILS">ILS</option>
          <option value="USD">USD</option>
        </select>

        <div className="notice">
          هذا يغيّر عملة العرض في واجهة المتجر. لا يقوم بتحويل الأسعار رقمياً.
        </div>

        <div className="row">
          {canUpdateStore && <button onClick={save} disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>}
        </div>
      </div>
    </section>
  );
}

function RecaptchaSettings({ showToast, currentAdmin }) {
  const [form, setForm] = useState({
    enabled: true,
    site_key: '',
    secret_key: ''
  });
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [localError, setLocalError] = useState('');
  const canUpdateRecaptcha = hasPermission(currentAdmin, 'recaptcha', 'update');
  const canCheckRecaptcha = hasPermission(currentAdmin, 'recaptcha', 'check');

  const loadDiagnostics = async () => {
    if (!canCheckRecaptcha) return;
    setChecking(true);
    try {
      const data = await apiGet('/admin/recaptcha-settings/check');
      setDiagnostics(data);
    } catch (err) {
      setLocalError(err.message || 'تعذر فحص إعدادات reCAPTCHA');
    } finally {
      setChecking(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setLocalError('');
    try {
      const data = await apiGet('/admin/recaptcha-settings');
      setForm({
        enabled: !!data?.enabled,
        site_key: data?.site_key || '',
        secret_key: data?.secret_key || ''
      });
      await loadDiagnostics();
    } catch (err) {
      setLocalError(err.message || 'تعذر تحميل إعدادات reCAPTCHA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!canUpdateRecaptcha) return;
    setSaving(true);
    setLocalError('');
    try {
      const saved = await apiPut('/admin/recaptcha-settings', form);
      setForm({
        enabled: !!saved?.enabled,
        site_key: saved?.site_key || '',
        secret_key: saved?.secret_key || ''
      });
      await loadDiagnostics();
      showToast?.('success', 'تم حفظ إعدادات reCAPTCHA');
    } catch (err) {
      setLocalError(err.message || 'تعذر حفظ إعدادات reCAPTCHA');
      showToast?.('error', err.message || 'تعذر حفظ إعدادات reCAPTCHA');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async () => {
    if (!canUpdateRecaptcha) return;
    const nextEnabled = !form.enabled;
    const payload = { ...form, enabled: nextEnabled };
    setSaving(true);
    setLocalError('');
    try {
      const saved = await apiPut('/admin/recaptcha-settings', payload);
      setForm({
        enabled: !!saved?.enabled,
        site_key: saved?.site_key || '',
        secret_key: saved?.secret_key || ''
      });
      await loadDiagnostics();
      showToast?.('success', nextEnabled ? 'تم إظهار reCAPTCHA' : 'تم إخفاء reCAPTCHA');
    } catch (err) {
      setLocalError(err.message || 'تعذر تحديث حالة reCAPTCHA');
      showToast?.('error', err.message || 'تعذر تحديث حالة reCAPTCHA');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <h2>إعدادات reCAPTCHA</h2>
        <p className="muted">جارٍ التحميل...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>إعدادات reCAPTCHA</h2>
        <div className="row">
          {canCheckRecaptcha && <button className="secondary" onClick={loadDiagnostics} disabled={checking || saving}>
            {checking ? 'جارٍ الفحص...' : 'فحص الإعدادات'}
          </button>}
          {canUpdateRecaptcha && <button className="secondary" onClick={toggleVisibility} disabled={saving}>
            {form.enabled ? 'إخفاء reCAPTCHA' : 'إظهار reCAPTCHA'}
          </button>}
        </div>
      </div>

      {localError && <div className="error">{localError}</div>}
      {!form.enabled && <div className="notice">reCAPTCHA مخفي حالياً من صفحة الدفع.</div>}
      {diagnostics && (
        <div className="notice recaptcha-status">
          <div><strong>واجهة المتجر:</strong> {diagnostics.storefront_ready ? 'جاهزة' : 'غير جاهزة'}</div>
          <div><strong>الخلفية:</strong> {diagnostics.backend_ready ? 'جاهزة' : 'غير جاهزة'}</div>
          <div><strong>Site Key:</strong> {diagnostics.site_key_preview || 'غير موجود'}</div>
          <div><strong>Secret Key:</strong> {diagnostics.secret_key_preview || 'غير موجود'}</div>
          {Array.isArray(diagnostics.warnings) && diagnostics.warnings.length > 0 && (
            <div className="recaptcha-warnings">
              {diagnostics.warnings.map((warning) => (
                <div key={warning}>- {warning}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form">
        <label>Site Key</label>
        <input
          value={form.site_key}
          onChange={(e) => setForm({ ...form, site_key: e.target.value })}
          disabled={!canUpdateRecaptcha}
          placeholder="6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          dir="ltr"
        />

        <label>Secret Key</label>
        <input
          type={showSecret ? 'text' : 'password'}
          value={form.secret_key}
          onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
          disabled={!canUpdateRecaptcha}
          placeholder="6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          dir="ltr"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={showSecret}
            onChange={(e) => setShowSecret(e.target.checked)}
            disabled={!canUpdateRecaptcha}
          />
          عرض Secret Key
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            disabled={!canUpdateRecaptcha}
          />
          تفعيل reCAPTCHA
        </label>

        <div className="row">
          {canUpdateRecaptcha && <button onClick={save} disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>}
        </div>
      </div>
    </section>
  );
}

function AdminUsers({ setError, currentAdmin, refreshCurrentAdmin }) {
  const emptyUserForm = () => ({
    email: '',
    password: '',
    is_super_admin: false,
    permissions: buildEmptyPermissions()
  });
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyUserForm());
  const [resetPass, setResetPass] = useState({ id: '', password: '', email: '' });
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [localError, setLocalError] = useState('');
  const canCreateUser = hasPermission(currentAdmin, 'users', 'create');
  const canUpdatePassword = hasPermission(currentAdmin, 'users', 'update_password');
  const canDeleteUser = hasPermission(currentAdmin, 'users', 'delete');
  const canManagePermissions = hasPermission(currentAdmin, 'users', 'manage_permissions');
  const canCreateManageableUser = canCreateUser && canManagePermissions;

  const countEnabledPermissions = (permissions) => {
    const normalized = normalizePermissions(permissions);
    return Object.values(normalized).reduce(
      (total, moduleActions) => total + Object.values(moduleActions).filter(Boolean).length,
      0
    );
  };

  const syncCurrentAdmin = (nextUsers) => {
    const current = (Array.isArray(nextUsers) ? nextUsers : []).find((user) => user.id === currentAdmin?.id);
    if (!current) return;
    refreshCurrentAdmin({
      ...currentAdmin,
      ...current,
      permissions: normalizePermissions(current.permissions)
    });
  };

  const load = async () => {
    try {
      const data = await apiGet('/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const addUser = async (e) => {
    e.preventDefault();
    if (!form.is_super_admin && countEnabledPermissions(form.permissions) === 0) {
      setLocalError('اختر صلاحية واحدة على الأقل للمستخدم غير المشرف العام');
      return;
    }
    try {
      const data = await apiPost('/admin/users', {
        email: form.email,
        password: form.password,
        is_super_admin: form.is_super_admin,
        permissions: form.permissions
      });
      setForm(emptyUserForm());
      setShowAdd(false);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await apiPut(`/admin/users/${resetPass.id}/password`, { password: resetPass.password });
      setResetPass({ id: '', password: '', email: '' });
      setShowReset(false);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const savePermissions = async (e) => {
    e.preventDefault();
    if (!editingPermissions) return;
    try {
      const data = await apiPut(`/admin/users/${editingPermissions.id}/permissions`, {
        is_super_admin: editingPermissions.is_super_admin,
        permissions: editingPermissions.permissions
      });
      setUsers(Array.isArray(data) ? data : []);
      syncCurrentAdmin(data);
      setEditingPermissions(null);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const removeUser = async (id) => {
    if (!confirm('حذف المستخدم؟')) return;
    try {
      await apiDelete(`/admin/users/${id}`);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const permissionSummary = (permissions) => {
    const normalized = normalizePermissions(permissions);
    const enabled = [];
    for (const [moduleName, actions] of Object.entries(normalized)) {
      const count = Object.values(actions).filter(Boolean).length;
      if (count > 0) enabled.push(`${PERMISSION_MODULE_LABELS[moduleName] || moduleName}: ${count}`);
    }
    return enabled.length > 0 ? enabled.join(' | ') : 'بدون صلاحيات مخصصة';
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>إدارة المستخدمين</h2>
        <div className="row">
          {canCreateManageableUser && <button onClick={() => setShowAdd(true)}>إضافة مستخدم</button>}
          {canUpdatePassword && <button className="secondary" onClick={() => setShowReset(true)}>تغيير كلمة المرور</button>}
        </div>
      </div>
      {localError && <div className="error">{localError}</div>}
      {showAdd && canCreateManageableUser && (
        <Modal title="إضافة مستخدم" onClose={() => setShowAdd(false)}>
          <form className="form" onSubmit={addUser}>
            <input placeholder="البريد الإلكتروني" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} />
            <input placeholder="كلمة المرور" type="password" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} />
            {canManagePermissions && (
              <>
                {currentAdmin?.is_super_admin && (
                  <label className="checkbox">
                    <input type="checkbox" checked={form.is_super_admin} onChange={(e) => setForm({ ...form, is_super_admin: e.target.checked })} />
                    حساب Super Admin
                  </label>
                )}
                {!form.is_super_admin && (
                  <>
                    <label>الصلاحيات</label>
                    <PermissionMatrix value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
                    <div className="muted">يجب اختيار صلاحية واحدة على الأقل لأي مستخدم ليس Super Admin.</div>
                  </>
                )}
              </>
            )}
            <button type="submit">إضافة</button>
          </form>
        </Modal>
      )}
      {showReset && canUpdatePassword && (
        <Modal title="تغيير كلمة المرور" onClose={() => setShowReset(false)}>
          <form className="form" onSubmit={changePassword}>
            <input placeholder="معرف المستخدم" value={resetPass.id} onChange={(e)=>setResetPass({...resetPass, id: e.target.value})} />
            <input placeholder="كلمة مرور جديدة" type="password" value={resetPass.password} onChange={(e)=>setResetPass({...resetPass, password: e.target.value})} />
            <button type="submit" className="secondary">تغيير</button>
          </form>
        </Modal>
      )}
      {editingPermissions && canManagePermissions && (
        <Modal title={`صلاحيات ${editingPermissions.email}`} onClose={() => setEditingPermissions(null)}>
          <form className="form" onSubmit={savePermissions}>
            {currentAdmin?.is_super_admin && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!editingPermissions.is_super_admin}
                  onChange={(e) => setEditingPermissions({ ...editingPermissions, is_super_admin: e.target.checked })}
                  disabled={editingPermissions.email === 'haythemasad5@gmail.com'}
                />
                حساب Super Admin
              </label>
            )}
            {!editingPermissions.is_super_admin && (
              <PermissionMatrix
                value={editingPermissions.permissions}
                onChange={(permissions) => setEditingPermissions({ ...editingPermissions, permissions })}
              />
            )}
            <div className="row">
              <button type="submit">حفظ الصلاحيات</button>
            </div>
          </form>
        </Modal>
      )}
      <ResponsiveTableWrap minWidth="920px" ariaLabel="جدول المستخدمين">
      <table className="responsive-table-card">
        <thead>
          <tr>
            <th>المعرف</th>
            <th>البريد</th>
            <th>النوع</th>
            <th>الصلاحيات</th>
            <th>تاريخ الإنشاء</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td data-label="المعرف">{u.id}</td>
              <td data-label="البريد">{u.email}</td>
              <td data-label="النوع">{u.is_super_admin ? 'Super Admin' : 'مستخدم مخصص'}</td>
              <td data-label="الصلاحيات">{u.is_super_admin ? 'وصول كامل' : permissionSummary(u.permissions)}</td>
              <td data-label="تاريخ الإنشاء">{u.created_at}</td>
              <td data-label="إجراءات" className="responsive-actions-cell">
                <div className="row" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  {canManagePermissions && <button className="secondary" onClick={() => setEditingPermissions({ id: u.id, email: u.email, is_super_admin: !!u.is_super_admin, permissions: normalizePermissions(u.permissions) })}>الصلاحيات</button>}
                  {canUpdatePassword && <button className="secondary" onClick={() => { setResetPass({ id: String(u.id), password: '', email: u.email }); setShowReset(true); }}>كلمة المرور</button>}
                  {canDeleteUser && <button className="danger" onClick={() => removeUser(u.id)}>حذف</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ResponsiveTableWrap>
    </section>
  );
}

export default App;
