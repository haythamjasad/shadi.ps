import { getGenericGridColumns } from "@/constants/gridColumns";
import { UpdateTransactionRequest } from "@/services/Transactions/APIs";
import { Button, Stack } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Pencil } from "lucide-react";

dayjs.extend(utc);

export const getColumns = (
  t: (key: string) => string,
  setIsUpdateTransactionDialogOpen: (isOpen: boolean) => void,
  setTransactionToUpdateDetails: (visit: UpdateTransactionRequest) => void
): GridColDef[] => {
  const columns = getGenericGridColumns(t);

  return [
    {
      ...columns.actions(),
      renderCell(params) {
        return (
          <Stack flexDirection="row" alignItems="center" gap={2} height="100%">
            <Button
              size="small"
              variant="contained"
              sx={{ minWidth: "5px" }}
              onClick={() => {
                setTransactionToUpdateDetails(params.row);
                setIsUpdateTransactionDialogOpen(true);
              }}
            >
              <Pencil />
            </Button>
          </Stack>
        );
      },
      minWidth: 80,
    },
    columns.id(),
    columns.createdAt(),
    columns.name(),
    columns.phone(),
    columns.serviceType(),
    columns.cost(),
    columns.location(),
    columns.status(),
    columns.adminNotes(),
    columns.notes(),
  ];
};
