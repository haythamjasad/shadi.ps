import { ServiceType } from "@/types";
import { ReactNode } from "react";

export interface ServiceTypeItem {
  label: string;
  value: ServiceType;
  cost: number;
  zoomCost: number;
  icon?: ReactNode;
}

export interface AddJoinRequestPayload {
  name: string;
  phone: string;
  engineeringType: ServiceTypeItem[];
  graduatedAt: number;
  graduatedAtObject: { label: string; value: number } | null;
  skills: string;
}
