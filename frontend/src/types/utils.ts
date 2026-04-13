export interface QueryObj {
  [index: string]: string | number;
}

export interface CustomerOption {
  name: string;
  value: string;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
}

export interface PaginationResponse {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface EmployeeOption {
  name: string;
  value: string;
}

export interface AutoCompleteOption {
  label: string;
  value: string | number;
}
