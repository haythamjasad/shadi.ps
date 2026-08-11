import { StaticFilterGridToolbarProps } from "@/components/StaticFilterGridToolbar/StaticFilterGridToolbar";
import { DEFAULT_PAGE_SIZE, GRID_PAGE_SIZE_OPTIONS } from "@/constants";
import Container from "@/containers/Container";
import routeHOC from "@/routes/HOCs/routeHOC";
import useGetJoinRequests from "@/services/JoinRequests/useGetJoinRequests";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { FC, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getColumns } from "./components/columns";
import GridToolbar from "./components/GridToolbar";
import { LoadingButton } from "@mui/lab";
import { Check, X } from "lucide-react";
import useDeleteJoinRequest from "@/services/JoinRequests/useDeleteJoinRequest";

const JoinRequests: FC = () => {
  const { t } = useTranslation("translation");
  const [joinRequestToDeleteId, setJoinRequestToDeleteId] =
    useState<string>("");
  const [isDeleteJoinRequestDialogOpen, setIsDeleteJoinRequestDialogOpen] =
    useState(false);

  const {
    joinRequests,
    totalRows,
    refetchJoinRequests,
    isFetchingJoinRequests,
    paginationModel,
    setPaginationModel,
    setTextFilter,
    serviceFilter,
    setServiceFilter,
  } = useGetJoinRequests();
  const { deleteJoinRequest, isDeleteJoinRequestPending } =
    useDeleteJoinRequest(
      refetchJoinRequests,
      setIsDeleteJoinRequestDialogOpen,
      setJoinRequestToDeleteId
    );

  const columns = useMemo(
    () =>
      getColumns(t, setJoinRequestToDeleteId, setIsDeleteJoinRequestDialogOpen),
    [t]
  );

  return (
    <Container>
      <Typography variant="h2" px={3} py={2}>
        <Trans i18nKey="SideDrawerLinks.join_requests">Join Requests</Trans>
      </Typography>
      <Stack justifyContent="center">
        <Paper variant="outlined" component="div" sx={{ pb: 2.5 }}>
          <DataGrid
            rows={joinRequests}
            columns={columns}
            loading={isFetchingJoinRequests}
            rowCount={totalRows}
            sx={{
              bgcolor: "white",
              mx: 2.5,
              mt: 5,
              boxShadow: 2,
              "& .MuiDataGrid-row.even": {
                backgroundColor: (theme) => theme.palette.grey[100],
                "&:hover": {
                  backgroundColor: (theme) => theme.palette.grey[200],
                },
              },
            }}
            getRowClassName={(params) =>
              params.indexRelativeToCurrentPage % 2 === 0 ? "even" : "odd"
            }
            slots={{
              toolbar: GridToolbar,
            }}
            slotProps={{
              toolbar: {
                refetch: refetchJoinRequests,
                setTextFilter,
                serviceFilter,
                setServiceFilter,
                isFetching: isFetchingJoinRequests,
              } as StaticFilterGridToolbarProps,
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: DEFAULT_PAGE_SIZE } },
              columns: {
                columnVisibilityModel: {
                  actions: false,
                },
              },
            }}
            pageSizeOptions={GRID_PAGE_SIZE_OPTIONS}
            paginationModel={paginationModel}
            paginationMode="server"
            onPaginationModelChange={(pagination) => {
              if (GRID_PAGE_SIZE_OPTIONS.indexOf(pagination.pageSize) !== -1) {
                setPaginationModel(pagination);
              }
            }}
          />
        </Paper>
      </Stack>
      <Dialog
        open={isDeleteJoinRequestDialogOpen}
        onClose={() => setIsDeleteJoinRequestDialogOpen(false)}
        fullWidth
      >
        <DialogTitle>
          <Trans i18nKey="Buttons.deleteCustomer">Delete Customer</Trans>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 4 }}>
          <Typography>
            <Trans i18nKey="Dialogs.confirmCustomerDelete">
              Are you sure you want to delete this Customer?
            </Trans>
          </Typography>
        </DialogContent>
        <DialogActions>
          <LoadingButton
            variant="contained"
            loading={isDeleteJoinRequestPending}
            color="error"
            endIcon={<Check />}
            onClick={() => deleteJoinRequest(joinRequestToDeleteId)}
          >
            <Trans i18nKey="Buttons.delete">Delete</Trans>
          </LoadingButton>
          <Button
            variant="outlined"
            endIcon={<X />}
            onClick={() => setIsDeleteJoinRequestDialogOpen(false)}
          >
            <Trans i18nKey="Buttons.cancel">Cancel</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

const withRouteHoC = routeHOC({
  title: "Join Requests",
  pageAccessName: "JoinRequests",
});

export default withRouteHoC(JoinRequests);
