import personPhoto from "@/assets/images/person1.jpg";
import sharaDialogLogo from "@/assets/images/shara-dialog-logo.png";
import Footer from "@/components/Footer";
import Navbar from "@/components/NavbarV2";
import routeHOC from "@/routes/HOCs/routeHOC";
import { useEffect, useState } from "react";
import {
  alpha,
  Box,
  //Divider,
  Dialog,
  DialogContent,
  Grid2,
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

const Home: FC = () => {
  const location = useLocation();
  const [isSharaDialogOpen, setIsSharaDialogOpen] = useState(false);

  const openSharaDialog = () => setIsSharaDialogOpen(true);
  const closeSharaDialog = () => setIsSharaDialogOpen(false);

  useEffect(() => {
    const handleOpenSharaDialog = () => openSharaDialog();
    window.addEventListener("open-shara-dialog", handleOpenSharaDialog);

    let timeout: number | undefined;

    const hash = location.hash.replace(/^#/, "");
    if (hash === "shara_dialog") {
      openSharaDialog();
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (hash) {
      timeout = window.setTimeout(() => {
        const sectionElement = document.getElementById(hash);
        if (!sectionElement) return;

        const offset = 140;
        sectionElement.scrollIntoView({ behavior: "smooth" });
        window.scrollTo({
          top: sectionElement.offsetTop - offset,
          behavior: "smooth",
        });
      }, 50);
    }

    return () => {
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener("open-shara-dialog", handleOpenSharaDialog);
    };
  }, [location.hash]);

  return (
    <Box
      sx={(theme) => ({
        backgroundImage:
          theme.palette.mode === "light"
            ? `linear-gradient(180deg, ${theme.palette.primary.light}, ${theme.palette.background.default})`
            : `linear-gradient(180deg, ${theme.palette.primary.dark}, ${alpha(
                theme.palette.background.default,
                0,
              )})`,

        backgroundSize: "100% 250px",
        backgroundRepeat: "no-repeat",
        backgroundColor: theme.palette.background.default,
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
              pt: { xs: 13.5, sm: 13.5, md: 12, lg: 14 },
            }}
          >
          <Grid2
            container
            spacing={{ xs: 3, sm: 4, md: 5 }}
            alignItems="center"
            justifyContent="center"
            minHeight={{ xs: "calc(100svh - 80px)", md: "72vh" }}
            pt={0}
            pb={{ xs: 4, md: 0 }}
          >
            <Grid2
              size={{ xs: 12, sm: 12, md: 6 }}
              sx={{ pt: { xs: 0, md: 0 }, pb: { xs: "20px", md: 0 } }}
            >
              <Stack
                spacing={{ xs: 2.5, md: 3 }}
                justifyContent="center"
                height="100%"
                alignItems="center"
              >
                <Typography
                  variant="h4"
                  textAlign="center"
                  sx={{
                    width: "100%",
                    maxWidth: "900px",
                    mt: { xs: 0, md: 0 },
                    mb: { xs: 0, md: 0 },
                    textAlign: "center",
                    fontWeight: "bold",
                    lineHeight: { xs: 1.35, md: 1.35 },
                    whiteSpace: "nowrap",
                    fontSize: {
                      xs: "clamp(16px, 5vw, 26px)",
                      md: "clamp(28px, 2.2vw, 32px)",
                    },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: "inherit",
                      color: "#f49b00",
                    }}
                  >
                    <Trans i18nKey="Content.shadi_shirri" />
                  </Box>{" "}
                  <Box
                    component="span"
                    sx={{
                      fontSize: "inherit",
                      color: "text.secondary",
                    }}
                  >
                    <Trans i18nKey="Content.for_engineering_consulting" />
                  </Box>
                </Typography>

                <Typography
                  color="text.secondary"
                  sx={{
                    width: "100%",
                    maxWidth: "760px",
                    px: { xs: 2.5, md: 0 },
                    mt: { xs: 0, md: 0 },
                    textAlign: "center",
                    fontSize: { xs: "10.5pt", md: "15pt" },
                    fontWeight: { md: 400 },
                    lineHeight: { xs: 1.7, md: 1.7 },
                  }}
                >
                  نساعد أصحاب المشاريع على اتخاذ قرارات هندسية واعية من خلال
                  الإشراف والزيارات الهندسية التي من شأنها رصد وبيان الأخطاء قبل
                  وقوعها، لنضمن مشاريع مستدامة اكثر امانا و جودة.
                </Typography>
              </Stack>
            </Grid2>
            <Grid2
              size={{ xs: 12, sm: 12, md: 6 }}
            >
              <Stack justifyContent="center" alignItems="center" height="100%">
                <Box
                  component="img"
                  src={personPhoto}
                  width="100%"
                  maxWidth="550px"
                  alt="person photo"
                  sx={(theme) => ({
                    marginBlock: "auto",
                    borderRadius: "10%",
                    objectFit: "cover",
                    boxShadow: `
              0 0 4px ${alpha(theme.palette.primary.main, 0.25)},
              2px 3px 6px -1px ${alpha(theme.palette.primary.main, 0.35)},
              8px 8px 20px -3px ${alpha(theme.palette.primary.main, 0.35)}
                    `,
                  })}
                />
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
      <Dialog
        open={isSharaDialogOpen}
        onClose={closeSharaDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogContent>
          <Stack spacing={1.5} alignItems="center">
            <Box
              component="img"
              src={sharaDialogLogo}
              alt="شعرة"
              sx={{
                width: { xs: 130, md: 170 },
                height: "auto",
                objectFit: "contain",
              }}
            />
            <Box
              component="iframe"
              src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1594743821586584%2F&show_text=false&width=560"
              title="Shara Reel"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              sx={{
                width: "100%",
                maxWidth: { xs: 280, md: 360 },
                aspectRatio: "9 / 16",
                mx: "auto",
                borderRadius: 2,
                display: "block",
                border: 0,
              }}
            />
            <Typography
              sx={{
                fontSize: { xs: "0.95rem", md: "1.1rem" },
                fontWeight: 700,
                color: "#f49b00",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Coming soon
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
       <Footer />
     </Box>
  );
};

const withRouteHoC = routeHOC({
  title: "Shadi Shirri",
  pageAccessName: "Home",
});

export default withRouteHoC(Home);
