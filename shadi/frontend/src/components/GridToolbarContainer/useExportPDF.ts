import { axiosInstance } from "@/config/axios.config";
import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import { useMutation } from "@tanstack/react-query";

const useExportPDF = (
  API?: string,
  filterModel?: GridFilterModel,
  sortModel?: GridSortModel
) => {
  const { showErrorSnackbar } = useSnackBar();

  const exportPDF = async () => {
    const res = await axiosInstance.post(
      `${API}`,
      { filterModel, sortModel },
      { responseType: "blob" }
    );
    return res.data;
  };
  const { mutate: generateReport, isPending: isGenerating } = useMutation({
    mutationFn: exportPDF,
    onSuccess: (pdfBlob) => {
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");
    },
    onError: (error) => {
      const errorMessage = extractErrorMessage(error as AxiosBaseError);
      showErrorSnackbar({ message: errorMessage });
    },
  });

  return {
    generateReport,
    isGenerating,
  };
};

export default useExportPDF;
