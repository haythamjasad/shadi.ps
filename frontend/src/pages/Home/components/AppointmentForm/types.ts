import { Location, ServiceType } from "@/types";

export interface ServiceTypeItem {
  label: string;
  value: ServiceType;
  cost: number;
  zoomCost: number;
}

export interface LocationItem {
  label: string;
  value: Location;
  cost: number;
  enabled: boolean;
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
