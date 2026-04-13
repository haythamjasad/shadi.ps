import { axiosInstance } from "@/config/axios.config";
import { Transaction, StatusFilter } from "@/types";
import { GetAPIResponse } from "@/types/axios";
import { PaginationProps, PaginationResponse } from "@/types/utils";

export interface GetTransactionsResponse extends GetAPIResponse {
  data: Array<Transaction>;
  pagination: PaginationResponse;
}

export interface CreateTransactionRequest
  extends Omit<Transaction, "id" | "createdAt" | "status" | "adminNotes"> {}

export interface CreateChargeRequest
  extends Omit<
    Transaction,
    "id" | "createdAt" | "status" | "adminNotes" | "location"
  > {}

export interface UpdateTransactionRequest
  extends Partial<
    Omit<
      Transaction,
      "name" | "phone" | "serviceType" | "location" | "createdAt" | "notes"
    >
  > {}

export interface GetTransactionByIdPayload {
  data: Transaction;
  status: number;
  message: string;
}

export const addTransactionAPI = async (
  transaction: CreateTransactionRequest
) => {
  const res = await axiosInstance.post("/transactions", transaction);
  return res.data;
};

export const addChargeAPI = async (transaction: CreateChargeRequest) => {
  const res = await axiosInstance.post("/transactions/charge", transaction);
  return res.data;
};

export const updateTransactionAPI = async (
  transaction: UpdateTransactionRequest
) => {
  const res = await axiosInstance.post(
    `/transactions/${transaction.id}`,
    transaction
  );
  return res.data;
};

export const getTransactionAPI = async (
  pagination: PaginationProps,
  name: string,
  phone: string,
  statusFilter: StatusFilter
) => {
  const statusEndpointMap: Record<StatusFilter, string> = {
    open: "open",
    new: "new",
    init: "init",
    closed: "closed",
    charge: "charge",
  };

  const res = await axiosInstance.get<GetTransactionsResponse>(
    `/transactions/${statusEndpointMap[statusFilter]}`,
    {
      params: {
        page: pagination.page + 1,
        size: pagination.pageSize,
        name,
        phone,
      },
    }
  );
  return res.data;
};

export const getTransactionByIdAPI = async (id: string) => {
  const res = await axiosInstance.get<GetTransactionByIdPayload>(
    `/transactions/get-one/${id}`
  );
  return res.data;
};
