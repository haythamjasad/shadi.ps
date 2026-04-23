import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ShoppingCart, Eye, Star } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import { useStoreSettings } from '../context/StoreSettingsContext';

/**
 * ProductCard Component (guest-ready)
 *
 * - No auth/wishlist
 * - Uses product.rating if present
 */
const ProductCard = memo(function ProductCard({
  product = {},
  disableAnimation = false,
  contentClassName = 'px-3 py-3 sm:p-4',
  onAddToCart = () => {
    console.warn('onAddToCart handler is not provided to ProductCard component');
  }
}) {
  const navigate = useNavigate();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { formatPrice } = useStoreSettings();

  const [ref, inView] = useInView({
    skip: disableAnimation,
    triggerOnce: true,
    threshold: 0.1
  });

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (product?.is_available === 0) {
      toast.warning('هذا المنتج غير متوفر حالياً');
      return;
    }

    if (Array.isArray(product?.color_options) && product.color_options.length > 0) {
      toast.info('اختر اللون من صفحة المنتج أولاً');
      navigate(`/product/${product.id}`);
      return;
    }

    setIsAddingToCart(true);
    try {
      await onAddToCart(product);
      toast.success('تمت إضافة المنتج إلى السلة');
    } catch (error) {
      toast.error(error.message || 'تعذرت إضافة المنتج إلى السلة');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleViewDetails = () => {
    navigate(`/product/${product.id}`);
  };

  const calculateDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice || isNaN(originalPrice) || isNaN(currentPrice)) {
      return 0;
    }
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  };

  const rating = Number(product.rating) || 0;
  const ratingCount = Number(product.ratingCount) || 0;

  return (
    <m.div
      ref={disableAnimation ? undefined : ref}
      initial={disableAnimation ? false : { opacity: 0, y: 20 }}
      animate={disableAnimation ? undefined : (inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 })}
      transition={disableAnimation ? undefined : { duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer group border border-gray-100"
      onClick={handleViewDetails}
    >
      <div className="relative overflow-hidden aspect-square bg-gray-50">
        <img
          src={product?.image_url || (product?.image_urls && product.image_urls[0]) || product?.image}
          alt={product?.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
          <div className="flex flex-col gap-2">
            {product?.mrp && product.mrp > product.price && (
              <div className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                خصم {calculateDiscount(product.mrp, product.price)}%
              </div>
            )}
            {product?.isNew && (
              <div className="bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                جديد
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails();
            }}
            className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            عرض سريع
          </button>
        </div>
      </div>

      <div className={`${contentClassName} flex flex-col gap-2 sm:gap-2 flex-grow`}>
        <div className="flex items-center justify-between">
          {product?.brand && (
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {product.brand}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {product?.is_available === 0 ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-xs text-red-600 font-medium">غير متوفر</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-green-600 font-medium">متوفر</span>
              </>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.5rem]">
          {product?.name}
        </h3>

        {rating > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
              <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
              <span className="text-xs font-semibold text-amber-700">
                {rating.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-gray-500">({ratingCount})</span>
          </div>
        )}

        <div className="mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-base sm:text-lg font-bold text-gray-900">
                {formatPrice(product?.price)}
              </span>
              {product?.mrp && product.mrp > product.price && (
                <span className="text-sm text-gray-400 line-through">
                  {formatPrice(product.mrp)}
                </span>
              )}
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isAddingToCart || product?.is_available === 0}
              className={`px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isAddingToCart || product?.is_available === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#f89c1c] text-[#1f1f27] hover:bg-[#e58f12]'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {isAddingToCart ? 'جارٍ الإضافة...' : 'أضف'}
            </button>
          </div>
        </div>
      </div>
    </m.div>
  );
});

ProductCard.propTypes = {
  product: PropTypes.object,
  disableAnimation: PropTypes.bool,
  contentClassName: PropTypes.string,
  onAddToCart: PropTypes.func
};

export default ProductCard;
