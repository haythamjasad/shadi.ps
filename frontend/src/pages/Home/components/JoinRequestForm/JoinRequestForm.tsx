import AutoCompleteField from "@/components/Fields/AutoCompleteField";
import TextField from "@/components/Fields/TextField";
import ServiceTypeSelector from "@/pages/Home/components/AppointmentForm/components/ServiceTypeSelector";
import useAddJoinRequest from "@/services/JoinRequests/useAddJoinRequest";
import { LoadingButton } from "@mui/lab";
import { Card, Grid2, Stack } from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { CirclePlus } from "lucide-react";
import { FC, useEffect, useMemo } from "react";
import { Trans } from "react-i18next";
import { initialValues, validationSchema } from "./form";
import { AddJoinRequestPayload } from "./types";

const JoinRequestForm: FC = () => {
  const { addJoinRequest, isAddPending, isAddSuccess } = useAddJoinRequest();

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 50; year--) {
      years.push({ label: year.toString(), value: year });
    }
    return years;
  }, []);

  const onSubmit = (values: AddJoinRequestPayload) => {
    const { engineeringType, graduatedAtObject, ...payload } = values;
    addJoinRequest({
      ...payload,
      engineeringType: engineeringType.map((service) => service.value),
    });
  };
  const formikProps = useFormik({
    initialValues,
    onSubmit,
    validationSchema,
  });

  const { values, resetForm, setFieldValue } = formikProps;

  useEffect(() => {
    isAddSuccess && resetForm();
  }, [isAddSuccess]);

  return (
    <Stack spacing={2} justifyContent="center" alignItems="center">
      <Card sx={{ p: 1 }}>
        <FormikProvider value={formikProps}>
          <Form>
            <Grid2 container width="100%" spacing={2}>
              <Grid2 container size={{ xs: 12, md: 4 }} spacing={2}>
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
                    name="phone"
                    aria-label="Please enter your phone number"
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
                </Grid2>
                <Grid2 size={{ xs: 12 }}>
                  <AutoCompleteField
                    name="graduatedAt"
                    placeholder="graduatedAt"
                    options={yearOptions}
                    size="small"
                    value={values.graduatedAtObject}
                    getOptionLabel={(option) =>
                      (option as { label: string; value: number })?.label || ""
                    }
                    onChange={(_, newValue) => {
                      if (newValue === null) {
                        setFieldValue(
                          "graduatedAtObject",
                          initialValues.graduatedAtObject
                        );
                        setFieldValue("graduatedAt", null);
                      }
                      setFieldValue("graduatedAtObject", newValue);
                      setFieldValue(
                        "graduatedAt",
                        (newValue as { label: string; value: number }).value
                      );
                    }}
                    disableClearable
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: "clamp(9pt, 1vw, 12pt)",
                      },
                    }}
                  />
                </Grid2>
              </Grid2>
              <Grid2 size={{ xs: 12, md: 8 }}>
                <ServiceTypeSelector name="engineeringType" />
              </Grid2>
              <Grid2 size={{ xs: 12 }}>
                <TextField
                  name="skills"
                  multiline
                  rows={4}
                  aria-label="Please enter additional details"
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
                <Stack
                  direction="row"
                  justifyContent={{ xs: "center", md: "flex-end" }}
                  alignItems="center"
                  pt={1.5}
                  spacing={3}
                >
                  <LoadingButton
                    type="submit"
                    color="primary"
                    variant="contained"
                    endIcon={<CirclePlus />}
                    sx={{ minWidth: "120px" }}
                    loading={isAddPending}
                  >
                    <Trans i18nKey="Buttons.join">Join</Trans>
                  </LoadingButton>
                </Stack>
              </Grid2>
            </Grid2>
          </Form>
        </FormikProvider>
      </Card>
    </Stack>
  );
};

export default JoinRequestForm;
