import { StatusFilter } from "@/types";

export const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "جديدة", value: "new" },
  { label: "قيد الاشراف", value: "open" },
  { label: "منتهية", value: "closed" },
  { label: "عالقة", value: "init" },
  { label: "الدفعات", value: "charge" },
];
