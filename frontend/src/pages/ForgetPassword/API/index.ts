import { axiosInstance } from "@/config/axios.config";
import { ForgetPasswordPayload } from "./types";

export const forgetPasswordAPI = async (payload: ForgetPasswordPayload) => {
  const res = await axiosInstance.post("/forgot-password", payload);
  return res.data;
};
