import { DEFAULT_PAGINATION_MODEL } from "@/constants";
import { StatusFilter } from "@/types";
import { GridPaginationModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTransactionAPI, GetTransactionsResponse } from "./APIs";

const useGetTransactions = () => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    DEFAULT_PAGINATION_MODEL
  );

  const [textFilter, setTextFilter] = useState<{ name: string; phone: string }>(
    { name: "", phone: "" }
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
  const [totalRows, setTotalRows] = useState<number>(0);

  const {
    data,
    isFetching: isFetchingTransactions,
    refetch: refetchTransactions,
  } = useQuery<GetTransactionsResponse>({
    queryKey: [`Transactions`, paginationModel, textFilter, statusFilter],
    queryFn: () =>
      getTransactionAPI(
        paginationModel,
        textFilter.name,
        textFilter.phone,
        statusFilter
      ).then((res) => {
        setTotalRows(res.pagination.totalItems);

        return res;
      }),
  });

  return {
    transactions: data?.data ?? [],
    totalRows,
    refetchTransactions,
    isFetchingTransactions,
    paginationModel,
    setPaginationModel,
    textFilter,
    setTextFilter,
    statusFilter,
    setStatusFilter,
  };
};

export default useGetTransactions;
