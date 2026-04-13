import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { resetPasswordAPI } from "../API";

const useResetPasswordAPI = () => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();
  const navigate = useNavigate();

  const { mutate: resetPassword, isPending } = useMutation({
    mutationFn: resetPasswordAPI,
    onSuccess: () => {
      setTimeout(
        () => showSuccessSnackbar({ message: "Password reset successfully" }),
        1000
      );
      navigate("/");
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    resetPassword,
    isPending,
  };
};

export default useResetPasswordAPI;
