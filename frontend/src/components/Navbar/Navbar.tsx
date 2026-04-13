import logo from "@/assets/images/logo-2.png";
import AccountMenu from "@/components/AccountMenu";
import Image from "@/components/Image";
import {
  hideSideDrawer,
  selectIsNavbarVisible,
  selectIsSideDrawerVisible,
  showSideDrawer,
} from "@/features/AppSettings";
import { selectIsLoggedIn } from "@/features/User";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Link,
  Stack,
  Toolbar,
} from "@mui/material";
import { Trans } from "react-i18next";
import { NavLink } from "react-router-dom";
import { buildAdminUrl } from "@/utils/adminUrl";
import { Icons } from "./Icons";

const Navbar = () => {
  const dispatch = useAppDispatch();

  const isSideDrawerVisible = useAppSelector(selectIsSideDrawerVisible);

  const isNavbarVisible = useAppSelector(selectIsNavbarVisible);

  const isLoggedIn = useAppSelector(selectIsLoggedIn);

  const handleToggleAppSideDrawer = () => {
    const action = isSideDrawerVisible ? hideSideDrawer() : showSideDrawer();
    dispatch(action);
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      color="primary"
      sx={{ display: isNavbarVisible ? "flex" : "none" }}
    >
      <Toolbar sx={{ gap: { xs: 0.5, sm: 1 }, px: 3 }}>
        <IconButton onClick={handleToggleAppSideDrawer} color="inherit">
          {isSideDrawerVisible ? <Icons.DrawerOpen /> : <Icons.Drawer />}
        </IconButton>
        <NavLink to={"/me"}>
          <Image
            src={logo}
            alt="Logo"
            boxProps={{
              sx: {
                width: 25,
                objectFit: "contain",
                marginInlineStart: "15px",
                transform: "scale(1.3)",
              },
            }}
          />
        </NavLink>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" gap={2} alignItems="center">
          {isLoggedIn && <AccountMenu />}
          {!isLoggedIn && (
            <>
              <Button
                endIcon={<Icons.Login />}
                LinkComponent={Link}
                href={buildAdminUrl()}
                sx={{ color: "white" }}
              >
                <Trans i18nKey="Buttons.login">Login</Trans>
              </Button>
            </>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
