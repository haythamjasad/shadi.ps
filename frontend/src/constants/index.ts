import { TransactionStatus } from "@/types";
import { GridFilterModel, GridLogicOperator } from "@mui/x-data-grid";

export const APP_SIDE_DRAWER_WIDTH = 240;

export const NAVBAR_HEIGHT = 64;

export const APP_LAYOUT_CONTAINER_ID = "app-layout-container";

export const MAIN_COLOR_HEX = "#1976d2";

export const FILTER_DELAY_TIME = 1000;

export const GRID_PAGE_SIZE_OPTIONS = [50, 100, 200];

export const DEFAULT_PAGE_SIZE = 50;

export const DEFAULT_PAGINATION_MODEL = {
  page: 0,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const DEFAULT_FILTER_MODEL: GridFilterModel = {
  items: [],
  logicOperator: "and" as GridLogicOperator,
  quickFilterValues: [],
  quickFilterLogicOperator: "and" as GridLogicOperator,
};

export const FILTER_ITEMS_IDS = {
  STARTDATE: "12345",
  ENDDATE: "67890",
};

export const TRANSACTION_STATUSES: Array<TransactionStatus> = [
  "NEW",
  "PENDING",
  "FINISHED",
  "PAUSED",
  "CANCELLED",
];
