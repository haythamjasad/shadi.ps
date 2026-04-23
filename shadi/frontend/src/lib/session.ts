import Cookies from "js-cookie";

export const setSession = (token: string) => {
  Cookies.set(import.meta.env.VITE_TOKEN_ACCESS_KEY, token, {
    expires: 10 / 24,
    sameSite: "strict",
    secure: window.location.protocol === "https:",
  });
};

export const getSession = () => {
  return Cookies.get(import.meta.env.VITE_TOKEN_ACCESS_KEY);
};

export const clearSession = () => {
  Cookies.remove(import.meta.env.VITE_TOKEN_ACCESS_KEY);
};
