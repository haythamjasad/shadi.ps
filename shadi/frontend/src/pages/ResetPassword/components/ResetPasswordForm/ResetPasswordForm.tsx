import PasswordField from "@/components/Fields/PasswordField";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { LoadingButton } from "@mui/lab";
import { CircularProgress, Stack } from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { Trans } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ResetPasswordFormPayload } from "../../API/types";
import { initialValues } from "../../constants";
import { validationSchema } from "../../formSchema";
import useResetPasswordAPI from "../../hooks/useResetPasswordAPI";

const ResetPasswordForm = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { resetPassword, isPending } = useResetPasswordAPI();

  const onSubmit = ({ password }: ResetPasswordFormPayload) => {
    resetPassword({ password, token });
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
          <PasswordField name="password" aria-label="Enter your password" />
          <PasswordField
            name="confirmPassword"
            aria-label="Confirm your password"
          />
          <LoadingButton
            type="submit"
            color="primary"
            variant="contained"
            loadingIndicator={<CircularProgress color="inherit" size={20} />}
            endIcon={<VpnKeyIcon />}
            loading={isPending}
          >
            <Trans i18nKey="Buttons.resetPassword">Reset Password</Trans>
          </LoadingButton>
        </Stack>
      </Form>
    </FormikProvider>
  );
};

export default ResetPasswordForm;
