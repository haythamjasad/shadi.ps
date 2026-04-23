import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  TagIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  const cartItems = useSelector(state => state.cart.items);
  const cartItemCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const mainNavItems = [
    { name: 'الرئيسية', href: '/', icon: HomeIcon },
    { name: 'المنتجات', href: '/products', icon: TagIcon }
  ];

  const bottomNavItems = [
    { name: 'الرئيسية', href: '/', icon: HomeIcon },
    { name: 'المنتجات', href: '/products', icon: TagIcon },
    { name: 'السلة', href: '/cart', icon: ShoppingBagIcon, count: cartItemCount }
  ];

  useEffect(() => {
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 20);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`
          fixed top-0 left-0 right-0 z-50
          transition-all duration-300 backdrop-blur-md
          hidden md:block
          ${isScrolled ? 'bg-white/95 shadow-lg' : 'bg-white/50'}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <img
                  className="h-16 w-auto"
                  src="/logo.png"
                  alt="Shadi Store"
                />
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              {mainNavItems.map((item) => (
                <div key={item.name} className="relative">
                  <Link
                    to={item.href}
                    className={classNames(
                      location.pathname === item.href
                        ? 'text-blue-600'
                        : 'text-gray-700 hover:text-blue-600',
                      'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200'
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-1.5" />
                    {item.name}
                    {location.pathname === item.href && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </Link>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-6">
              <div className="relative">
                <Link
                  to="/cart"
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <ShoppingBagIcon className="h-6 w-6" />
                  {cartItemCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {cartItemCount}
                    </div>
                  )}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <div className="grid grid-cols-3 gap-1">
          {bottomNavItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={classNames(
                location.pathname === item.href ? 'text-blue-600' : 'text-gray-600',
                'flex flex-col items-center justify-center py-2 text-xs font-medium'
              )}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" />
                {item.count > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {item.count}
                  </span>
                )}
              </div>
              {item.name}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
