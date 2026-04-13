import TextField from "@/components/Fields/TextField";
import ServiceTypeSelector from "@/pages/Home/components/JoinRequestForm/components/ServiceTypeSelector";
import useAddTransaction from "@/services/Transactions/useAddTransaction";
import { LoadingButton } from "@mui/lab";
import {
  alpha,
  Card,
  Grid2,
  Paper,
  Stack,
  Typography,
  FormHelperText,
  Box,
} from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { CircleDollarSign } from "lucide-react";
import { FC, useEffect, useRef } from "react";
import { Trans } from "react-i18next";
import ReCAPTCHA from "react-google-recaptcha";
import LocationSelector from "./components/LocationSelector";
import PoliciesSection from "./components/PoliciesSection";
import { brand, logoColor } from "@/style/colors";
import { initialValues, recaptchaEnabled, validationSchema } from "./form";
import { AddTransactionPayload } from "./types";
import SectionContainer from "../UI/SectionContainer";

const AppointmentForm: FC = () => {
  const { addTransaction, isAddPending, isAddSuccess } = useAddTransaction();
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const accentColor = logoColor;
  const cardBg = "#ffffff";
  const fieldStyles = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#ffffff",
      color: "inherit",
      "& fieldset": {
        borderColor: alpha(accentColor, 0.35),
      },
      "&:hover fieldset": {
        borderColor: accentColor,
      },
      "&.Mui-focused fieldset": {
        borderColor: accentColor,
      },
    },
    "& .MuiFormLabel-root": {
      color: alpha("#000000", 0.7),
      "&.Mui-focused": {
        color: accentColor,
      },
    },
  };

  const onSubmit = (values: AddTransactionPayload) => {
    const {
      selectedLocation,
      selectedServices,
      privacyPolicyAgreed,
      recaptchaToken,
      ...payload
    } = values;
    const cost = selectedServices.reduce(
      (total, service) =>
        total +
        (selectedLocation?.value === "ZOOM" ? service.zoomCost : service.cost),
      selectedLocation ? selectedLocation.cost : 0,
    );
    addTransaction({
      ...payload,
      location: selectedLocation.value,
      serviceType: selectedServices.map((service) => service.value),
      cost,
    });
  };
  const formikProps = useFormik({
    initialValues,
    onSubmit,
    validationSchema,
  });

  const { values } = formikProps;

  const orderTotal = values.selectedServices.reduce(
    (total, service) =>
      total +
      (values.selectedLocation?.value === "ZOOM"
        ? service.zoomCost
        : service.cost),
    values.selectedLocation?.cost ? values.selectedLocation.cost : 0,
  );

  const { resetForm } = formikProps;

  useEffect(() => {
    if (isAddSuccess) {
      resetForm();
      recaptchaRef.current?.reset();
    }
  }, [isAddSuccess, resetForm]);

  return (
    <SectionContainer id="appointment_form" py={0} px={0}>
      <Stack
        spacing={2}
        justifyContent="center"
        alignItems="center"
        pt={2}
        pb={2}
      >
        {/* <SectionTitle logo={<ClipboardClock size={40} strokeWidth={1.5} />}>
          حجز استشارة
        </SectionTitle> */}
        <Typography
          sx={() => ({
            /*color: logoColor,*/
            width: "100%",
            fontSize: { xs: "14pt", md: "34pt" },
            fontWeight: "bold",
            color: logoColor,
          })}
        >
          حجز استشارة
        </Typography>
        <Card
          sx={{
            width: "100%",
            maxWidth: 1180,
            borderRadius: 4,
            p: { xs: 2, md: 3 },
            border: `1px solid ${alpha(accentColor, 0.25)}`,
            background: cardBg,
            boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
            color: "inherit",
          }}
        >
          <FormikProvider value={formikProps}>
            <Form>
              <Grid2 container width="100%" spacing={2} alignItems="stretch">
                <Grid2
                  size={{ xs: 12, md: 5 }}
                  sx={{ display: "flex", height: "100%" }}
                >
                  <Stack spacing={1.5} height="100%" flex={1}>
                    <TextField
                      name="name"
                      aria-label="Please enter your first name"
                      sx={fieldStyles}
                      InputLabelProps={{
                        sx: { fontSize: "clamp(9pt, 1vw, 12pt)" },
                      }}
                      slotProps={{
                        input: {
                          style: {
                            fontSize: "clamp(9pt, 1vw, 12pt)",
                          },
                        },
                      }}
                    />
                    <TextField
                      name="email"
                      aria-label="Enter your email"
                      sx={fieldStyles}
                      InputLabelProps={{
                        sx: { fontSize: "clamp(9pt, 1vw, 12pt)" },
                      }}
                      slotProps={{
                        input: {
                          style: {
                            fontSize: "clamp(9pt, 1vw, 12pt)",
                          },
                        },
                      }}
                    />
                    <TextField
                      name="phone"
                      aria-label="Please enter your phone number"
                      sx={fieldStyles}
                      InputLabelProps={{
                        sx: { fontSize: "clamp(9pt, 1vw, 12pt)" },
                      }}
                      slotProps={{
                        input: {
                          style: {
                            direction: "ltr",
                            textAlign: "end",
                            fontSize: "clamp(9pt, 1vw, 12pt)",
                          },
                        },
                      }}
                    />
                  </Stack>
                </Grid2>
                <Grid2
                  size={{ xs: 12, md: 7 }}
                  sx={{ display: "flex", height: "100%" }}
                >
                  <Stack spacing={1.5} flex={1}>
                    <ServiceTypeSelector name="selectedServices" />
                    <LocationSelector name="selectedLocation" />
                  </Stack>
                </Grid2>
                <Grid2 size={{ xs: 12 }}>
                  <TextField
                    name="notes"
                    multiline
                    rows={6}
                    aria-label="Please enter additional details"
                    sx={fieldStyles}
                    InputLabelProps={{
                      sx: { fontSize: "clamp(9pt, 1vw, 12pt)" },
                    }}
                    slotProps={{
                      input: {
                        style: {
                          fontSize: "clamp(9pt, 1vw, 12pt)",
                        },
                      },
                    }}
                  />
                </Grid2>

                {/* Privacy Policy Section + Recaptcha */}
                <Grid2 size={{ xs: 12 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems="stretch"
                    sx={{ mt: 0.5, mb: 1 }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        "& .MuiAccordion-root": {
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                        },
                        "& .MuiAccordionDetails-root": {
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                        },
                        minWidth: 0,
                      }}
                    >
                      <PoliciesSection
                        transparency={0.12}
                        agreed={values.privacyPolicyAgreed}
                        onChange={(checked) => {
                          formikProps.setFieldValue(
                            "privacyPolicyAgreed",
                            checked,
                          );
                        }}
                        error={formikProps.errors.privacyPolicyAgreed}
                        touched={formikProps.touched.privacyPolicyAgreed}
                      />
                    </Box>
                    {recaptchaEnabled && (
                      <Box
                        sx={{
                          minWidth: { md: 320 },
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          mt: { xs: 1, md: 0 },
                        }}
                      >
                        <ReCAPTCHA
                          ref={recaptchaRef}
                          sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""}
                          onChange={(token) => {
                            formikProps.setFieldValue(
                              "recaptchaToken",
                              token || "",
                            );
                          }}
                          onExpired={() => {
                            formikProps.setFieldValue("recaptchaToken", "");
                          }}
                        />
                        {formikProps.touched.recaptchaToken &&
                          formikProps.errors.recaptchaToken && (
                            <FormHelperText error sx={{ textAlign: "center" }}>
                              {formikProps.errors.recaptchaToken}
                            </FormHelperText>
                          )}
                      </Box>
                    )}
                  </Stack>
                </Grid2>
                <Grid2 size={{ xs: 12 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        minWidth: 200,
                        backgroundColor: alpha(brand[50], 0.9),
                        border: `1px solid ${alpha(accentColor, 0.3)}`,
                        color: brand[700],
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        height="100%"
                        spacing={2}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: "bold", color: "#f7f5ef" }}
                        >
                          إجمالي الدفع
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          fontWeight="bold"
                          sx={{ color: accentColor }}
                        >
                          ${orderTotal}
                        </Typography>
                      </Stack>
                    </Paper>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      endIcon={<CircleDollarSign />}
                      sx={{
                        minWidth: "140px",
                        background: "linear-gradient(135deg, #f1b14e, #f29a2c)",
                        borderColor: alpha(accentColor, 0.7),
                        color: "#3a2304",
                        boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
                        "&:hover": {
                          background: "linear-gradient(135deg, #f1b14e, #f29a2c)",
                          boxShadow: "0 14px 26px rgba(0,0,0,0.28)",
                        },
                      }}
                      loading={isAddPending}
                      disabled={
                        isAddPending ||
                        !values.privacyPolicyAgreed ||
                        (recaptchaEnabled && !values.recaptchaToken) ||
                        !formikProps.isValid
                      }
                    >
                      <Trans i18nKey="Buttons.pay">Pay</Trans>
                    </LoadingButton>
                  </Stack>
                </Grid2>
              </Grid2>
            </Form>
          </FormikProvider>
        </Card>
      </Stack>
    </SectionContainer>
  );
};

export default AppointmentForm;
