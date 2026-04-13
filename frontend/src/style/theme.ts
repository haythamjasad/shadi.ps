import { alpha, createTheme, responsiveFontSizes } from "@mui/material/styles";
import customMixins from "./mixins";
import { APP_SIDE_DRAWER_PALETTE } from "./palettes/appSideDrawer";
import { USER_AVATAR_PALETTE } from "./palettes/userAvatar";
import { brand, gray, green, secondary } from "./colors";
import { red } from "@mui/material/colors";
import { arSD } from "@mui/x-data-grid/locales";

const AlertBgColors = {
  success: "#d4edda",
  info: "#d1ecf1",
  warning: "#fff3cd",
  error: "#f8d7da",
};

const AlertTextColor = {
  success: "#155724",
  info: "#0c5460",
  warning: "#856404",
  error: "#721c24",
};

const muiTheme = createTheme(
  {
    direction: "rtl",
    mixins: customMixins,
    palette: {
      userAvatar: USER_AVATAR_PALETTE,
      appMenu: APP_SIDE_DRAWER_PALETTE,
      primary: {
        light: brand[200],
        main: brand[500],
        dark: brand[800],
        contrastText: brand[50],
      },
      secondary: {
        light: secondary[300],
        main: secondary[500],
        dark: secondary[800],
      },
      warning: {
        main: "#F7B538",
        dark: "#F79F00",
      },
      error: {
        light: red[50],
        main: red[500],
        dark: red[700],
      },
      success: {
        light: green[300],
        main: green[400],
        dark: green[800],
      },
      grey: {
        50: gray[50],
        100: gray[100],
        200: gray[200],
        300: gray[300],
        400: gray[400],
        500: gray[500],
        600: gray[600],
        700: gray[700],
        800: gray[800],
        900: gray[900],
      },
      divider: alpha(gray[300], 0.5),
      background: {
        default: "#fff",
        paper: gray[50],
      },
      text: {
        primary: gray[800],
        secondary: gray[600],
      },
      action: {
        selected: `${alpha(brand[200], 0.2)}`,
      },
    },
    typography: {
      fontFamily: ["'Noto Kufi Arabic'", "'Inter'", "sans-serif"].join(","),
      h1: {
        fontSize: 54,
        fontWeight: 600,
        lineHeight: 78 / 70,
        letterSpacing: -0.2,
      },
      h2: {
        fontSize: 43,
        fontWeight: 600,
        lineHeight: 1.2,
      },
      h3: {
        fontSize: 38,
        lineHeight: 1.2,
      },
      h4: {
        fontSize: 32,
        fontWeight: 500,
        lineHeight: 1.5,
      },
      h5: {
        fontSize: 18,
        fontWeight: 600,
      },
      h6: {
        fontSize: 16,
      },
      subtitle1: {
        fontSize: 16,
      },
      subtitle2: {
        fontSize: 14,
      },
      body1: {
        fontWeight: 400,
        fontSize: 14,
      },
      body2: {
        fontWeight: 400,
        fontSize: 13,
      },
      caption: {
        fontWeight: 400,
        fontSize: 11,
      },
    },
    components: {
      MuiSvgIcon: {
        styleOverrides: {
          root: () => ({
            transform: "scaleX(-1)",
            marginInline: 10,
          }),
        },
      },
      MuiAccordion: {
        defaultProps: {
          elevation: 0,
          disableGutters: true,
        },
        styleOverrides: {
          root: () => ({
            padding: 8,
            overflow: "clip",
            backgroundColor: "#fff",
            border: "1px solid",
            borderColor: gray[100],
            ":before": {
              backgroundColor: "transparent",
            },
            "&:first-of-type": {
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
            },
            "&:last-of-type": {
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
            },
          }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            ...(ownerState?.severity === "success" && {
              backgroundColor: AlertBgColors.success,
              color: AlertTextColor.success,
            }),
            ...(ownerState?.severity === "info" && {
              backgroundColor: AlertBgColors.info,
              color: AlertTextColor.info,
            }),
            ...(ownerState?.severity === "warning" && {
              backgroundColor: AlertBgColors.warning,
              color: AlertTextColor.warning,
            }),
            ...(ownerState?.severity === "error" && {
              backgroundColor: AlertBgColors.error,
              color: AlertTextColor.error,
            }),
          }),
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: () => ({
            border: "none",
            borderRadius: 8,
            "&:hover": { backgroundColor: gray[100] },
          }),
        },
      },
      MuiAccordionDetails: {
        styleOverrides: {
          root: { mb: 20, border: "none" },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: () => ({
            borderRadius: "10px",
            boxShadow: `0 4px 16px ${alpha(gray[400], 0.2)}`,
            "& .Mui-selected": {
              color: brand[500],
            },
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: () => ({
            padding: "12px 16px",
            textTransform: "none",
            borderRadius: "10px",
            fontWeight: 500,
          }),
        },
      },
      MuiButtonBase: {
        defaultProps: {
          disableTouchRipple: true,
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            boxSizing: "border-box",
            transition: "all 100ms ease-in",
            "&:focus-visible": {
              outline: `3px solid ${alpha(brand[500], 0.5)}`,
              outlineOffset: "2px",
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            boxSizing: "border-box",
            boxShadow: "none",
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "1rem",
            "&:active": {
              transform: "scale(0.98)",
            },
            ...(ownerState?.size === "small" && {
              maxHeight: "32px",
            }),
            ...(ownerState?.size === "medium" && {
              height: "40px",
            }),
            ...(ownerState?.variant === "contained" &&
              ownerState?.color === "primary" && {
                color: brand[50],
                background: brand[500],
                backgroundImage: `linear-gradient(to bottom, ${brand[400]}, ${brand[600]})`,
                boxShadow: `inset 0 1px ${alpha(brand[300], 0.4)}`,
                outline: `1px solid ${brand[700]}`,
                "&:hover": {
                  background: brand[400],
                  backgroundImage: "none",
                  boxShadow: `0 0 0 1px  ${alpha(brand[300], 0.5)}`,
                },
              }),
            ...(ownerState?.variant === "contained" &&
              ownerState?.color === "error" && {
                color: red[50],
                background: red[500],
                backgroundImage: `linear-gradient(to bottom, ${red[400]}, ${red[600]})`,
                boxShadow: `inset 0 1px ${alpha(red[300], 0.4)}`,
                outline: `1px solid ${red[700]}`,
                "&:hover": {
                  background: red[400],
                  backgroundImage: "none",
                  boxShadow: `0 0 0 1px ${alpha(red[300], 0.5)}`,
                },
              }),
            ...(ownerState?.variant === "outlined" && {
              backgroundColor: alpha(brand[300], 0.1),
              borderColor: brand[300],
              color: brand[500],
              "&:hover": {
                backgroundColor: alpha(brand[300], 0.3),
                borderColor: brand[200],
              },
            }),
            ...(ownerState?.variant === "text" && {
              color: brand[500],
              "&:hover": {
                backgroundColor: alpha(brand[300], 0.3),
                borderColor: brand[200],
              },
            }),
            "&.Mui-disabled": {
              backgroundColor: brand[100],
              color: brand[200],
            },
          }),
        },
      },
      MuiLoadingButton: {
        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            boxSizing: "border-box",
            boxShadow: "none",
            borderRadius: "10px",
            textTransform: "none",
            "&:active": {
              transform: "scale(0.98)",
            },
            ...(ownerState?.size === "small" && {
              maxHeight: "32px",
            }),
            ...(ownerState?.size === "medium" && {
              height: "40px",
            }),
            ...(ownerState?.variant === "contained" &&
              ownerState?.color === "primary" && {
                color: brand[50],
                background: brand[500],
                backgroundImage: `linear-gradient(to bottom, ${brand[400]}, ${brand[600]})`,
                boxShadow: `inset 0 1px ${alpha(brand[300], 0.4)}`,
                outline: `1px solid ${brand[700]}`,
                "&:hover": {
                  background: brand[400],
                  backgroundImage: "none",
                  boxShadow: `0 0 0 1px  ${alpha(brand[300], 0.5)}`,
                },
              }),
            ...(ownerState?.variant === "outlined" && {
              backgroundColor: alpha(brand[300], 0.1),
              borderColor: brand[300],
              color: brand[500],
              "&:hover": {
                backgroundColor: alpha(brand[300], 0.3),
                borderColor: brand[200],
              },
            }),
            ...(ownerState?.variant === "text" && {
              color: brand[500],
              "&:hover": {
                backgroundColor: alpha(brand[300], 0.3),
                borderColor: brand[200],
              },
            }),
            "& .MuiLoadingButton-loadingIndicator": {
              color: theme.palette.background.paper,
            },
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            backgroundColor: gray[50],
            borderRadius: 10,
            border: `1px solid ${alpha(gray[200], 0.8)}`,
            boxShadow: "none",
            transition: "background-color, border, 80ms ease",
            ...(ownerState?.variant === "outlined" && {
              background: `linear-gradient(to bottom, #FFF, ${gray[50]})`,
              "&:hover": {
                borderColor: brand[300],
                boxShadow: `0 0 24px ${brand[100]}`,
              },
            }),
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            boxSizing: "border-box",
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            padding: "0 8px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            ...(ownerState.variant === "filled" &&
              ownerState.color === "primary" && {
                color: brand[50],
                background: brand[500],
                backgroundImage: `linear-gradient(to bottom, ${brand[400]}, ${brand[600]})`,
                boxShadow: `inset 0 1px ${alpha(brand[300], 0.4)}`,
                outline: `1px solid ${brand[700]}`,
                "&:hover": {
                  background: brand[400],
                  backgroundImage: "none",
                  boxShadow: `0 0 0 1px ${alpha(brand[300], 0.5)}`,
                },
              }),

            ...(ownerState.variant === "filled" &&
              ownerState.color === "error" && {
                color: red[50],
                background: red[500],
                backgroundImage: `linear-gradient(to bottom, ${red[400]}, ${red[600]})`,
                boxShadow: `inset 0 1px ${alpha(red[300], 0.4)}`,
                outline: `1px solid ${red[700]}`,
                "&:hover": {
                  background: red[400],
                  backgroundImage: "none",
                  boxShadow: `0 0 0 1px ${alpha(red[300], 0.5)}`,
                },
              }),

            // outlined chip
            ...(ownerState.variant === "outlined" && {
              backgroundColor: alpha(brand[300], 0.1),
              border: `1px solid ${brand[300]}`,
              color: brand[500],
              "&:hover": {
                backgroundColor: alpha(brand[300], 0.3),
                borderColor: brand[200],
              },
            }),

            // disabled state
            "&.Mui-disabled": {
              backgroundColor: brand[100],
              color: brand[200],
            },

            "& .MuiChip-label": {
              fontWeight: "inherit",
            },
          }),
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: () => ({
            borderColor: `${alpha(gray[200], 0.8)}`,
          }),
        },
      },
      MuiLink: {
        defaultProps: {
          underline: "none",
        },
        styleOverrides: {
          root: () => ({
            color: brand[600],
            fontWeight: 500,
            position: "relative",
            textDecoration: "none",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 0,
              height: "1px",
              bottom: 0,
              left: 0,
              backgroundColor: "#000",
              opacity: 0.7,
              transition: "width 0.3s ease, opacity 0.3s ease",
            },
            "&:hover::before": {
              width: "100%",
              opacity: 1,
            },
          }),
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: () => ({
            borderRadius: "99px",
            color: gray[500],
            fontWeight: 500,
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: () => ({
            backgroundImage: "none",
            backgroundColor: gray[100],
          }),
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: () => ({
            boxSizing: "border-box",
            width: 36,
            height: 24,
            padding: 0,
            transition: "background-color 100ms ease-in",
            "&:hover": {
              "& .MuiSwitch-track": {
                backgroundColor: brand[600],
              },
            },
            "& .MuiSwitch-switchBase": {
              "&.Mui-checked": {
                transform: "translateX(13px)",
              },
            },
            "& .MuiSwitch-track": {
              borderRadius: 50,
            },
            "& .MuiSwitch-thumb": {
              boxShadow: "0 0 2px 2px rgba(0, 0, 0, 0.2)",
              backgroundColor: "#FFF",
              width: 16,
              height: 16,
              margin: 2,
            },
          }),
          switchBase: {
            height: 24,
            width: 24,
            padding: 0,
            color: "#fff",
            "&.Mui-checked + .MuiSwitch-track": {
              opacity: 1,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            "& label .Mui-focused": {
              color: "white",
            },
            "& .MuiInputBase-input": {
              boxSizing: "border-box",
              height: "100%",
              "&::placeholder": {
                opacity: 0.7,
              },
              "&[type=number]": {
                MozAppearance: "textfield",
                textAlign: "center",
              },
              "&[type=number]::-webkit-outer-spin-button": {
                WebkitAppearance: "none",
                margin: 0,
              },
              "&[type=number]::-webkit-inner-spin-button": {
                WebkitAppearance: "none",
                margin: 0,
              },
            },
            "& .MuiOutlinedInput-root": {
              boxSizing: "border-box",
              minWidth: 50,
              minHeight: 40,
              height: "100%",
              borderRadius: "10px",
              transition: "border-color 120ms ease-in",
              "& fieldset": {
                boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
                background: `${alpha("#FFF", 0.3)}`,
              },
              "&.Mui-focused fieldset": {
                borderWidth: 2,
                borderColor: brand[400],
              },
              "&:hover": {
                borderColor: brand[300],
              },
              "&.Mui-focused": {
                borderColor: brand[400],
                outline: "1px solid",
                outlineColor: brand[200],
              },
              ...(ownerState?.color === "error" && {
                "&.Mui-focused fieldset": {
                  borderWidth: 2,
                  borderColor: red[400],
                },
              }),
              ...(ownerState?.color === "success" && {
                "&.Mui-focused fieldset": {
                  borderWidth: 2,
                  borderColor: green[400],
                },
              }),
            },
          }),
        },
      },
    },
  },
  arSD
);

export default responsiveFontSizes(muiTheme);
