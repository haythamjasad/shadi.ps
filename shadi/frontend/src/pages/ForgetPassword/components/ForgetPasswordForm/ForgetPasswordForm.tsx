import TextField from "@/components/Fields/TextField";
import MailIcon from "@mui/icons-material/Mail";
import { LoadingButton } from "@mui/lab";
import { CircularProgress, Stack } from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { Trans } from "react-i18next";
import { ForgetPasswordPayload } from "../../API/types";
import { initialValues } from "../../constants";
import { validationSchema } from "../../formSchema";
import useForgetPasswordAPI from "../../hooks/useForgetPasswordAPI";

const ForgetPasswordForm = () => {
  const { sendCode, isPending } = useForgetPasswordAPI();

  const onSubmit = (values: ForgetPasswordPayload) => {
    sendCode({ ...values });
  };

  const formikProps = useFormik({
    initialValues,
    onSubmit,
    validationSchema,
  });

  return (
    <FormikProvider value={formikProps}>
      <Form>
        <Stack gap={2}>
          <TextField name="email" aria-label="Enter your email" />
          <LoadingButton
            type="submit"
            color="primary"
            variant="contained"
            loadingIndicator={<CircularProgress color="inherit" size={20} />}
            endIcon={<MailIcon />}
            loading={isPending}
          >
            <Trans i18nKey="Buttons.sendCode">Send Code</Trans>
          </LoadingButton>
        </Stack>
      </Form>
    </FormikProvider>
  );
};

export default ForgetPasswordForm;
