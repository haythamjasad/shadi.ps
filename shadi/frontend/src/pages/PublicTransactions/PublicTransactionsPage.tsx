import Footer from "@/components/Footer";
import Navbar from "@/components/NavbarV2";
import routeHOC from "@/routes/HOCs/routeHOC";
import { alpha, Box, Stack } from "@mui/material";
import { FC, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AppointmentForm from "@/pages/Home/components/AppointmentForm/AppointmentForm";
import ConsultationReports from "@/pages/Home/components/ConsultationReports";
import SectionContainer from "@/pages/Home/components/UI/SectionContainer";

function resolveStoreApi(): string {
  const configured = String(import.meta.env.VITE_STORE_API_URL || "").trim().replace(/\/+$/, "");
  if (typeof window === "undefined") return configured || "http://localhost:4000/api/v01";

  const pageHost = window.location.hostname;
  if (pageHost === "www.shadi.ps" || pageHost === "shadi.ps") return "https://store.shadi.ps/api/v01";

  if (configured) {
    try {
      const url = new URL(configured);
      if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return configured;
    } catch {
      return configured;
    }
  }

  return `${window.location.protocol}//${pageHost}:4000/api/v01`;
}

const STORE_API = resolveStoreApi();
const DEFAULT_CONSULTING_BANNER_PATH = "/api/v01/uploads/banners/shadi-banner-1780762420058-1h7x5e.jpg";

function resolveBannerUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = STORE_API.replace(/\/api\/v01\/?$/, "").replace(/\/+$/, "");
  return `${base}${path}`;
}

const PublicTransactionsPage: FC = () => {
  const location = useLocation();
  const [bannerUrl, setBannerUrl] = useState(() => resolveBannerUrl(DEFAULT_CONSULTING_BANNER_PATH));

  useEffect(() => {
    fetch(`${STORE_API}/settings/banner/shadi`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.image_url) setBannerUrl(resolveBannerUrl(data.image_url));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;

    const timeout = window.setTimeout(() => {
      const sectionElement = document.getElementById(hash);
      if (!sectionElement) return;

      const offset = 140;
      sectionElement.scrollIntoView({ behavior: "smooth" });
      window.scrollTo({
        top: sectionElement.offsetTop - offset,
        behavior: "smooth",
      });
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [location.hash]);

  return (
    <Box
      sx={(themeMode) => ({
        backgroundImage:
          themeMode.palette.mode === "light"
            ? `linear-gradient(180deg, ${themeMode.palette.primary.light}, ${themeMode.palette.background.default})`
            : `linear-gradient(180deg, ${themeMode.palette.primary.dark}, ${alpha(
                themeMode.palette.background.default,
                0,
              )})`,
        backgroundSize: "100% 250px",
        backgroundRepeat: "no-repeat",
        backgroundColor: themeMode.palette.background.default,
        position: "relative",
        paddingX: { xs: 0, md: 2 },
      })}
    >
      <Stack mx="auto" sx={{ maxWidth: "2400px", width: "100%" }}>
        <Navbar />
        <SectionContainer
          id="consulting_top_section"
          py={0}
          sx={{
            minHeight: { xs: "auto", md: "auto" },
            pt: { xs: 12, sm: 12.5, md: 14.5, lg: 14.5 },
            px: { xs: 0, sm: 3, md: 5 },
          }}
        >
          <Stack spacing={{ xs: 0.75, md: 1.25 }} alignItems="center" textAlign="center" pb={{ xs: 0, md: 1.5 }}>
            <Box
              sx={(theme) => ({
                width: { xs: "calc(100vw - 32px)", sm: "100%" },
                maxWidth: 1260,
                overflow: "hidden",
                borderRadius: { xs: 2.25, md: 2 },
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                boxShadow: {
                  xs: "0 12px 28px rgba(90, 59, 37, 0.12)",
                  md: "0 18px 48px rgba(90, 59, 37, 0.16)",
                },
                backgroundColor: theme.palette.background.paper,
              })}
            >
              <Box
                component="img"
                src={bannerUrl}
                alt="الاستشارات"
                sx={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  objectPosition: "center",
                }}
              />
            </Box>
          </Stack>
        </SectionContainer>

        <AppointmentForm />
        <ConsultationReports />
      </Stack>
      <Footer />
    </Box>
  );
};

const withRouteHoC = routeHOC({
  title: "Consulting | Shadi Shirri",
});

export default withRouteHoC(PublicTransactionsPage);
