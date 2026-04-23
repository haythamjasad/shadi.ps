import { Stack, Typography } from "@mui/material";
import { FC } from "react";
import { TransactionDetailRowProps } from "./types";

const TransactionDetailRow: FC<TransactionDetailRowProps> = ({
  label,
  value,
  ltr = false,
}) => (
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    sx={{ py: 1.5 }}
  >
    <Typography
      variant="body1"
      color="text.secondary"
      fontWeight={500}
      sx={{ fontSize: { xs: "8pt", sm: "10pt", md: "12pt" } }}
    >
      {label}
    </Typography>
    <Typography
      variant="body1"
      fontWeight={550}
      sx={{ fontSize: { xs: "8pt", sm: "10pt", md: "12pt" } }}
    >
      {ltr ? <bdi dir="ltr">{String(value)}</bdi> : value}
    </Typography>
  </Stack>
);

export default TransactionDetailRow;
