import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, apiGet, apiPost, apiPut, apiDelete, getToken, setToken } from './api.js';
import { ADMIN_PERMISSION_DEFINITIONS, buildEmptyPermissions, hasAnyPermission, hasPermission, normalizePermissions } from './permissions.js';
import { ShadiJoinRequests, ShadiTransactions } from './shadiTabs.jsx';

const ADMIN_SESSION_MS = 30 * 60 * 1000;
const ADMIN_SESSION_KEY = 'admin_session_started_at';
const BUILD_STAMP = '2026-03-22-admin-token-fix-2';
const PERMISSION_MODULE_LABELS = {
  products: 'المنتجات',
  categories: 'الفئات',
  cities: 'المدن',
  orders: 'الطلبات',
  shadi_transactions: 'الاستشارات',
  shadi_join_requests: 'طلبات الانضمام',
  smtp: 'SMTP',
  lahza: 'Lahza',
  store: 'المتجر',
  whatsapp: 'واتساب',
  banner: 'البانر',
  recaptcha: 'reCAPTCHA',
  users: 'المستخدمون'
};
const PERMISSION_ACTION_LABELS = {
  read: 'قراءة',
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  hide: 'إخفاء',
  home: 'الرئيسية',
  sort: 'ترتيب',
  import: 'استيراد',
  read_list: 'قائمة الطلبات',
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
  manage_permissions: 'إدارة الصلاحيات'
};

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

  const [activeTab, setActiveTab] = useState('products');
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
        setError('انتهت جلسة الإدارة بعد 30 دقيقة. سجل الدخول مرة أخرى.');
        handleLogout();
      }
    };

    checkSession();
    const timer = setInterval(checkSession, 15000);
    return () => clearInterval(timer);
  }, [token, handleLogout]);

  const visibleTabs = [
    hasPermission(currentAdmin, 'products', 'read') && { key: 'products', label: 'المنتجات' },
    hasAnyPermission(currentAdmin, [
      ['orders', 'read_list'],
      ['orders', 'read_details'],
      ['orders', 'preview_customer_email'],
      ['orders', 'preview_internal_email'],
      ['orders', 'send_customer_email'],
      ['orders', 'send_internal_email']
    ]) && { key: 'orders', label: 'الطلبات' },
    hasPermission(currentAdmin, 'shadi_transactions', 'read_list') && { key: 'shadi_transactions', label: 'الاستشارات' },
    hasPermission(currentAdmin, 'shadi_join_requests', 'read_list') && { key: 'shadi_join_requests', label: 'طلبات الانضمام' },
    hasPermission(currentAdmin, 'smtp', 'read') && { key: 'smtp', label: 'SMTP' },
    hasPermission(currentAdmin, 'lahza', 'read') && { key: 'lahza', label: 'Lahza' },
    hasPermission(currentAdmin, 'store', 'read') && { key: 'store', label: 'المتجر' },
    hasPermission(currentAdmin, 'whatsapp', 'read') && { key: 'whatsapp', label: 'واتساب' },
    hasPermission(currentAdmin, 'banner', 'read') && { key: 'banner', label: 'بانر الموقع' },
    hasPermission(currentAdmin, 'recaptcha', 'read') && { key: 'recaptcha', label: 'reCAPTCHA' },
    hasPermission(currentAdmin, 'users', 'read') && { key: 'users', label: 'المستخدمون' },
    hasAnyPermission(currentAdmin, [['categories', 'read'], ['categories', 'sort'], ['products', 'sort']]) && { key: 'categories', label: 'الفئات' },
    hasPermission(currentAdmin, 'cities', 'read') && { key: 'cities', label: 'المدن' }
  ].filter(Boolean);

  const activeTabVisible = visibleTabs.some((tab) => tab.key === activeTab);
  const effectiveTab = activeTabVisible ? activeTab : (visibleTabs[0]?.key || 'products');

  useEffect(() => {
    if (token && !booting && currentAdmin && effectiveTab !== activeTab) {
      setActiveTab(effectiveTab);
    }
  }, [activeTab, booting, currentAdmin, effectiveTab, token]);

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
            <div className="brand-title">لوحة الإدارة</div>
            <div className="brand-sub">مركز التحكم</div>
            <div className="brand-sub">{currentAdmin.email}</div>
          </div>
          <button onClick={handleLogout} className="danger full">تسجيل الخروج</button>
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
          <div className="brand-title">لوحة الإدارة</div>
          <div className="brand-sub">مركز التحكم</div>
          <div className="brand-sub">{currentAdmin.email}{currentAdmin.is_super_admin ? ' - Super Admin' : ''}</div>
        </div>
        <nav className="nav">
          {visibleTabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={effectiveTab === tab.key ? 'active' : ''}>{tab.label}</button>
          ))}
        </nav>
        <button onClick={handleLogout} className="danger full">تسجيل الخروج</button>
      </aside>

      <div className="content">
        {error && <div className="error">{error}</div>}
        <Toast toast={toast} onClose={() => setToast(null)} />
        <main className="main">
          {effectiveTab === 'products' && <Products setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'orders' && <Orders setError={setError} currentAdmin={currentAdmin} refreshSession={refreshAdminSession} />}
          {effectiveTab === 'shadi_transactions' && <ShadiTransactions setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'shadi_join_requests' && <ShadiJoinRequests setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'smtp' && <SmtpSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'lahza' && <LahzaSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'store' && <StoreSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'whatsapp' && <WhatsappSettings setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'banner' && <SiteBannerSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'recaptcha' && <RecaptchaSettings showToast={showToast} currentAdmin={currentAdmin} />}
          {effectiveTab === 'users' && <AdminUsers setError={setError} currentAdmin={currentAdmin} refreshCurrentAdmin={setCurrentAdmin} />}
          {effectiveTab === 'categories' && <CategoriesManager setError={setError} currentAdmin={currentAdmin} />}
          {effectiveTab === 'cities' && <CitiesManager setError={setError} currentAdmin={currentAdmin} />}
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
      const data = await apiPost('/admin/login', { email, password });
      onSuccess({ token: data.token, admin: data.admin || {} });
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول');
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

          <form className="login-panel" onSubmit={handleSubmit}>
            <img src="/logo.png" alt="Shadi Store" className="login-logo" />
            <h2>تسجيل دخول الإدارة</h2>
            <p className="muted">أدخل بياناتك للوصول إلى لوحة التحكم</p>
            {error && <div className="error">{error}</div>}

            <label>البريد الإلكتروني</label>
            <input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label>كلمة المرور</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
    <div className="modal-backdrop" onClick={onClose}>
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

