import notFound from "@/animation/404.json";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeIcon from "@mui/icons-material/Home";
import ReplayIcon from "@mui/icons-material/Replay";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Lottie from "lottie-react";
import { FC } from "react";
import { Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";

const NotFound: FC = () => {
  const navigate = useNavigate();

  const goToHome = () => navigate("/");
  const backToPreviousPage = () => navigate(-1);
  const reloadPage = () => navigate(0);

  return (
    <Grid
      container
      sx={{
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        bgcolor: "grey.100",
      }}
    >
      <Stack sx={{ alignItems: "center" }}>
        <Lottie animationData={notFound} />
        <Typography
          variant="h2"
          sx={{ color: "grey.700", mt: -5 }}
          fontSize={{ xs: "h4.fontSize", md: "h3.fontSize", xl: "h2.fontSize" }}
        >
          <Trans i18nKey={"PublicPages.NotFound.title"}>
            Oops! Page not found
          </Trans>
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ mt: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={backToPreviousPage}
            size="large"
            variant="contained"
          >
            <Trans i18nKey={"Buttons.back"}>Back</Trans>
          </Button>
          <Button
            startIcon={<HomeIcon />}
            onClick={goToHome}
            size="large"
            variant="outlined"
          >
            <Trans i18nKey={"Buttons.home"}>Home</Trans>
          </Button>
          <Button
            startIcon={<ReplayIcon />}
            onClick={reloadPage}
            size="large"
            variant="outlined"
          >
            <Trans i18nKey={"Buttons.reload"}>Reload</Trans>
          </Button>
        </Stack>
      </Stack>
    </Grid>
  );
};

export default NotFound;
