import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { api } from '../api/client';
import { removeFromCart, updateQuantity, addToCart } from '../redux/cartSlice';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Loader2 } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { buildCartItemKey } from '../utils/cartItem';

function Cart() {
  const cartItems = useSelector(state => state.cart.items);
  const dispatch = useDispatch();
  const [products, setProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useStoreSettings();
  const cartProductIds = useMemo(
    () => Array.from(new Set(cartItems.map((item) => Number(item.productId)).filter((id) => Number.isInteger(id) && id > 0))),
    [cartItems]
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const [cartProducts, featuredProducts] = await Promise.all([
          cartProductIds.length > 0 ? api.get(`/products?ids=${cartProductIds.join(',')}`) : Promise.resolve([]),
          api.get('/products?featured=1').catch(() => [])
        ]);
        setProducts(cartProducts || []);
        setPopularProducts(featuredProducts || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching products:", error);
        setLoading(false);
      }
    };

    fetchProducts();
  }, [cartProductIds]);

  const handleRemove = (cartKey) => {
    dispatch(removeFromCart(cartKey));
  };

  const handleQuantityChange = (cartKey, quantity) => {
    if (quantity < 1) return;
    dispatch(updateQuantity({ cartKey, quantity }));
  };

  const cartDetails = cartItems.map(item => {
    const product = products.find(p => p.id === item.productId);
    return product ? { ...item, product } : null;
  }).filter(Boolean);

  const subtotal = cartDetails.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const total = subtotal;

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <Loader2 className="w-12 h-12 text-gray-900 animate-spin mb-4" />
        <p className="text-gray-600">جاري تحميل السلة...</p>
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
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">سلة التسوق</h1>
          <p className="text-gray-600">عدد العناصر في السلة: {cartItems.length}</p>
        </m.div>

        {cartItems.length === 0 ? (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
              <ShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">السلة فارغة</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              لم تقم بإضافة أي منتجات بعد. ابدأ التسوق الآن.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#f89c1c] px-8 py-4 font-semibold text-[#1f1f27] hover:bg-[#e58f12] transition-all shadow-lg hover:shadow-xl"
            >
              ابدأ التسوق
              <ArrowRight className="w-5 h-5" />
            </Link>
          </m.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 grid grid-cols-1 gap-4">
              {cartDetails.map((item, index) => {
                const cartKey = buildCartItemKey(item);
                return (
                <m.div
                  key={cartKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-row gap-4 sm:gap-6 items-start">
                    {/* Product Image */}
                    <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
                        <img
                          src={item.product.image_url || (item.product.image_urls && item.product.image_urls[0]) || item.product.image}
                          alt={item.product.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                            {item.product.name}
                          </h3>
                          {item.selectedColorName && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                              <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: item.selectedColorHex || '#ccc' }} />
                              <span>{item.selectedColorName}</span>
                            </div>
                          )}
                          {item.product.brand && (
                            <p className="text-sm text-gray-500">{item.product.brand}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemove(cartKey)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="إزالة"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-3 sm:gap-4">
                        {/* Price */}
                        <div className="text-base sm:text-lg font-bold text-gray-900">
                          {formatPrice(item.product.price)}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 font-medium">الكمية:</span>
                          <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => handleQuantityChange(cartKey, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="p-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="px-4 py-2 min-w-[3rem] text-center font-semibold border-x-2 border-gray-200">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(cartKey, item.quantity + 1)}
                              className="p-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="text-right">
                          <div className="text-sm text-gray-500 mb-1">المجموع الفرعي</div>
                          <div className="text-lg sm:text-xl font-bold text-gray-900">
                            {formatPrice(item.product.price * item.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </m.div>
              )})}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <m.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-4"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6">ملخص الطلب</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>المجموع الفرعي</span>
                    <span className="font-semibold">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-lg font-semibold text-gray-900">الإجمالي</span>
                      <span className="text-2xl font-bold text-gray-900">{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>

                <Link
                  to="/checkout"
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f89c1c] px-6 py-4 font-bold text-[#1f1f27] hover:bg-[#e58f12] transition-all shadow-lg hover:shadow-xl"
                >
                  المتابعة إلى الدفع
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <Link
                  to="/products"
                  className="w-full border-2 border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  متابعة التسوق
                </Link>

                {/* Features */}
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    <span>دفع آمن ومضمون</span>
                  </div>
                </div>
              </m.div>
            </div>
          </div>
        )}

        {/* منتجات مقترحة */}
        {popularProducts.length > 0 && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-6">قد يعجبك أيضًا</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {popularProducts.slice(0, 4).map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  disableAnimation={true}
                  onAddToCart={(product) => {
                    dispatch(addToCart({ productId: product.id, quantity: 1 }));
                  }}
                />
              ))}
            </div>
          </m.div>
        )}
      </div>
    </div>
  );
}

export default Cart;
