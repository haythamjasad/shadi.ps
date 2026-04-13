import Footer from "@/components/Footer";
import Navbar from "@/components/NavbarV2";
import routeHOC from "@/routes/HOCs/routeHOC";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { FC, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppointmentForm from "@/pages/Home/components/AppointmentForm/AppointmentForm";
import SectionContainer from "@/pages/Home/components/UI/SectionContainer";
import { logoColor } from "@/style/colors";

const PublicTransactionsPage: FC = () => {
  const location = useLocation();

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
            ? `linear-gradient(180deg, ${themeMode.palette.primary.light}, #FFF)`
            : `linear-gradient(180deg, ${themeMode.palette.primary.dark}, ${alpha(
                themeMode.palette.background.default,
                0,
              )})`,
        backgroundSize: "100% 250px",
        backgroundRepeat: "no-repeat",
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
            pt: { xs: 10, sm: 12, md: 12, lg: 14 },
          }}
        >
          <Stack spacing={2} alignItems="center" textAlign="center" pb={4}>
            <Typography
              sx={{
                color: logoColor,
                width: "100%",
                fontSize: { xs: "18pt", md: "38pt" },
                fontWeight: "bold",
              }}
            >
              الاستشارات
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                width: "100%",
                maxWidth: "720px",
                textAlign: "center",
                fontSize: { xs: "10pt", md: "14pt" },
              }}
            >
              احجز استشارة هندسية.
            </Typography>
          </Stack>
        </SectionContainer>

        <AppointmentForm />
      </Stack>
      <Footer />
    </Box>
  );
};

const withRouteHoC = routeHOC({
  title: "Consulting | Shadi Shirri",
});

export default withRouteHoC(PublicTransactionsPage);
