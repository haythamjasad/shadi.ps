export function buildCartItemKey(item) {
  const productId = String(item?.productId || '');
  const colorName = String(item?.selectedColorName || '').trim().toLowerCase();
  const colorHex = String(item?.selectedColorHex || '').trim().toUpperCase();
  return `${productId}::${colorName}::${colorHex}`;
}

export function isSameCartItem(left, right) {
  return buildCartItemKey(left) === buildCartItemKey(right);
}
