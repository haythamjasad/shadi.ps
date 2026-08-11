import TextField from "@/components/Fields/TextField";
import { TRANSACTION_STATUSES } from "@/constants";
import useUpdateTransaction from "@/services/Transactions/useUpdateTransaction";
import { LoadingButton } from "@mui/lab";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2,
  Stack,
} from "@mui/material";
import { Form, FormikProvider, useFormik } from "formik";
import { Save, X } from "lucide-react";
import { FC, useEffect } from "react";
import { Trans } from "react-i18next";
import * as yup from "yup";
import { defaultTransaction } from "../../constants";
import StatusSelector from "./components/StatusSelector";
import { EditTransactionFormProps } from "./types";
import { UpdateTransactionRequest } from "@/services/Transactions/APIs";

const EditTransactionForm: FC<EditTransactionFormProps> = ({
  transaction,
  open,
  onClose,
  setTransaction,
  refetchTransactions,
}) => {
  const columnDivides = { xs: 12, sm: 6 };
  const { updateTransaction, isUpdatePending, isUpdateSuccess } =
    useUpdateTransaction(refetchTransactions);

  const onSubmit = (values: UpdateTransactionRequest) => {
    updateTransaction({ id: transaction.id, ...values });
  };

  const formikProps = useFormik({
    initialValues: {
      status: "NEW",
      adminNotes: "",
    },
    onSubmit,
    validationSchema: yup.object().shape({
      status: yup
        .string()
        .oneOf(TRANSACTION_STATUSES, "Invalid status")
        .required("Please select a status"),
      adminNotes: yup.string(),
    }),
  });
  const { resetForm, setValues } = formikProps;

  useEffect(() => {
    if (isUpdateSuccess) {
      formikProps.resetForm();
      onClose();
      setTransaction(defaultTransaction);
    }
  }, [isUpdateSuccess]);

  useEffect(() => {
    setValues({
      status: transaction.status || "NEW",
      adminNotes: transaction.adminNotes || "",
    });
  }, [transaction]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>
        <Trans i18nKey="Buttons.editTransaction">Edit Transaction</Trans>
      </DialogTitle>
      <FormikProvider value={formikProps}>
        <Form>
          <DialogContent dividers sx={{ px: 4 }}>
            <Stack spacing={2} flexWrap="wrap">
              <StatusSelector name="status" />
              <TextField name="adminNotes" multiline rows={4} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Grid2 container spacing={2} size={columnDivides} flexWrap="nowrap">
              <LoadingButton
                type="submit"
                variant="contained"
                endIcon={<Save size={18} />}
                sx={{ minWidth: "90px" }}
                loading={isUpdatePending}
              >
                <Trans i18nKey="Buttons.save">Save</Trans>
              </LoadingButton>
              <Button
                variant="outlined"
                sx={{ minWidth: "90px" }}
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                endIcon={<X size={18} />}
              >
                <Trans i18nKey="Buttons.cancel">Cancel</Trans>
              </Button>
            </Grid2>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
};

export default EditTransactionForm;
