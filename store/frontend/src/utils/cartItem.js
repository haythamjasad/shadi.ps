export function buildCartItemKey(item) {
  const productId = String(item?.productId || '');
  const variantId = String(item?.selectedVariantId || '').trim();
  const colorName = String(item?.selectedColorName || '').trim().toLowerCase();
  const colorHex = String(item?.selectedColorHex || '').trim().toUpperCase();
  const sizeName = String(item?.selectedSizeName || '').trim().toLowerCase();
  return `${productId}::${variantId}::${colorName}::${colorHex}::${sizeName}`;
}

export function isSameCartItem(left, right) {
  return buildCartItemKey(left) === buildCartItemKey(right);
}
