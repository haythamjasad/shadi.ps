import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { addTransactionAPI } from "./APIs";

const useAddTransaction = () => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();

  const {
    mutate: addTransaction,
    isPending: isAddPending,
    isSuccess: isAddSuccess,
  } = useMutation({
    mutationFn: addTransactionAPI,
    onSuccess: (data) => {
      if (data.paymentData.status === true) {
        showSuccessSnackbar({ message: "Transaction added successfully" });
        const authorizationUrl = data.paymentData.data.authorization_url;
        try {
          window.open(authorizationUrl, "_self");
        } catch {
          try {
            window.location.assign(authorizationUrl);
          } catch {
            (window.top ?? window).location.href = authorizationUrl;
          }
        }
      } else {
        showErrorSnackbar({ message: "Payment failed to add" });
      }
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    addTransaction,
    isAddPending,
    isAddSuccess,
  };
};

export default useAddTransaction;
