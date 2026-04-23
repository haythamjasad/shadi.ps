import { getGenericGridColumns } from "@/constants/gridColumns";
import { Button, Stack } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Trash } from "lucide-react";

dayjs.extend(utc);

export const getColumns = (
  t: (key: string) => string,
  setJoinRequestToDeleteId: (id: string) => void,
  setIsDeleteJoinRequestDialogOpen: (isOpen: boolean) => void
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
                setJoinRequestToDeleteId(params.row.id);
                setIsDeleteJoinRequestDialogOpen(true);
              }}
              color="error"
            >
              <Trash />
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
    columns.serviceType("engineeringType"),
    columns.graduatedAt(),
    columns.skills(),
  ];
};
