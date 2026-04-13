import { useQuery } from "@tanstack/react-query";
import { getTransactionByIdAPI } from "./APIs";
import { Transaction } from "@/types";

interface UseGetTransactionByIdResult {
  transaction: Transaction | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

const useGetTransactionById = (id: string): UseGetTransactionByIdResult => {
  const shouldFetch = !!id && id !== "failed";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => getTransactionByIdAPI(id),
    enabled: shouldFetch,
  });

  return {
    transaction: data?.data || null,
    isLoading: shouldFetch ? isLoading : false,
    isError: shouldFetch ? isError : false,
    error: error as Error | null,
  };
};

export default useGetTransactionById;
