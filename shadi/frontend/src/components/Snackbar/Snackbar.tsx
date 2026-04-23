import { hideSnackbar, selectSnackbar } from "@/features/Snackbar";
import { useAppDispatch, useAppSelector } from "@/store";
import AlertTitle from "@mui/material/AlertTitle";
import Slide from "@mui/material/Slide";
import MuiSnackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import React from "react";
import Alert from "./Alert";
import { useTranslation } from "react-i18next";

const Snackbar = () => {
  const dispatch = useAppDispatch();
  const {
    isOpen,
    title,
    message,
    severity,
    variant,
    anchorOrigin,
    autoHideDuration,
    icon,
    alertAction,
  } = useAppSelector(selectSnackbar);

  const handleClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;

    dispatch(hideSnackbar());
  };

  const { t } = useTranslation("translation");

  return (
    <Stack gap={2} sx={{ width: "100%" }}>
      <MuiSnackbar
        open={isOpen}
        autoHideDuration={autoHideDuration}
        anchorOrigin={anchorOrigin}
        onClose={handleClose}
        TransitionComponent={Slide}
      >
        <Alert
          icon={icon}
          variant={variant}
          severity={severity}
          onClose={handleClose}
          sx={{ width: "100%" }}
          action={alertAction}
        >
          {title && <AlertTitle>{title}</AlertTitle>}
          {message ? t(`SnackbarMessages.${message}`) : ""}
        </Alert>
      </MuiSnackbar>
    </Stack>
  );
};

export default Snackbar;
