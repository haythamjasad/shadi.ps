import sharaDialogLogo from "@/assets/images/shara-dialog-logo.png";
import Footer from "@/components/Footer";
import Navbar from "@/components/NavbarV2";
import routeHOC from "@/routes/HOCs/routeHOC";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { FC } from "react";

const SharaPage: FC = () => {
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
        minHeight: "100svh",
        paddingX: { xs: 0, md: 2 },
      })}
    >
      <Stack mx="auto" sx={{ maxWidth: "2400px", width: "100%" }}>
        <Navbar />
        <Stack
          alignItems="center"
          spacing={2}
          pt={{ xs: 12, md: 14 }}
          pb={{ xs: 4, md: 6 }}
          px={2}
        >
          <Box
            component="img"
            src={sharaDialogLogo}
            alt="شعرة"
            sx={{ width: { xs: 140, md: 180 }, height: "auto", objectFit: "contain" }}
          />
          <Box
            component="iframe"
            src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1594743821586584%2F&show_text=false&width=560"
            title="Shara Reel"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            sx={{
              width: "100%",
              maxWidth: { xs: 340, md: 420 },
              aspectRatio: "9 / 16",
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
      </Stack>
      <Footer />
    </Box>
  );
};

const withRouteHoC = routeHOC({
  title: "Shara | Shadi Shirri",
});

export default withRouteHoC(SharaPage);
