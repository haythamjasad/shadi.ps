import { AxiosError } from "axios";

export interface BaseResponse {
  type: string;
  title: string;
  status: number;
  traceId: string;
  errors: Record<string, string[]>;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AxiosBaseError extends AxiosError<BaseResponse> {}

export interface GetAPIResponse {
  totalRows: number;
}
