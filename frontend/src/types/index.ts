/* eslint-disable @typescript-eslint/no-empty-object-type */
export type TransactionStatus =
  | "NEW"
  | "PENDING"
  | "FINISHED"
  | "PAUSED"
  | "CANCELLED";

export type Location =
  | "RAMMALLAH"
  | "NABLUS"
  | "SALFIT"
  | "BETHLEHEM"
  | "HEBRON"
  | "TULKAREM"
  | "ZOOM";

export type ServiceType =
  | "MECHANIC"
  | "ELECTRIC"
  | "CIVIL"
  | "ARCHITECTURAL"
  | "CHARGES";

export type StatusFilter = "open" | "new" | "init" | "closed" | "charge";

export interface Transaction {
  id: number;
  name: string;
  phone: string;
  serviceType: Array<ServiceType>;
  location: Location;
  status: TransactionStatus;
  cost: number;
  createdAt: Date;
  notes: string;
  adminNotes: string;
}

export interface JoinRequest {
  id: number;
  name: string;
  phone: string;
  engineeringType: Array<ServiceType>;
  graduatedAt: number;
  skills: string;
  createdAt: Date;
}
