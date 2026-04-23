import React, { useEffect, useMemo, useRef, useState } from 'react';
import { hasPermission } from './permissions.js';
import { shadiApiDelete, shadiApiGet, shadiApiPost } from './shadiApi.js';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const TRANSACTION_BUCKETS = [
  { key: 'pending', label: 'قيد المتابعة' },
  { key: 'cancelled', label: 'ملغي' },
  { key: 'finished', label: 'تمت الزيارة' }
];
const TRANSACTION_STATUS_OPTIONS = ['PENDING', 'FINISHED', 'CANCELLED'];
const SERVICE_LABELS = {
  MECHANIC: 'ميكانيك',
  ELECTRIC: 'كهرباء',
  CIVIL: 'مدني',
  ARCHITECTURAL: 'معماري',
  CHARGES: 'رسوم'
};
const LOCATION_LABELS = {
  RAMMALLAH: 'رام الله',
  NABLUS: 'نابلس',
  SALFIT: 'سلفيت',
  BETHLEHEM: 'بيت لحم',
  TULKAREM: 'طولكرم',
  ZOOM: 'Zoom'
};
const STATUS_LABELS = {
  NEW: 'قيد المتابعة',
  PENDING: 'قيد المتابعة',
  PAUSED: 'موقوف',
  FINISHED: 'تمت الزيارة',
  CANCELLED: 'ملغي'
};

function getTransactionBucketPath(bucket) {
  return `/transactions/status/${bucket}`;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="card-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="إغلاق">x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function formatList(value, labels = {}) {
  const values = normalizeList(value);
  if (!values.length) return '-';
  return values.map((item) => labels[item] || item).join('، ');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeTransactionRow(row) {
  if (!row || typeof row !== 'object') return row;

  return {
    ...row,
    serviceType: row.serviceType ?? row.service_type ?? [],
    createdAt: row.createdAt ?? row.created_at ?? null,
    serviceAt: row.serviceAt ?? row.service_at ?? null,
    adminNotes: row.adminNotes ?? row.admin_notes ?? '',
    transactionNO: row.transactionNO ?? row.transaction_no ?? '',
    transactionAmount: row.transactionAmount ?? row.transaction_amount ?? null,
    transactionDate: row.transactionDate ?? row.transaction_date ?? '',
    cardType: row.cardType ?? row.card_type ?? '',
    cardNo: row.cardNo ?? row.card_no ?? ''
  };
}

function buildPageItems(page, totalPages) {
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
    .sort((left, right) => left - right);

  const items = [];
  for (let index = 0; index < ordered.length; index += 1) {
    if (index > 0 && ordered[index] - ordered[index - 1] > 1) {
      items.push('ellipsis');
    }
    items.push(ordered[index]);
  }

  return items;
}

function PaginationBar({ pagination, pageSize, setPage, setPageSize }) {
  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1);
  const totalItems = Math.max(0, Number(pagination?.totalItems) || 0);
  const currentPage = Math.max(1, Number(pagination?.page) || 1);
  const pageItems = buildPageItems(currentPage, totalPages);
  const from = totalItems === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  const to = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-bar">
      <div className="pagination-meta">
        <label className="pagination-page-size">
          <span>عدد الصفوف</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) || 10)}>
            {PAGE_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="muted">عرض {from}-{to} من {totalItems}</div>
      </div>
      <div className="pagination-controls">
        <button type="button" className="pagination-nav" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} aria-label="الصفحة السابقة">&#8249;</button>
        <div className="pagination-numbers">
          {pageItems.map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
          ) : (
            <button key={item} type="button" className={`pagination-number ${currentPage === item ? 'active' : ''}`} onClick={() => setPage(item)}>{item}</button>
          ))}
        </div>
        <button type="button" className="pagination-nav" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages} aria-label="الصفحة التالية">&#8250;</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="detail-row">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

