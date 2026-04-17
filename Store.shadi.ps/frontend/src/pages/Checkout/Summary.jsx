import React from 'react';
import { useSelector } from 'react-redux';

function Summary() {
  const cartItems = useSelector(state => state.cart.items);

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-2">ملخص الطلب</h3>
        <p className="text-sm text-gray-500">السلة فارغة.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4">ملخص الطلب</h3>
      <div className="space-y-3">
        {cartItems.map(item => (
          <div key={item.productId} className="flex justify-between text-sm">
            <span>منتج رقم {item.productId} × {item.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Summary;
