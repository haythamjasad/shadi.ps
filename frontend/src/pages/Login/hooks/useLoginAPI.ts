import { setAuthHeader } from "@/config/axios.config";
import { login } from "@/features/User";
import { useSnackBar } from "@/hooks/useSnackbar";
import { setSession } from "@/lib/session";
import { useAppDispatch } from "@/store";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loginAPI } from "../API";

const useLoginAPI = () => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { mutate: loginUser, isPending } = useMutation({
    mutationFn: loginAPI,
    onSuccess: ({ data }) => {
      setTimeout(
        () => showSuccessSnackbar({ message: "Login successful" }),
        1000
      );

      setSession(data.token);
      dispatch(login(data.user));

      setAuthHeader(data.token);

      navigate("/admin");
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    loginUser,
    isPending,
  };
};

export default useLoginAPI;
