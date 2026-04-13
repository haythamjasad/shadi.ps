import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { addChargeAPI } from "./APIs";

const useAddCharge = (setIsAddChargeFormOpen: (isOpen: boolean) => void) => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();

  const { mutate: addCharge, isPending: isAddPending } = useMutation({
    mutationFn: addChargeAPI,
    onSuccess: (data) => {
      if (data.paymentData.status === true) {
        showSuccessSnackbar({ message: "Charge Transaction added successfully" });
      setIsAddChargeFormOpen(false);
        const authorizationUrl = data.paymentData.data.authorization_url;
        window.location.href = authorizationUrl;
      } else {
        showErrorSnackbar({ message: "Something went wrong!" });
      }
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    addCharge,
    isAddPending,
  };
};

export default useAddCharge;
