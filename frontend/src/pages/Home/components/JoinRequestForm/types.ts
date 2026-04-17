import { ServiceType } from "@/types";

export interface ServiceTypeItem {
  label: string;
  value: ServiceType;
  cost: number;
  zoomCost: number;
}

export interface AddJoinRequestPayload {
  name: string;
  phone: string;
  engineeringType: ServiceTypeItem[];
  graduatedAt: number;
  graduatedAtObject: { label: string; value: number } | null;
  skills: string;
}
