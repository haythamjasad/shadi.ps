import personPhoto from "@/assets/images/person1.jpg";
import sharaImage from "@/assets/images/shara-removebg-preview.png";
import sharaVideo from "@/assets/images/shara.mp4";
import storeImage from "@/assets/images/store-removebg-preview.png";
import consultingImage from "@/assets/images/consulting-removebg-preview.png";
import StorefrontIcon from "@mui/icons-material/Storefront";
import EngineeringIcon from "@mui/icons-material/Engineering";
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
import { useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [isSharaDialogOpen, setIsSharaDialogOpen] = useState(false);

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
              sx={{ pt: { xs: "10px", md: 0 }, pb: { xs: "10px", md: 0 } }}
            >
              <Stack
                spacing={2}
                justifyContent="center"
                height="100%"
                alignItems="center"
              >
                <Grid2
                  container
                  spacing={{ xs: 1, md: 2 }}
                  justifyContent="center"
                  alignItems="center"
                  sx={{
                    width: "100%",
                    maxWidth: 820,
                    mt: { xs: -1, md: -7 },
                    mb: { xs: 0, md: 0 },
                    pb: { xs: "40px", md: "100px" },
                  }}
                >
                  <Grid2 size={{ xs: 4 }} sx={{ display: "flex", justifyContent: "center" }}>
                    <Stack
                      alignItems="center"
                      spacing={0.5}
                      onClick={() => setIsSharaDialogOpen(true)}
                      sx={{ cursor: "pointer" }}
                    >
                      <Box
                        component="img"
                        src={sharaImage}
                        alt="شعرة"
                        sx={{
                          width: { xs: 92, md: 240 },
                          height: "auto",
                          objectFit: "contain",
                        }}
                      />
                    </Stack>
                  </Grid2>
                  <Grid2
                    size={{ xs: 4 }}
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      transform: { xs: "translateX(-10px)", md: "translateX(-24px)" },
                    }}
                  >
                    <Stack
                      alignItems="center"
                      spacing={0.5}
                      onClick={() => window.open("https://store.shadi.ps", "_blank", "noopener,noreferrer")}
                      sx={{ width: { xs: 108, md: 320 }, cursor: "pointer" }}
                    >
                      <Box
                        component="img"
                        src={storeImage}
                        alt="المتجر"
                        sx={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                          objectFit: "contain",
                        }}
                      />
                      <StorefrontIcon
                        sx={{
                          display: "none",
                          color: logoColor,
                          fontSize: { xs: 34, md: 42 },
                        }}
                      />
                      <Typography
                        sx={{
                          color: "text.primary",
                          fontSize: { xs: "12pt", md: "17pt" },
                          fontWeight: 700,
                          textAlign: "center",
                          display: "none",
                        }}
                      >
                        المتجر
                      </Typography>
                    </Stack>
                  </Grid2>
                  <Grid2 size={{ xs: 4 }} sx={{ display: "flex", justifyContent: "center" }}>
                    <Stack
                      alignItems="center"
                      spacing={0.5}
                      onClick={() => navigate("/consulting")}
                      sx={{ width: { xs: 108, md: 320 }, cursor: "pointer" }}
                    >
                      <Box
                        component="img"
                        src={consultingImage}
                        alt="الاستشارات"
                        sx={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                          objectFit: "contain",
                        }}
                      />
                      <EngineeringIcon
                        sx={{
                          display: "none",
                          color: logoColor,
                          fontSize: { xs: 34, md: 42 },
                        }}
                      />
                      <Typography
                        sx={{
                          color: "text.primary",
                          fontSize: { xs: "12pt", md: "17pt" },
                          fontWeight: 700,
                          textAlign: "center",
                          display: "none",
                        }}
                      >
                        الاستشارات
                      </Typography>
                    </Stack>
                  </Grid2>
                </Grid2>
                <Typography
                  variant="h4"
                  textAlign="center"
                  sx={{
                    width: "100%",
                    maxWidth: "850px",
                    textAlign: "center",
                    fontWeight: "bold",
                    lineHeight: { md: 1.235 },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: { xs: "16pt", md: "34pt" },
                      color: logoColor,
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
                    textAlign: "justify",
                    fontSize: { xs: "10pt", md: "14pt" },
                    fontWeight: { md: 400 },
                    lineHeight: { md: 1.235 },
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
        onClose={() => setIsSharaDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogContent>
          <Stack spacing={2} alignItems="center" pb={1}>
            <Box
              component="video"
              src={sharaVideo}
              autoPlay
              loop
              playsInline
              controls={false}
              sx={{
                width: "100%",
                maxWidth: { xs: 260, md: 360 },
                height: "auto",
                borderRadius: 2,
              }}
            />
            <Box
              component="img"
              src={sharaImage}
              alt="شعرة"
              sx={{
                display: "block",
                width: { xs: 140, md: 180 },
                height: "auto",
                objectFit: "contain",
              }}
            />
            <Typography sx={{ textAlign: "center", fontSize: { xs: "13pt", md: "15pt" } }}>
            Coming soon...
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
