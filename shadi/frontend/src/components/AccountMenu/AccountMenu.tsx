// MUI
import {
  Button,
  CardContent,
  Chip,
  Grid2 as Grid,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { TabContext, TabPanel } from "@mui/lab";

// icons
import LogoutIcon from "@mui/icons-material/PowerSettingsNew";

// project imports
import UserAvatar from "@/components/UserAvatar";
import { ListItemIcon } from "@mui/material";
import { FC } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AccountMenuContext } from "./context/AccountMenuContext";
import useAccountMenu from "./hooks/useAccountMenu";
import { menuSlotProps } from "./styles";
import classes from "./styles.module.css";
import { useAppSelector } from "@/store";
import { selectUserRole } from "@/features/User";

const AccountMenu: FC = () => {
  const { t } = useTranslation("translation");
  const {
    anchorEl,
    open,
    fullName,
    userInitial,
    isMobile,
    handleClick,
    handleClose,
    handleLogOut,
  } = useAccountMenu();
  const userRole = useAppSelector(selectUserRole);

  return (
    <AccountMenuContext.Provider
      value={{
        onClose: handleClose,
        onLogOut: handleLogOut,
      }}
    >
      <Tooltip title="Account settings">
        <Button
          onClick={handleClick}
          aria-controls={open ? "account-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          startIcon={<UserAvatar fullName={fullName} initials={userInitial} />}
          sx={{
            textTransform: "none",
            color: (theme) => theme.palette.grey[50],
          }}
        >
          {!isMobile && (
            <Typography variant="subtitle2" mx={2}>
              {fullName}
            </Typography>
          )}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        slotProps={menuSlotProps}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <CardContent sx={{ width: "350px" }}>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid>
              <Stack direction="row" alignItems="center">
                <UserAvatar fullName={fullName ?? ""} initials={userInitial} />
                <Typography variant="subtitle1" mx={1}>
                  {fullName}
                </Typography>
              </Stack>
            </Grid>
            <Grid>
              <Chip label={t(`Roles.${userRole}`)} color="info" />
            </Grid>
          </Grid>
        </CardContent>
        <TabContext value={"profile"}>
          <TabPanel
            value="profile"
            classes={{
              root: classes.tabPanelRoot,
            }}
          >
            <MenuItem onClick={handleLogOut}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                <Trans i18nKey={"Buttons.logout"}>Logout</Trans>
              </ListItemText>
            </MenuItem>
          </TabPanel>
        </TabContext>
      </Menu>
    </AccountMenuContext.Provider>
  );
};

export default AccountMenu;
