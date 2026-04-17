import React from 'react';
import { Link } from 'react-router-dom';

function Profile() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">الحساب غير متاح</h1>
        <p className="text-sm text-gray-600 mb-4">
          حسابات العملاء غير مفعلة. يمكنك إتمام الطلب كزائر.
        </p>
        <Link to="/products" className="text-gray-900 font-semibold hover:underline">
          متابعة التسوق
        </Link>
      </div>
    </div>
  );
}

export default Profile;
