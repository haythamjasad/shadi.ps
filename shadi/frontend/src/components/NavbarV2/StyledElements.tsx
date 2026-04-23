import { MenuItem, Toolbar, alpha, styled } from "@mui/material";

export const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  borderRadius: "999px",
  backgroundColor:
    theme.palette.mode === "light"
      ? "rgba(255, 255, 255, 0.4)"
      : "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(24px)",
  maxHeight: 40,
  border: "1px solid",
  borderColor: theme.palette.divider,
  boxShadow:
    theme.palette.mode === "light"
      ? `
        0 0 1px ${alpha(theme.palette.primary.main, 0.1)},
        1px 1.5px 2px -1px ${alpha(theme.palette.primary.main, 0.15)},
        4px 4px 12px -2.5px ${alpha(theme.palette.primary.main, 0.15)}
      `
      : `
        0 0 1px ${alpha(theme.palette.primary.dark, 0.7)},
        1px 1.5px 2px -1px ${alpha(theme.palette.primary.dark, 0.65)},
        4px 4px 12px -2.5px ${alpha(theme.palette.primary.dark, 0.65)}
      `,
}));

export const StyledMenuItem = styled(MenuItem)({
  paddingBlock: "6px",
  paddingInline: "10px",
});
