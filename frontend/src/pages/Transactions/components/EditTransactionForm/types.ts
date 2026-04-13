import { UpdateTransactionRequest } from "@/services/Transactions/APIs";
import { DialogProps } from "@mui/material";

export interface EditTransactionFormProps extends DialogProps {
  transaction: UpdateTransactionRequest;
  setTransaction: (transaction: UpdateTransactionRequest) => void;
  refetchTransactions: () => void;
  onClose: () => void;
}
