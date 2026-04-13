import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { updateTransactionAPI } from "./APIs";

const useUpdateTransaction = (
  refetchTransactions?: () => void,
  setIsAddTransactionDialogOpen?: (isOpen: boolean) => void
) => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();

  const {
    mutate: updateTransaction,
    isPending: isUpdatePending,
    isSuccess: isUpdateSuccess,
  } = useMutation({
    mutationFn: updateTransactionAPI,
    onSuccess: () => {
      showSuccessSnackbar({ message: "Transaction updated successfully" });
      setIsAddTransactionDialogOpen && setIsAddTransactionDialogOpen(false);
      refetchTransactions && refetchTransactions();
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    updateTransaction,
    isUpdatePending,
    isUpdateSuccess,
  };
};

export default useUpdateTransaction;
