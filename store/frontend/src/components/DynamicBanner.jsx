import React, { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { api, PUBLIC_BASE } from '../api/client';

const FALLBACK_BANNER = `${process.env.PUBLIC_URL || ''}/shara.jpeg`;

function resolveBannerUrl(url) {
  const value = String(url || '').trim();
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${PUBLIC_BASE}${value.startsWith('/') ? '' : '/'}${value}`;
}

const DynamicBanner = () => {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.get('/settings/banner');
        if (!mounted) return;
        setImageUrl(resolveBannerUrl(data?.image_url) || FALLBACK_BANNER);
      } catch {
        if (!mounted) return;
        setImageUrl(FALLBACK_BANNER);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (!imageUrl) return null;

  return (
    <m.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full mb-0 rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white md:mb-6"
    >
      <m.img
        src={imageUrl}
        alt="بانر الموقع"
        className="w-full h-auto object-contain"
        onError={() => setImageUrl((currentUrl) => (
          currentUrl && currentUrl !== FALLBACK_BANNER ? FALLBACK_BANNER : ''
        ))}
      />
    </m.section>
  );
};

export default DynamicBanner;
