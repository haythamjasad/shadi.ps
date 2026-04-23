import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Mail, MapPin, Package, PhoneCall, ReceiptText, RefreshCw, ShieldCheck } from 'lucide-react';
import { m } from 'framer-motion';
import { useStoreSettings } from '../context/StoreSettingsContext';

function buildSummaryTokenStorageKey(orderId, paymentId) {
  return `checkout-summary-token:${orderId || 'none'}:${paymentId || 'none'}`;
}

function getOrderStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'paid') return 'مدفوع';
  if (value === 'packed') return 'تم التجهيز';
  if (value === 'shipped') return 'تم الشحن';
  if (value === 'delivered') return 'تم التسليم';
  if (value === 'cancelled') return 'ملغي';
  if (value === 'pending_payment') return 'بانتظار تأكيد الدفع';
  return status || 'قيد المراجعة';
}

function getPaymentStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'paid') return 'تم الدفع بنجاح';
  if (value === 'failed') return 'فشل الدفع';
  if (value === 'pending') return 'بانتظار التأكيد';
  return status || 'قيد المعالجة';
}

function joinAddress(order) {
  return [order?.address_line1, order?.address_line2, order?.city, order?.state, order?.country, order?.postal_code]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' - ');
}

function OrderSummary() {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const orderId = query.get('orderId');
  const paymentId = query.get('paymentId');
  const storageKey = useMemo(() => buildSummaryTokenStorageKey(orderId, paymentId), [orderId, paymentId]);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [items, setItems] = useState([]);
  const [pendingOrderCreation, setPendingOrderCreation] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const { formatPrice } = useStoreSettings();
  const logoUrl = '/circle_logo_footer.png';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = String(location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const hashToken = String(hashParams.get('token') || '').trim();
    if (hashToken) {
      window.sessionStorage.setItem(storageKey, hashToken);
      setToken(hashToken);
      setTokenReady(true);
      window.history.replaceState(null, '', `${location.pathname}${location.search}`);
      return;
    }

    setToken(window.sessionStorage.getItem(storageKey) || '');
    setTokenReady(true);
  }, [location.hash, location.pathname, location.search, storageKey]);

  const authHeaders = useMemo(() => (
    token ? { headers: { 'x-checkout-token': token } } : {}
  ), [token]);

  const fetchOrderById = useCallback(async (id) => {
    const data = await api.get(`/orders/${id}`, authHeaders);
    setOrder(data.order);
    setItems(data.items || []);
  }, [authHeaders]);

  const fetchSummary = useCallback(async () => {
    if (!tokenReady) return;
    setLoading(true);
    setError('');
    setPendingOrderCreation(false);
    try {
      if (orderId) {
        await fetchOrderById(orderId);
        return;
      }

      if (!paymentId) {
        setError('رقم الطلب أو الدفع غير موجود');
        return;
      }

      const paymentData = await api.get(`/payments/${paymentId}`, authHeaders);
      setPayment(paymentData);
      if (paymentData?.order_id) {
        await fetchOrderById(paymentData.order_id);
      } else {
        setPendingOrderCreation(true);
      }
    } catch (err) {
      console.error(err);
      setError('تعذر تحميل الطلب');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, orderId, paymentId, fetchOrderById, tokenReady]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshTick]);

  useEffect(() => {
    if (!pendingOrderCreation) return undefined;
    const timer = window.setTimeout(() => setRefreshTick((value) => value + 1), 3500);
    return () => window.clearTimeout(timer);
  }, [pendingOrderCreation]);

  const addressText = useMemo(() => joinAddress(order), [order]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(248,156,28,0.18),transparent_22%),linear-gradient(180deg,#0f1014_0%,#16181f_100%)] px-4">
        <div className="rounded-[30px] border border-[#f89c1c26] bg-[linear-gradient(180deg,#171a21_0%,#101217_100%)] px-8 py-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#f89c1c]" />
          <p className="text-sm font-semibold text-white">جاري تحميل تأكيد الطلب...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(248,156,28,0.18),transparent_22%),linear-gradient(180deg,#0f1014_0%,#16181f_100%)] px-4">
        <div className="max-w-lg rounded-[30px] border border-[#f89c1c26] bg-[linear-gradient(180deg,#171a21_0%,#101217_100%)] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffffff0a] text-[#f89c1c]">
            <ReceiptText className="h-8 w-8" />
          </div>
          <h1 className="mb-3 text-2xl font-extrabold text-white">تعذر تحميل تأكيد الطلب</h1>
          <p className="text-sm leading-7 text-white/70">{error}</p>
          <div className="mt-6 flex justify-center">
            <Link to="/products" className="inline-flex items-center gap-2 rounded-full bg-[#f89c1c] px-5 py-3 text-sm font-bold text-[#1f1f27]">
              العودة للمنتجات
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (pendingOrderCreation) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(248,156,28,0.18),transparent_22%),linear-gradient(180deg,#0f1014_0%,#16181f_100%)] px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[32px] border border-[#f89c1c26] bg-[linear-gradient(180deg,#171a21_0%,#101217_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.38)]">
          <div className="bg-[linear-gradient(135deg,rgba(248,156,28,0.14),rgba(255,255,255,0.02))] px-8 py-10 text-white">
            <div className="flex flex-col-reverse items-center justify-between gap-6 text-center sm:flex-row sm:text-right">
              <div>
                <span className="inline-flex rounded-full bg-[#f89c1c1f] px-4 py-2 text-xs font-extrabold text-[#ffd9a0]">تأكيد الدفع</span>
                <h1 className="mt-4 text-3xl font-extrabold">جاري تجهيز صفحة تأكيد الطلب</h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">تمت إعادة توجيهك بنجاح من بوابة الدفع. نحن نراجع حالة العملية الآن وسنحوّل هذه الصفحة تلقائيًا إلى تأكيد الطلب فور اكتمالها.</p>
              </div>
              {logoUrl ? <img src={logoUrl} alt="شعار شادي شرّي" className="h-36 w-36 object-contain" /> : null}
            </div>
          </div>

          <div className="space-y-4 px-8 py-8">
            <div className="rounded-[24px] border border-[#ffffff12] bg-[#ffffff08] p-5">
              <div className="flex items-center gap-3 text-white">
                <Loader2 className="h-6 w-6 animate-spin text-[#f89c1c]" />
                <p className="font-bold">بانتظار تأكيد الدفع من البوابة</p>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                {paymentId ? <div>رقم الدفع: <span className="font-bold text-white">{paymentId}</span></div> : null}
                {payment?.status ? <div>الحالة الحالية: <span className="font-bold text-white">{getPaymentStatusLabel(payment.status)}</span></div> : null}
                <div className="sm:col-span-2">سيتم تحديث الصفحة تلقائيًا بعد نجاح الدفع وإنشاء الطلب.</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => setRefreshTick((value) => value + 1)} className="inline-flex items-center gap-2 rounded-full bg-[#f89c1c] px-5 py-3 text-sm font-bold text-[#1f1f27]">
                تحديث الآن
                <RefreshCw className="h-4 w-4" />
              </button>
              <Link to="/products" className="inline-flex items-center gap-2 rounded-full border border-[#ffffff18] px-5 py-3 text-sm font-bold text-white">
                متابعة التسوق
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f3f4f6_100%)] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[34px] border border-[#fed7aa] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.12)]">
        <div className="bg-[linear-gradient(135deg,#fff7ed,#ffedd5)] px-8 py-10 text-[#111827] sm:px-10">
          <div className="flex flex-col-reverse items-center justify-between gap-8 text-center sm:flex-row sm:text-right">
            <m.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <span className="inline-flex rounded-full border border-[#fdba74] bg-white px-4 py-2 text-xs font-extrabold text-[#c2410c]">تم الدفع بنجاح</span>
              <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">تم تأكيد طلبك بنجاح</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4b5563] sm:text-base">شكراً لك. تم استلام عملية الدفع وإنشاء الطلب في النظام، وسيقوم فريقنا بالتواصل معك قريباً لتأكيد التوصيل ومتابعة التجهيز.</p>
            </m.div>

            <m.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="شعار شادي شرّي" className="h-40 w-40 object-contain" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#f89c1c14] ring-8 ring-[#ffffff0f]">
                  <CheckCircle2 className="h-14 w-14 text-[#f89c1c]" />
                </div>
              )}
            </m.div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[26px] border border-[#e5e7eb] bg-[#fffaf3] p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
              <div className="mb-5 flex items-center gap-3 text-[#111827]">
                <Package className="h-5 w-5 text-[#f89c1c]" />
                <h2 className="text-xl font-extrabold">المنتجات المطلوبة</h2>
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 rounded-[18px] border border-[#e5e7eb] bg-white px-4 py-4 text-sm shadow-sm">
                    <div className="min-w-0 flex-1 leading-7 text-[#111827]">
                      <div className="font-bold">{item.product_name}</div>
                      <div className="text-[#6b7280]">
                        {item.color_name || 'اللون الافتراضي'}
                      </div>
                    </div>
                    <div className="shrink-0 font-extrabold text-[#9a3412]">{formatPrice(item.line_total || 0)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-[#e5e7eb] bg-[#fffaf3] p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
              <div className="mb-5 flex items-center gap-3 text-[#111827]">
                <ShieldCheck className="h-5 w-5 text-[#f89c1c]" />
                <h2 className="text-xl font-extrabold">ماذا بعد؟</h2>
              </div>
              <div className="grid gap-3 text-sm text-[#6b7280] sm:grid-cols-3">
                <div className="rounded-[18px] border border-[#e5e7eb] bg-white p-4 leading-7">
                  <div className="mb-2 font-bold text-[#111827]">1. مراجعة الطلب</div>
                  نراجع العناصر المطلوبة فور وصول الطلب.
                </div>
                <div className="rounded-[18px] border border-[#e5e7eb] bg-white p-4 leading-7">
                  <div className="mb-2 font-bold text-[#111827]">2. التواصل معك</div>
                  سيتواصل معك فريقنا لتأكيد التفاصيل وتكلفة التوصيل.
                </div>
                <div className="rounded-[18px] border border-[#e5e7eb] bg-white p-4 leading-7">
                  <div className="mb-2 font-bold text-[#111827]">3. بدء التجهيز</div>
                  بعد التأكيد نبدأ تجهيز الطلب ومتابعة التسليم.
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="overflow-hidden rounded-[26px] border border-[#e5e7eb] bg-[#fffaf3] shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
              <div className="border-b border-[#e5e7eb] bg-[#fff7ed] px-6 py-5">
                <h2 className="text-xl font-extrabold text-[#9a3412]">ملخص الطلب</h2>
              </div>
              <div className="space-y-4 px-6 py-6 text-sm text-[#6b7280]">
                <div className="flex items-start justify-between gap-4"><span>رقم الطلب</span><strong className="text-[#111827]">#{order?.id}</strong></div>
                {paymentId ? <div className="flex items-start justify-between gap-4"><span>رقم الدفع</span><strong className="text-[#111827]">{paymentId}</strong></div> : null}
                <div className="flex items-start justify-between gap-4"><span>حالة الطلب</span><strong className="text-[#111827]">{getOrderStatusLabel(order?.status)}</strong></div>
                {payment?.status ? <div className="flex items-start justify-between gap-4"><span>حالة الدفع</span><strong className="text-[#111827]">{getPaymentStatusLabel(payment.status)}</strong></div> : null}
                <div className="flex items-start justify-between gap-4 border-t border-dashed border-[#e5e7eb] pt-4"><span>الإجمالي</span><strong className="text-lg text-[#9a3412]">{formatPrice(order?.total || 0)}</strong></div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[26px] border border-[#e5e7eb] bg-[#fffaf3] shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
              <div className="border-b border-[#e5e7eb] bg-[#fff7ed] px-6 py-5">
                <h2 className="text-xl font-extrabold text-[#9a3412]">بيانات التواصل</h2>
              </div>
              <div className="space-y-4 px-6 py-6 text-sm text-[#6b7280]">
                <div className="flex items-start gap-3"><PhoneCall className="mt-0.5 h-4 w-4 text-[#f89c1c]" /><div><div className="font-bold text-[#111827]">الهاتف</div><div>{order?.customer_phone || 'غير متوفر'}</div></div></div>
                <div className="flex items-start gap-3"><Mail className="mt-0.5 h-4 w-4 text-[#f89c1c]" /><div><div className="font-bold text-[#111827]">البريد الإلكتروني</div><div>{order?.customer_email || 'غير متوفر'}</div></div></div>
                <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-[#f89c1c]" /><div><div className="font-bold text-[#111827]">العنوان</div><div>{addressText || 'سيتم تأكيد العنوان معك'}</div></div></div>
                <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-4 w-4 text-[#f89c1c]" /><div><div className="font-bold text-[#111827]">ملاحظات</div><div>{order?.notes || 'لا توجد ملاحظات'}</div></div></div>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Link to="/products" className="inline-flex items-center gap-2 rounded-full bg-[#f89c1c] px-5 py-3 text-sm font-bold text-[#1f1f27]">
                متابعة التسوق
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-[#fed7aa] px-5 py-3 text-sm font-bold text-[#9a3412]">
                العودة للرئيسية
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderSummary;
