import { navItems } from "@/components/NavbarV2/constants";
import { brand } from "@/style/colors";
import { alpha, Container, Stack, StackProps } from "@mui/material";
import { FC } from "react";

const SectionContainer: FC<StackProps> = ({ id, children, ...rest }) => {
  return (
    <Stack
      py={2}
      px={5}
      justifyContent="center"
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        pt:
          id === "home_top_section"
            ? 2
            : { xs: 8, sm: 9, md: 10 },
        ...(id === "home_top_section" && {
          backgroundImage: `radial-gradient(circle at 15% 20%, ${alpha("#f8a01b", 0.18)}, transparent 28%), radial-gradient(circle at 88% 18%, ${alpha(brand[500], 0.14)}, transparent 24%), linear-gradient(180deg, ${alpha(theme.palette.primary.light, 0.72)}, ${alpha("#ffffff", 0.96)})`,
        }),
        ...(id === "about_us" && {
          backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.6)}, ${alpha("#ffffff", 0.96)} 65%), radial-gradient(circle at 82% 18%, ${alpha("#f8a01b", 0.12)}, transparent 20%)`,
        }),
        ...(id === "founder_profile" && {
          backgroundImage: `linear-gradient(180deg, ${alpha("#ffffff", 0.98)}, ${alpha(theme.palette.primary.light, 0.38)}), radial-gradient(circle at 12% 16%, ${alpha(brand[500], 0.08)}, transparent 22%)`,
        }),
        ...(id === "our_services" && {
          backgroundImage: `linear-gradient(160deg, ${alpha(theme.palette.primary.light, 0.52)}, ${alpha("#ffffff", 0.98)} 58%), radial-gradient(circle at 86% 12%, ${alpha("#f8a01b", 0.14)}, transparent 18%)`,
        }),
        ...(id !== "home_top_section" && !navItems.includes(String(id)) && {
          backgroundColor: alpha(theme.palette.primary.light, 0.12),
        }),
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(58,55,65,0.08) 0.8px, transparent 0.8px)",
          backgroundSize: "20px 20px",
          opacity: 0.35,
          pointerEvents: "none",
        },
      })}
      {...rest}
    >
        <Container
          id={id}
          maxWidth={false}
          sx={{
            scrollMarginTop: { xs: 96, md: 120 },
            minHeight:
              id === "home_top_section"
                ? { xs: "auto", md: "90vh" }
              : "auto",
          px: { xs: 0.1, sm: 2.5, md: 4 },
          maxWidth: "1750px",
          mx: "auto",
        }}
      >
        {children}
      </Container>
    </Stack>
  );
};

export default SectionContainer;
