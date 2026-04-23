import { useSnackBar } from "@/hooks/useSnackbar";
import { AxiosBaseError } from "@/types/axios";
import { extractErrorMessage } from "@/utils/errorHandling";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider as MuiQueryClientProvider,
} from "@tanstack/react-query";
import { FC, PropsWithChildren, useState } from "react";

const QueryClientProvider: FC<PropsWithChildren> = ({ children }) => {
  const { showErrorSnackbar } = useSnackBar();
  const [queryClient] = useState(
    () => new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          const errorMessage = extractErrorMessage(error as AxiosBaseError);
          showErrorSnackbar({ message: errorMessage });
        },
      }),
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          refetchInterval: 60 * 60 * 1000, // 1 hour
        },
      },
    })
  );
  return (
    <MuiQueryClientProvider client={queryClient}>
      {children}
    </MuiQueryClientProvider>
  );
};

export default QueryClientProvider;
