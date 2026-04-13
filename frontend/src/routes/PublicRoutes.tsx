import { Navigate, RouteObject } from "react-router-dom";
import LegacyAdminRedirect from "./LegacyAdminRedirect";
import {
  AccessDenied,
  Home,
  NotFound,
  PaymentStatus,
  PublicTransactions,
} from "./imports";

const publicRoutes: RouteObject = {
  path: "",
  children: [
    {
      index: true,
      element: <Home />,
    },
    {
      path: "consulting",
      element: <PublicTransactions />,
    },
    {
      path: "transactions",
      element: <Navigate to="/consulting" replace />,
    },
    {
      path: "login",
      element: <LegacyAdminRedirect />,
    },
    {
      path: "forget-password",
      element: <LegacyAdminRedirect />,
    },
    {
      path: "reset-password",
      element: <LegacyAdminRedirect />,
    },
    {
      path: "payment-status/:id",
      element: <PaymentStatus />,
    },
    {
      path: "access-denied",
      element: <AccessDenied />,
    },
    {
      path: "unauthenticated",
      element: <LegacyAdminRedirect />,
    },
    {
      path: "*",
      element: <NotFound />,
    },
  ],
};

export default publicRoutes;
