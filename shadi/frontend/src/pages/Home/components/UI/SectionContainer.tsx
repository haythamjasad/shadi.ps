import { navItems } from "@/components/NavbarV2/constants";
import { alpha, Container, Stack, StackProps } from "@mui/material";
import { FC } from "react";

const SectionContainer: FC<StackProps> = ({ id, children, ...rest }) => {
  return (
    <Stack
      py={2}
      px={{ xs: 2, sm: 3, md: 5 }}
      justifyContent="center"
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        backgroundColor: theme.palette.background.default,
        backgroundImage: "none",
        pt:
          id === "home_top_section"
            ? 2
            : { xs: 8, sm: 9, md: 10 },
        ...(id !== "home_top_section" && !navItems.includes(String(id)) && {
          backgroundColor: alpha(theme.palette.primary.light, 0.12),
        }),
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
          px: { xs: 0, sm: 2.5, md: 4 },
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
