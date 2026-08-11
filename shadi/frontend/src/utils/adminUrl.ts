export const getAdminBaseUrl = () => {
  const configured = import.meta.env.VITE_ADMIN_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return "https://admin.shadi.ps";
};

export const buildAdminUrl = (path = "") => {
  const baseUrl = getAdminBaseUrl();
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) return baseUrl;
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;

  return `${baseUrl}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
};
