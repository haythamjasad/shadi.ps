import TextField from "@/components/Fields/TextField";
import ServiceTypeSelector from "@/pages/Home/components/JoinRequestForm/components/ServiceTypeSelector";
import useAddTransaction from "@/services/Transactions/useAddTransaction";
import { LoadingButton } from "@mui/lab";
import {
  alpha,
  Box,
  Card,
  FormHelperText,
  Grid2,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { CircleDollarSign } from "lucide-react";
import { FC, useEffect, useRef } from "react";
import { Trans } from "react-i18next";
import ReCAPTCHA from "react-google-recaptcha";
import LocationSelector from "./components/LocationSelector";
import PoliciesSection from "./components/PoliciesSection";
import { logoColor } from "@/style/colors";
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
      "& .MuiOutlinedInput-input": {
        fontSize: { xs: "16px", md: "1rem" },
      },
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
    const { selectedLocation, selectedServices, name, email, phone, notes } = values;
    const cost = selectedServices.reduce(
      (total, service) =>
        total +
        (selectedLocation?.value === "ZOOM" ? service.zoomCost : service.cost),
      selectedLocation ? selectedLocation.cost : 0,
    );
    addTransaction({
      name,
      email,
      phone,
      notes,
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
    <SectionContainer
      id="appointment_form"
      py={0}
      px={0}
      sx={{ pt: { xs: 1, md: 2 } }}
    >
      <Stack
        spacing={2}
        justifyContent="center"
        alignItems="center"
        pt={{ xs: 1, md: 1.5 }}
        pb={2}
      >
        <Typography
          sx={() => ({
            width: "100%",
            fontSize: { xs: "14pt", md: "34pt" },
            fontWeight: "bold",
            color: logoColor,
            textAlign: "center",
          })}
        >
          حجز الاستشارة
        </Typography>
        <Card
          sx={{
            width: { xs: "90%", md: "85%" },
            maxWidth: 1180,
            borderRadius: 4,
            mx: "auto",
            p: { xs: 2.25, md: 3 },
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

                <Grid2 size={{ xs: 12 }}>
                  <Box
                    sx={{
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
                      mt: 0.5,
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
                </Grid2>
                <Grid2 size={{ xs: 12 }}>
                  <Stack
                    direction="row"
                    justifyContent="flex-start"
                    alignItems="center"
                    spacing={2}
                    sx={{ mt: 1.5 }}
                  >
                    {recaptchaEnabled && (
                      <Box
                        sx={{
                          width: "100%",
                          minWidth: { xs: "100%", md: 302 },
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          "& > div": {
                            transform: { xs: "scale(0.82)", md: "none" },
                            transformOrigin: "right top",
                          },
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
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="flex-end"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        px: { xs: 1.25, md: 2 },
                        py: { xs: 0.75, md: 1 },
                        borderRadius: "4px",
                        minWidth: { xs: 160, md: 200 },
                        backgroundColor: "#ffffff",
                        border: "1px solid rgba(248, 159, 50, 0.35)",
                        boxShadow: "none",
                        "&:hover": {
                          border: "1px solid rgba(248, 159, 50, 1)",
                        },
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
                          sx={{ fontWeight: "bold", color: alpha("#000000", 0.7) }}
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
                        minWidth: { xs: "110px", md: "140px" },
                        borderRadius: "4px",
                        border: "1px solid rgba(248, 159, 50, 0.35)",
                        boxShadow: "none",
                        fontSize: { xs: "0.95rem", md: "1rem" },
                        "&:hover": {
                          boxShadow: "none",
                          border: "1px solid rgba(248, 159, 50, 1)",
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
