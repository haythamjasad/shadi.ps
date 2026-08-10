import { getSession } from "@/lib/session";
import axios, { AxiosRequestConfig } from "axios";

const resolveApiUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL;

  if (!configuredUrl) return configuredUrl;
  if (typeof window === "undefined") return configuredUrl;

  try {
    const parsed = new URL(configuredUrl);
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isRemoteClient =
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

    if (isLocalHost && isRemoteClient) {
      parsed.hostname = window.location.hostname;
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
};

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
  baseURL: resolveApiUrl(),
  ...defaultAxiosSettings,
});

export const axiosFormData = axios.create({
  baseURL: resolveApiUrl(),
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
