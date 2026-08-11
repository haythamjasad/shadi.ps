function isLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "::1"
    || host.endsWith(".local")
    || /^192\.168\./.test(host)
    || /^10\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

export function shouldEnableRecaptcha() {
  if (!import.meta.env.VITE_RECAPTCHA_SITE_KEY) return false;
  if (typeof window !== "undefined" && isLocalHost(window.location.hostname || "")) return false;
  return true;
}
