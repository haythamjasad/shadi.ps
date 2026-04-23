import { DEFAULT_FILTER_MODEL, FILTER_ITEMS_IDS } from "@/constants";
import { useSnackBar } from "@/hooks/useSnackbar";
import { getFilterObject } from "@/utils";
import { LoadingButton } from "@mui/lab";
import { Box, Button, Grid2 } from "@mui/material";
import {
  GridFilterModel,
  GridSortModel,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridToolbarFilterButton,
  GridToolbarProps,
  GridToolbarContainer as MuiGridToolbarContainer,
} from "@mui/x-data-grid";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { Dayjs } from "dayjs";
import { Printer, RotateCw } from "lucide-react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import useExportPDF from "./useExportPDF";

export interface GridToolbarContainerProps extends GridToolbarProps {
  printingAPI?: string;
  filterModel?: GridFilterModel;
  sortModel?: GridSortModel;
  defaultFilterModel?: GridFilterModel;
  refetch?: () => void;
  setFilterModel?: (filterModel: GridFilterModel) => void;
}

const GridToolbarContainer: FC<GridToolbarContainerProps> = ({
  printingAPI,
  filterModel,
  sortModel,
  defaultFilterModel,
  refetch,
  setFilterModel,
}) => {
  const { t } = useTranslation("translation");
  const { showErrorSnackbar } = useSnackBar();
  const gridSizes = { xs: 12, sm: 6, md: 4 };
  const toolbarWidth = printingAPI ? "auto" : 130;
  const filterKey = printingAPI === "appointments/print" ? "date" : "createdAt";

  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const onDateChange = (newValue: Dayjs | null, type: "start" | "end") => {
    if (!newValue) return;
    const baseFilter = filterModel ? filterModel : DEFAULT_FILTER_MODEL;
    if (type == "start") {
      if (newValue.isAfter(endDate)) {
        showErrorSnackbar({
          message: t("Start date cannot be after end date"),
        });
      }
      const startDateFilter = getFilterObject(filterKey, "startDate", newValue);
      baseFilter.items = baseFilter.items.filter(
        (obj) => obj.id != FILTER_ITEMS_IDS.STARTDATE
      );
      setFilterModel!({ ...DEFAULT_FILTER_MODEL, items: [] });
      if (startDateFilter) baseFilter.items.push(startDateFilter);
      setStartDate(newValue);
    } else {
      if (newValue.isBefore(startDate)) {
        showErrorSnackbar({
          message: t("End date cannot be before start date"),
        });
      }
      const endDateFilter = getFilterObject(filterKey, "endDate", newValue);
      baseFilter.items = baseFilter.items.filter(
        (obj) => obj.id !== FILTER_ITEMS_IDS.ENDDATE
      );
      setFilterModel!({ ...DEFAULT_FILTER_MODEL, items: [] });
      if (endDateFilter) baseFilter.items.push(endDateFilter);
      setEndDate(newValue);
    }
    setFilterModel!(baseFilter);
  };

  const { generateReport, isGenerating } = useExportPDF(
    printingAPI,
    filterModel,
    sortModel
  );

  return (
    <MuiGridToolbarContainer
      sx={{
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Box>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
      </Box>
      {setFilterModel && (
        <Grid2
          container
          padding={1}
          spacing={2}
          maxWidth={800}
          justifyContent="end"
        >
          <Grid2 size={gridSizes}>
            <DatePicker
              label={t("Textfields.fromDate")}
              value={startDate}
              format="YYYY-MM-DD"
              slotProps={{
                textField: { size: "small" },
                calendarHeader: {
                  format: "MM/YYYY",
                },
              }}
              onChange={(newValue: Dayjs | null) =>
                onDateChange(newValue, "start")
              }
            />
          </Grid2>
          <Grid2 size={gridSizes}>
            <DatePicker
              label={t("Textfields.toDate")}
              value={endDate}
              format="YYYY-MM-DD"
              slotProps={{
                textField: { size: "small" },
                calendarHeader: {
                  format: "MM/YYYY",
                },
              }}
              onChange={(newValue: Dayjs | null) =>
                onDateChange(newValue, "end")
              }
            />
          </Grid2>
          <Grid2
            container
            spacing={2}
            size={gridSizes}
            flexWrap="nowrap"
            sx={{ maxWidth: toolbarWidth }}
          >
            {printingAPI && (
              <LoadingButton
                variant="contained"
                endIcon={<Printer />}
                loading={isGenerating}
                onClick={() => generateReport()}
                sx={{ minWidth: "100px" }}
              >
                <Trans i18nKey="Buttons.print">Print</Trans>
              </LoadingButton>
            )}
            <Button
              variant="outlined"
              sx={{ minWidth: "130px" }}
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setFilterModel({
                  ...DEFAULT_FILTER_MODEL,
                  items: [],
                  ...defaultFilterModel,
                });
              }}
              endIcon={<RotateCw size={18} />}
            >
              <Trans i18nKey="Buttons.reset">Reset</Trans>
            </Button>
          </Grid2>
        </Grid2>
      )}
      {!!refetch && (
        <LoadingButton
          variant="contained"
          endIcon={<RotateCw />}
          loading={isGenerating}
          onClick={() => refetch()}
          sx={{ minWidth: "100px", mt: 1, mr: 2 }}
        >
          <Trans i18nKey="Buttons.refresh">Refresh</Trans>
        </LoadingButton>
      )}
    </MuiGridToolbarContainer>
  );
};

export default GridToolbarContainer;
