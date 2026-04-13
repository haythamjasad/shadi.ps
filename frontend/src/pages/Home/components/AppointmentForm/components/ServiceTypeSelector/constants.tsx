import { ServiceTypeItem } from "../../types";
import { Building2, Hammer, Lightbulb, Ruler } from "lucide-react";

export const SERVICE_TYPES: ServiceTypeItem[] = [
  {
    label: "ميكانيك",
    value: "MECHANIC",
    cost: 100,
    zoomCost: 50,
    icon: <Hammer size={18} />,
  },
  {
    label: "كهرباء",
    value: "ELECTRIC",
    cost: 100,
    zoomCost: 50,
    icon: <Lightbulb size={18} />,
  },
  {
    label: "مدني",
    value: "CIVIL",
    cost: 100,
    zoomCost: 50,
    icon: <Ruler size={18} />,
  },
  {
    label: "معماري",
    value: "ARCHITECTURAL",
    cost: 100,
    zoomCost: 50,
    icon: <Building2 size={18} />,
  },
];
