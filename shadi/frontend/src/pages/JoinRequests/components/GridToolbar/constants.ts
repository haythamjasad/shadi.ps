import { ServiceType } from "@/types";

export const STATUS_FILTERS: { label: string; value: ServiceType }[] = [
  { label: "معماري", value: "ARCHITECTURAL" },
  { label: "مدني", value: "CIVIL" },
  { label: "ميكانيكي", value: "MECHANIC" },
  { label: "كهربائي", value: "ELECTRIC" },
];
