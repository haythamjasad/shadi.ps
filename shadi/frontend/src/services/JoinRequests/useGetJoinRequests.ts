import { DEFAULT_PAGINATION_MODEL } from "@/constants";
import { ServiceType } from "@/types";
import { GridPaginationModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GetJoinRequestsResponse, getTransactionAPI } from "./APIs";

const useGetJoinRequests = () => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    DEFAULT_PAGINATION_MODEL
  );

  const [textFilter, setTextFilter] = useState<{ name: string; phone: string }>(
    { name: "", phone: "" }
  );
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "">("");
  const [totalRows, setTotalRows] = useState<number>(0);

  const {
    data,
    isFetching: isFetchingJoinRequests,
    refetch: refetchJoinRequests,
  } = useQuery<GetJoinRequestsResponse>({
    queryKey: [`JoinRequests`, paginationModel, textFilter, serviceFilter],
    queryFn: () =>
      getTransactionAPI(
        paginationModel,
        textFilter.name,
        textFilter.phone,
        serviceFilter
      ).then((res) => {
        setTotalRows(res.pagination.totalItems);

        return res;
      }),
  });

  return {
    joinRequests: data?.data ?? [],
    totalRows,
    refetchJoinRequests,
    isFetchingJoinRequests,
    paginationModel,
    setPaginationModel,
    textFilter,
    setTextFilter,
    serviceFilter,
    setServiceFilter,
  };
};

export default useGetJoinRequests;
