import { buildAdminUrl } from "@/utils/adminUrl";
import { useEffect } from "react";

const LegacyAdminRedirect = () => {
  useEffect(() => {
    window.location.replace(buildAdminUrl());
  }, []);

  return <p style={{ padding: 24 }}>Redirecting to admin.shadi.ps...</p>;
};

export default LegacyAdminRedirect;
