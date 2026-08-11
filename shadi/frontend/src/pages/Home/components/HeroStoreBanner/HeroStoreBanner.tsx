import { alpha, Box, Container } from "@mui/material";
import { FC } from "react";
import { brand, logoColor } from "@/style/colors";

const storeUrl = "https://store.shadi.ps";

const HeroStoreBanner: FC = () => {
  return (
    <Box px={{ xs: 1.5, sm: 2.5, md: 5 }} pt={{ xs: 10, md: 12 }} pb={1.5}>
      <Container
        maxWidth={false}
        sx={{
          px: { xs: 0.1, sm: 2.5, md: 4 },
          maxWidth: "1750px",
          mx: "auto",
        }}
      >
        <Box
          component="a"
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Visit store"
          sx={(theme) => ({
            position: "relative",
            display: "block",
            overflow: "hidden",
            minHeight: { xs: 96, sm: 118, md: 150 },
            borderRadius: { xs: "20px", md: "28px" },
            textDecoration: "none",
            border: "1px solid",
            borderColor: alpha(theme.palette.common.white, 0.24),
            background: `linear-gradient(135deg, ${brand[900]} 0%, ${brand[700]} 45%, ${brand[500]} 100%)`,
            boxShadow: `0 18px 42px ${alpha(brand[900], 0.24)}`,
            isolation: "isolate",
            transition: "transform 220ms ease, box-shadow 220ms ease",
            "&:hover": {
              transform: "translateY(-3px)",
              boxShadow: `0 22px 52px ${alpha(brand[900], 0.3)}`,
            },
          })}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 15% 20%, ${alpha(
                logoColor,
                0.35,
              )} 0%, transparent 32%), radial-gradient(circle at 85% 22%, ${alpha(
                "#ffffff",
                0.18,
              )} 0%, transparent 22%), linear-gradient(120deg, transparent 10%, ${alpha(
                "#ffffff",
                0.08,
              )} 55%, transparent 78%)`,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              insetInlineEnd: { xs: -26, md: -18 },
              top: { xs: -30, md: -20 },
              width: { xs: 110, md: 170 },
              height: { xs: 110, md: 170 },
              borderRadius: "50%",
              background: alpha(logoColor, 0.16),
              filter: "blur(10px)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              insetInlineStart: { xs: -18, md: 40 },
              bottom: { xs: -48, md: -68 },
              width: { xs: 98, md: 150 },
              height: { xs: 98, md: 150 },
              borderRadius: "50%",
              border: `1px solid ${alpha("#ffffff", 0.12)}`,
              background: alpha("#ffffff", 0.04),
            }}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default HeroStoreBanner;
