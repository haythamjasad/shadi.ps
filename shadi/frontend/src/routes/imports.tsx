import { lazy } from "react";

export const AccessDenied = lazy(() => import("@/pages/AccessDenied"));
export const NotFound = lazy(() => import("@/pages/NotFound"));
export const Unauthenticated = lazy(() => import("@/pages/Unauthenticated"));
export const Login = lazy(() => import("@/pages/Login"));
export const ForgetPassword = lazy(() => import("@/pages/ForgetPassword"));
export const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

export const Transactions = lazy(() => import("@/pages/Transactions"));
export const JoinRequests = lazy(() => import("@/pages/JoinRequests"));
export const Home = lazy(() => import("@/pages/Home"));
export const PublicTransactions = lazy(() => import("@/pages/PublicTransactions"));
export const PaymentStatus = lazy(() => import("@/pages/PaymentStatus"));
