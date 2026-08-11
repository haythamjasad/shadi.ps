import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { forgetPasswordAPI } from "../API";

const useForgetPasswordAPI = () => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();

  const { mutate: sendCode, isPending } = useMutation({
    mutationFn: forgetPasswordAPI,
    onSuccess: () => {
      showSuccessSnackbar({
        message:
          "Reset Password Link Sent Successfully to your Email, Check it",
        autoHideDuration: 10000,
      });
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    sendCode,
    isPending,
  };
};

export default useForgetPasswordAPI;
