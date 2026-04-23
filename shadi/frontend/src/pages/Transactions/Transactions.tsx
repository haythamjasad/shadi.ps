import StaticFilterGridToolbar from "@/components/StaticFilterGridToolbar";
import { StaticFilterGridToolbarProps } from "@/components/StaticFilterGridToolbar/StaticFilterGridToolbar";
import { DEFAULT_PAGE_SIZE, GRID_PAGE_SIZE_OPTIONS } from "@/constants";
import Container from "@/containers/Container";
import routeHOC from "@/routes/HOCs/routeHOC";
import { UpdateTransactionRequest } from "@/services/Transactions/APIs";
import useGetTransactions from "@/services/Transactions/useGetTransactions";
import { Paper, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { FC, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getColumns } from "./components/columns";
import EditTransactionForm from "./components/EditTransactionForm/EditTransactionForm";
import { defaultTransaction } from "./constants";

const Transactions: FC = () => {
  const { t } = useTranslation("translation");
  const [isUpdateTransactionDialogOpen, setIsUpdateTransactionDialogOpen] =
    useState<boolean>(false);
  const [transactionToUpdateDetails, setTransactionToUpdateDetails] =
    useState<UpdateTransactionRequest>(defaultTransaction);

  const {
    transactions,
    totalRows,
    refetchTransactions,
    isFetchingTransactions,
    paginationModel,
    setPaginationModel,
    setTextFilter,
    statusFilter,
    setStatusFilter,
  } = useGetTransactions();

  const columns = useMemo(
    () =>
      getColumns(
        t,
        setIsUpdateTransactionDialogOpen,
        setTransactionToUpdateDetails
      ),
    [t]
  );

  return (
    <Container>
      <Typography variant="h2" px={3} py={2}>
        <Trans i18nKey="SideDrawerLinks.transactions">Transactions</Trans>
      </Typography>
      <Stack justifyContent="center">
        <Paper variant="outlined" component="div" sx={{ pb: 2.5 }}>
          <DataGrid
            rows={transactions}
            columns={columns}
            loading={isFetchingTransactions}
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
              toolbar: StaticFilterGridToolbar,
            }}
            slotProps={{
              toolbar: {
                refetch: refetchTransactions,
                setTextFilter,
                statusFilter,
                setStatusFilter,
                isFetching: isFetchingTransactions,
              } as StaticFilterGridToolbarProps,
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: DEFAULT_PAGE_SIZE } },
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
      <EditTransactionForm
        open={isUpdateTransactionDialogOpen}
        onClose={() => setIsUpdateTransactionDialogOpen(false)}
        transaction={transactionToUpdateDetails}
        refetchTransactions={refetchTransactions}
        setTransaction={setTransactionToUpdateDetails}
      />
    </Container>
  );
};

const withRouteHoC = routeHOC({
  title: "Transactions",
  pageAccessName: "Transactions",
});

export default withRouteHoC(Transactions);
