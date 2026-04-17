import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { ShoppingBag, Truck, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../api/client';
import { clearCart } from '../../redux/cartSlice';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { buildCartItemKey } from '../../utils/cartItem';

const emptyAddress = {
  line1: '',
  city: ''
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_REGEX = /^[0-9+\-\s()]+$/;
const RECAPTCHA_SCRIPT_URLS = [
  'https://www.google.com/recaptcha/api.js?render=explicit&hl=ar',
  'https://www.recaptcha.net/recaptcha/api.js?render=explicit&hl=ar'
];
const RECAPTCHA_RETRY_DELAYS_MS = [2000, 5000, 10000, 15000];
const CHECKOUT_DRAFT_STORAGE_KEY = 'checkout_draft_v1';

let recaptchaLoadPromise = null;

function resetRecaptchaLoader() {
  recaptchaLoadPromise = null;
  if (typeof document === 'undefined') return;
  document.querySelectorAll('script[data-recaptcha-script="true"]').forEach((node) => node.remove());
}

function loadScriptFromUrl(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading script: ${url}`));
    }, 12000);
    script.src = url;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaScript = 'true';
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error(`Failed to load script: ${url}`));
    };
    document.head.appendChild(script);
  });
}

function loadRecaptchaScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha?.render) return Promise.resolve();
  if (recaptchaLoadPromise) return recaptchaLoadPromise;

  recaptchaLoadPromise = (async () => {
    const existing = document.querySelector('script[data-recaptcha-script="true"]');
    if (existing) {
      if (window.grecaptcha?.render) return;
      await new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load reCAPTCHA script')), { once: true });
      });
      return;
    }

    let lastError = null;
    for (const url of RECAPTCHA_SCRIPT_URLS) {
      try {
        await loadScriptFromUrl(url);
        if (window.grecaptcha?.render) return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Failed to load reCAPTCHA');
  })().catch((error) => {
    recaptchaLoadPromise = null;
    throw error;
  });

  return recaptchaLoadPromise;
}

function isValidEmail(value) {
  return EMAIL_REGEX.test(String(value || '').trim());
}

function isValidPhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !PHONE_CHARS_REGEX.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function getCheckoutErrorMessage(error) {
  const message = String(error?.message || '').trim();
  if (!message) return 'فشل بدء عملية الدفع';
  if (message.startsWith('Insufficient stock for ')) {
    return `الكمية المطلوبة غير متوفرة حالياً للمنتج: ${message.replace('Insufficient stock for ', '').trim()}`;
  }
  if (message === 'Insufficient stock for one or more products') {
    return 'بعض المنتجات في السلة لم تعد متوفرة بالكمية المطلوبة. حدّث الكمية ثم حاول مرة أخرى.';
  }
  if (message === 'Payment initiation failed') return 'فشل بدء عملية الدفع';
  if (message === 'Customer email is required for Lahza payment') return 'البريد الإلكتروني مطلوب لإتمام الدفع الإلكتروني';
  if (message === 'Lahza payment gateway is disabled') return 'بوابة الدفع غير مفعلة حالياً';
  if (message === 'LAHZA_SECRET_KEY is missing') return 'إعدادات بوابة الدفع غير مكتملة حالياً';
  return message;
}

function readCheckoutDraft() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      customerName: String(parsed.customerName || ''),
      phoneNumber: String(parsed.phoneNumber || ''),
      email: String(parsed.email || ''),
      address: {
        line1: String(parsed.address?.line1 || ''),
        city: String(parsed.address?.city || '')
      },
      notes: String(parsed.notes || ''),
      acceptedPolicies: !!parsed.acceptedPolicies
    };
  } catch {
    return null;
  }
}

function clearCheckoutDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
}

function UnifiedCheckout() {
  const cartItems = useSelector(state => state.cart.items);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [whatsappSettings, setWhatsappSettings] = useState(null);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [cities, setCities] = useState([]);

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [notes, setNotes] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [recaptchaConfig, setRecaptchaConfig] = useState({ enabled: false, site_key: '' });
  const [recaptchaLoading, setRecaptchaLoading] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaWidgetId, setCaptchaWidgetId] = useState(null);
  const [captchaReady, setCaptchaReady] = useState(true);
  const [captchaError, setCaptchaError] = useState('');
  const [captchaRetryAttempt, setCaptchaRetryAttempt] = useState(0);
  const [captchaRetryNonce, setCaptchaRetryNonce] = useState(0);
  const [captchaRetryScheduled, setCaptchaRetryScheduled] = useState(false);
  const [captchaRetryExhausted, setCaptchaRetryExhausted] = useState(false);
  const recaptchaRef = useRef(null);
  const recaptchaRetryTimerRef = useRef(null);
  const checkoutDraftRestoredRef = useRef(false);
  const { formatPrice } = useStoreSettings();
  const cartProductIds = useMemo(
    () => Array.from(new Set(cartItems.map((item) => Number(item.productId)).filter((id) => Number.isInteger(id) && id > 0))),
    [cartItems]
  );

  useEffect(() => {
    if (checkoutDraftRestoredRef.current) return;
    checkoutDraftRestoredRef.current = true;

    const draft = readCheckoutDraft();
    if (!draft) return;

    setCustomerName(draft.customerName);
    setPhoneNumber(draft.phoneNumber);
    setEmail(draft.email);
    setAddress({
      line1: draft.address?.line1 || '',
      city: draft.address?.city || ''
    });
    setNotes(draft.notes);
    setAcceptedPolicies(!!draft.acceptedPolicies);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({
      customerName,
      phoneNumber,
      email,
      address,
      notes,
      acceptedPolicies
    }));
  }, [acceptedPolicies, address, customerName, email, notes, phoneNumber]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const list = cartProductIds.length > 0
          ? await api.get(`/products?ids=${cartProductIds.join(',')}`)
          : [];
        setProducts(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
        toast.error('Failed to load products. Please refresh.');
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [cartProductIds]);

  useEffect(() => {
    const fetchWhatsapp = async () => {
      try {
        const data = await api.get('/settings/whatsapp');
        setWhatsappSettings(data || null);
      } catch {
        setWhatsappSettings(null);
      }
    };
    fetchWhatsapp();
  }, []);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const data = await api.get('/settings/cities');
        setCities(Array.isArray(data) ? data : []);
      } catch {
        setCities([]);
      }
    };
    fetchCities();
  }, []);

  useEffect(() => {
    const fetchRecaptchaSettings = async () => {
      try {
        const data = await api.get('/settings/recaptcha');
        setRecaptchaConfig({
          enabled: !!data?.enabled,
          site_key: String(data?.site_key || '').trim()
        });
      } catch {
        setRecaptchaConfig({ enabled: false, site_key: '' });
      } finally {
        setRecaptchaLoading(false);
      }
    };
    fetchRecaptchaSettings();
  }, []);

  const recaptchaEnabled = !!recaptchaConfig.enabled && !!recaptchaConfig.site_key;
  const validCityNames = useMemo(() => new Set(cities.map((city) => String(city.name || '').trim())), [cities]);

  useEffect(() => {
    if (!recaptchaEnabled) {
      setCaptchaToken('');
      setCaptchaWidgetId(null);
      setCaptchaReady(true);
      setCaptchaError('');
      setCaptchaRetryAttempt(0);
      setCaptchaRetryScheduled(false);
      setCaptchaRetryExhausted(false);
      if (recaptchaRetryTimerRef.current) {
        window.clearTimeout(recaptchaRetryTimerRef.current);
        recaptchaRetryTimerRef.current = null;
      }
      if (recaptchaRef.current) recaptchaRef.current.innerHTML = '';
      return;
    }
    setCaptchaReady(false);
  }, [recaptchaEnabled]);

  useEffect(() => {
    if (!recaptchaEnabled) return;

    let cancelled = false;
    const initRecaptcha = async () => {
      try {
        await loadRecaptchaScript();
        if (cancelled) return;
        if (!window.grecaptcha || !recaptchaRef.current || captchaWidgetId != null) return;

        window.grecaptcha.ready(() => {
          if (cancelled || !recaptchaRef.current || captchaWidgetId != null) return;
          const widgetId = window.grecaptcha.render(recaptchaRef.current, {
            sitekey: recaptchaConfig.site_key,
            callback: (token) => setCaptchaToken(String(token || '')),
            'expired-callback': () => setCaptchaToken(''),
            'error-callback': () => setCaptchaToken('')
          });
          if (!cancelled) {
            setCaptchaWidgetId(widgetId);
            setCaptchaReady(true);
            setCaptchaError('');
            setCaptchaRetryAttempt(0);
            setCaptchaRetryScheduled(false);
            setCaptchaRetryExhausted(false);
            if (recaptchaRetryTimerRef.current) {
              window.clearTimeout(recaptchaRetryTimerRef.current);
              recaptchaRetryTimerRef.current = null;
            }
          }
        });
      } catch (err) {
        console.error('Failed to initialize reCAPTCHA:', err);
        if (!cancelled) {
          setCaptchaReady(false);
          const nextDelay = RECAPTCHA_RETRY_DELAYS_MS[captchaRetryAttempt];

          if (nextDelay != null) {
            const seconds = Math.ceil(nextDelay / 1000);
            setCaptchaRetryScheduled(true);
            setCaptchaRetryExhausted(false);
            setCaptchaError(`تعذر تحميل reCAPTCHA. ستتم إعادة المحاولة تلقائياً خلال ${seconds} ثوان.`);

            if (recaptchaRetryTimerRef.current) {
              window.clearTimeout(recaptchaRetryTimerRef.current);
            }

            recaptchaRetryTimerRef.current = window.setTimeout(() => {
              recaptchaRetryTimerRef.current = null;
              if (cancelled) return;
              setCaptchaRetryScheduled(false);
              setCaptchaRetryAttempt((value) => value + 1);
              setCaptchaToken('');
              setCaptchaWidgetId(null);
              setCaptchaReady(false);
              resetRecaptchaLoader();
              setCaptchaRetryNonce((value) => value + 1);
            }, nextDelay);
          } else {
            setCaptchaRetryScheduled(false);
            setCaptchaRetryExhausted(true);
            setCaptchaError('تعذر تحميل reCAPTCHA. تأكد من تعطيل مانع الإعلانات أو جرّب شبكة أخرى ثم أعد المحاولة.');
          }
        }
      }
    };

    initRecaptcha();
    return () => {
      cancelled = true;
      if (recaptchaRetryTimerRef.current) {
        window.clearTimeout(recaptchaRetryTimerRef.current);
        recaptchaRetryTimerRef.current = null;
      }
    };
  }, [captchaRetryAttempt, captchaRetryNonce, captchaWidgetId, recaptchaEnabled, recaptchaConfig.site_key]);

  const cartDetails = useMemo(() => {
    return cartItems
      .map(item => {
        const product = products.find(p => String(p.id) === String(item.productId));
        if (!product) return null;
        return {
          ...item,
          product
        };
      })
      .filter(Boolean);
  }, [cartItems, products]);

  const subtotal = cartDetails.reduce((acc, item) => acc + (Number(item.product.price) || 0) * item.quantity, 0);
  const total = subtotal;

  const cartStockError = useMemo(() => {
    const unavailableItem = cartDetails.find(({ product }) => Number(product?.is_available) === 0 || Number(product?.is_hidden) === 1);
    if (unavailableItem) {
      return `هذا المنتج غير متوفر حالياً: ${unavailableItem.product?.name || ''}`.trim();
    }

    const insufficientItem = cartDetails.find(({ product, quantity }) => {
      const stock = Number(product?.stock);
      return Number.isFinite(stock) && stock > 0 && Number(quantity) > stock;
    });
    if (insufficientItem) {
      return `الكمية المطلوبة غير متوفرة حالياً للمنتج: ${insufficientItem.product?.name || ''}`.trim();
    }

    return '';
  }, [cartDetails]);

  const validateForm = () => {
    if (!customerName.trim()) return 'الاسم مطلوب';
    if (!phoneNumber.trim()) return 'رقم الهاتف مطلوب';
    if (!isValidPhone(phoneNumber)) return 'صيغة رقم الهاتف غير صحيحة';
    if (!email.trim()) return 'البريد الإلكتروني مطلوب';
    if (!isValidEmail(email)) return 'صيغة البريد الإلكتروني غير صحيحة';
    if (!address.line1.trim()) return 'عنوان 1 مطلوب';
    if (!address.city.trim()) return 'المدينة مطلوبة';
    if (!validCityNames.has(String(address.city || '').trim())) return 'يرجى اختيار مدينة من القائمة';
    if (!address.city.trim()) return 'المدينة مطلوبة';
    if (cartDetails.length === 0) return 'السلة فارغة';
    if (cartStockError) return cartStockError;
    if (!acceptedPolicies) return 'يرجى الموافقة على السياسات';
    if (recaptchaLoading) return 'جاري تحميل إعدادات التحقق';
    if (recaptchaEnabled && captchaError) return captchaError;
    if (recaptchaEnabled && !captchaReady) return 'يرجى انتظار تحميل reCAPTCHA';
    if (recaptchaEnabled && !captchaToken) return 'يرجى تأكيد reCAPTCHA';
    return null;
  };

  const formError = validateForm();

  const submitOrder = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const items = cartDetails.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        selectedColorName: item.selectedColorName || '',
        selectedColorHex: item.selectedColorHex || ''
      }));

      const paymentResponse = await api.post('/payments/initiate', {
        customer: {
          name: customerName,
          phone: phoneNumber,
          email: email || null,
          address: {
            line1: address.line1,
            line2: null,
            city: address.city,
            state: null
          }
        },
        items,
        notes,
        captchaToken: recaptchaEnabled ? captchaToken : null
      });

      const paymentId = paymentResponse?.paymentId;
      if (!paymentId) throw new Error('فشل بدء عملية الدفع');
      const redirectUrl = paymentResponse?.redirectUrl;
      const summaryToken = String(paymentResponse?.summaryToken || '').trim();

      clearCheckoutDraft();
      dispatch(clearCart());
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      const params = new URLSearchParams({ paymentId: String(paymentId) });
      const hash = summaryToken ? `#token=${encodeURIComponent(summaryToken)}` : '';
      navigate(`/summary?${params.toString()}${hash}`);
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(getCheckoutErrorMessage(err));
      if (recaptchaEnabled && window.grecaptcha && captchaWidgetId != null) {
        window.grecaptcha.reset(captchaWidgetId);
        setCaptchaToken('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlaceOrder = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }
    setShowWhatsapp(true);
  };

  const whatsappPhone = (whatsappSettings?.phone || '').trim();
  const whatsappLink = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/[^0-9]/g, '')}`
    : '';
  const whatsappMessage = whatsappSettings?.message || 'سيتم احتساب سعر التوصيل بعد تأكيد الطلب. إذا رغبت بمعرفة السعر تواصل معنا على واتساب.';

  if (loadingProducts) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-gray-900 animate-spin mb-3" />
        <p className="text-gray-600">جاري تحميل صفحة الدفع...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="w-6 h-6 text-gray-900" />
          <h1 className="text-2xl font-bold text-gray-900">الدفع</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5" />
                <h2 className="text-lg font-semibold">تفاصيل الشحن</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">الاسم الكامل</label>
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">الهاتف</label>
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    inputMode="tel"
                    dir="ltr"
                    placeholder="+9705XXXXXXXX"
                  />
                  {phoneNumber.trim() && !isValidPhone(phoneNumber) && (
                    <p className="mt-1 text-xs text-red-600">أدخل رقم هاتف صحيح (9 إلى 15 رقم)</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    inputMode="email"
                    dir="ltr"
                    placeholder="name@example.com"
                  />
                  {email.trim() && !isValidEmail(email) && (
                    <p className="mt-1 text-xs text-red-600">أدخل بريد إلكتروني صحيح</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">العنوان 1</label>
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">المدينة</label>
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    required
                  >
                    <option value="" disabled>اختر المدينة</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">ملاحظات (اختياري)</label>
                  <textarea
                    className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptedPolicies}
                  onChange={(e) => setAcceptedPolicies(e.target.checked)}
                />
                <span>
                  أوافق على{' '}
                  <Link className="text-orange-600 hover:underline" to="/terms-of-service" target="_blank" rel="noreferrer">سياسة الإرجاع والتبديل و سياسة الخصوصية</Link>.
                </span>
              </label>
              {recaptchaEnabled && (
                <div className="mt-4">
                  <div ref={recaptchaRef} />
                  {!captchaReady && (
                    <p className="mt-2 text-xs text-gray-500">
                      {captchaRetryScheduled ? 'جاري إعادة محاولة تحميل reCAPTCHA تلقائياً...' : 'جاري تحميل reCAPTCHA...'}
                    </p>
                  )}
                  {captchaError && (
                    <p className="mt-2 text-xs text-red-600">{captchaError}</p>
                  )}
                  {recaptchaEnabled && captchaRetryExhausted && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-orange-600 hover:underline"
                      onClick={() => {
                        setCaptchaError('');
                        setCaptchaToken('');
                        setCaptchaWidgetId(null);
                        setCaptchaReady(false);
                        setCaptchaRetryAttempt(0);
                        setCaptchaRetryScheduled(false);
                        setCaptchaRetryExhausted(false);
                        if (recaptchaRetryTimerRef.current) {
                          window.clearTimeout(recaptchaRetryTimerRef.current);
                          recaptchaRetryTimerRef.current = null;
                        }
                        resetRecaptchaLoader();
                        setCaptchaRetryNonce((value) => value + 1);
                      }}
                    >
                      إعادة محاولة تحميل reCAPTCHA
                    </button>
                  )}
                </div>
              )}
            </div>

          </m.div>

          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit"
          >
            <h2 className="text-lg font-semibold mb-4">ملخص الطلب</h2>
            <div className="space-y-3">
              {cartDetails.length === 0 && (
                <p className="text-sm text-gray-500">السلة فارغة.</p>
              )}
              {cartDetails.map(item => (
                <div key={buildCartItemKey(item)} className="flex justify-between text-sm">
                  <span>
                    {item.product.name}
                    {item.selectedColorName ? ` - ${item.selectedColorName}` : ''} × {item.quantity}
                  </span>
                  <span>{formatPrice((Number(item.product.price) || 0) * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t mt-4 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>الإجمالي</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

              <button
                onClick={handlePlaceOrder}
                disabled={submitting || !!formError}
                className={`mt-6 w-full py-3 rounded-lg font-semibold ${
                  submitting || !!formError
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-[#f89c1c] text-[#1f1f27] hover:bg-[#e58f12]'
                }`}
              >
              {submitting ? 'جارٍ إنشاء الطلب...' : 'تأكيد الطلب'}
            </button>
            {formError && (
              <p className="mt-2 text-xs text-red-600">{formError}</p>
            )}
          </m.div>
        </div>
      </div>

      {showWhatsapp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowWhatsapp(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold">ملاحظة بخصوص التوصيل</h3>
              <button className="text-gray-500 text-2xl leading-none" onClick={() => setShowWhatsapp(false)}>×</button>
            </div>
            <p className="text-sm text-gray-700 leading-7 mb-4">
              {whatsappMessage}
            </p>
            {whatsappSettings?.qr_data_url && (
              <div className="flex justify-center mb-4">
                <img src={whatsappSettings.qr_data_url} alt="WhatsApp QR" className="w-40 h-40 object-contain" />
              </div>
            )}
            {whatsappPhone && (
              <div className="flex justify-center mb-6">
                <a
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  تواصل عبر واتساب: {whatsappPhone}
                </a>
              </div>
            )}
            <div className="flex gap-3">
              <button className="flex-1 rounded-lg bg-[#f89c1c] py-3 font-semibold text-[#1f1f27] hover:bg-[#e58f12]" onClick={() => { setShowWhatsapp(false); submitOrder(); }}>
                تأكيد الطلب
              </button>
              <button className="flex-1 border border-gray-300 py-3 rounded-lg font-semibold" onClick={() => setShowWhatsapp(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UnifiedCheckout;
