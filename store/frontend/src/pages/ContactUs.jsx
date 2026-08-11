import React from 'react';

function ContactUs() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">تواصل معنا</h1>
        <p className="text-gray-700 mb-6">يسعدنا تواصلكم معنا لأي استفسار.</p>
        <div className="space-y-2 text-gray-700">
          <div>الهاتف: 0590000000</div>
          <div>البريد الإلكتروني: info@example.com</div>
          <div>العنوان: فلسطين</div>
        </div>
      </div>
    </div>
  );
}

export default ContactUs;
