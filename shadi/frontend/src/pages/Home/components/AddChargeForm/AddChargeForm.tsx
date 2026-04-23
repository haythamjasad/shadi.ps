import TextField from "@/components/Fields/TextField";
import { CreateChargeRequest } from "@/services/Transactions/APIs";
import useAddCharge from "@/services/Transactions/useAddCharge";
import { LoadingButton } from "@mui/lab";
import { FormHelperText, Grid2, Stack } from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { CircleDollarSign } from "lucide-react";
import { FC, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { Trans } from "react-i18next";
import * as yup from "yup";
import theme from "@/style/theme";
import PoliciesSection from "../AppointmentForm/components/PoliciesSection";
import { AddChargeFormProps } from "./types";

const recaptchaEnabled = import.meta.env.PROD && !!import.meta.env.VITE_RECAPTCHA_SITE_KEY;

const AddChargeForm: FC<AddChargeFormProps> = ({ setIsAddChargeFormOpen }) => {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { addCharge, isAddPending } = useAddCharge(setIsAddChargeFormOpen);

  const onSubmit = (values: Omit<CreateChargeRequest, "serviceType">) => {
    addCharge({ ...values, serviceType: ["CHARGES"] });
  };

  const formikProps = useFormik({
    initialValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
      cost: 0,
      privacyPolicyAgreed: false,
      recaptchaToken: "",
    },
    onSubmit,
    validationSchema: yup.object().shape({
      name: yup.string().required("Please enter your name"),
      email: yup
        .string()
        .email("Please enter a valid email")
        .required("Please enter your email"),
      phone: yup
        .string()
        .matches(
          /^(?:\+|00)[1-9]\d{6,14}$/,
          "Phone number must start with a country code"
        )
        .required("Please enter your phone number"),
      notes: yup.string(),
      cost: yup
        .number()
        .min(1, "Cost must be more than 0")
        .required("Please enter the cost"),
      privacyPolicyAgreed: yup
        .boolean()
        .oneOf([true], "يجب الموافقة على سياسة الخصوصية "),
      recaptchaToken: yup.string().when([], {
        is: () => recaptchaEnabled,
        then: (schema) => schema.required("يجب اكمال خيار التحقق."),
        otherwise: (schema) => schema.notRequired(),
      }),
    }),
  });

  const { values } = formikProps;

  return (
    <Stack spacing={2} justifyContent="center" alignItems="center" width="100%">
      <FormikProvider value={formikProps}>
        <Form style={{ width: "100%" }}>
          <Grid2 container width="100%" spacing={2}>
            <Grid2 size={{ xs: 12 }}>
              <TextField
                name="name"
                aria-label="Please enter your first name"
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
              <TextField
                name="email"
                aria-label="Enter your email"
                slotProps={{
                  input: {
                    style: {
                      fontSize: "clamp(9pt, 1vw, 12pt)",
                    },
                  },
                }}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <TextField
                name="phone"
                aria-label="Please enter your phone number"
                slotProps={{
                  input: {
                    style: {
                      direction: "ltr",
                      fontSize: "clamp(9pt, 1vw, 12pt)",
                    },
                  },
                }}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <TextField
                name="cost"
                aria-label="Please enter the cost"
                label="التكلفة بالدولار"
                type="number"
                value={values.cost == 0 ? "" : values.cost}
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
              <TextField
                name="notes"
                multiline
                rows={4}
                aria-label="Please enter additional details"
                label="تفاصيل اضافية عن المشروع المراد الدفع عنه"
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
              <PoliciesSection
                transparency={0.02}
                agreed={values.privacyPolicyAgreed}
                onChange={(checked) => {
                  formikProps.setFieldValue("privacyPolicyAgreed", checked);
                }}
                error={formikProps.errors.privacyPolicyAgreed}
                touched={formikProps.touched.privacyPolicyAgreed}
              />
            </Grid2>
            {recaptchaEnabled && (
              <Grid2
                size={{ xs: 12 }}
                sx={{ display: "flex", justifyContent: "start" }}
              >
                <Stack
                  sx={{
                    maxWidth: "100%",
                    overflow: "hidden",
                    "& > div": {
                      transform: "scale(0.95)",
                      transformOrigin: "0 0",
                      "@media (max-width: 400px)": {
                        transform: "scale(0.85)",
                      },
                      "@media (max-width: 350px)": {
                        transform: "scale(0.75)",
                      },
                    },
                  }}
                  alignItems="flex-end"
                >
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""}
                    onChange={(token) => {
                      formikProps.setFieldValue("recaptchaToken", token || "");
                    }}
                    onExpired={() => {
                      formikProps.setFieldValue("recaptchaToken", "");
                    }}
                  />
                  {formikProps.touched.recaptchaToken &&
                    formikProps.errors.recaptchaToken && (
                      <FormHelperText error sx={{ textAlign: "left" }}>
                        {formikProps.errors.recaptchaToken}
                      </FormHelperText>
                    )}
                </Stack>
              </Grid2>
            )}
            <Grid2 size={{ xs: 12 }}>
              <Stack
                direction="row"
                justifyContent="flex-end"
                alignItems="center"
                height="100%"
                pt={1.5}
                spacing={3}
              >
                <LoadingButton
                  type="submit"
                  variant="contained"
                  endIcon={<CircleDollarSign />}
                  sx={{
                    minWidth: "120px",
                    background: "#F89D1B",
                    backgroundColor: "#F89D1B",
                    backgroundImage: "none",
                    borderColor: "#F89D1B",
                    color: theme.palette.primary.dark,
                    boxShadow: "none",
                    outline: "1px solid #E58F00",
                    "&:hover": {
                      background: "#F89D1B",
                      backgroundColor: "#F89D1B",
                      backgroundImage: "none",
                      borderColor: "#F89D1B",
                      boxShadow: "none",
                    },
                  }}
                  loading={isAddPending}
                >
                  <Trans i18nKey="Buttons.pay">Pay</Trans>
                </LoadingButton>
              </Stack>
            </Grid2>
          </Grid2>
        </Form>
      </FormikProvider>
    </Stack>
  );
};

export default AddChargeForm;
