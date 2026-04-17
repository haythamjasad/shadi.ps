import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import DynamicBanner from "../components/DynamicBanner";
import { useContentLoader } from "../hooks/useContentLoader";
import { ArrowRight, ShoppingBag } from "lucide-react";

/**
 * Modern Home Page Component
 *
 * Features:
 * - Hero section with dynamic banner
 * - Featured products showcase
 * - Category highlights
 * - Modern, minimalistic design
 * - Smooth animations and transitions
 */
function Home() {
  const [products, setProducts] = useState([]);
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const dispatch = useDispatch();

  const { getCachedData, preloadedData } = useContentLoader();

  useEffect(() => {
    const initializeProducts = async () => {
      try {
        const cachedProducts = getCachedData('products');

        if (cachedProducts && cachedProducts.length > 0) {
          setProducts(cachedProducts);
          return;
        }

        setIsLoadingFresh(true);

        const productList = await api.get('/products?featured=1');
        setProducts((productList || []).filter(p => !p.is_hidden));

      } catch (error) {
        setProducts([]);
      } finally {
        setIsLoadingFresh(false);
      }
    };

    initializeProducts();
  }, [getCachedData]);

  useEffect(() => {
    const preloadedProducts = preloadedData?.products;
    if (preloadedProducts && preloadedProducts.length > 0 && products.length === 0) {
      setProducts(preloadedProducts);
    }
  }, [preloadedData, products.length]);

  const handleAddToCart = useCallback((product) => {
    try {
      dispatch(addToCart({
        productId: product.id,
        quantity: 1
      }));
    } catch {}
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Section with Banner */}
      <m.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative w-full"
      >
        <DynamicBanner />
      </m.section>

      {/* Featured Products Section */}
      <section className="container mx-auto px-4 pt-6 pb-0 sm:py-12">
        <div className="px-7">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mb-8"
          >
            <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl md:text-[28px] font-bold text-gray-900 mb-2">مواد مميزة للمشاريع</h2>
              <Link
                to="/products"
                className="hidden md:flex items-center gap-2 text-gray-900 hover:text-gray-700 font-medium transition-colors group"
              >
                عرض الكل
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <p className="text-gray-600">مختارة لأعمال البناء والسباكة والعزل</p>
            </div>
          </m.div>

          {/* Loading State */}
          {isLoadingFresh && products.length === 0 && (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
                  <div className="w-full h-64 bg-gray-200"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Products Grid */}
          {products.length > 0 && (
            <m.div
              className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  disableAnimation={true}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </m.div>
          )}

          {/* No Products State */}
          {!isLoadingFresh && products.length === 0 && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">لا توجد مواد مميزة بعد</h3>
              <p className="text-gray-600 mb-6">تصفح جميع مواد البناء والسباكة والعزل</p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-lg bg-[#f89c1c] px-6 py-3 text-[#1f1f27] hover:bg-[#e58f12] transition-colors"
              >
                تصفح المنتجات
                <ArrowRight className="w-5 h-5" />
              </Link>
            </m.div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-32 pt-20 sm:pb-40 sm:pt-28">
        <div className="flex justify-center">
          <Link
            to="/products"
            className="cta-button-animated group inline-flex min-w-[240px] sm:min-w-[320px] items-center justify-center gap-3 rounded-2xl bg-[#f89c1c] px-8 py-4 text-lg font-extrabold text-[#1f1f27] shadow-[0_20px_45px_-20px_rgba(248,156,28,0.7)] transition-all duration-300 hover:scale-[1.03] hover:bg-[#e58f12] hover:shadow-[0_28px_60px_-24px_rgba(248,156,28,0.8)] sm:px-12 sm:py-5 sm:text-xl"
          >
            تسوق الآن
            <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* Bottom Spacing */}
    </div>
  );
}

export default Home;
