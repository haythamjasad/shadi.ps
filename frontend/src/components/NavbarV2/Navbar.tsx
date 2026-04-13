import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import { ClipboardClock, HandCoins, Menu, Store } from "lucide-react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { navItems } from "./constants";
import { StyledMenuItem, StyledToolbar } from "./StyledElements";
import styles from "./styles.module.css";
import fullLogo from "@/assets/images/logo-2.png";
import AddChargeForm from "@/pages/Home/components/AddChargeForm";

const navActionButtonSx = {
  background: "linear-gradient(180deg, #ffbd59 0%, #f8a01b 100%)",
  backgroundColor: "#f8a01b",
  borderColor: "#e59616",
  backgroundImage: "none",
  color: "#000",
  fontWeight: 800,
  boxShadow: "0 10px 22px rgba(248, 160, 27, 0.22)",
  outline: "1px solid #E58F00",
  borderRadius: "18px",
  "&:hover": {
    background: "linear-gradient(180deg, #ffc46a 0%, #f6a21f 100%)",
    backgroundColor: "#f6a21f",
    borderColor: "#e59616",
    backgroundImage: "none",
    boxShadow: "0 14px 30px rgba(248, 160, 27, 0.28)",
  },
};

const visitStoreButtonSx = {
  ...navActionButtonSx,
};

