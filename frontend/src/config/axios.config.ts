import { getSession } from "@/lib/session";
import axios, { AxiosRequestConfig } from "axios";

const getDefaultAxiosSettings = (): AxiosRequestConfig => {
  const accessToken = getSession();
  const bearerKey = import.meta.env.VITE_BEARERKEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `${bearerKey}${accessToken}`;
  }
  return { headers };
};

const defaultAxiosSettings = getDefaultAxiosSettings();

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  ...defaultAxiosSettings,
});

export const axiosFormData = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    ...defaultAxiosSettings.headers,
    Accept: "*/*",
    "Content-Type": "multipart/form-data",
  },
});

export const setAuthHeader = (token: string) => {
  const bearerKey = import.meta.env.VITE_BEARERKEY;
  const value = `${bearerKey}${token}`;

  axiosInstance.defaults.headers.common.Authorization = value;
  axiosFormData.defaults.headers.common.Authorization = value;
};

export const clearAuthHeader = () => {
  delete axiosInstance.defaults.headers.common.Authorization;
  delete axiosFormData.defaults.headers.common.Authorization;
};
