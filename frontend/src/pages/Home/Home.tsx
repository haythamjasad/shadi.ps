import personPhoto from "@/assets/images/person1.jpg";
import Footer from "@/components/Footer";
import Navbar from "@/components/NavbarV2";
import routeHOC from "@/routes/HOCs/routeHOC";
import { useEffect } from "react";
import {
  alpha,
  Box,
  Chip,
  //Divider,
  Grid2,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { FC } from "react";
import { Trans } from "react-i18next";
import { useLocation } from "react-router-dom";
import AboutFounder from "./components/AboutFounder";
import AboutUs from "./components/AboutUs";
import ContactUsLink from "./components/ContactUsLink";
// import CoreValues from "./components/CoreValues";
// import JoinUs from "./components/JoinUs";
import OurServices from "./components/OurServices";
// import VisionAndMission from "./components/VisionAndMission";
import SectionContainer from "./components/UI/SectionContainer";
import { logoColor } from "@/style/colors";

const Home: FC = () => {
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
      sx={(theme) => ({
        backgroundImage:
          theme.palette.mode === "light"
            ? `linear-gradient(180deg, ${theme.palette.primary.light}, #FFF)`
            : `linear-gradient(180deg, ${theme.palette.primary.dark}, ${alpha(
                theme.palette.background.default,
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
          id="home_top_section"
          py={0}
          sx={{
            minHeight: { xs: "100svh", md: "auto" },
            maxHeight: "1400px",
            pt: { xs: 10, sm: 12, md: 12, lg: 14 },
          }}
        >
          <Grid2
            container
            spacing={{ xs: 5, sm: 4, md: 5 }}
            alignItems="center"
            justifyContent="center"
            minHeight={{ xs: "calc(100svh - 80px)", md: "72vh" }}
            pt={0}
            pb={{ xs: 4, md: 0 }}
          >
            <Grid2
              size={{ xs: 12, sm: 12, md: 6 }}
              sx={{ pt: { xs: "50px", md: 0 }, pb: { xs: "10px", md: 0 } }}
            >
              <Stack
                spacing={2.5}
                justifyContent="center"
                height="100%"
                alignItems={{ xs: "center", md: "flex-start" }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label="استشارات هندسية"
                    sx={{
                      backgroundColor: alpha("#ffffff", 0.84),
                      border: "1px solid rgba(58,55,65,0.14)",
                      color: logoColor,
                      fontWeight: 700,
                      backdropFilter: "blur(10px)",
                    }}
                  />
                  <Chip
                    label="إشراف ميداني"
                    sx={{
                      backgroundColor: alpha("#f8a01b", 0.16),
                      border: "1px solid rgba(248,160,27,0.24)",
                      color: "#6d4300",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
                <Typography
                  variant="h4"
                  textAlign={{ xs: "center", md: "right" }}
                  sx={{
                    width: "100%",
                    maxWidth: "850px",
                    textAlign: { xs: "center", md: "right" },
                    fontWeight: "bold",
                    lineHeight: { xs: 1.35, md: 1.15 },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: { xs: "16pt", md: "34pt" },
                      color: logoColor,
                      display: "inline-block",
                      textShadow: "0 8px 26px rgba(248,160,27,0.14)",
                    }}
                  >
                    <Trans i18nKey="Content.shadi_shirri" />
                  </Box>{" "}
                  <Box
                    component="span"
                    sx={{
                      fontSize: { xs: "13pt", md: "30pt" },
                      color: "black",
                    }}
                  >
                    <Trans i18nKey="Content.for_engineering_consulting" />
                  </Box>
                </Typography>

                <Typography
                  color="text.secondary"
                  sx={{
                    width: "100%",
                    maxWidth: "600px",
                    textAlign: { xs: "center", md: "justify" },
                    fontSize: { xs: "10pt", md: "14pt" },
                    fontWeight: { md: 400 },
                    lineHeight: { xs: 1.9, md: 2.05 },
                  }}
                >
                  نساعد أصحاب المشاريع على اتخاذ قرارات هندسية واعية من خلال
                  الإشراف والزيارات الهندسية التي من شأنها رصد وبيان الأخطاء قبل
                  وقوعها، لنضمن مشاريع مستدامة اكثر امانا و جودة.
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    width: "100%",
                    maxWidth: 620,
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 4,
                    background: "linear-gradient(135deg, rgba(255,255,255,0.86), rgba(255,255,255,0.66))",
                    border: "1px solid rgba(58,55,65,0.1)",
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 20px 50px rgba(58,55,65,0.08)",
                  }}
                >
                  <Grid2 container spacing={2}>
                    <Grid2 size={{ xs: 4 }}>
                      <Typography color={logoColor} fontWeight={800} sx={{ fontSize: { xs: "18pt", md: "22pt" } }}>+15</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: { xs: "8pt", md: "10pt" } }}>سنة خبرة ميدانية</Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 4 }}>
                      <Typography color={logoColor} fontWeight={800} sx={{ fontSize: { xs: "18pt", md: "22pt" } }}>4</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: { xs: "8pt", md: "10pt" } }}>تخصصات هندسية</Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 4 }}>
                      <Typography color={logoColor} fontWeight={800} sx={{ fontSize: { xs: "13pt", md: "17pt" } }}>ميداني + أونلاين</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: { xs: "8pt", md: "10pt" } }}>نماذج استشارة مرنة</Typography>
                    </Grid2>
                  </Grid2>
                </Paper>
              </Stack>
            </Grid2>
            <Grid2
              size={{ xs: 12, sm: 12, md: 6 }}
            >
              <Stack justifyContent="center" alignItems="center" height="100%">
                <Box sx={{ position: "relative", width: "100%", maxWidth: 620, display: "flex", justifyContent: "center" }}>
                  <Box
                    sx={{
                      position: "absolute",
                      top: { xs: 14, md: 26 },
                      left: { xs: 12, md: 20 },
                      width: { xs: 120, md: 160 },
                      height: { xs: 120, md: 160 },
                      borderRadius: "28px",
                      background: "linear-gradient(135deg, rgba(248,160,27,0.3), rgba(248,160,27,0.05))",
                      filter: "blur(4px)",
                    }}
                  />
                  <Box
                    component="img"
                    src={personPhoto}
                    width="100%"
                    maxWidth="550px"
                    alt="person photo"
                    sx={(theme) => ({
                      position: "relative",
                      zIndex: 1,
                      marginBlock: "auto",
                      borderRadius: "42px",
                      objectFit: "cover",
                      border: "1px solid rgba(255,255,255,0.62)",
                      boxShadow: `0 24px 60px ${alpha(theme.palette.primary.main, 0.18)}, 0 8px 18px ${alpha(theme.palette.common.black, 0.08)}`,
                    })}
                  />
                  <Paper
                    elevation={0}
                    sx={{
                      position: "absolute",
                      left: { xs: 12, md: -6 },
                      bottom: { xs: 18, md: 28 },
                      zIndex: 2,
                      maxWidth: { xs: 210, md: 250 },
                      px: 2,
                      py: 1.5,
                      borderRadius: 3,
                      background: "linear-gradient(135deg, rgba(58,55,65,0.88), rgba(34,32,40,0.92))",
                      color: "#fff",
                      boxShadow: "0 18px 44px rgba(23,21,28,0.22)",
                    }}
                  >
                    <Typography sx={{ fontSize: { xs: "8pt", md: "9pt" }, opacity: 0.72, mb: 0.5 }}>رؤية هندسية عملية</Typography>
                    <Typography sx={{ fontSize: { xs: "9.5pt", md: "11pt" }, lineHeight: 1.8 }}>
                      قرارات أدق، ملاحظات أوضح، وزيارات تقرأ الأخطاء قبل أن تتحول إلى خسائر.
                    </Typography>
                  </Paper>
                </Box>
              </Stack>
            </Grid2>
          </Grid2>
        </SectionContainer>
        <AboutUs />
        <AboutFounder />
        {/* <VisionAndMission />
        <CoreValues /> */}
        <OurServices />

        {/*<Divider /><Divider />
        <JoinUs />        */}
        <Stack
          position="fixed"
          justifyContent="center"
          alignItems="center"
          pt={1}
          spacing={{ xs: 0.4, sm: 0.65, md: 1 }}
          sx={(theme) => ({
            height: { xs: "160px", sm: "230px", md: "280px" },
            width: { xs: "32px", sm: "45px", md: "60px" },
            top: { xs: "62dvh", sm: "50%", md: "50%" },
            right: 0,
            transform: "translateY(-50%)",
            boxShadow: `0 0 4px ${alpha(theme.palette.primary.main, 0.25)},
                  2px 3px 6px -1px ${alpha(theme.palette.primary.main, 0.35)},
                  8px 8px 20px -3px ${alpha(theme.palette.primary.main, 0.35)}`,
            borderBottomLeftRadius: "10px",
            borderTopLeftRadius: "10px",
            backgroundColor:
              theme.palette.mode === "light"
                ? "rgba(255, 255, 255, 0.4)"
                : "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(24px)",
            border: "1px solid",
            borderColor: theme.palette.divider,
          })}
        >
          <ContactUsLink xs="20px" sm="32px" md="36px" />
        </Stack>
      </Stack>
      <Footer />
    </Box>
  );
};

const withRouteHoC = routeHOC({
  title: "Shadi Shirri",
  pageAccessName: "Home",
});

export default withRouteHoC(Home);
