import React, { useMemo, useState } from 'react';
import { Bell, X } from 'react-feather';

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'support',
    text: 'بحاجة للمساعدة؟ تواصل معنا للطلبات الخاصة والدعم.',
    link: '/contact',
    backgroundColor: '#F1F8E9',
    textColor: '#2E7D32'
  }
];

/**
 * Announcement Strip Component
 *
 * Static announcements (Firebase removed).
 */
const AnnouncementStrip = () => {
  const announcements = useMemo(() => DEFAULT_ANNOUNCEMENTS, []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    const saved = localStorage.getItem('dismissedAnnouncements');
    return saved ? JSON.parse(saved) : [];
  });

  const activeAnnouncements = announcements.filter(a => !dismissed.includes(a.id));
  if (activeAnnouncements.length === 0) return null;

  const current = activeAnnouncements[currentIndex % activeAnnouncements.length];

  const handleDismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(next));
    if (activeAnnouncements.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length);
    }
  };

  return (
    <div
      className="hidden md:block w-full py-2 px-3 md:px-4 shadow-sm"
      style={{ backgroundColor: current.backgroundColor, color: current.textColor }}
    >
      <div className="container mx-auto flex items-center justify-center relative">
        <div className="flex items-center gap-2">
          <Bell size={16} />
          {current.link ? (
            <a href={current.link} className="font-medium hover:underline">
              {current.text}
            </a>
          ) : (
            <span className="font-medium">{current.text}</span>
          )}
        </div>
        <button
          onClick={() => handleDismiss(current.id)}
          className="absolute right-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss announcement"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementStrip;
