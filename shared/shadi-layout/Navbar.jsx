import React, { useEffect, useMemo, useState } from "react";
import "./shadi-layout.css";

const DEFAULT_ASSETS = {
  logo: "/circle_logo_footer.png",
  sharaLabel: "/shara-nav-label-new.png",
  storeLabel: "/store-nav-label-new.png",
  consultingLabel: "/consulting-nav-label-new.png",
};

const DEFAULT_LINKS = {
  home: "/#home_top_section",
  shara: "https://shara.shadi.ps",
  store: "https://store.shadi.ps",
  consulting: "https://www.shadi.ps/consulting#appointment_form",
};

const DEFAULT_SECTION_LINKS = [
  { label: "الشركة", href: "/#about_us" },
  { label: "المؤسس", href: "/#founder_profile" },
  { label: "الخدمات", href: "/#our_services" },
];

function MenuIcon({ open = false }) {
  return (
    <span className={`ss-menu-icon${open ? " ss-menu-icon--open" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function isExternalHref(href) {
  return /^https?:\/\//i.test(href);
}

function goToHash(href, onDone) {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return false;

  const targetPath = href.slice(0, hashIndex) || window.location.pathname;
  const hash = href.slice(hashIndex + 1);
  const currentPath = window.location.pathname;

  if (targetPath && targetPath !== "/" && targetPath !== currentPath) return false;

  const element = document.getElementById(hash);
  if (!element) return false;

  window.history.pushState(null, "", `#${hash}`);
  const offset = window.innerWidth >= 768 ? 100 : 76;
  window.scrollTo({ top: element.offsetTop - offset, behavior: "smooth" });
  onDone?.();
  return true;
}

function NavImageButton({ href, src, alt, onClick, className = "" }) {
  const external = isExternalHref(href || "");

  const handleClick = (event) => {
    if (onClick) {
      onClick(event);
      return;
    }
    if (!external && href && goToHash(href)) event.preventDefault();
  };

  return (
    <a
      className={`ss-nav-image-button ${className}`}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onClick={handleClick}
    >
      <img src={src} alt={alt} />
    </a>
  );
}

export default function Navbar({
  assets = {},
  links = {},
  sectionLinks = DEFAULT_SECTION_LINKS,
  className = "",
}) {
  const mergedAssets = { ...DEFAULT_ASSETS, ...assets };
  const mergedLinks = { ...DEFAULT_LINKS, ...links };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const desktopActions = useMemo(
    () => [
      { key: "consulting", href: mergedLinks.consulting, src: mergedAssets.consultingLabel, alt: "إستشارة" },
      { key: "store", href: mergedLinks.store, src: mergedAssets.storeLabel, alt: "المتجر" },
      { key: "shara", href: mergedLinks.shara, src: mergedAssets.sharaLabel, alt: "شعرة" },
    ],
    [mergedAssets.consultingLabel, mergedAssets.sharaLabel, mergedAssets.storeLabel, mergedLinks.consulting, mergedLinks.shara, mergedLinks.store],
  );

  const mobileActions = useMemo(
    () => [
      { key: "shara", href: mergedLinks.shara, src: mergedAssets.sharaLabel, alt: "شعرة" },
      { key: "store", href: mergedLinks.store, src: mergedAssets.storeLabel, alt: "المتجر" },
      { key: "consulting", href: mergedLinks.consulting, src: mergedAssets.consultingLabel, alt: "إستشارة" },
    ],
    [mergedAssets.consultingLabel, mergedAssets.sharaLabel, mergedAssets.storeLabel, mergedLinks.consulting, mergedLinks.shara, mergedLinks.store],
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const closeDrawer = () => setDrawerOpen(false);

  const handleHashLink = (href) => (event) => {
    if (goToHash(href, closeDrawer)) event.preventDefault();
  };

  return (
    <header className={`ss-navbar ${scrolled ? "ss-navbar--scrolled" : ""} ${className}`} dir="ltr">
      <div className="ss-navbar-shell">
        <nav className="ss-navbar-pill" aria-label="Main navigation">
          <div className="ss-desktop-actions">
            {desktopActions.map((action) => (
              <NavImageButton key={action.key} {...action} />
            ))}
          </div>

          <a className="ss-navbar-logo" href={mergedLinks.home} onClick={handleHashLink(mergedLinks.home)} aria-label="Shadi Shirri home">
            <img src={mergedAssets.logo} alt="Shadi Shirri" />
          </a>

          <div className="ss-mobile-row">
            <a className="ss-mobile-logo" href={mergedLinks.home} onClick={handleHashLink(mergedLinks.home)} aria-label="Shadi Shirri home">
              <img src={mergedAssets.logo} alt="Shadi Shirri" />
            </a>

            <div className="ss-mobile-actions" aria-label="Quick links">
              {mobileActions.map((action, index) => (
                <React.Fragment key={action.key}>
                  <NavImageButton {...action} className="ss-nav-image-button--mobile" />
                  {index < mobileActions.length - 1 && <span className="ss-mobile-divider" />}
                </React.Fragment>
              ))}
            </div>

            <button className="ss-menu-button" type="button" aria-label="Open menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </button>
          </div>
        </nav>
      </div>

      <div className={`ss-drawer-backdrop${drawerOpen ? " ss-drawer-backdrop--open" : ""}`} onClick={closeDrawer} />
      <aside className={`ss-mobile-drawer${drawerOpen ? " ss-mobile-drawer--open" : ""}`} aria-hidden={!drawerOpen} dir="rtl">
        <div className="ss-drawer-header">
          <a className="ss-drawer-logo" href={mergedLinks.home} onClick={handleHashLink(mergedLinks.home)} aria-label="Shadi Shirri home">
            <img src={mergedAssets.logo} alt="Shadi Shirri" />
          </a>
          <button className="ss-menu-button ss-menu-button--drawer" type="button" aria-label="Close menu" onClick={closeDrawer}>
            <MenuIcon open />
          </button>
        </div>

        <div className="ss-drawer-image-links">
          {mobileActions.map((action) => (
            <NavImageButton key={action.key} {...action} onClick={() => setTimeout(closeDrawer, 80)} />
          ))}
        </div>

        <div className="ss-drawer-separator" />

        <div className="ss-drawer-section-links">
          {sectionLinks.map((item) => (
            <a key={item.href} href={item.href} onClick={handleHashLink(item.href)}>
              {item.label}
            </a>
          ))}
        </div>
      </aside>
    </header>
  );
}
