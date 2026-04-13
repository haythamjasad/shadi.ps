export interface PageAccessRight {
  roles: any[];
}

export type PageAccessName = "Home" | "Transactions" | "JoinRequests";

export interface RouteConfigs {
  title: string;
  pageAccessName?: PageAccessName;
}
