export const doesUrlMatchMenuItem = (url: string) => {
  if (typeof window === "undefined") return false;
  return window.location.pathname === url;
};
