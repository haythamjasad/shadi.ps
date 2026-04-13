import { axiosInstance } from "@/config/axios.config";
import { JoinRequest, ServiceType } from "@/types";
import { GetAPIResponse } from "@/types/axios";
import { PaginationProps, PaginationResponse } from "@/types/utils";

export interface AddJoinRequestRequest
  extends Omit<JoinRequest, "id" | "createdAt"> {}

export interface GetJoinRequestsResponse extends GetAPIResponse {
  data: Array<JoinRequest>;
  pagination: PaginationResponse;
}

export const addJoinRequestAPI = async (joinRequest: AddJoinRequestRequest) => {
  const res = await axiosInstance.post("/join-us", joinRequest);
  return res.data;
};

export const getTransactionAPI = async (
  pagination: PaginationProps,
  name: string,
  phone: string,
  serviceFilter: ServiceType | ""
) => {
  const res = await axiosInstance.get<GetJoinRequestsResponse>("/join-us", {
    params: {
      engineeringType: serviceFilter,
      page: pagination.page + 1,
      size: pagination.pageSize,
      name,
      phone,
    },
  });
  return res.data;
};

export const deleteJoinRequestAPI = async (joinRequestId: string) => {
  const res = await axiosInstance.delete(`/join-us/${joinRequestId}`);
  return res.data;
};
