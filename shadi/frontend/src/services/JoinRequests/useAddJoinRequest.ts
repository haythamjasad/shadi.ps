import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { addJoinRequestAPI } from "./APIs";

const useAddJoinRequest = () => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();

  const {
    mutate: addJoinRequest,
    isPending: isAddPending,
    isSuccess: isAddSuccess,
  } = useMutation({
    mutationFn: addJoinRequestAPI,
    onSuccess: () => {
      showSuccessSnackbar({ message: "Join request added successfully" });
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    addJoinRequest,
    isAddPending,
    isAddSuccess,
  };
};

export default useAddJoinRequest;
