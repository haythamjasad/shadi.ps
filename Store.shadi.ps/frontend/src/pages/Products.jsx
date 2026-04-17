import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Search, X, SlidersHorizontal, Loader2 } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import { useStoreSettings } from '../context/StoreSettingsContext';

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
function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCounts, setVisibleCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    priceRange: { min: "", max: "" },
    categories: [],
    warranty: false,
    guarantee: false,
    inStock: false
  });
  const [activeThumb, setActiveThumb] = useState('min');

  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoryProductOrderMap, setCategoryProductOrderMap] = useState({});
  const { formatPrice, currencySymbol } = useStoreSettings();

  const dispatch = useDispatch();
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        sessionStorage.removeItem('products_cache');
        sessionStorage.removeItem('products_fetch_time');
        console.log("Fetching fresh products data...");
        const [productsArray, categoriesList] = await Promise.all([
          api.get('/products'),
          api.get('/settings/categories').catch(() => [])
        ]);
        setProducts((productsArray || []).filter(p => !p.is_hidden));
        setAvailableCategories((categoriesList || []).map((item) => String(item?.name || '').trim()).filter(Boolean));
        setCategoryProductOrderMap((categoriesList || []).reduce((acc, item) => {
          const name = String(item?.name || '').trim();
          if (!name) return acc;
          acc[name] = Array.isArray(item?.product_order_ids)
            ? item.product_order_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
            : [];
          return acc;
        }, {}));
        console.log(`Successfully fetched ${productsArray.length} products`);

      } catch (error) {
        console.error("Error fetching products:", error);

        const cachedProducts = sessionStorage.getItem('products_cache');
        if (cachedProducts) {
          console.log("Using cached products as fallback after fetch error");
          setProducts(JSON.parse(cachedProducts));
        } else {
          console.log("No cache available for fallback, showing empty products list");
          setProducts([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      // Cleanup if needed
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
      guarantee: false,
      inStock: false
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
    categories.forEach((c) => {
      if (!unique.includes(c)) unique.push(c);
    });
    return unique.length > 0 ? unique : ["السباكة", "الإنشاءات", "العزل"];
  }, [products, getProductCategories, availableCategories]);

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
        if (filters.inStock && product.stock <= 0) return false;

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

  const handleLoadMore = useCallback((category) => {
    setVisibleCounts((prevCounts) => ({
      ...prevCounts,
      [category]: (prevCounts[category] || 12) + 12,
    }));
  }, []);

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
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <Loader2 className="w-12 h-12 text-gray-900 animate-spin mb-4" />
        <p className="text-gray-600">جاري تحميل المنتجات...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <m.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">مواد البناء والسباكة والعزل</h1>
          <p className="text-gray-600">كل ما تحتاجه لمشاريع المنزل والإنشاءات</p>
        </m.div>

        {/* Search and Filter Bar */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8"
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-grow relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ابحث عن منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-gray-900 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#f89c1c] focus:border-transparent transition-all"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">الفئات</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                      {categoriesOrder.map((category) => (
                        <label key={category} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
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
                          <span className="text-sm text-gray-700">{category}</span>
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
          {categorizedProducts.map(({ category, items }, index) => {
            const visibleItems = items.slice(0, visibleCounts[category] || 12);

            if (items.length === 0) return null;

            return (
              <m.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-gradient-to-r from-[#f89c1c] to-[#e58f12] px-6 py-4">
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
                  </div>

                  {/* Load More Button */}
                  {items.length > 12 && !(visibleCounts[category] >= items.length) && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() => handleLoadMore(category)}
                        className="rounded-lg bg-[#f89c1c] px-6 py-3 font-medium text-[#1f1f27] hover:bg-[#e58f12] transition-colors"
                      >
                        Load More
                      </button>
                    </div>
                  )}
                </div>
              </m.div>
            );
          })}
        </div>

        {/* No Results */}
        {products.length === 0 && (
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
