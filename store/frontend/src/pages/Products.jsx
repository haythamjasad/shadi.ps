import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Plus, Search, X, SlidersHorizontal, Loader2 } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import { useStoreSettings } from '../context/StoreSettingsContext';

const CATEGORY_PREVIEW_LIMIT = 14;
const MOBILE_CATEGORY_PREVIEW_LIMIT = 15;
const PRODUCTS_CACHE_KEY = 'store_products_catalog_cache_v3';
const PRODUCTS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function readProductsCache() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(PRODUCTS_CACHE_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.products)) return null;
    if (Date.now() - Number(parsed.fetchedAt || 0) > PRODUCTS_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProductsCache(payload) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({
      ...payload,
      fetchedAt: Date.now()
    }));
  } catch {
    // Storage can be unavailable in private mode; the catalog still works without it.
  }
}

/**
 * Modern Products Page
 *
 * Features:
 * - Advanced search and filtering
 * - Organized by categories
 * - Modern, minimalistic design
 * - Smooth animations
 * - Responsive grid layout
 */
function Products({ embedded = false, showHeader = true }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  const [filters, setFilters] = useState({
    priceRange: { min: "", max: "" },
    categories: [],
    warranty: false,
    guarantee: false
  });
  const [activeThumb, setActiveThumb] = useState('min');

  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoryProductOrderMap, setCategoryProductOrderMap] = useState({});
  const { formatPrice, currencySymbol } = useStoreSettings();

  const dispatch = useDispatch();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updatePreviewMode = () => setIsMobilePreview(mediaQuery.matches);

    updatePreviewMode();
    mediaQuery.addEventListener('change', updatePreviewMode);
    return () => mediaQuery.removeEventListener('change', updatePreviewMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyCategories = (categoriesList = [], ok = true) => {
      setCategoriesLoaded(ok);
      setAvailableCategories((categoriesList || []).map((item) => String(item?.name || '').trim()).filter(Boolean));
      setCategoryProductOrderMap((categoriesList || []).reduce((acc, item) => {
        const name = String(item?.name || '').trim();
        if (!name) return acc;
        acc[name] = Array.isArray(item?.product_order_ids)
          ? item.product_order_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
          : [];
        return acc;
      }, {}));
    };

    const fetchProducts = async () => {
      const cached = readProductsCache();
      if (cached) {
        setProducts((cached.products || []).filter(p => !p.is_hidden));
        applyCategories(cached.categories || [], cached.categoriesLoaded !== false);
        setLoading(false);
      }

      try {
        const [productsArray, categoriesResult] = await Promise.all([
          api.get('/products?summary=1'),
          api.get('/settings/categories')
            .then((data) => ({ ok: true, data: Array.isArray(data) ? data : [] }))
            .catch(() => ({ ok: false, data: [] }))
        ]);
        if (cancelled) return;
        const categoriesList = categoriesResult.data;
        setProducts((productsArray || []).filter(p => !p.is_hidden));
        applyCategories(categoriesList, categoriesResult.ok);
        setLoading(false);
        writeProductsCache({
          products: productsArray || [],
          categories: categoriesList || [],
          categoriesLoaded: categoriesResult.ok
        });
      } catch (error) {
        console.error("Error fetching products:", error);

        if (!cached) {
          setProducts([]);
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const priceBounds = useMemo(() => {
    const prices = products.map(p => Number(p.price)).filter(v => !Number.isNaN(v));
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      priceRange: { min: "", max: "" },
      categories: [],
      warranty: false,
      guarantee: false
    });
  };

  const getProductCategories = useCallback((product) => {
    if (Array.isArray(product?.categories) && product.categories.length) return product.categories.filter(Boolean);
    return product?.category ? [product.category] : [];
  }, []);

  const categoriesOrder = useMemo(() => {
    const categories = products.flatMap((product) => getProductCategories(product));
    const unique = [];
    availableCategories.forEach((c) => {
      if (c && !unique.includes(c)) unique.push(c);
    });

    if (categoriesLoaded) return unique;

    categories.forEach((c) => {
      if (!unique.includes(c)) unique.push(c);
    });
    return unique;
  }, [products, getProductCategories, availableCategories, categoriesLoaded]);

  const categorizedProducts = useMemo(() => {
    const processedProducts = products.map(product => ({
      ...product,
      price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
      originalPrice: product.originalPrice ?
        (typeof product.originalPrice === 'string' ? parseFloat(product.originalPrice) : product.originalPrice)
        : null,
      stock: typeof product.stock === 'string' ? parseInt(product.stock, 10) : product.stock,
    }));

    const defaultIndexById = new Map();
    processedProducts.forEach((product, index) => {
      defaultIndexById.set(product.id, index);
    });

    return categoriesOrder.map((category) => ({
      category,
      items: (() => {
        const orderedIds = categoryProductOrderMap[category] || [];
        const sortIndex = new Map(orderedIds.map((id, index) => [Number(id), index]));

        return processedProducts.filter((product) => {
        if (!getProductCategories(product).includes(category)) return false;

        if (filters.priceRange.min !== "" && product.price < Number(filters.priceRange.min)) return false;
        if (filters.priceRange.max !== "" && product.price > Number(filters.priceRange.max)) return false;

        if (filters.categories.length > 0) {
          const productCategories = getProductCategories(product);
          if (!filters.categories.some((category) => productCategories.includes(category))) return false;
        }

        if (filters.warranty && !product.warranty?.available) return false;
        if (filters.guarantee && !product.guarantee?.available) return false;
        if (searchTerm === "") return true;

        const term = searchTerm.toLowerCase();

        if (product.name?.toLowerCase().includes(term)) return true;
        if (product.description?.toLowerCase().includes(term)) return true;
        if (product.brand?.toLowerCase().includes(term)) return true;
        if (product.slug?.toLowerCase().includes(term)) return true;
        if (product.origin?.toLowerCase().includes(term)) return true;
        if (product.additionalInfo?.toLowerCase().includes(term)) return true;
        if (product.tags?.some(tag => tag.toLowerCase().includes(term))) return true;

        if (product.warranty?.available) {
          if (product.warranty.details?.toLowerCase().includes(term)) return true;
          if (product.warranty.period?.toLowerCase().includes(term)) return true;
        }

        if (product.guarantee?.available) {
          if (product.guarantee.details?.toLowerCase().includes(term)) return true;
          if (product.guarantee.period?.toLowerCase().includes(term)) return true;
        }

        if (product.importDetails?.isImported) {
          if (product.importDetails.country?.toLowerCase().includes(term)) return true;
          if (product.importDetails.deliveryNote?.toLowerCase().includes(term)) return true;
        }

        return false;
        }).sort((left, right) => {
          const leftOrder = sortIndex.has(Number(left.id)) ? sortIndex.get(Number(left.id)) : Number.MAX_SAFE_INTEGER;
          const rightOrder = sortIndex.has(Number(right.id)) ? sortIndex.get(Number(right.id)) : Number.MAX_SAFE_INTEGER;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return (defaultIndexById.get(left.id) || 0) - (defaultIndexById.get(right.id) || 0);
        });
      })(),
    }));
  }, [products, searchTerm, categoriesOrder, filters, getProductCategories, categoryProductOrderMap]);

  const visibleCategorizedProducts = useMemo(() => {
    return categorizedProducts.filter(({ items }) => items.length > 0);
  }, [categorizedProducts]);

  const handleAddToCart = useCallback((product) => {
    dispatch(addToCart({
      productId: product.id,
      quantity: 1
    }));
  }, [dispatch]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).reduce((count, value) => {
      if (typeof value === 'object') {
        return count + Object.values(value).filter(v => v !== "" && v !== false).length;
      }
      return count + (value !== "" && value !== false && value.length > 0 ? 1 : 0);
    }, 0);
  }, [filters]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[320px] bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <Loader2 className="w-12 h-12 text-gray-900 animate-spin mb-4" />
        <p className="text-gray-600">جاري تحميل المنتجات...</p>
      </div>
    );
  }

  return (
    <div className={embedded ? "bg-gradient-to-br from-gray-50 via-white to-gray-50" : "min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50"}>
      <div className={embedded ? "mx-auto w-full max-w-[1600px] px-4 pb-12 pt-2 sm:px-6 md:pt-8 lg:px-8" : "mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8"}>
        {/* Search and Filter Bar */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className={`${showMobileSearch ? 'block' : 'hidden'} mb-3 md:mb-8 md:block`}
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
            <div className="flex flex-col gap-4 md:flex-row">
              {/* Search */}
              <div className="flex-grow relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ابحث عن منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-gray-900 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#f89c1c] focus:border-transparent transition-all md:py-3"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 font-medium transition-all md:py-3 ${
                  showFilters
                    ? 'bg-[#f89c1c] text-[#1f1f27] shadow-lg'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span className="hidden sm:inline">التصفية</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filters).map(([key, value]) => {
                    if (key === 'priceRange' && (value.min || value.max)) {
                      return (
                        <div key={key} className="flex items-center gap-2 bg-gray-100 text-gray-900 px-3 py-1.5 rounded-lg text-sm">
                          <span>السعر: {value.min ? `${currencySymbol}${value.min}` : 'الحد الأدنى'} - {value.max ? `${currencySymbol}${value.max}` : 'الحد الأقصى'}</span>
                          <button
                            onClick={() => handleFilterChange('priceRange', { min: "", max: "" })}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }
                    if (Array.isArray(value) && value.length > 0) {
                      return value.map(item => (
                        <div key={`${key}-${item}`} className="flex items-center gap-2 bg-gray-100 text-gray-900 px-3 py-1.5 rounded-lg text-sm">
                          <span>{'الفئة'}: {item}</span>
                          <button
                            onClick={() => handleFilterChange(key, value.filter(v => v !== item))}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ));
                    }
                    if (typeof value === 'boolean' && value) {
                      return (
                        <div key={key} className="flex items-center gap-2 bg-gray-100 text-gray-900 px-3 py-1.5 rounded-lg text-sm">
                          <span>{key === 'warranty' ? 'مع ضمان' : key === 'guarantee' ? 'مع كفالة' : 'متوفر'}</span>
                          <button
                            onClick={() => handleFilterChange(key, false)}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })}
                  <button
                    onClick={resetFilters}
                    className="text-sm text-gray-600 hover:text-gray-900 underline font-medium"
                  >
                    مسح الكل
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Price Range */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">نطاق السعر</label>
                    {(() => {
                      const minVal = filters.priceRange.min !== '' ? Number(filters.priceRange.min) : priceBounds.min;
                      const maxVal = filters.priceRange.max !== '' ? Number(filters.priceRange.max) : priceBounds.max;
                      const range = Math.max(priceBounds.max - priceBounds.min, 1);
                      const minPos = ((minVal - priceBounds.min) / range) * 100;
                      const maxPos = ((maxVal - priceBounds.min) / range) * 100;
                      const span = Math.max(maxPos - minPos, 0);
                      const rtlLeft = 100 - maxPos;
                      const minZ = activeThumb === 'min' || minVal >= maxVal - 1 ? 4 : 2;
                      const maxZ = activeThumb === 'max' ? 5 : 3;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>{formatPrice(minVal)}</span>
                            <span>{formatPrice(maxVal)}</span>
                          </div>
                          <div className="relative h-10">
                            <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 rounded-full bg-gray-200" />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-[#f89c1c]"
                              style={{ left: `${rtlLeft}%`, width: `${span}%` }}
                            />
                            <input
                              type="range"
                              min={priceBounds.min}
                              max={priceBounds.max}
                              value={minVal}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                handleFilterChange('priceRange', { ...filters.priceRange, min: Math.min(val, maxVal) });
                              }}
                              onMouseDown={() => setActiveThumb('min')}
                              onTouchStart={() => setActiveThumb('min')}
                              className="range-input absolute inset-0 w-full h-10 cursor-pointer"
                              style={{ zIndex: minZ }}
                            />
                            <input
                              type="range"
                              min={priceBounds.min}
                              max={priceBounds.max}
                              value={maxVal}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                handleFilterChange('priceRange', { ...filters.priceRange, max: Math.max(val, minVal) });
                              }}
                              onMouseDown={() => setActiveThumb('max')}
                              onTouchStart={() => setActiveThumb('max')}
                              className="range-input absolute inset-0 w-full h-10 cursor-pointer"
                              style={{ zIndex: maxZ }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Categories */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">الفئات</label>
                    <div className="flex flex-wrap items-center gap-3">
                      {categoriesOrder.map((category) => (
                        <label key={category} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={filters.categories.includes(category)}
                            onChange={(e) => {
                              const nextCategories = e.target.checked
                                ? [...filters.categories, category]
                                : filters.categories.filter((item) => item !== category);
                              handleFilterChange('categories', nextCategories);
                            }}
                            className="rounded text-[#c97800] focus:ring-[#f89c1c]"
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              </m.div>
            )}
          </AnimatePresence>
        </m.div>

        {/* Product Categories */}
        <div className="space-y-8">
          {visibleCategorizedProducts.map(({ category, items }, index) => {
            const isExpanded = Boolean(expandedCategories[category]);
            const previewLimit = isMobilePreview ? MOBILE_CATEGORY_PREVIEW_LIMIT : CATEGORY_PREVIEW_LIMIT;
            const visibleItems = isExpanded ? items : items.slice(0, previewLimit);
            const remainingItems = Math.max(items.length - previewLimit, 0);
            return (
              <m.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Category Header */}
                <div className="relative bg-gradient-to-r from-[#f89c1c] to-[#e58f12] px-6 py-4">
                  {index === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMobileSearch((value) => !value)}
                      className="absolute left-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center text-[#1f1f27] transition-colors hover:text-black md:hidden"
                      aria-label={showMobileSearch ? "إخفاء البحث" : "فتح البحث"}
                      aria-expanded={showMobileSearch}
                    >
                      <m.span
                        className="flex items-center justify-center"
                        whileHover={{ scale: 1.12, rotate: -6 }}
                        whileTap={{ scale: 0.88, rotate: 8 }}
                        animate={{ scale: showMobileSearch ? 1.12 : 1, rotate: showMobileSearch ? -8 : 0 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      >
                        <Search className="h-7 w-7" />
                      </m.span>
                    </button>
                  )}
                  <h2 className="text-xl font-semibold text-[#262231]">{category}</h2>
                  <p className="mt-1 text-sm text-[#262231]">{items.length} عنصر</p>
                </div>

                {/* Products Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                    {visibleItems.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        disableAnimation={true}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                    {!isExpanded && remainingItems > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedCategories((prev) => ({ ...prev, [category]: true }))}
                        className="group flex h-full min-h-[17rem] cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-right shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#f89c1c]/60 hover:shadow-xl"
                        aria-label={`عرض المزيد من ${category}`}
                      >
                        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7]">
                          <span className="absolute inset-6 rounded-full bg-[#f89c1c]/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f89c1c] text-[#1f1f27] shadow-[0_14px_30px_rgba(248,156,28,0.28)] transition-transform duration-300 group-hover:scale-110">
                            <Plus className="h-8 w-8" />
                          </span>
                        </div>

                        <div className="flex flex-grow flex-col gap-2 px-3 py-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">المزيد</span>
                            <span className="rounded-full bg-[#f89c1c]/15 px-2 py-1 text-xs font-black text-[#1f1f27]">+{remainingItems}</span>
                          </div>

                          <h3 className="min-h-[2rem] text-sm font-semibold leading-snug text-gray-900 sm:min-h-[2.5rem]">
                            اعرض المزيد من {category}
                          </h3>

                          <div className="mt-auto flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">{remainingItems} منتجات</span>
                            <span className="rounded-lg bg-[#f89c1c] px-3 py-1.5 text-xs font-semibold text-[#1f1f27] transition-colors group-hover:bg-[#e58f12]">
                              عرض
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </m.div>
            );
          })}
        </div>

        {/* No Results */}
        {visibleCategorizedProducts.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">لا توجد منتجات</h3>
            <p className="text-gray-600">جرّب تعديل البحث أو الفلاتر</p>
          </div>
        )}
      </div>

      {/* Bottom Spacing */}
    </div>
  );
}

export default Products;
