import { Location, ServiceType } from "@/types";
import { ReactNode } from "react";

export interface ServiceTypeItem {
  label: string;
  value: ServiceType;
  cost: number;
  zoomCost: number;
  icon?: ReactNode;
}

export interface LocationItem {
  label: string;
  value: Location;
  cost: number;
  enabled: boolean;
  icon?: ReactNode;
}

export interface AddTransactionPayload {
  name: string;
  phone: string;
  notes: string;
  selectedServices: ServiceTypeItem[];
  selectedLocation: LocationItem;
  privacyPolicyAgreed: boolean;
  recaptchaToken: string;
}

export interface PoliciesSectionProps {
  agreed: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  touched?: boolean;
  transparency?: number;
}

export interface ContactUsLinkProps {
  xs: string;
  sm: string;
  md: string;
}
