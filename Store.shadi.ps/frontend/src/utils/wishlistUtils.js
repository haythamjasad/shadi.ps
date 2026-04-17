const wishlistUtils = {
  async getUserWishlist() {
    return [];
  },
  async isProductInWishlist() {
    return false;
  },
  async addToWishlist() {
    throw new Error('Wishlist is disabled');
  },
  async removeFromWishlist() {
    throw new Error('Wishlist is disabled');
  }
};

export default wishlistUtils;
