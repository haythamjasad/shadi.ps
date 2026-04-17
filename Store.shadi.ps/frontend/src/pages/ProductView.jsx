import React, { useEffect, useState } from 'react';
import { api, API_BASE } from '../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addToCart } from '../redux/cartSlice';
import { toast } from 'react-toastify';
import {
  ArrowLeft, ShoppingCart, ChevronDown, ChevronUp,
  Star, Globe, Award, Minus, Plus, Loader2, FileText, ExternalLink
} from 'lucide-react';
import { m } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import ProductCard from '../components/ProductCard';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { FaWhatsapp } from 'react-icons/fa';

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return 'PDF file';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateDataUrlSize(dataUrl) {
  const text = String(dataUrl || '');
  const match = text.match(/^data:.*?;base64,(.*)$/);
  if (!match) return null;
  const payload = match[1] || '';
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function getDocumentHeadline(name) {
  const text = String(name || '').replace(/\.pdf$/i, '').trim();
  return text || 'Technical file';
}

function getDocumentOpenUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';

  const match = text.match(/(?:https?:\/\/[^/]+)?\/(?:(?:api(?:\/v01)?)?\/?uploads\/docs|assets)\/([^/?#]+\.pdf)(?:[?#].*)?$/i);
  if (match) {
    return `${API_BASE}/uploads/docs/${match[1]}`;
  }

  return text;
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
    throw new Error('Failed to load PDF');
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return {
    size: bytes.length || fallbackSize || null,
    pages: getPdfPageCount(bytes)
  };
}

function normalizeDocument(doc, index) {
  if (!doc) return null;

  if (typeof doc === 'string') {
    const size = estimateDataUrlSize(doc);
    return {
      id: `doc-${index}`,
      name: `Sample ${index + 1}.pdf`,
      url: doc,
      type: 'application/pdf',
      sizeLabel: formatFileSize(size),
      isPdf: true
    };
  }

  if (typeof doc === 'object') {
    const url = String(doc.url || doc.href || doc.path || doc.dataUrl || '').trim();
    const type = String(doc.type || '').trim().toLowerCase();
    const inferredPdf = type.includes('pdf') || /\.pdf($|\?)/i.test(String(doc.name || url));
    const size = Number(doc.size) || estimateDataUrlSize(url);
    return {
      ...doc,
      id: String(doc.id || `doc-${index}`),
      name: String(doc.name || `Sample ${index + 1}.pdf`),
      url,
      type,
      sizeLabel: formatFileSize(size),
      isPdf: inferredPdf || url.startsWith('data:application/pdf')
    };
  }

  return null;
}

function ProductDocumentCard({ doc, onMissingUrl }) {
  const docUrl = getDocumentOpenUrl(doc.url);
  const previewUrl = buildPdfPreviewUrl(docUrl);
  const [details, setDetails] = useState({
    sizeLabel: doc.sizeLabel || '',
    pages: null
  });

  useEffect(() => {
    let cancelled = false;

    if (!docUrl || !doc.isPdf) {
      setDetails({ sizeLabel: doc.sizeLabel || '', pages: null });
      return undefined;
    }

    readPdfDetails(docUrl, doc.size)
      .then((next) => {
        if (cancelled) return;
        setDetails({
          sizeLabel: formatFileSize(next?.size || doc.size),
          pages: next?.pages || null
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDetails({ sizeLabel: doc.sizeLabel || '', pages: null });
      });

    return () => {
      cancelled = true;
    };
  }, [doc.isPdf, doc.size, doc.sizeLabel, docUrl]);

  const metaParts = [];
  if (details.pages) metaParts.push(`${details.pages} pages`);
  metaParts.push(doc.isPdf ? 'PDF' : 'File');
  if (details.sizeLabel) metaParts.push(details.sizeLabel);

  return (
    <a
      href={docUrl || '#'}
      target="_blank"
      rel="noreferrer noopener"
      className="group block w-full max-w-[18rem] sm:max-w-none"
      onClick={(event) => {
        if (!docUrl) {
          event.preventDefault();
          onMissingUrl();
        }
      }}
    >
      <div className="overflow-hidden rounded-[0.38rem] border border-[#d88210] bg-gradient-to-b from-[#f7a52d] to-[#ee961c] shadow-[0_10px_24px_rgba(15,23,42,0.2)] transition-transform duration-300 group-hover:-translate-y-1">
        <div className="m-2.5 overflow-hidden rounded-t-[0.18rem] border border-black/10 bg-white">
          {previewUrl && doc.isPdf ? (
            <iframe
              title={doc.name}
              src={previewUrl}
              className="pointer-events-none block h-[18.75rem] w-full border-0 bg-white"
              loading="lazy"
            />
          ) : (
            <div className="flex h-[18.75rem] items-center justify-center bg-gradient-to-b from-orange-50 to-white px-6 text-center">
              <div>
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-rose-600 text-white shadow-lg shadow-rose-900/20">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xl font-semibold text-gray-900">{getDocumentHeadline(doc.name)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 bg-gradient-to-b from-[#f3a52e] to-[#ee981d] px-[0.82rem] py-[0.78rem]">
          <div className="flex h-[2.38rem] w-[2.38rem] shrink-0 flex-col items-center justify-center rounded-md bg-rose-600 text-white shadow-[0_8px_16px_rgba(190,24,93,0.24)]">
            <FileText className="h-[0.88rem] w-[0.88rem]" />
            <span className="mt-[-1px] text-[0.42rem] font-black tracking-[0.12em]">PDF</span>
          </div>

          <div className="min-w-0 flex-1 text-left [direction:ltr]">
            <p className="truncate text-[0.96rem] font-medium leading-[1.12] text-black">{doc.name}</p>
            <p className="mt-[1px] text-[0.76rem] font-medium leading-[1.15] text-black">{metaParts.join(' · ')}</p>
          </div>
        </div>
      </div>
    </a>
  );
}

function ProductView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [whatsappSettings, setWhatsappSettings] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    description: true,
    usage: false,
    technical: false,
    warnings: false,
    shipping: false,
    warranty: false,
  });
  const { formatPrice } = useStoreSettings();

  const dispatch = useDispatch();
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const productData = await api.get(`/products/${id}`);
        setProduct(productData);

        const relatedQuery = productData?.type
          ? `/products?type=${encodeURIComponent(productData.type)}&excludeId=${encodeURIComponent(productData.id)}&limit=5`
          : productData?.category
            ? `/products?category=${encodeURIComponent(productData.category)}&excludeId=${encodeURIComponent(productData.id)}&limit=5`
            : '';

        if (relatedQuery) {
          const similar = await api.get(relatedQuery);
          setSimilarProducts(Array.isArray(similar) ? similar : []);
        } else {
          setSimilarProducts([]);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        toast.error("حدث خطأ أثناء تحميل بيانات المنتج.");
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, navigate]);

  useEffect(() => {
    const options = Array.isArray(product?.color_options) ? product.color_options : [];
    setSelectedColor(options[0] || null);
  }, [product]);

  useEffect(() => {
    const fetchWhatsappSettings = async () => {
      try {
        const data = await api.get('/settings/whatsapp');
        setWhatsappSettings(data || null);
      } catch {
        setWhatsappSettings(null);
      }
    };

    fetchWhatsappSettings();
  }, []);

  const calculateDiscount = (mrp, price) => {
    if (!mrp || !price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const handleAddToCart = () => {
    if (product?.is_available === 0) {
      toast.warning('هذا المنتج غير متوفر حالياً');
      return;
    }
    if (Array.isArray(product?.color_options) && product.color_options.length > 0 && !selectedColor) {
      toast.warning('يرجى اختيار اللون أولاً');
      return;
    }
    dispatch(addToCart({
      productId: product.id,
      quantity,
      selectedColorName: selectedColor?.name || '',
      selectedColorHex: selectedColor?.hex || ''
    }));
    toast.success(`تمت إضافة ${quantity} قطعة إلى السلة`);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const whatsappPhone = String(whatsappSettings?.phone || '').trim();
  const whatsappLink = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/[^0-9]/g, '')}`
    : null;

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <Loader2 className="w-12 h-12 text-gray-900 animate-spin mb-4" />
        <p className="text-gray-600">جاري تحميل المنتج...</p>
      </div>
    );
  }

  if (!product) return null;

  const rawDocs = Array.isArray(product?.docs)
    ? product.docs
    : product?.docs
      ? [product.docs]
      : [];
  const docs = rawDocs.map((doc, index) => normalizeDocument(doc, index)).filter(Boolean);

  return (
    <>
      <Helmet>
        <title>{product.name} | شادي شرّي</title>
        <meta name="description" content={product.description || product.name} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <m.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            رجوع
          </m.button>

          {/* Product Main Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
            {/* Left - Image */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 aspect-square sticky top-4">
                <img
                  src={product.image_url || (product.image_urls && product.image_urls[0]) || product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </m.div>

            {/* Right - Product Info */}
            <m.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Brand */}
              {product.brand && (
                <span className="inline-block text-sm font-semibold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                  {product.brand}
                </span>
              )}

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                {product.name}
              </h1>

              {/* Rating */}
              {Number(product.rating) > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg">
                    <Star className="w-5 h-5 fill-amber-500 stroke-amber-500" />
                    <span className="text-sm font-semibold text-amber-700">{Number(product.rating).toFixed(1)}</span>
                  </div>
                  <span className="text-sm text-gray-600">({Number(product.ratingCount) || 0} تقييم)</span>
                </div>
              )}

              {/* Price */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(product.price)}
                  </span>
                  {product.mrp && product.mrp > product.price && (
                    <>
                      <span className="text-2xl text-gray-400 line-through">
                        {formatPrice(product.mrp)}
                      </span>
                      <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                        خصم {calculateDiscount(product.mrp, product.price)}%
                      </span>
                    </>
                  )}
                </div>
                {product.mrp && product.mrp > product.price && (
                  <p className="text-sm text-green-600 font-semibold">
                    وفّر {formatPrice(product.mrp - product.price)}
                  </p>
                )}
              </div>

              {Array.isArray(product?.color_options) && product.color_options.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-900">اللون</label>
                  <div className="flex flex-wrap gap-3">
                    {product.color_options.map((color) => {
                      const active = selectedColor?.name === color.name && selectedColor?.hex === color.hex;
                      return (
                        <button
                          key={`${color.name}-${color.hex}`}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                            active ? 'border-[#f89c1c] bg-[#f89c1c] text-[#1f1f27]' : 'border-gray-300 bg-white text-gray-900 hover:border-[#f89c1c]'
                          }`}
                        >
                          <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                          <span>{color.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {product?.is_available === 0 && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 border border-red-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold">المنتج غير متوفر حالياً</span>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">الكمية</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-gray-300 transition-all hover:border-[#f89c1c] hover:bg-[#fff7eb]"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="w-16 text-center text-xl font-bold text-gray-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-gray-300 transition-all hover:border-[#f89c1c] hover:bg-[#fff7eb]"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={product?.is_available === 0}
                    className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                      product?.is_available === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#f89c1c] text-[#1f1f27] hover:bg-[#e58f12]'
                    }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  أضف إلى السلة
                </button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 gap-3 pt-4">
                <a
                  href={whatsappLink || '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (!whatsappLink) event.preventDefault();
                  }}
                  className={`flex items-center gap-3 rounded-xl p-4 border transition-colors ${whatsappLink ? 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/40' : 'bg-gray-50 border-gray-200 cursor-default'}`}
                >
                  <div className="p-2 bg-green-50 rounded-lg">
                    <FaWhatsapp className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">تحتاج مساعدة أكثر؟ تواصل معنا</span>
                </a>
              </div>
            </m.div>
          </div>

          {/* Product Details Accordion */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12"
          >
            {/* Description */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => toggleSection('description')}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-lg font-bold text-gray-900">وصف المنتج</h2>
                {expandedSections.description ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
              {expandedSections.description && (
                <div className="px-6 pb-6">
                  <p className="text-gray-700 leading-relaxed">{product.description || 'لا يوجد وصف متاح.'}</p>
                </div>
              )}
            </div>

            {/* Usage */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => toggleSection('usage')}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-lg font-bold text-gray-900">آلية الاستخدام</h2>
                {expandedSections.usage ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
              {expandedSections.usage && (
                <div className="px-6 pb-6">
                  <p className="text-gray-700 leading-relaxed">
                    {product.usage || 'يرجى اتباع تعليمات السلامة والاستخدام الخاصة بالمنتج حسب توصيات الشركة المصنّعة.'}
                  </p>
                </div>
              )}
            </div>

            {/* Technical Data */}
            {product.technical_data && (
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection('technical')}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-lg font-bold text-gray-900">بيانات فنية</h2>
                  {expandedSections.technical ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                {expandedSections.technical && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{product.technical_data}</p>
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {product.warnings && (
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection('warnings')}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-lg font-bold text-gray-900">تحذيرات</h2>
                  {expandedSections.warnings ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                {expandedSections.warnings && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{product.warnings}</p>
                  </div>
                )}
              </div>
            )}

            {/* Shipping */}
            {product.importDetails?.isImported && (
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection('shipping')}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-lg font-bold text-gray-900">تفاصيل الشحن والاستيراد</h2>
                  {expandedSections.shipping ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                {expandedSections.shipping && (
                  <div className="px-6 pb-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Globe className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">مستورد من {product.importDetails.country}</p>
                        {product.importDetails.deliveryNote && (
                          <p className="text-sm text-gray-600 mt-1">{product.importDetails.deliveryNote}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warranty */}
            {product.warranty?.available && (
              <div>
                <button
                  onClick={() => toggleSection('warranty')}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-lg font-bold text-gray-900">معلومات الضمان</h2>
                  {expandedSections.warranty ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                {expandedSections.warranty && (
                  <div className="px-6 pb-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <Award className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">ضمان لمدة {product.warranty.period}</p>
                        <p className="text-sm text-gray-600 mt-1">{product.warranty.details}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </m.div>

          {/* Datasheet & Links */}
          {(docs.length > 0 || product?.links?.length > 0) && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 mb-12">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.28em] text-amber-500">Technical Files</p>
                  <h2 className="text-2xl font-black text-gray-900 mt-2">النشرات والملفات الفنية</h2>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                  <FileText className="w-4 h-4" />
                  فتح مباشر بصيغة PDF
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
                {docs.length > 0 && (
                  <div className="grid justify-items-center gap-4 sm:grid-cols-2 sm:justify-items-stretch xl:grid-cols-3 lg:col-span-1">
                    {docs.map((doc) => (
                      <ProductDocumentCard
                        key={doc.id}
                        doc={doc}
                        onMissingUrl={() => toast.error('تعذر فتح الملف')}
                      />
                    ))}
                  </div>
                )}

                {product?.links?.length > 0 && (
                  <div className="rounded-[1.6rem] border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-5">
                    <div className="flex items-center gap-2 text-gray-900 mb-4">
                      <Globe className="w-5 h-5 text-amber-600" />
                      <h3 className="text-lg font-black">روابط إضافية</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                    {product.links.map((link, i) => {
                      const rawUrl = link.url || '';
                      const safeUrl = rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`;
                      return (
                      <a
                        key={i}
                        href={safeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-700 transition-colors hover:border-amber-300 hover:bg-amber-50"
                      >
                        <span className="min-w-0 break-all font-medium">{link.label || rawUrl}</span>
                        <ExternalLink className="w-4 h-4 shrink-0 text-gray-400 transition-colors group-hover:text-amber-700" />
                      </a>
                    );
                    })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* منتجات مشابهة */}
          {similarProducts.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">قد يعجبك أيضًا</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {similarProducts.map((similarProduct) => (
                  <ProductCard
                    key={similarProduct.id}
                    product={similarProduct}
                    disableAnimation={true}
                    onAddToCart={(product) => {
                      dispatch(addToCart({ productId: product.id, quantity: 1 }));
                       toast.success('تمت إضافة المنتج إلى السلة');
                     }}
                   />
                ))}
              </div>
            </m.div>
          )}
        </div>
      </div>

    </>
  );
}

export default ProductView;
