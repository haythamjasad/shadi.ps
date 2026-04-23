import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@mui/x-data-grid")) {
            return "mui-data-grid";
          }

          if (id.includes("@mui/x-date-pickers")) {
            return "mui-date-pickers";
          }

          if (id.includes("@mui/icons-material") || id.includes("@mui/lab")) {
            return "mui-extended";
          }

          if (id.includes("@mui/material") || id.includes("@emotion")) {
            return "mui-core";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          if (id.includes("pdfjs-dist")) {
            return "pdf-vendor";
          }

          if (id.includes("i18next")) {
            return "i18n-vendor";
          }

          if (id.includes("react-router")) {
            return "router-vendor";
          }

          if (id.includes("@reduxjs") || id.includes("redux") || id.includes("reselect")) {
            return "state-vendor";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query-vendor";
          }

          if (id.includes("formik") || id.includes("yup") || id.includes("react-google-recaptcha")) {
            return "forms-vendor";
          }

          if (id.includes("lucide-react") || id.includes("react-icons")) {
            return "icons-vendor";
          }

          if (id.includes("luxon") || id.includes("dayjs")) {
            return "date-vendor";
          }

          if (id.includes("axios") || id.includes("js-cookie") || id.includes("jwt-decode")) {
            return "network-vendor";
          }

          if (id.includes("lottie-react") || id.includes("lottie-web")) {
            return "animation-vendor";
          }

          return "app-vendor";
        },
      },
    },
  },
});
