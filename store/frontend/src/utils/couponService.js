const CouponService = {
  async validateCoupon() {
    return { valid: false, message: 'Coupons are disabled' };
  }
};

export default CouponService;
