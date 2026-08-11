import whatsappQR from "@/assets/images/whatsapp-qr.jpeg";
import Container from "@/containers/Container";
import useGetTransactionById from "@/services/Transactions/useGetTransactionById";
import { Location, ServiceType } from "@/types";
import {
  Alert,
  Box,
  Button,
  CardContent,
  CircularProgress,
  Divider,
  Grid2,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { CheckCircle, HomeIcon, XCircle } from "lucide-react";
import { FC } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import TransactionDetailRow from "./components/TransactionDetailRow";

dayjs.extend(utc);

const PaymentStatus: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("translation");
  const navigate = useNavigate();
  const isFailedOnly = id === "failed";

  const goToHome = () => navigate("/");

  const { transaction, isLoading, isError } = useGetTransactionById(id || "");

  if (isLoading) {
    return (
      <Container>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="60vh"
        >
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (isError || (!transaction && !isFailedOnly)) {
    return (
      <Container>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="60vh"
        >
          <Alert severity="error" icon={<XCircle />}>
            <Typography variant="h6">
              {t("PaymentStatus.errorMessage")}
            </Typography>
          </Alert>
        </Box>
      </Container>
    );
  }

  const isOk = isFailedOnly
    ? false
    :
    transaction?.status === "PENDING" || transaction?.status === "FINISHED";

  return (
    <Container sx={{ my: 2, maxWidth: "800px" }}>
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CardContent sx={{ p: 0.5 }}>
          <Stack spacing={1}>
            {/* Status Icon and Message */}
            <Stack alignItems="center" spacing={1}>
              {isOk ? (
                <Box sx={{ fontSize: { xs: "46px", sm: "54px", md: "62px" } }}>
                  <CheckCircle size="1em" color="#4caf50" />
                </Box>
              ) : (
                <Box sx={{ fontSize: { xs: "46px", sm: "54px", md: "62px" } }}>
                  <XCircle size="1em" color="#f44336" />
                </Box>
              )}
              <Typography
                fontWeight="bold"
                textAlign="center"
                sx={{ fontSize: { xs: "12pt", sm: "16pt", md: "22pt" } }}
              >
                {isOk
                  ? t("PaymentStatus.successTitle")
                  : t("PaymentStatus.failedTitle")}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                textAlign="center"
                sx={{ fontSize: { xs: "10pt", sm: "12pt", md: "14pt" } }}
              >
                {isOk
                  ? t("PaymentStatus.successMessage")
                  : t("PaymentStatus.failedMessage")}
              </Typography>
            </Stack>

            <Divider />

            {/* Main Content: Transaction Details and WhatsApp QR */}
            <Grid2 container spacing={1}>
              {/* Transaction Details */}
              <Grid2 size={{ xs: 12, md: 7 }}>
                <Stack spacing={0}>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    mb={2}
                    sx={{ fontSize: { xs: "10pt", sm: "12pt", md: "14pt" } }}
                  >
                    {t("PaymentStatus.transactionDetails")}
                  </Typography>

                  {!isFailedOnly && transaction && (
                    <>
                      <TransactionDetailRow
                        label={t("Tables.Headers.name")}
                        value={transaction.name}
                      />
                      <Divider />
                      <TransactionDetailRow
                        label={t("Tables.Headers.phone")}
                        value={transaction.phone}
                        ltr
                      />
                      <Divider />
                      <TransactionDetailRow
                        label={t("Tables.Headers.serviceType")}
                        value={transaction.serviceType
                          .map((service: ServiceType) => t(`ServiceType.${service}`))
                          .join(", ")}
                      />
                      <Divider />
                      {transaction.location && (
                        <>
                          <TransactionDetailRow
                            label={t("Tables.Headers.location")}
                            value={t(`Location.${transaction.location as Location}`)}
                          />
                          <Divider />
                        </>
                      )}
                      <TransactionDetailRow
                        label={t("Tables.Headers.cost")}
                        value={`$${transaction.cost}`}
                      />
                      <Divider />
                      {transaction.notes && (
                        <>
                          <Stack sx={{ py: 1.5 }}>
                            <Typography
                              sx={{ fontSize: { xs: "8pt", sm: "10pt", md: "12pt" } }}
                              color="text.secondary"
                              fontWeight={500}
                              mb={1}
                            >
                              {t("Tables.Headers.notes")}
                            </Typography>
                            <Typography
                              sx={{ fontSize: { xs: "8pt", sm: "10pt", md: "12pt" } }}
                            >
                              {transaction.notes}
                            </Typography>
                          </Stack>
                          <Divider />
                        </>
                      )}
                    </>
                  )}

                  {/* <TransactionDetailRow
                      label={t("Tables.Headers.createdAt")}
                      value={dayjs
                        .utc(transaction.createdAt)
                        .format("YYYY-MM-DD")}
                    /> */}
                </Stack>
              </Grid2>

              {/* WhatsApp QR Code Section */}
              <Grid2 size={{ xs: 12, md: 5 }}>
                <Grid2 size={{ xs: 12 }}>
                  <Stack
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Button
                      startIcon={<HomeIcon />}
                      onClick={goToHome}
                      size="large"
                      variant="contained"
                      sx={{ mt: 3 }}
                    >
                      <Trans i18nKey={"Buttons.home"}>Home</Trans>
                    </Button>
                  </Stack>
                </Grid2>
                <Grid2 size={{ xs: 12 }} p={1.5}>
                  <Stack
                    spacing={1}
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                      height: "100%",
                      p: 1,
                      backgroundColor: "#f5f5f5",
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      textAlign="center"
                    >
                      {t("PaymentStatus.scanQrCode")}
                    </Typography>
                    <Box
                      component="a"
                      href="https://wa.me/+972568114114"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        width: 200,
                        height: 200,
                        backgroundColor: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                        border: "2px solid #25D366",
                        p: 1,
                      }}
                    >
                      <img
                        src={whatsappQR}
                        alt="WhatsApp QR Code"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </Box>
                  </Stack>
                </Grid2>
              </Grid2>
            </Grid2>
          </Stack>
        </CardContent>
      </Box>
    </Container>
  );
};

export default PaymentStatus;
