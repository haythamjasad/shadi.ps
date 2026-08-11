import { APP_SIDE_DRAWER_WIDTH, NAVBAR_HEIGHT } from "@/constants";
import Grid from "@mui/material/Grid2";
import { styled } from "@mui/material/styles";
import { AppLayoutContainerProps } from "./types";

export const AppLayoutContainer = styled(Grid, {
  shouldForwardProp: (prop) =>
    !["isNavbarVisible", "isSideDrawerVisible", "isMobile"].includes(
      prop.toString()
    ),
  name: "AppLayoutContainer",
})<AppLayoutContainerProps>(
  ({ theme, isNavbarVisible, isSideDrawerVisible, dir, isMobile }) => ({
    position: "absolute",
    top: isNavbarVisible ? NAVBAR_HEIGHT : 0,
    height: isNavbarVisible ? `calc(100% - ${NAVBAR_HEIGHT}px)` : "100%",
    right: 0,
    display: "block",
    overflow: "auto",
    transition: ".25s",
    width: "100%",
    backgroundColor: theme.palette.grey[50],
    justifyContent: "center",
    alignItems: "center",
    ...theme.mixins.niceScroll(),
    ...(isSideDrawerVisible &&
      !isMobile && {
        ...(dir === "rtl"
          ? { paddingRight: APP_SIDE_DRAWER_WIDTH }
          : { paddingLeft: APP_SIDE_DRAWER_WIDTH }),
      }),
  })
);
