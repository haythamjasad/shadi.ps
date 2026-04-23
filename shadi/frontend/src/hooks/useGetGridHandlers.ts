import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import { useCallback } from "react";

const useGetGridHandlers = (
  setFilterModel: (filterModel: GridFilterModel) => void,
  setSortModel: (sortModel: GridSortModel) => void
) => {
  const onFilterChange = useCallback(
    (filterModel: GridFilterModel) => {
      setTimeout(() => {
        setFilterModel(filterModel);
      }, 1000);
    },
    [setFilterModel]
  );

  const onSortChange = useCallback(
    (sortModel: GridSortModel) => {
      setSortModel(sortModel);
    },
    [setSortModel]
  );

  return { onFilterChange, onSortChange };
};

export default useGetGridHandlers;
