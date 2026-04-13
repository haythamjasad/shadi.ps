import { GridColDef } from "@mui/x-data-grid";

export const noop = () => {};

export const noopArray = () => [];

export const notImplementedYet = () => {
  throw new Error("Not Implemented yet!");
};

export const identity = <T>(v: T) => v;

export const getExportableColumnsCount = (columns: GridColDef[]): number => {
  return columns.filter((column) => column.disableExport !== true).length;
};
