import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import cartReducer from './cartSlice';
import orderReducer from './orderSlice';
import wishlistReducer from './wishlistSlice';

const CART_STORAGE_KEY = 'shadi_store_cart';

const loadCartState = () => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const saveCartState = (state) => {
  try {
    const payload = JSON.stringify(state);
    localStorage.setItem(CART_STORAGE_KEY, payload);
  } catch {
    // ignore storage errors
  }
};

const preloadedCart = loadCartState();

const store = configureStore({
  reducer: {
    user: userReducer,
    cart: cartReducer,
    orders: orderReducer,
    wishlist: wishlistReducer,
  },
  preloadedState: preloadedCart ? { cart: preloadedCart } : undefined,
});

store.subscribe(() => {
  const state = store.getState();
  saveCartState(state.cart);
});

export default store;
