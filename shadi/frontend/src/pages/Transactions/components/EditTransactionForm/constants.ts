import { TransactionStatus } from "@/types";

export const TRANSACTION_STATUS_OPTIONS: {
  label: string;
  value: TransactionStatus;
}[] = [
  { label: "NEW", value: "NEW" },
  { label: "PENDING", value: "PENDING" },
  { label: "FINISHED", value: "FINISHED" },
  { label: "PAUSED", value: "PAUSED" },
  { label: "CANCELLED", value: "CANCELLED" },
];
