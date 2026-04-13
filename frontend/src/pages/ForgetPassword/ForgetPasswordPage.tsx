import logo from "@/assets/images/logo-2.png";
import useMediaQuery from "@/hooks/useMediaQuery";
import { Card, Container, Stack } from "@mui/material";
import ForgetPasswordForm from "./components/ForgetPasswordForm";

const ForgetPasswordPage = () => {
  const { isTabletOrLess, isMobile } = useMediaQuery();

  return (
    <Container
      disableGutters
      sx={{
        height: "100vh",
        minWidth: "100%",
      }}
    >
      <Stack
        justifyContent="center"
        alignItems="center"
        sx={{
          bgcolor: (theme) => theme.palette.primary.main,
          width: "100%",
          height: "100vh",
        }}
      >
        <Card
          sx={{
            p: 3,
            m: 2,
            width: isMobile ? "90%" : isTabletOrLess ? "60%" : "30%",
            maxWidth: "500px",
          }}
        >
          <Stack direction="row" justifyContent="center" mb={3}>
            <img
              src={logo}
              alt="Shadi Shirri logo"
              width={isMobile ? "45%" : "35%"}
            />
          </Stack>
          <ForgetPasswordForm />
        </Card>
      </Stack>
    </Container>
  );
};

export default ForgetPasswordPage;