const Navbar: FC = () => {
  const { t } = useTranslation("translation");
  const storeUrl = "https://store.shadi.ps";

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddChargeFormOpen, setIsAddChargeFormOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const toggleDrawer = (newIsOpen: boolean) => () => {
    setIsDrawerOpen(newIsOpen);
  };

  const scrollToSection = (sectionId: string) => {
    const sectionElement = document.getElementById(sectionId);
    const offset = 140;
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth" });
      window.scrollTo({
        top: sectionElement.offsetTop - offset,
        behavior: "smooth",
      });
    } else {
      navigate({ pathname: "/", hash: `#${sectionId}` });
    }
    toggleDrawer(false)();
  };

  const goToConsultingPage = (hash: string) => {
    const sectionElement = document.getElementById(hash);

    if (location.pathname === "/consulting" && sectionElement) {
      const offset = 140;
      sectionElement.scrollIntoView({ behavior: "smooth" });
      window.scrollTo({
        top: sectionElement.offsetTop - offset,
        behavior: "smooth",
      });
      toggleDrawer(false)();
      return;
    }

    navigate({ pathname: "/consulting", hash: `#${hash}` });
    toggleDrawer(false)();
  };

  const handleBookAppointment = () => {
    goToConsultingPage("appointment_form");
  };

  const renderNavigationsItems = navItems.map((item) => (
    <StyledMenuItem key={item} onClick={() => scrollToSection(item)}>
      <Typography variant="h6" color="text.primary">
        {t(`NavItems.${item}`)}
      </Typography>
    </StyledMenuItem>
  ));

  const renderDrawerNavigationButtons = navItems.map((item) => (
    <Button
      key={item}
      variant="contained"
      size="small"
      onClick={() => scrollToSection(item)}
      fullWidth
      sx={{
        ...navActionButtonSx,
        width: "100%",
        fontSize: { xs: "0.85rem", sm: "0.875rem" },
        fontWeight: 700,
        justifyContent: "center",
        textAlign: "center",
        display: "flex",
        alignSelf: "stretch",
        direction: "rtl",
      }}
    >
      {t(`NavItems.${item}`)}
    </Button>
  ));

  return (
    <AppBar
      position="fixed"
      sx={{
        boxShadow: 0,
        backgroundColor: "transparent",
        marginTop: 2,
      }}
    >
      <Container sx={{ maxWidth: "1850px !important" }}>
        <StyledToolbar variant="regular">
          <Stack direction="row" flexGrow={1} ml={-1}>
            <Link
              to="/"
              onClick={() => scrollToSection("home_top_section")}
            >
              <img
                src={fullLogo}
                width="32px"
                alt="logo of shadi shirri"
                style={{ marginInlineStart: "10px", marginBlockStart: "5px" }}
              />
            </Link>
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, px: 3 }}>
              {renderNavigationsItems}
            </Box>
          </Stack>
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1.5,
              width: "450px",
              maxWidth: "450px",
              flexShrink: 0,
            }}
          >
            <Button
              variant="contained"
              size="small"
              component="a"
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              endIcon={<Store size={20} />}
              sx={{
                ...visitStoreButtonSx,
                flex: 1,
                minWidth: 0,
                px: 1.8,
                py: 0.75,
                fontSize: "0.82rem",
                lineHeight: 1.2,
                textAlign: "center",
                whiteSpace: "nowrap",
                "& .MuiButton-endIcon": {
                  marginInlineStart: "6px",
                  marginInlineEnd: 0,
                },
              }}
            >
              <Trans i18nKey="Buttons.visitStore">Go to Store</Trans>
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => setIsAddChargeFormOpen(true)}
              endIcon={<HandCoins size={20} />}
              sx={{
                ...navActionButtonSx,
                flex: 1,
                minWidth: 0,
                px: 1,
                py: 0.75,
                fontSize: "0.82rem",
                lineHeight: 1.2,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              <Trans i18nKey="Buttons.addPayment">Add Payment</Trans>
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleBookAppointment}
              endIcon={<ClipboardClock size={20} />}
              sx={{
                ...navActionButtonSx,
                flex: 1,
                minWidth: 0,
                px: 1,
                py: 0.75,
                fontSize: "0.82rem",
                lineHeight: 1.2,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              <Trans i18nKey="Buttons.book_consultation">
                Book Consultation
              </Trans>
            </Button>
          </Box>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ display: { xs: "flex", md: "none" } }}
          >
            <Button
              variant="contained"
              size="small"
              component="a"
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              endIcon={<Store size={18} />}
              sx={{
                ...visitStoreButtonSx,
                minHeight: 42,
                minWidth: "fit-content",
                px: 1.5,
                py: 0.75,
                whiteSpace: "nowrap",
                fontSize: "0.8rem",
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                "& .MuiButton-endIcon": {
                  marginInlineStart: "6px",
                  marginInlineEnd: 0,
                },
              }}
            >
              <Trans i18nKey="Buttons.visitStore">Go to Store</Trans>
            </Button>
            <Button
              variant="text"
              color="primary"
              aria-label="menu"
              onClick={toggleDrawer(!isDrawerOpen)}
              className={styles.menuBtn}
            >
              <Menu />
            </Button>
              <Drawer
                anchor="right"
                open={isDrawerOpen}
                onClose={toggleDrawer(false)}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                  sx: {
                    width: { xs: "82vw", sm: 360 },
                    maxWidth: 360,
                    borderTopLeftRadius: 20,
                    borderBottomLeftRadius: 20,
                    backgroundColor: "#fff",
                  },
                }}
              >
              <Box
                p={2}
                flexGrow={1}
                sx={{
                  minWidth: "100%",
                  backgroundColor: "background.paper",
                }}
              >
                <Stack
                  spacing={1.5}
                  flexGrow={1}
                  gap={2}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Link to="/">
                      <img
                        src={fullLogo}
                        width="32px"
                        alt="logo of shadi shirri"
                        style={{}}
                      />
                    </Link>
                    <Button
                      variant="text"
                      color="primary"
                      aria-label="close menu"
                      onClick={toggleDrawer(false)}
                      className={styles.menuBtn}
                      sx={{ minWidth: "auto" }}
                    >
                      <Menu />
                    </Button>
                  </Stack>
                  <Stack direction="column" spacing={1.5} alignItems="stretch">
                    <Button
                      variant="contained"
                      size="small"
                      component="a"
                      href={storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      endIcon={<Store size={20} />}
                      sx={{
                        ...visitStoreButtonSx,
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 4,
                        fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        fontWeight: 700,
                        py: 0.75,
                      }}
                    >
                      <Trans i18nKey="Buttons.visitStore">Go to Store</Trans>
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        setIsAddChargeFormOpen(true);
                        toggleDrawer(false)();
                      }}
                      endIcon={<HandCoins size={20} />}
                      sx={{
                        ...navActionButtonSx,
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 4,
                        fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        fontWeight: 700,
                        py: 0.75,
                      }}
                    >
                      <Trans i18nKey="Buttons.addPayment">Add Payment</Trans>
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleBookAppointment}
                      endIcon={<ClipboardClock size={20} />}
                      sx={{
                        ...navActionButtonSx,
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 4,
                        fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        fontWeight: 700,
                        py: 0.75,
                      }}
                    >
                      <Trans i18nKey="Buttons.book_consultation">
                        Book Consultation
                      </Trans>
                    </Button>
                  </Stack>
                  <Divider sx={{ my: 1.5, borderColor: "#000000" }} />
                </Stack>
                <Stack spacing={1.5} alignItems="stretch" sx={{ mt: 3 }}>
                  {renderDrawerNavigationButtons}
                </Stack>
              </Box>
            </Drawer>
          </Stack>
        </StyledToolbar>
      </Container>
      <Dialog
        open={isAddChargeFormOpen}
        onClose={() => setIsAddChargeFormOpen(false)}
        fullWidth
      >
        <DialogTitle>
          <Trans i18nKey="Buttons.addPayment">Add Payment</Trans>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 4 }}>
          <AddChargeForm setIsAddChargeFormOpen={setIsAddChargeFormOpen} />
        </DialogContent>
      </Dialog>
    </AppBar>
  );
};

export default Navbar;
