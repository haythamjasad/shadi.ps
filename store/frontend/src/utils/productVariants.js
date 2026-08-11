export function getProductVariants(product) {
  if (!product) return [];
  const source = Array.isArray(product.variant_options)
    ? product.variant_options
    : Array.isArray(product.color_options)
      ? product.color_options.map((color, index) => ({
        id: `color-${index + 1}`,
        color_name: color.name,
        color_hex: color.hex,
        size_name: '',
        price: null
      }))
      : [];

  return source
    .map((variant, index) => ({
      id: String(variant.id || `variant-${index + 1}`),
      color_name: String(variant.color_name || variant.colorName || variant.name || '').trim(),
      color_hex: String(variant.color_hex || variant.colorHex || variant.hex || '').trim(),
      size_name: String(variant.size_name || variant.sizeName || variant.size || '').trim(),
      price: variant.price === undefined || variant.price === null || variant.price === '' ? null : Number(variant.price),
      image_url: String(variant.image_url || variant.imageUrl || '').trim() || null,
      image_urls: Array.isArray(variant.image_urls || variant.imageUrls)
        ? (variant.image_urls || variant.imageUrls).map((url) => String(url || '').trim()).filter(Boolean)
        : []
    }))
    .filter((variant) => variant.color_name || variant.size_name);
}

export function getVariantPrice(product, selectedVariantId) {
  const variants = getProductVariants(product);
  const selected = variants.find((variant) => String(variant.id) === String(selectedVariantId || ''));
  const variantPrice = Number(selected?.price);
  return Number.isFinite(variantPrice) ? variantPrice : Number(product?.price || 0);
}

export function findCartItemVariant(product, item) {
  const variants = getProductVariants(product);
  if (variants.length === 0) return null;
  return variants.find((variant) => {
    if (item?.selectedVariantId && String(variant.id) === String(item.selectedVariantId)) return true;
    const colorMatches = variant.color_name
      ? String(variant.color_name).toLowerCase() === String(item?.selectedColorName || '').trim().toLowerCase()
      : !String(item?.selectedColorName || '').trim();
    const sizeMatches = variant.size_name
      ? String(variant.size_name).toLowerCase() === String(item?.selectedSizeName || '').trim().toLowerCase()
      : !String(item?.selectedSizeName || '').trim();
    return colorMatches && sizeMatches;
  }) || null;
}

export function getVariantImageUrl(product, selectedVariant) {
  const variantImages = Array.isArray(selectedVariant?.image_urls)
    ? selectedVariant.image_urls.filter(Boolean)
    : [];
  const productImages = Array.isArray(product?.image_urls)
    ? product.image_urls.filter(Boolean)
    : [];

  return selectedVariant?.image_url
    || variantImages[0]
    || product?.image_url
    || productImages[0]
    || product?.image
    || '';
}
