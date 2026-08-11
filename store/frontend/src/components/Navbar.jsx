import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ShoppingBag } from 'lucide-react';

const quickLinks = [
  {
    name: 'الرئيسية',
    href: 'https://shadi.ps',
    label: '/Shadi.png',
    className: 'shadiCloneNavLabelStore',
  },
  {
    name: 'شعرة',
    href: 'https://shara.shadi.ps',
    label: '/shara-nav-label-new.png',
    className: 'shadiCloneNavLabelShara',
  },
  {
    name: 'إستشارة',
    href: 'https://www.shadi.ps/consulting#appointment_form',
    label: '/consulting-nav-label-new.png',
    className: 'shadiCloneNavLabelConsulting',
  },
];

const mobileQuickLinks = [...quickLinks].reverse();
const desktopQuickLinks = [...quickLinks].reverse();

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(false);
  const cartCount = useSelector((state) =>
    state.cart.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
  );

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > 24);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  return (
    <nav
      className={`shadiCloneNavbar${isVisible ? ' isVisible' : ''}`}
      dir="ltr"
      aria-label="روابط شادي السريعة"
    >
      <div className="shadiCloneToolbar">
        <div className="shadiCloneDesktopButtons" aria-label="روابط سريعة">
          {desktopQuickLinks.map((item, index) => (
            <React.Fragment key={item.name}>
              {index > 0 && <span className="shadiCloneDesktopDivider" aria-hidden="true" />}
              <a
                className="shadiCloneDesktopLink"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.name}
              >
                <img className={item.className} src={item.label} alt={item.name} />
              </a>
            </React.Fragment>
          ))}
        </div>

        <Link className="shadiCloneDesktopCart" to="/cart" aria-label="سلة التسوق">
          <ShoppingBag aria-hidden="true" />
          {cartCount > 0 && <span className="shadiCloneCartBadge">{cartCount}</span>}
        </Link>

        <Link className="shadiCloneDesktopLogo" to="/" aria-label="الصفحة الرئيسية">
          <img src="/circle_logo_footer.png" alt="Shadi" />
        </Link>

        <div className="shadiCloneMobileBar">
          <Link className="shadiCloneMobileCart" to="/cart" aria-label="سلة التسوق">
            <ShoppingBag aria-hidden="true" />
            {cartCount > 0 && <span className="shadiCloneCartBadge">{cartCount}</span>}
          </Link>

          <div className="shadiCloneMobileLinks" aria-label="روابط سريعة">
            {mobileQuickLinks.map((item, index) => (
              <React.Fragment key={item.name}>
                {index > 0 && <span className="shadiCloneMobileDivider" aria-hidden="true" />}
                <a
                  className="shadiCloneMobileLink"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.name}
                >
                  <img className={item.className} src={item.label} alt={item.name} />
                </a>
              </React.Fragment>
            ))}
          </div>

          <Link className="shadiCloneMobileLogo" to="/" aria-label="الصفحة الرئيسية">
            <img src="/circle_logo_footer.png" alt="Shadi" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
