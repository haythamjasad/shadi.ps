import { axiosInstance } from "@/config/axios.config";
import { ResetPasswordPayload } from "./types";

export const resetPasswordAPI = async (payload: ResetPasswordPayload) => {
  const res = await axiosInstance.post("/reset-password", {
    ...payload,
  });

  return res.data;
};
