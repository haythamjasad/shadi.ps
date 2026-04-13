import { TransactionStatus } from "@/types";
import { StatusColor } from "@/types/layout";
import { Chip, Stack } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

interface GridColumn {
  [index: string]: (fieldName?: string) => GridColDef;
}
dayjs.extend(utc);

export const getGenericGridColumns = (
  t: (key: string) => string
): GridColumn => {
  return {
    id: (fieldName = "id") => ({
      field: fieldName,
      headerName: t("Tables.Headers.id"),
      type: "number",
      headerAlign: "left",
      align: "left",
      sortable: false,
      minWidth: 90,
      flex: 1,
    }),
    name: (fieldName = "name") => ({
      field: fieldName,
      headerName: t("Tables.Headers.name"),
      flex: 1,
      sortable: false,
      minWidth: 180,
      type: "string",
    }),
    phone: (fieldName = "phone") => ({
      field: fieldName,
      sortable: false,
      minWidth: 150,
      type: "string",
      headerName: t("Tables.Headers.phone"),
      flex: 1,
      renderCell: (params) => (
        <div style={{ direction: "ltr", textAlign: "right", width: "100%" }}>
          {params.value}
        </div>
      ),
    }),
    location: (fieldName = "location") => ({
      field: fieldName,
      sortable: false,
      minWidth: 100,
      type: "string",
      headerName: t("Tables.Headers.location"),
      flex: 1.2,
      renderCell: (params) => t(`Location.${params.value}`),
    }),
    cost: (fieldName = "cost") => ({
      field: fieldName,
      headerName: t("Tables.Headers.cost"),
      type: "number",
      headerAlign: "left",
      align: "left",
      flex: 0.7,
      minWidth: 80,
    }),
    notes: (fieldName = "notes") => ({
      field: fieldName,
      headerName: t("Tables.Headers.notes"),
      sortable: false,
      renderCell: (params) => (
        <div
          style={{
            whiteSpace: "normal",
            wordWrap: "break-word",
            lineHeight: "1.5",
            height: "100%",
            width: "100%",
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {params.value || t("Tables.noResults")}
        </div>
      ),
      flex: 1,
      minWidth: 250,
      type: "string",
    }),
    adminNotes: (fieldName = "adminNotes") => ({
      field: fieldName,
      headerName: t("Tables.Headers.adminNotes"),
      sortable: false,
      renderCell: (params) => (
        <div
          style={{
            whiteSpace: "normal",
            wordWrap: "break-word",
            lineHeight: "1.5",
            height: "100%",
            width: "100%",
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {params.value || t("Tables.noResults")}
        </div>
      ),
      flex: 1,
      minWidth: 250,
      type: "string",
    }),
    actions: (fieldName = "actions") => ({
      field: fieldName,
      headerName: t("Tables.Headers.actions"),
      disableExport: true,
      sortable: false,
      flex: 0.7,
      minWidth: 100,
    }),
    status: (fieldName = "status") => ({
      field: fieldName,
      headerName: t("Tables.Headers.status"),
      type: "singleSelect",
      flex: 0.6,
      renderCell: (params) => (
        <Stack justifyContent="center" alignItems="flex-start" height="100%">
          <Chip
            label={t(`Status.${params.value}`)}
            color={AppointmentStatusColors[params.value as TransactionStatus]}
            sx={{ fontSize: "" }}
          />
        </Stack>
      ),
      sortable: false,
      minWidth: 120,
    }),
    serviceType: (fieldName = "serviceType") => ({
      field: fieldName,
      headerName: t("Tables.Headers.serviceType"),
      flex: 0.6,
      renderCell: (params) => (
        <>
          {params.value
            .map((type: string) => t(`ServiceType.${type}`))
            .join(", ")}
        </>
      ),
      sortable: false,
      minWidth: 100,
    }),
    createdAt: (fieldName = "createdAt") => ({
      field: fieldName,
      headerName: t("Tables.Headers.createdAt"),
      flex: 1,
      type: "date",
      filterable: false,
      valueGetter: (params: any) => {
        const value = params?.row?.[fieldName];
        return value ? new Date(value as string) : null;
      },
      renderCell: (params) => {
        const formatted = dayjs
          .utc(params.row[fieldName])
          .format("YYYY-MM-DD hh:mm A");
        return <span dir="ltr">{formatted}</span>;
      },
      minWidth: 180,
    }),
    graduatedAt: (fieldName = "graduatedAt") => ({
      field: fieldName,
      headerName: t("Tables.Headers.graduatedAt"),
      type: "number",
      headerAlign: "left",
      align: "left",
      flex: 0.7,
      minWidth: 100,
    }),
    skills: (fieldName = "skills") => ({
      field: fieldName,
      headerName: t("Tables.Headers.skills"),
      sortable: false,
      renderCell: (params) => (
        <div
          style={{
            whiteSpace: "normal",
            wordWrap: "break-word",
            lineHeight: "1.5",
            height: "100%",
            width: "100%",
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {params.value || t("Tables.noResults")}
        </div>
      ),
      flex: 1,
      minWidth: 300,
      type: "string",
      getApplyQuickFilterFn: undefined,
    }),
  };
};

export const AppointmentStatusColors: Record<TransactionStatus, StatusColor> = {
  CANCELLED: "error",
  NEW: "primary",
  FINISHED: "success",
  PAUSED: "warning",
  PENDING: "info",
};
