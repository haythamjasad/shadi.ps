import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import { ToastContainer } from "react-toastify";
import Footer from "./components/Footer";
import Home from "./pages/Home";
// User auth and profile removed for guest checkout
import LoadingScreen from "./components/LoadingScreen";
import ScrollToTop from "./components/ScrollToTop";
import AnnouncementStrip from "./components/AnnouncementStrip";
import { useContentLoader } from "./hooks/useContentLoader";
import "react-toastify/dist/ReactToastify.css";
import { HelmetProvider } from 'react-helmet-async';
import { LazyMotion, domAnimation } from "framer-motion";
import { StoreSettingsProvider } from './context/StoreSettingsContext';

const AboutUs = lazy(() => import('./pages/AboutUs'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ReturnPolicy = lazy(() => import('./pages/ReturnPolicy'));
const ProductView = lazy(() => import('./pages/ProductView'));
const Cart = lazy(() => import('./pages/Cart'));
const UnifiedCheckout = lazy(() => import('./pages/Checkout/UnifiedCheckout'));
const Products = lazy(() => import('./pages/Products'));
const OrderSummary = lazy(() => import('./pages/OrderSummary'));

/**
 * Main application component with routing and providers setup
 * Features comprehensive content loading that waits for all critical assets
 * before displaying the website to ensure optimal user experience
 * 
 * @returns {JSX.Element} The main application component
 */
function App() {
  // Use the comprehensive content loader hook
  const {
    isLoading,
    loadingProgress,
    loadingStates,
    errors,
    markAuthLoaded,
    forceComplete
  } = useContentLoader();
  
  /**
   * Detects if the current visitor is a social media crawler/bot
   * Used to bypass loading screens for better SEO and link previews
   * 
   * @returns {boolean} True if the current user agent appears to be a bot
   */
  const isBotOrCrawler = () => {
    if (typeof window === 'undefined' || !window.navigator) return false;
    
    const botPatterns = [
      'googlebot', 'bingbot', 'yandex', 'baiduspider', 'twitterbot',
      'facebookexternalhit', 'linkedinbot', 'discordbot', 'slackbot',
      'telegrambot', 'whatsapp', 'line-podcast', 'skype', 'pinterest',
      'bot', 'spider', 'crawl'
    ];
    
    const userAgent = navigator.userAgent.toLowerCase();
    return botPatterns.some(pattern => userAgent.indexOf(pattern) !== -1);
  };

  useEffect(() => {
    if (isBotOrCrawler()) {
      markAuthLoaded();
      return;
    }

    // Mark auth as loaded for guest checkout flow
    const timer = setTimeout(() => markAuthLoaded(), process.env.NODE_ENV === 'development' ? 0 : 120);
    return () => clearTimeout(timer);
  }, [markAuthLoaded]);

  // Emergency loading completion for development/testing
  useEffect(() => {
    // Add keyboard shortcut for emergency loading completion (Ctrl+Shift+L)
    const handleKeyPress = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        console.log('🔧 Emergency loading completion triggered');
        forceComplete();
      }
    };
    
    if (process.env.NODE_ENV === 'development') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [forceComplete]);

  // Show comprehensive loading screen with progress
  if (isLoading && !isBotOrCrawler()) {
    return (
      <LoadingScreen 
        message="Preparing your shopping experience"
        progress={loadingProgress}
        showTips={true}
        loadingStates={loadingStates}
        errors={errors}
      />
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <HelmetProvider>
        <StoreSettingsProvider>
          <Router>
            <ScrollToTop />
            <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
            limit={3}
            icon={true}
            className="mt-16"
          />

              <div className="flex flex-col min-h-screen md:pt-16">
                <Navbar />
                <AnnouncementStrip />

              <main className="flex-grow">
                <Suspense fallback={<LoadingScreen fullScreen={false} />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/product/:id" element={<ProductView />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<UnifiedCheckout />} />

                  {/* Post-checkout order summary page - displays order confirmation */}
                  {/* Accessible after successful payment with orderId and paymentId query parameters */}
                    <Route path="/summary" element={<OrderSummary />} />

                    <Route path="/about" element={<AboutUs />} />
                    <Route path="/contact" element={<ContactUs />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/return-policy" element={<ReturnPolicy />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          </Router>
        </StoreSettingsProvider>
      </HelmetProvider>
    </LazyMotion>
  );
}

export default App;
