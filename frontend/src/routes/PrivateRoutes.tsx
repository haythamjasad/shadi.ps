import { RouteObject } from "react-router-dom";
import LegacyAdminRedirect from "./LegacyAdminRedirect";

const privateRoutes: RouteObject = {
  path: "/admin/*",
  element: <LegacyAdminRedirect />,
};

export default privateRoutes;
