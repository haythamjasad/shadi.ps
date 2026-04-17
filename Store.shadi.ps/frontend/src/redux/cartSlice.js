import { createSlice } from '@reduxjs/toolkit';
import { buildCartItemKey, isSameCartItem } from '../utils/cartItem';

/**
 * Initial state for the cart slice.
 * Includes items array and coupon information.
 */
const initialState = {
  items: [], 
  coupon: null,
};

/**
 * Redux slice for managing shopping cart state
 * Handles adding, removing, updating items and applying coupons
 */
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Add an item to the cart or increase its quantity if already present
     * @param {Object} state - Current cart state
     * @param {Object} action - Action with productId and quantity
     */
    addToCart(state, action) {
      const payload = {
        ...action.payload,
        selectedColorName: String(action.payload?.selectedColorName || '').trim(),
        selectedColorHex: String(action.payload?.selectedColorHex || '').trim().toUpperCase()
      };
      const item = state.items.find(i => isSameCartItem(i, payload));
      if (item) {
        item.quantity += payload.quantity;
      } else {
        state.items.push(payload);
      }
    },
    
    /**
     * Remove an item from the cart completely
     * @param {Object} state - Current cart state
     * @param {string} action - Product ID to remove
     */
    removeFromCart(state, action) {
      state.items = state.items.filter(i => buildCartItemKey(i) !== String(action.payload));
    },
    
    /**
     * Update the quantity of an item in the cart
     * @param {Object} state - Current cart state
     * @param {Object} action - Action with productId and new quantity
     */
    updateQuantity(state, action) {
      const item = state.items.find(i => buildCartItemKey(i) === String(action.payload.cartKey));
      if (item) {
        item.quantity = action.payload.quantity;
      }
    },
    
    /**
     * Apply a coupon discount to the cart
     * @param {Object} state - Current cart state
     * @param {Object} action - Action with coupon details
     */
    applyCoupon(state, action) {
      state.coupon = action.payload;
    },
    
    /**
     * Remove any applied coupon from the cart
     * @param {Object} state - Current cart state
     */
    removeCoupon(state) {
      state.coupon = null;
    },
    
    /**
     * Clear all items from the cart and remove any coupon
     * @param {Object} state - Current cart state
     */
    clearCart(state) {
      state.items = [];
      state.coupon = null;
    },

    /**
     * Remove purchased items from the cart after successful order
     * @param {Object} state - Current cart state
     * @param {Object} action - Action with array of purchased product IDs
     */
    removePurchasedFromCart(state, action) {
      // Ensure payload is an array before using includes method
      const productIdsToRemove = Array.isArray(action.payload) ? action.payload : [];
      if (productIdsToRemove.length > 0) {
        state.items = state.items.filter(item => !productIdsToRemove.includes(item.productId));
      }
    },
  },
});

export const { 
  addToCart, 
  removeFromCart, 
  updateQuantity, 
  clearCart,
  applyCoupon,
  removeCoupon,
  removePurchasedFromCart
} = cartSlice.actions;

export default cartSlice.reducer;
