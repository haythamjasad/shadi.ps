(function () {
  function initShadiCloneNav() {
    var navbar = document.querySelector(".shadiCloneNavbar");
    var drawer = document.querySelector(".shadiCloneDrawer");
    var backdrop = document.querySelector(".shadiCloneDrawerBackdrop");
    var openButton = document.querySelector(".shadiCloneMenuButton");
    var closeButton = document.querySelector(".shadiCloneDrawerClose");
    var drawerLinks = document.querySelectorAll(".shadiCloneDrawer a");

    if (!navbar) return;

    function updateVisibility() {
      navbar.classList.toggle("isVisible", window.scrollY > 24);
    }

    function setDrawerOpen(isOpen) {
      if (!drawer || !backdrop || !openButton) return;
      drawer.classList.toggle("isOpen", isOpen);
      backdrop.classList.toggle("isOpen", isOpen);
      drawer.setAttribute("aria-hidden", String(!isOpen));
      openButton.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    if (openButton) openButton.addEventListener("click", function () { setDrawerOpen(true); });
    if (closeButton) closeButton.addEventListener("click", function () { setDrawerOpen(false); });
    if (backdrop) backdrop.addEventListener("click", function () { setDrawerOpen(false); });
    drawerLinks.forEach(function (link) {
      link.addEventListener("click", function () { setDrawerOpen(false); });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setDrawerOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShadiCloneNav);
  } else {
    initShadiCloneNav();
  }
})();
