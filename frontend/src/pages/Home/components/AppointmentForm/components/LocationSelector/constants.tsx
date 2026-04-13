import { LocationItem } from "../../types";
import { Building2, Video } from "lucide-react";

export const LOCATIONS: LocationItem[] = [
  {
    label: "رام الله",
    value: "RAMMALLAH",
    cost: 0,
    enabled: true,
    icon: <Building2 size={18} />,
  },
  {
    label: "لقاء اونلاين",
    value: "ZOOM",
    cost: 0,
    enabled: true,
    icon: <Video size={18} />,
  },
];
