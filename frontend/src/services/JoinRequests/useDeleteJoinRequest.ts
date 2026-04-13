import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { useMutation } from "@tanstack/react-query";
import { deleteJoinRequestAPI } from "./APIs";

const useDeleteJoinRequest = (
  refetchJoinRequests: () => void,
  setIsDialogOpen: (isOpen: boolean) => void,
  setSelectedJoinRequest: (requestId: string) => void
) => {
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackBar();

  const { mutate: deleteJoinRequest, isPending: isDeleteJoinRequestPending } =
    useMutation({
      mutationFn: deleteJoinRequestAPI,
      onSuccess: () => {
        showSuccessSnackbar({ message: "Join request deleted successfully" });
        refetchJoinRequests();
        setIsDialogOpen(false);
        setSelectedJoinRequest("");
      },
      onError: (error) => {
        const errorMessage = extractErrorMessage(error as AxiosBaseError);
        showErrorSnackbar({ message: errorMessage });
      },
    });

  return {
    deleteJoinRequest,
    isDeleteJoinRequestPending,
  };
};

export default useDeleteJoinRequest;
