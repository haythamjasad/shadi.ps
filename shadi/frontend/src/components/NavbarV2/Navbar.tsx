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
} from "@mui/material";
import { ClipboardClock, HandCoins, Menu, Store } from "lucide-react";
import { FC, useState } from "react";
import { Trans } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { StyledToolbar } from "./StyledElements";
import styles from "./styles.module.css";
import sharaNavLabel from "@/assets/images/shara-nav-label-new.png";
import storeNavLabel from "@/assets/images/store-nav-label-new.png";
import consultingNavLabel from "@/assets/images/consulting-nav-label-new.png";
import homeNavLabel from "@/assets/images/Shadi.png";
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
  const storeUrl = "https://store.shadi.ps";

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddChargeFormOpen, setIsAddChargeFormOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const isConsultingPage = location.pathname === "/consulting";

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

  const drawerNavItems = [
    { key: "about_us", label: "الشركة" },
    { key: "founder_profile", label: "المؤسس" },
    { key: "our_services", label: "الخدمات" },
  ];

  const renderDrawerNavigationButtons = (
    <Stack direction="column" spacing={1.2} alignItems="stretch">
      {drawerNavItems.map((item) => (
        <Button
          key={item.key}
          variant="outlined"
          size="small"
          onClick={() => scrollToSection(item.key)}
          fullWidth
          sx={{
            width: "100%",
            minHeight: 44,
            borderRadius: 999,
            borderColor: "#e59616",
            backgroundColor: "#f8a01b",
            boxShadow: "0 8px 18px rgba(248,160,27,0.18)",
            color: "#000",
            fontSize: { xs: "0.9rem", sm: "0.95rem" },
            fontWeight: 800,
            justifyContent: "center",
            textAlign: "center",
            direction: "rtl",
            "&:hover": {
              borderColor: "#e59616",
              backgroundColor: "#f6a21f",
              boxShadow: "0 10px 22px rgba(248,160,27,0.22)",
            },
          }}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );

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
        <StyledToolbar
          variant="regular"
          sx={(theme) => ({
            [theme.breakpoints.up("md")]: {
              position: "relative",
              paddingRight: "15px",
              paddingLeft: "15px",
              minHeight: "64px",
              maxHeight: "64px",
            },
            [theme.breakpoints.down("md")]: {
              direction: "ltr",
              px: 0.4,
              minHeight: 46,
              maxHeight: 56,
            },
          })}
        >
          <Stack
            direction="row"
            flexGrow={1}
            alignItems="center"
            sx={{
              display: { xs: "none", md: "flex" },
              width: "100%",
              direction: "ltr",
            }}
          >
            <Box
              style={{
                position: "absolute",
                left: 15,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                flexDirection: "row",
                direction: "ltr",
                gap: 12,
              }}
            >
              {!isConsultingPage && (
                <Button
                  variant="outlined"
                  onClick={() => window.open("https://www.shadi.ps/consulting#appointment_form", "_blank", "noopener,noreferrer")}
                  sx={{
                    minWidth: 128,
                    minHeight: 46,
                    borderRadius: 999,
                    borderColor: "rgba(0,0,0,0.08)",
                    backgroundColor: "rgba(255,255,255,0.92)",
                    boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                    px: 2.5,
                    "&:hover": { backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.12)" },
                  }}
                >
                  <Box component="img" src={consultingNavLabel} alt="إستشارة" sx={{ height: 24, maxWidth: 96, objectFit: "contain" }} />
                </Button>
              )}
              <Button
                variant="outlined"
                component="a"
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                sx={{
                  minWidth: 128,
                  minHeight: 46,
                  borderRadius: 999,
                  borderColor: "rgba(0,0,0,0.08)",
                  backgroundColor: "rgba(255,255,255,0.92)",
                  boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                  px: 2.5,
                  "&:hover": { backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.12)" },
                }}
              >
                <Box component="img" src={storeNavLabel} alt="المتجر" sx={{ height: 24, maxWidth: 82, objectFit: "contain" }} />
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.open("https://shara.shadi.ps", "_blank", "noopener,noreferrer")}
                sx={{
                  minWidth: 128,
                  minHeight: 46,
                  borderRadius: 999,
                  borderColor: "rgba(0,0,0,0.08)",
                  backgroundColor: "rgba(255,255,255,0.92)",
                  boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                  px: 2.5,
                  "&:hover": { backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.12)" },
                }}
              >
                <Box component="img" src={sharaNavLabel} alt="شعرة" sx={{ height: 24, maxWidth: 96, objectFit: "contain" }} />
              </Button>
              {isConsultingPage && (
                <Button
                  variant="outlined"
                  onClick={() => navigate("/")}
                  sx={{
                    minWidth: 128,
                    minHeight: 46,
                    borderRadius: 999,
                    borderColor: "rgba(0,0,0,0.08)",
                    backgroundColor: "rgba(255,255,255,0.92)",
                    boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                    px: 2.5,
                    "&:hover": { backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.12)" },
                  }}
                >
                  <Box component="img" src={homeNavLabel} alt="الرئيسية" sx={{ height: 24, maxWidth: 82, objectFit: "contain" }} />
                </Button>
              )}
            </Box>
            <Box
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <Link to="/" onClick={() => scrollToSection("home_top_section")}>
                <Box
                  component="img"
                  src="/circle_logo_footer.png"
                  alt="logo of shadi shirri"
                  sx={{
                    display: "block",
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              </Link>
            </Box>
          </Stack>
          <Box
            sx={{
              display: "none",
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
          <Box sx={{ display: { xs: "flex", md: "none" }, width: "100%", direction: "ltr" }}>
            <Box
              sx={{
                width: "100%",
                minHeight: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 0.25,
                px: 0,
                py: 0,
                direction: "ltr",
              }}
            >
              <Link
                to="/"
                onClick={() => scrollToSection("home_top_section")}
                style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <Box
                  component="img"
                  src="/circle_logo_footer.png"
                  alt="logo of shadi shirri"
                  sx={{
                    display: "block",
                    borderRadius: "50%",
                    width: 50,
                    height: 50,
                    objectFit: "cover",
                  }}
                />
              </Link>
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 1px minmax(0, 1fr) 1px minmax(0, 1fr)",
                  alignItems: "center",
                  justifyItems: "center",
                  direction: "ltr",
                }}
              >
                {isConsultingPage ? (
                  <>
                    <Button
                      variant="text"
                      onClick={() => navigate("/")}
                      sx={{ width: "100%", minWidth: 0, px: 0.25, py: 0.35 }}
                    >
                      <Box
                        component="img"
                        src={homeNavLabel}
                        alt="الرئيسية"
                        sx={{ display: "block", width: "100%", maxWidth: 60, height: 22, objectFit: "contain" }}
                      />
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ my: 0.6, borderColor: "#2f2f35" }} />
                    <Button
                      variant="text"
                      onClick={() => window.open("https://shara.shadi.ps", "_blank", "noopener,noreferrer")}
                      sx={{ width: "100%", minWidth: 0, px: 0.25, py: 0.35 }}
                    >
                      <Box
                        component="img"
                        src={sharaNavLabel}
                        alt="شعرة"
                        sx={{ display: "block", width: "100%", maxWidth: 68, height: 22, objectFit: "contain" }}
                      />
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ my: 0.6, borderColor: "#2f2f35" }} />
                    <Button
                      variant="text"
                      component="a"
                      href={storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ width: "100%", minWidth: 0, px: 0.25, py: 0.35 }}
                    >
                      <Box
                        component="img"
                        src={storeNavLabel}
                        alt="المتجر"
                        sx={{ display: "block", width: "100%", maxWidth: 60, height: 22, objectFit: "contain" }}
                      />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="text"
                      onClick={() => window.open("https://shara.shadi.ps", "_blank", "noopener,noreferrer")}
                      sx={{ width: "100%", minWidth: 0, px: 0.25, py: 0.35 }}
                    >
                      <Box
                        component="img"
                        src={sharaNavLabel}
                        alt="شعرة"
                        sx={{ display: "block", width: "100%", maxWidth: 68, height: 22, objectFit: "contain" }}
                      />
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ my: 0.6, borderColor: "#2f2f35" }} />
                    <Button
                      variant="text"
                      component="a"
                      href={storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ width: "100%", minWidth: 0, px: 0.25, py: 0.35 }}
                    >
                      <Box
                        component="img"
                        src={storeNavLabel}
                        alt="المتجر"
                        sx={{ display: "block", width: "100%", maxWidth: 60, height: 22, objectFit: "contain" }}
                      />
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ my: 0.6, borderColor: "#2f2f35" }} />
                    <Button
                      variant="text"
                      onClick={() => window.open("https://www.shadi.ps/consulting#appointment_form", "_blank", "noopener,noreferrer")}
                      sx={{ width: "100%", minWidth: 0, px: 0.25, py: 0.35 }}
                    >
                      <Box
                        component="img"
                        src={consultingNavLabel}
                        alt="إستشارة"
                        sx={{ display: "block", width: "100%", maxWidth: 78, height: 22, objectFit: "contain" }}
                      />
                    </Button>
                  </>
                )}
              </Box>
              <Button
                variant="text"
                color="primary"
                aria-label="menu"
                onClick={toggleDrawer(!isDrawerOpen)}
                sx={{
                  minWidth: 30,
                  width: 30,
                  height: 36,
                  p: 0,
                  color: "#3b3b44",
                  flexShrink: 0,
                  "&:hover": { backgroundColor: "transparent" },
                }}
              >
                <Menu size={22} strokeWidth={2.4} />
              </Button>
            </Box>
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
                    <Link to="/" onClick={toggleDrawer(false)}>
                      <Box
                        component="img"
                        src="/circle_logo_footer.png"
                        alt="logo of shadi shirri"
                        sx={{
                          display: "block",
                          width: 50,
                          height: 50,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
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
                  <Stack direction="column" spacing={1.2} alignItems="stretch">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        window.open("https://shara.shadi.ps", "_blank", "noopener,noreferrer");
                        toggleDrawer(false)();
                      }}
                      sx={{
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 999,
                        borderColor: "rgba(0,0,0,0.08)",
                        backgroundColor: "rgba(255,255,255,0.92)",
                        boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                        py: 0.75,
                        "&:hover": {
                          borderColor: "rgba(0,0,0,0.12)",
                          backgroundColor: "#fff",
                          boxShadow: "0 10px 22px rgba(30,30,40,0.1)",
                        },
                      }}
                    >
                      <Box component="img" src={sharaNavLabel} alt="شعرة" sx={{ height: 24, maxWidth: 96, objectFit: "contain" }} />
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      component="a"
                      href={storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 999,
                        borderColor: "rgba(0,0,0,0.08)",
                        backgroundColor: "rgba(255,255,255,0.92)",
                        boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                        py: 0.75,
                        "&:hover": {
                          borderColor: "rgba(0,0,0,0.12)",
                          backgroundColor: "#fff",
                          boxShadow: "0 10px 22px rgba(30,30,40,0.1)",
                        },
                      }}
                    >
                      <Box component="img" src={storeNavLabel} alt="المتجر" sx={{ height: 24, maxWidth: 86, objectFit: "contain" }} />
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={isConsultingPage ? () => {
                        navigate("/");
                        toggleDrawer(false)();
                      } : handleBookAppointment}
                      sx={{
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 999,
                        borderColor: "rgba(0,0,0,0.08)",
                        backgroundColor: "rgba(255,255,255,0.92)",
                        boxShadow: "0 8px 18px rgba(30,30,40,0.08)",
                        py: 0.75,
                        "&:hover": {
                          borderColor: "rgba(0,0,0,0.12)",
                          backgroundColor: "#fff",
                          boxShadow: "0 10px 22px rgba(30,30,40,0.1)",
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={isConsultingPage ? homeNavLabel : consultingNavLabel}
                        alt={isConsultingPage ? "الرئيسية" : "إستشارة"}
                        sx={{ height: 24, maxWidth: isConsultingPage ? 82 : 96, objectFit: "contain" }}
                      />
                    </Button>
                  </Stack>
                  <Divider sx={{ my: 1.5, borderColor: "#000000" }} />
                </Stack>
                <Stack spacing={1.5} alignItems="stretch" sx={{ mt: 3 }}>
                  {renderDrawerNavigationButtons}
                </Stack>
              </Box>
            </Drawer>
          </Box>
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
