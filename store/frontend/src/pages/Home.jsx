import React from "react";
import { m } from "framer-motion";
import DynamicBanner from "../components/DynamicBanner";
import Products from "./Products";

/**
 * Modern Home Page Component
 *
 * Features:
 * - Hero section with dynamic banner
 * - Featured products showcase
 * - Category highlights
 * - Modern, minimalistic design
 * - Smooth animations and transitions
 */
function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Section with Banner */}
      <m.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8"
      >
        <DynamicBanner />
      </m.section>

      <Products embedded showHeader />

      {/* Bottom Spacing */}
    </div>
  );
}

export default Home;
