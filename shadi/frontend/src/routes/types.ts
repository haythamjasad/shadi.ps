import { UserRole } from "@/types/user";

export interface PageAccessRight {
  roles: UserRole[];
}

export type PageAccessName = "Home" | "Transactions" | "JoinRequests";

export interface RouteConfigs {
  title: string;
  pageAccessName?: PageAccessName;
}