export function ShadiTransactions({ setError, currentAdmin, refreshSession }) {
  const canReadList = hasPermission(currentAdmin, 'shadi_transactions', 'read_list');
  const canUpdate = hasPermission(currentAdmin, 'shadi_transactions', 'update');
  const canDelete = hasPermission(currentAdmin, 'shadi_transactions', 'delete');
  const [bucket, setBucket] = useState('pending');
  const [nameFilter, setNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [bucketRows, setBucketRows] = useState({ pending: [], finished: [], cancelled: [] });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ status: 'NEW', adminNotes: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const detailCardRef = useRef(null);

  const rows = useMemo(() => bucketRows[bucket] || [], [bucketRows, bucket]);

  const filteredRows = useMemo(() => {
    const normalizedName = String(nameFilter || '').trim().toLowerCase();
    const normalizedPhone = String(phoneFilter || '').trim().toLowerCase();

    return rows.filter((row) => {
      const matchesName = !normalizedName || String(row.name || '').toLowerCase().includes(normalizedName);
      const matchesPhone = !normalizedPhone || String(row.phone || '').toLowerCase().includes(normalizedPhone);
      return matchesName && matchesPhone;
    });
  }, [rows, nameFilter, phoneFilter]);

  const pagination = useMemo(() => {
    const totalItems = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    return {
      page: safePage,
      size: pageSize,
      totalItems,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrevious: safePage > 1
    };
  }, [filteredRows.length, page, pageSize]);

  const pageRows = useMemo(() => {
    const currentPage = Math.min(page, pagination.totalPages);
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize, pagination.totalPages]);

  const selectedTransaction = useMemo(
    () => filteredRows.find((row) => String(row.id) === String(selectedId)) || null,
    [filteredRows, selectedId]
  );

  useEffect(() => {
    setPage(1);
  }, [bucket, nameFilter, phoneFilter, pageSize]);

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  useEffect(() => {
    const closeMenu = (event) => {
      const target = event.target;
      if (target && target.closest && target.closest('.dropdown')) return;
      setOpenMenuId(null);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const showTransaction = (transactionId) => {
    setSelectedId(String(transactionId));
    setShowMoreDetails(false);
    window.requestAnimationFrame(() => {
      detailCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (!canReadList) {
      setBucketRows({ pending: [], finished: [], cancelled: [] });
      setSelectedId('');
      return undefined;
    }

    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      try {
        if (refreshSession) {
          await refreshSession();
        }

        const [pendingResponse, finishedResponse, cancelledResponse] = await Promise.all([
          shadiApiGet(getTransactionBucketPath('pending'), { page: 1, size: 500 }),
          shadiApiGet(getTransactionBucketPath('finished'), { page: 1, size: 500 }),
          shadiApiGet(getTransactionBucketPath('cancelled'), { page: 1, size: 500 })
        ]);

        if (cancelled) return;

        const nextBucketRows = {
          pending: Array.isArray(pendingResponse?.data) ? pendingResponse.data.map(normalizeTransactionRow) : [],
          finished: Array.isArray(finishedResponse?.data) ? finishedResponse.data.map(normalizeTransactionRow) : [],
          cancelled: Array.isArray(cancelledResponse?.data) ? cancelledResponse.data.map(normalizeTransactionRow) : []
        };

        setBucketRows(nextBucketRows);
        const currentBucketRows = nextBucketRows[bucket] || [];
        setSelectedId((current) => (currentBucketRows.some((row) => String(row.id) === String(current)) ? current : (currentBucketRows[0]?.id || '')));
      } catch (error) {
        if (!cancelled) {
          setBucketRows({ pending: [], finished: [], cancelled: [] });
          setSelectedId('');
          setError(error.message || 'فشل تحميل الاستشارات');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [canReadList, refreshSession, setError]);

  useEffect(() => {
    const currentBucketRows = bucketRows[bucket] || [];
    setSelectedId((current) => (currentBucketRows.some((row) => String(row.id) === String(current)) ? current : (currentBucketRows[0]?.id || '')));
  }, [bucket, bucketRows]);

  const openEditor = (transaction) => {
    if (!canUpdate) return;
    const nextStatus = TRANSACTION_STATUS_OPTIONS.includes(String(transaction?.status || ''))
      ? String(transaction.status)
      : 'FINISHED';

    setEditing(transaction);
    setEditForm({
      status: nextStatus,
      adminNotes: String(transaction?.adminNotes || '')
    });
  };

  const openEditorWithStatus = (transaction, status) => {
    if (!canUpdate) return;
    setEditing(transaction);
    setEditForm({
      status,
      adminNotes: String(transaction?.adminNotes || '')
    });
  };

  const refreshCurrentPage = async () => {
    if (refreshSession) {
      await refreshSession();
    }
    const [pendingResponse, finishedResponse, cancelledResponse] = await Promise.all([
      shadiApiGet(getTransactionBucketPath('pending'), { page: 1, size: 500 }),
      shadiApiGet(getTransactionBucketPath('finished'), { page: 1, size: 500 }),
      shadiApiGet(getTransactionBucketPath('cancelled'), { page: 1, size: 500 })
    ]);
    const nextBucketRows = {
      pending: Array.isArray(pendingResponse?.data) ? pendingResponse.data.map(normalizeTransactionRow) : [],
      finished: Array.isArray(finishedResponse?.data) ? finishedResponse.data.map(normalizeTransactionRow) : [],
      cancelled: Array.isArray(cancelledResponse?.data) ? cancelledResponse.data.map(normalizeTransactionRow) : []
    };
    setBucketRows(nextBucketRows);
    const currentBucketRows = nextBucketRows[bucket] || [];
    setSelectedId((current) => (currentBucketRows.some((row) => String(row.id) === String(current)) ? current : (currentBucketRows[0]?.id || '')));
  };

  const submitUpdate = async (event) => {
    event.preventDefault();
    if (!editing) return;
    if (!String(editForm.adminNotes || '').trim()) {
      setError('يجب إدخال ملاحظة الحالة');
      return;
    }

    setSaving(true);
    try {
      await shadiApiPost(`/transactions/${editing.id}`, {
        status: editForm.status,
        adminNotes: editForm.adminNotes
      });
      setEditing(null);
      await refreshCurrentPage();
    } catch (error) {
      setError(error.message || 'فشل تحديث المعاملة');
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (transaction) => {
    if (!canDelete) return;
    if (!window.confirm(`حذف المعاملة #${transaction.id}؟`)) return;

    setDeletingId(String(transaction.id));
    try {
      await shadiApiDelete(`/transactions/${transaction.id}`);
      await refreshCurrentPage();
    } catch (error) {
      setError(error.message || 'فشل حذف المعاملة');
    } finally {
      setDeletingId('');
    }
  };

  if (!canReadList) {
    return (
      <section className="card">
        <h2>الاستشارات</h2>
        <p className="muted">هذا الحساب لا يملك صلاحية عرض الاستشارات.</p>
      </section>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>الاستشارات</h2>
        <div className="row table-toolbar">
          <input placeholder="بحث بالاسم" value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} />
          <input placeholder="بحث برقم الهاتف" value={phoneFilter} onChange={(event) => setPhoneFilter(event.target.value)} />
          <select value={bucket} onChange={(event) => setBucket(event.target.value)}>
            {TRANSACTION_BUCKETS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>
        {loading ? <p>جارٍ تحميل البيانات...</p> : (
          <>
            <table>
              <thead>
                <tr>
                  <th>المعرف</th>
                  <th>الاسم</th>
                  <th>التكلفة</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className={String(selectedId) === String(row.id) ? 'selected-row' : ''}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{row.cost ?? '-'}</td>
                    <td>{STATUS_LABELS[row.status] || row.status || '-'}</td>
                    <td>
                      <div className="actions-menu">
                        <button type="button" onClick={() => showTransaction(row.id)}>عرض</button>
                        <div className={`dropdown ${openMenuId === row.id ? 'open' : ''}`}>
                          <button
                            className="dots"
                            aria-label="خيارات"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId(openMenuId === row.id ? null : row.id);
                            }}
                          >
                            ⋯
                          </button>
                          <div className="menu" onClick={(event) => event.stopPropagation()}>
                            {canUpdate && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  openEditor(row);
                                }}
                              >
                                تعديل
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className="danger"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  deleteTransaction(row);
                                }}
                                disabled={deletingId === String(row.id)}
                              >
                                {deletingId === String(row.id) ? 'جارٍ الحذف...' : 'حذف'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan="5">لا توجد استشارات مطابقة للفلاتر الحالية.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationBar pagination={pagination} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
          </>
        )}
      </section>

      <section ref={detailCardRef} className="card">
        <h2>تفاصيل الاستشارة</h2>
        {!selectedTransaction ? (
          <p>اختر استشارة لعرض التفاصيل.</p>
        ) : (
          <div>
            <h3>تفاصيل الطلب</h3>
            <p><strong>الطلب:</strong> #{selectedTransaction.id}</p>
            <p><strong>العميل:</strong> {selectedTransaction.name || '-'}</p>
            <p><strong>الهاتف:</strong> {selectedTransaction.phone || '-'}</p>
            <p><strong>البريد:</strong> {selectedTransaction.email || '-'}</p>
            <p><strong>التكلفة:</strong> {selectedTransaction.cost ?? '-'}</p>
            <p><strong>الموقع:</strong> {LOCATION_LABELS[selectedTransaction.location] || selectedTransaction.location || '-'}</p>
            <p><strong>الخدمات:</strong> {formatList(selectedTransaction.serviceType, SERVICE_LABELS)}</p>
            <p><strong>ملاحظة العميل:</strong> {selectedTransaction.notes || '-'}</p>
            <p><strong>الحالة:</strong> {STATUS_LABELS[selectedTransaction.status] || selectedTransaction.status || '-'}</p>
            <p><strong>ملاحظة الحالة:</strong> {selectedTransaction.adminNotes || '-'}</p>
            <div className="status-actions">
              {canUpdate && TRANSACTION_STATUS_OPTIONS.map((status) => (
                <button key={status} type="button" onClick={() => openEditorWithStatus(selectedTransaction, status)}>
                  {STATUS_LABELS[status] || status}
                </button>
              ))}
            </div>
            <button type="button" className="secondary consultation-more-toggle" onClick={() => setShowMoreDetails((current) => !current)}>
              {showMoreDetails ? 'إخفاء التفاصيل الإضافية' : 'عرض التفاصيل الإضافية'}
            </button>
            {showMoreDetails && (
              <div>
                <h3>تفاصيل إضافية</h3>
                <p><strong>تاريخ الإنشاء:</strong> {formatDate(selectedTransaction.createdAt)}</p>
                <p><strong>موعد الخدمة:</strong> {formatDate(selectedTransaction.serviceAt)}</p>
                <p><strong>رقم العملية:</strong> {selectedTransaction.transactionNO || '-'}</p>
                <p><strong>نوع البطاقة:</strong> {selectedTransaction.cardType || '-'}</p>
                <p><strong>رقم البطاقة:</strong> {selectedTransaction.cardNo || '-'}</p>
                <p><strong>مبلغ العملية:</strong> {selectedTransaction.transactionAmount ?? '-'}</p>
                <p><strong>تاريخ الدفع:</strong> {selectedTransaction.transactionDate || '-'}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {editing && (
        <Modal title={`تحديث المعاملة #${editing.id}`} onClose={() => setEditing(null)}>
          <form className="form" onSubmit={submitUpdate}>
            <label>
              <span>الحالة</span>
              <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}>
                {TRANSACTION_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>ملاحظات الإدارة</span>
              <textarea value={editForm.adminNotes} onChange={(event) => setEditForm((current) => ({ ...current, adminNotes: event.target.value }))} />
            </label>
            <p className="muted">يجب إدخال ملاحظة قبل تغيير الحالة.</p>
            <div className="row">
              <button type="submit" disabled={saving || !String(editForm.adminNotes || '').trim()}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function ShadiJoinRequests({ setError, currentAdmin, refreshSession }) {
  const canReadList = hasPermission(currentAdmin, 'shadi_join_requests', 'read_list');
  const canDelete = hasPermission(currentAdmin, 'shadi_join_requests', 'delete');
  const [nameFilter, setNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 10,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const detailCardRef = useRef(null);

  const selectedRequest = useMemo(
    () => rows.find((row) => String(row.id) === String(selectedId)) || null,
    [rows, selectedId]
  );

  useEffect(() => {
    setPage(1);
  }, [nameFilter, phoneFilter, serviceFilter, pageSize]);

  const showJoinRequest = (requestId) => {
    setSelectedId(String(requestId));
    window.requestAnimationFrame(() => {
      detailCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (!canReadList) {
      setRows([]);
      setSelectedId('');
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (refreshSession) {
          await refreshSession();
        }
        const response = await shadiApiGet('/join-us', {
          page,
          size: pageSize,
          name: nameFilter,
          phone: phoneFilter,
          engineeringType: serviceFilter
        });

        if (cancelled) return;
        const nextRows = Array.isArray(response?.data) ? response.data : [];
        setRows(nextRows);
        setPagination(response?.pagination || {
          page,
          size: pageSize,
          totalItems: nextRows.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false
        });
        setSelectedId((current) => (nextRows.some((row) => String(row.id) === String(current)) ? current : (nextRows[0]?.id || '')));
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setSelectedId('');
          setError(error.message || 'فشل تحميل طلبات الانضمام');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [canReadList, nameFilter, page, pageSize, phoneFilter, serviceFilter, setError]);

  const refreshCurrentPage = async () => {
    if (refreshSession) {
      await refreshSession();
    }
    const response = await shadiApiGet('/join-us', {
      page,
      size: pageSize,
      name: nameFilter,
      phone: phoneFilter,
      engineeringType: serviceFilter
    });
    const nextRows = Array.isArray(response?.data) ? response.data : [];
    setRows(nextRows);
    setPagination(response?.pagination || pagination);
    setSelectedId((current) => (nextRows.some((row) => String(row.id) === String(current)) ? current : (nextRows[0]?.id || '')));
  };

  const deleteRequest = async (request) => {
    if (!canDelete) return;
    if (!window.confirm(`حذف طلب الانضمام #${request.id}؟`)) return;

    setDeletingId(String(request.id));
    try {
      await shadiApiDelete(`/join-us/${request.id}`);
      await refreshCurrentPage();
    } catch (error) {
      setError(error.message || 'فشل حذف طلب الانضمام');
    } finally {
      setDeletingId('');
    }
  };

  if (!canReadList) {
    return (
      <section className="card">
        <h2>طلبات الانضمام</h2>
        <p className="muted">هذا الحساب لا يملك صلاحية عرض طلبات الانضمام.</p>
      </section>
    );
  }

  return (
    <div className="grid single">
      <section className="card">
        <div className="card-header">
          <h2>طلبات الانضمام</h2>
        </div>
        <div className="row table-toolbar">
          <input placeholder="بحث بالاسم" value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} />
          <input placeholder="بحث برقم الهاتف" value={phoneFilter} onChange={(event) => setPhoneFilter(event.target.value)} />
          <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
            <option value="">كل التخصصات</option>
            {Object.entries(SERVICE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {loading ? <p>جارٍ تحميل البيانات...</p> : (
          <>
            <table>
              <thead>
                <tr>
                  <th>المعرف</th>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>التخصص</th>
                  <th>سنة التخرج</th>
                  <th>التاريخ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={String(selectedId) === String(row.id) ? 'selected-row' : ''}>
                    <td>{row.id}</td>
                    <td><button type="button" className="link-button" onClick={() => showJoinRequest(row.id)}>{row.name}</button></td>
                    <td>{row.phone || '-'}</td>
                    <td>{formatList(row.engineeringType, SERVICE_LABELS)}</td>
                    <td>{row.graduatedAt || '-'}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="actions-menu">
                        <button type="button" className="secondary" onClick={() => showJoinRequest(row.id)}>عرض</button>
                        {canDelete && (
                          <button type="button" className="danger" onClick={() => deleteRequest(row)} disabled={deletingId === String(row.id)}>
                            {deletingId === String(row.id) ? '...' : 'حذف'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="7">لا توجد طلبات انضمام مطابقة للفلاتر الحالية.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationBar pagination={pagination} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
          </>
        )}
      </section>

      <section ref={detailCardRef} className="card detail-card">
        <h2>تفاصيل الطلب</h2>
        {!selectedRequest ? (
          <p className="muted">اختر طلب انضمام لعرض التفاصيل.</p>
        ) : (
          <div className="detail-list">
            <InfoRow label="المعرف" value={selectedRequest.id} />
            <InfoRow label="الاسم" value={selectedRequest.name || '-'} />
            <InfoRow label="الهاتف" value={selectedRequest.phone || '-'} />
            <InfoRow label="التخصص" value={formatList(selectedRequest.engineeringType, SERVICE_LABELS)} />
            <InfoRow label="سنة التخرج" value={selectedRequest.graduatedAt || '-'} />
            <InfoRow label="المهارات" value={selectedRequest.skills || '-'} />
            <InfoRow label="تاريخ الإنشاء" value={formatDate(selectedRequest.createdAt)} />
          </div>
        )}
      </section>
    </div>
  );
}