function Products({ setError, currentAdmin }) {
  const PRODUCT_FILTERS_KEY = 'admin_products_filters';
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
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
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
    brand: '',
    type: '',
    categories: [],
    color_options: [],
    image_urls: [],
    docs: [],
    links: [],
    is_available: true,
    is_hidden: false,
    show_on_home: false
  });
  const [docPreviews, setDocPreviews] = useState([]);
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [newColor, setNewColor] = useState({ name: '', hex: '#000000' });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [homeFilter, setHomeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const templateUrl = `${import.meta.env.BASE_URL || '/'}template.xlsx`;
  const canCreateProduct = hasPermission(currentAdmin, 'products', 'create');
  const canUpdateProduct = hasPermission(currentAdmin, 'products', 'update');
  const canDeleteProduct = hasPermission(currentAdmin, 'products', 'delete');
  const canHideProduct = hasPermission(currentAdmin, 'products', 'hide');
  const canToggleHome = hasPermission(currentAdmin, 'products', 'home');
  const canImportProducts = hasPermission(currentAdmin, 'products', 'import');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_FILTERS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setSearchTerm(String(saved.searchTerm || ''));
      setCategoryFilter(String(saved.categoryFilter || 'all'));
      setAvailabilityFilter(String(saved.availabilityFilter || 'all'));
      setVisibilityFilter(String(saved.visibilityFilter || 'all'));
      setHomeFilter(String(saved.homeFilter || 'all'));
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
      homeFilter,
      sortBy,
      sortDirection,
      itemsPerPage
    }));
  }, [searchTerm, categoryFilter, availabilityFilter, visibilityFilter, homeFilter, sortBy, sortDirection, itemsPerPage]);

  const openCreate = () => {
    if (!canCreateProduct) return;
    setLocalError('');
    setEditingId(null);
    setForm({ name:'', description:'', usage:'', technical_data:'', warnings:'', price:'', mrp:'', categories:[], color_options:[], image_urls:[], docs:[], links:[], is_available:true, is_hidden:false, show_on_home:false });
    setImagePreviews([]);
    setDocPreviews([]);
    setNewColor({ name: '', hex: '#000000' });
    setCategoryDropdownOpen(false);
    setShowCreate(true);
  };

  const openEdit = async (item) => {
    if (!canUpdateProduct) return;
    setLocalError('');
    try {
      const fullItem = await apiGet(`/products/${item.id}`);
      const source = fullItem || item;
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
        categories: Array.isArray(source.categories) && source.categories.length ? source.categories : (source.category ? [source.category] : []),
        color_options: Array.isArray(source.color_options) ? source.color_options : [],
        image_urls: images,
        docs: source.docs || [],
        links: source.links || [],
        is_available: source.is_available !== 0 && source.is_available !== false,
        is_hidden: source.is_hidden === 1 || source.is_hidden === true,
        show_on_home: !!source.show_on_home
      });
      setImagePreviews(images);
      setDocPreviews(source.docs || []);
      setNewColor({ name: '', hex: '#000000' });
      setCategoryDropdownOpen(false);
      setShowCreate(true);
    } catch (err) {
      setLocalError(err.message || 'فشل تحميل بيانات المنتج');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [productsResult, categoriesResult] = await Promise.allSettled([
        apiGet('/products'),
        apiGet('/admin/categories')
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

  useEffect(() => { load(); }, []);
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
      if (homeFilter !== 'all') {
        const onHome = !!item.show_on_home;
        if ((homeFilter === 'yes' && !onHome) || (homeFilter === 'no' && onHome)) {
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
        isHidden(item) ? 'مخفي' : 'ظاهر',
        item.show_on_home ? 'نعم' : 'لا'
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
          case 'status': return isAvailable(item) ? 1 : 0;
          case 'visibility': return isHidden(item) ? 1 : 0;
          case 'home': return item.show_on_home ? 1 : 0;
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
  }, [items, searchTerm, categoryFilter, availabilityFilter, visibilityFilter, homeFilter, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, page, itemsPerPage]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, availabilityFilter, visibilityFilter, homeFilter, sortBy, sortDirection, itemsPerPage]);

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
      const payload = {
        ...form,
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : null,
        stock: 0,
        image_url: form.image_urls?.[0] || null,
        docs: normalizeDocPayload(form.docs)
      };

      if (editingId) {
        await apiPut(`/products/${editingId}`, payload);
      } else {
        await apiPost('/products', payload);
      }

      setForm({ name:'', description:'', usage:'', technical_data:'', warnings:'', price:'', mrp:'', categories:[], color_options:[], image_urls:[], docs:[], links:[], is_available:true, is_hidden:false, show_on_home:false });
      setImagePreviews([]);
      setDocPreviews([]);
      setNewColor({ name: '', hex: '#000000' });
      setCategoryDropdownOpen(false);
      setShowCreate(false);
      setEditingId(null);
      load();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleImages = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const toDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      const dataUrls = await Promise.all(list.map(toDataUrl));
      const merged = [...(form.image_urls || []), ...dataUrls];
      setForm({ ...form, image_urls: merged });
      setImagePreviews(merged);
    } catch (err) {
      setError('فشل قراءة الصورة');
    }
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

  const removeImage = (idx) => {
    const next = (form.image_urls || []).filter((_, i) => i !== idx);
    setForm({ ...form, image_urls: next });
    setImagePreviews(next);
  };

  const handleDocs = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const toDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      const dataUrls = await Promise.all(list.map(toDataUrl));
      const merged = [...(form.docs || []), ...dataUrls];
      setForm({ ...form, docs: merged });
      setDocPreviews(merged);
    } catch (err) {
      setError('فشل قراءة الملف');
    }
  };

  const removeDoc = (idx) => {
    const next = (form.docs || []).filter((_, i) => i !== idx);
    setForm({ ...form, docs: next });
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

  const toggleHome = async (item) => {
    if (!canToggleHome) return;
    try {
      await apiPut(`/products/${item.id}`, { show_on_home: !item.show_on_home });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setAvailabilityFilter('all');
    setVisibilityFilter('all');
    setHomeFilter('all');
    setSortBy('id');
    setSortDirection('desc');
    setItemsPerPage(10);
    setPage(1);
  };

  return (
    <div className="grid single">
      <section className="card">
        <div className="card-header">
          <h2>المنتجات</h2>
          <div className="row">
            <button type="button" className="secondary" onClick={resetFilters}>إعادة تعيين</button>
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
          <select value={homeFilter} onChange={(e) => setHomeFilter(e.target.value)}>
            <option value="all">كل الرئيسية</option>
            <option value="yes">في الرئيسية</option>
            <option value="no">خارج الرئيسية</option>
          </select>
        </div>
        {loading ? <p>جارٍ التحميل...</p> : (
          <table>
            <thead>
              <tr>
                <th><button type="button" className={`sortable-header ${sortBy === 'id' ? 'active' : ''}`} onClick={() => toggleSort('id')}><span>المعرف</span><span className="sort-icon">{sortIndicator('id')}</span></button></th>
                <th><button type="button" className={`sortable-header ${sortBy === 'name' ? 'active' : ''}`} onClick={() => toggleSort('name')}><span>الاسم</span><span className="sort-icon">{sortIndicator('name')}</span></button></th>
                <th><button type="button" className={`sortable-header ${sortBy === 'category' ? 'active' : ''}`} onClick={() => toggleSort('category')}><span>الفئة</span><span className="sort-icon">{sortIndicator('category')}</span></button></th>
                <th><button type="button" className={`sortable-header ${sortBy === 'price' ? 'active' : ''}`} onClick={() => toggleSort('price')}><span>السعر</span><span className="sort-icon">{sortIndicator('price')}</span></button></th>
                <th><button type="button" className={`sortable-header ${sortBy === 'status' ? 'active' : ''}`} onClick={() => toggleSort('status')}><span>الحالة</span><span className="sort-icon">{sortIndicator('status')}</span></button></th>
                <th><button type="button" className={`sortable-header ${sortBy === 'visibility' ? 'active' : ''}`} onClick={() => toggleSort('visibility')}><span>الظهور</span><span className="sort-icon">{sortIndicator('visibility')}</span></button></th>
                <th><button type="button" className={`sortable-header ${sortBy === 'home' ? 'active' : ''}`} onClick={() => toggleSort('home')}><span>الرئيسية</span><span className="sort-icon">{sortIndicator('home')}</span></button></th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{formatCategoryList(item)}</td>
                  <td>{item.price}</td>
                  <td>{isAvailable(item) ? 'متوفر' : 'غير متوفر'}</td>
                  <td>{isHidden(item) ? 'مخفي' : 'ظاهر'}</td>
                  <td>
                    <label className="checkbox inline-checkbox">
                      <input
                        type="checkbox"
                        checked={!!item.show_on_home}
                        onChange={() => toggleHome(item)}
                        disabled={!canToggleHome}
                      />
                    </label>
                  </td>
                  <td>
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
                <tr>
                  <td colSpan="8">لا توجد منتجات مطابقة للفلاتر الحالية</td>
                </tr>
              )}
            </tbody>
          </table>
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
                <label className="upload-label">ألوان المنتج</label>
                <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    placeholder="اسم اللون"
                    value={newColor.name}
                    onChange={(e) => setNewColor({ ...newColor, name: e.target.value })}
                  />
                  <input
                    type="color"
                    value={newColor.hex}
                    onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })}
                    style={{ width: 72, minWidth: 72, padding: 4 }}
                  />
                  <button type="button" onClick={addColorOption}>إضافة لون</button>
                </div>
                {(form.color_options || []).length > 0 && (
                  <div className="preview-grid">
                    {(form.color_options || []).map((color, index) => (
                      <div key={`${color.name}-${index}`} className="preview-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 18, height: 18, borderRadius: 9999, background: color.hex, border: '1px solid #d1d5db' }} />
                          <div className="text-sm text-gray-700">{color.name} - {color.hex}</div>
                        </div>
                        <button type="button" className="secondary" onClick={() => removeColorOption(index)}>إزالة</button>
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
              <label className="checkbox">
                <input type="checkbox" checked={form.show_on_home} onChange={(e)=>setForm({...form, show_on_home: e.target.checked})} />
                إظهار في الرئيسية
              </label>
              <button type="submit">{editingId ? 'تحديث' : 'حفظ'}</button>
          </form>
        </Modal>
      )}

      {showImport && canImportProducts && (
        <Modal title="استيراد منتجات من Excel" onClose={() => setShowImport(false)}>
          {localError && <div className="error">{localError}</div>}
          <div className="form">
            <div className="notice">
              الأعمدة الأساسية: الاسم، الفئة، السعر. أعمدة إضافية مدعومة: الوصف، بيانات فنية، تعليمات الاستخدام، تحذيرات، السعر قبل الخصم، متوفر، مخفي، الرئيسية، صورة.
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={(e)=>parseImportFile(e.target.files?.[0])} />
            {importFileName && <div className="muted">الملف الحالي: {importFileName}</div>}
            <label className="checkbox">
              <input type="checkbox" checked={importMode === 'update_existing'} onChange={(e) => setImportMode(e.target.checked ? 'update_existing' : 'create_only')} />
              تحديث المنتجات الموجودة إذا تطابق الاسم
            </label>
            <a className="secondary" href={templateUrl} download="template.xlsx">تنزيل قالب Excel</a>
            {importPreview && (
              <div className="notice">
                معاينة قبل التنفيذ: إنشاء {importPreview.toCreate ?? 0} | تحديث {importPreview.toUpdate ?? 0} | مكرر {importPreview.skippedDuplicates ?? 0} | غير صالح {importPreview.skippedInvalid ?? 0}
                {Array.isArray(importPreview.createdCategories) && importPreview.createdCategories.length > 0
                  ? ` | فئات ستُنشأ: ${importPreview.createdCategories.length}`
                  : ''}
              </div>
            )}
            {importPreview?.previewRows?.length > 0 && (
              <div className="preview-list">
                {importPreview.previewRows.map((row) => (
                  <div key={`${row.row}-${row.name}`} className="preview-row">
                    <span>الصف {row.row} - {row.name}</span>
                    <span>{row.action === 'update' ? 'تحديث' : 'إنشاء'} | {row.category} | {row.price}</span>
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
    paid: 'قيد المتابعة',
    packed: 'تم التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    cancelled: 'ملغي'
  };

  const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[String(status || '').trim()] || String(status || '-');

  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null);
  const [message, setMessage] = useState('');
  const [sendingKey, setSendingKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const canReadList = hasPermission(currentAdmin, 'orders', 'read_list');
  const canReadDetails = hasPermission(currentAdmin, 'orders', 'read_details');
  const canChangeStatus = hasPermission(currentAdmin, 'orders', 'change_status');
  const canPreviewCustomerEmail = hasPermission(currentAdmin, 'orders', 'preview_customer_email');
  const canPreviewInternalEmail = hasPermission(currentAdmin, 'orders', 'preview_internal_email');
  const canSendCustomerEmail = hasPermission(currentAdmin, 'orders', 'send_customer_email');
  const canSendInternalEmail = hasPermission(currentAdmin, 'orders', 'send_internal_email');
  const load = async () => {
    if (!canReadList) {
      setOrders([]);
      return;
    }
    try {
      setMessage('');
      if (refreshSession) {
        await refreshSession();
      }
      const data = await apiGet('/admin/orders');
      setOrders(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadOrder = async (id) => {
    if (!canReadDetails) return;
    try {
      setMessage('');
      const data = await apiGet(`/admin/orders/${id}`);
      setSelected(data.order);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async () => {
    if (!canChangeStatus || !statusDialog) return;
    try {
      setMessage('');
      const updatedOrder = await apiPut(`/admin/orders/${statusDialog.orderId}/status`, { status: statusDialog.status, note: statusDialog.note });
      setSelected(updatedOrder || null);
      await load();
      await loadOrder(statusDialog.orderId);
      setStatusDialog(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const openStatusDialog = (orderId, status) => {
    if (!canChangeStatus) return;
    setStatusDialog({ orderId, status, note: '' });
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

  const openSendDialog = (order, type) => {
    if ((type === 'customer' && !canSendCustomerEmail) || (type === 'internal' && !canSendInternalEmail)) return;
    setSendDialog({
      orderId: order.id,
      type,
      email: type === 'customer' ? String(order.customer_email || '').trim() : ''
    });
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

  useEffect(() => { load(); }, []);
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
      const matchesStatus = statusFilter === 'all' || String(order.status || '') === statusFilter;
      if (!matchesStatus) return false;

      if (!query) return true;

      const haystack = [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.customer_email,
        order.city,
        order.status,
        getOrderStatusLabel(order.status),
        order.total
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <div className="grid">
      <section className="card">
        <h2>الطلبات</h2>
        <div className="row table-toolbar">
          <input
            placeholder="بحث بالمعرف أو اسم العميل أو الهاتف أو البريد"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">كل الحالات</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {message && <p className="success-text">{message}</p>}
        <table>
          <thead>
            <tr>
              <th>المعرف</th>
              <th>الاسم</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customer_name}</td>
                <td>{o.total}</td>
                <td>{getOrderStatusLabel(o.status)}</td>
                <td>
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
              <tr>
                <td colSpan="5">لا توجد طلبات مطابقة للفلاتر الحالية.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>تفاصيل الطلب</h2>
        {!selected ? (
          <p>اختر طلبًا لعرض التفاصيل.</p>
        ) : (
          <div>
            <p><strong>الطلب:</strong> #{selected.id}</p>
            <p><strong>العميل:</strong> {selected.customer_name} ({selected.customer_phone})</p>
            <p><strong>العنوان:</strong> {selected.address_line1}, {selected.city}, {selected.state}, {selected.country}</p>
            <p><strong>الحالة:</strong> {getOrderStatusLabel(selected.status)}</p>
            <p><strong>ملاحظة الحالة:</strong> {selected.admin_status_note || '-'}</p>
            <div className="status-actions">
              {[
                { key: 'packed', label: 'تم التجهيز' },
                { key: 'shipped', label: 'تم الشحن' },
                { key: 'delivered', label: 'تم التسليم' },
                { key: 'cancelled', label: 'ملغي' }
              ].map(s => (
                <button key={s.key} onClick={() => openStatusDialog(selected.id, s.key)} disabled={!canChangeStatus}>
                  {s.label}
                </button>
              ))}
            </div>
            <h3>المنتجات</h3>
            <ul>
              {items.map(i => (
                <li key={i.id}>{i.product_name}{i.color_name ? ` - ${i.color_name}` : ''} × {i.quantity} = {i.line_total}</li>
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

      {statusDialog && (
        <Modal title={`تحديث حالة الطلب #${statusDialog.orderId}`} onClose={() => setStatusDialog(null)}>
          <div className="send-email-dialog">
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
        <table>
          <thead>
            <tr>
              <th>الترتيب</th>
              <th>الاسم</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category.id}>
                <td>{index + 1}</td>
                <td>{category.name}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                    {canSortCategories && <button type="button" className="secondary" disabled={index === 0 || categoryReorderingId === category.id} onClick={() => moveCategory(index, -1)}>↑</button>}
                    {canSortCategories && <button type="button" className="secondary" disabled={index === categories.length - 1 || categoryReorderingId === category.id} onClick={() => moveCategory(index, 1)}>↓</button>}
                    {canDeleteCategory && <button className="danger" onClick={() => deleteCategory(category.id)}>حذف</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city.id}>
                <td>{city.name}</td>
                <td>
                  {canDeleteCity && <button className="danger" onClick={() => deleteCity(city.id)}>حذف</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function SiteBannerSettings({ showToast, currentAdmin }) {
  const [banner, setBanner] = useState({ image_url: '', updated_at: null, feature_tabs: [] });
  const [uploadDataUrl, setUploadDataUrl] = useState('');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const canUpdateBanner = hasPermission(currentAdmin, 'banner', 'update');
  const canDeleteBanner = hasPermission(currentAdmin, 'banner', 'delete');

  const defaultTabs = [
    { title: 'مواد موثوقة', subtitle: 'سباكة وإنشاءات وعزل', icon: 'package' },
    { title: 'أسعار مناسبة', subtitle: '', icon: 'trending-up' },
    { title: 'جاهزون للمشاريع', subtitle: '', icon: 'star' }
  ];

  const mergeTabs = (tabs) => defaultTabs.map((item, index) => ({
    ...item,
    ...((Array.isArray(tabs) && tabs[index]) || {})
  }));

  const load = async () => {
    try {
      const data = await apiGet('/admin/banner');
      setBanner({
        image_url: data?.image_url || '',
        updated_at: data?.updated_at || null,
        feature_tabs: mergeTabs(data?.feature_tabs)
      });
    } catch (err) {
      setLocalError(err.message || 'تعذر تحميل البانر');
    }
  };

  useEffect(() => { load(); }, []);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      setUploadDataUrl(value);
      setPreview(value);
      setLocalError('');
    };
    reader.onerror = () => setLocalError('فشل قراءة ملف الصورة');
    reader.readAsDataURL(file);
  };

  const saveBanner = async () => {
    if (!canUpdateBanner) return;
    if (!uploadDataUrl && !banner.image_url) {
      setLocalError('اختر صورة البانر أولاً');
      return;
    }
    setSaving(true);
    setLocalError('');
    try {
      const saved = await apiPut('/admin/banner', {
        image_data_url: uploadDataUrl,
        image_url: banner.image_url,
        feature_tabs: banner.feature_tabs
      });
      setBanner({
        image_url: saved?.image_url || '',
        updated_at: saved?.updated_at || null,
        feature_tabs: mergeTabs(saved?.feature_tabs)
      });
      setUploadDataUrl('');
      setPreview('');
      showToast?.('success', 'تم حفظ البانر بنجاح');
    } catch (err) {
      setLocalError(err.message || 'تعذر حفظ البانر');
      showToast?.('error', err.message || 'تعذر حفظ البانر');
    } finally {
      setSaving(false);
    }
  };

  const deleteBanner = async () => {
    if (!canDeleteBanner) return;
    if (!confirm('هل تريد حذف بانر الموقع؟')) return;
    setSaving(true);
    setLocalError('');
    try {
      await apiDelete('/admin/banner');
      setBanner({ image_url: '', updated_at: null, feature_tabs: mergeTabs([]) });
      setUploadDataUrl('');
      setPreview('');
      showToast?.('success', 'تم حذف البانر');
    } catch (err) {
      setLocalError(err.message || 'تعذر حذف البانر');
      showToast?.('error', err.message || 'تعذر حذف البانر');
    } finally {
      setSaving(false);
    }
  };

  const updateFeatureTab = (index, field, value) => {
    setBanner((current) => ({
      ...current,
      feature_tabs: mergeTabs(current.feature_tabs).map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      ))
    }));
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>بانر الصفحة الرئيسية</h2>
      </div>

      {localError && <div className="error">{localError}</div>}

      {!banner.image_url && (
        <div className="notice">لا يوجد بانر ظاهر حالياً على الموقع.</div>
      )}

      {banner.image_url && (
        <div className="banner-preview-wrap">
          <img src={banner.image_url} alt="current banner" className="banner-preview" />
          <div className="muted">
            آخر تحديث: {banner.updated_at ? new Date(banner.updated_at).toLocaleString() : '-'}
          </div>
        </div>
      )}

      <div className="form">
        <div className="upload">
          <label className="upload-label">صورة بانر جديدة</label>
          {canUpdateBanner && <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />}
        </div>

        {preview && (
          <div className="banner-preview-wrap">
            <img src={preview} alt="new banner preview" className="banner-preview" />
          </div>
        )}

        <div className="form-section">
          <h3>بطاقات الواجهة الرئيسية</h3>
          {mergeTabs(banner.feature_tabs).map((tab, index) => (
            <div key={index} className="row" style={{ alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label>العنوان {index + 1}</label>
                <input
                  value={tab.title || ''}
                   onChange={(e) => updateFeatureTab(index, 'title', e.target.value)}
                   disabled={!canUpdateBanner}
                  placeholder="عنوان البطاقة"
                />
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <label>الوصف</label>
                <input
                  value={tab.subtitle || ''}
                   onChange={(e) => updateFeatureTab(index, 'subtitle', e.target.value)}
                   disabled={!canUpdateBanner}
                  placeholder="وصف قصير"
                />
              </div>
              <div style={{ width: 180 }}>
                <label>الأيقونة</label>
                <select
                  value={tab.icon || 'package'}
                   onChange={(e) => updateFeatureTab(index, 'icon', e.target.value)}
                   disabled={!canUpdateBanner}
                >
                  <option value="package">Package</option>
                  <option value="trending-up">Trending Up</option>
                  <option value="star">Star</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="row">
          {canUpdateBanner && <button onClick={saveBanner} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ البانر'}</button>}
          {canDeleteBanner && <button className="danger" onClick={deleteBanner} disabled={saving || !banner.image_url}>حذف البانر</button>}
        </div>
      </div>
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
      <table>
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
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>{u.is_super_admin ? 'Super Admin' : 'مستخدم مخصص'}</td>
              <td>{u.is_super_admin ? 'وصول كامل' : permissionSummary(u.permissions)}</td>
              <td>{u.created_at}</td>
              <td>
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
    </section>
  );
}

export default App;
