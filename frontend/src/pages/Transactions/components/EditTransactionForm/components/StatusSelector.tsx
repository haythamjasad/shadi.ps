import { Box, Stack, Typography } from "@mui/material";
import { TRANSACTION_STATUS_OPTIONS } from "../constants";
import { CheckIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useField, useFormikContext } from "formik";
import { TransactionStatus } from "@/types";
import { FC } from "react";

interface Props {
  name: string; // formik field name
}

export const StatusSelector: FC<Props> = ({ name }) => {
  const { t } = useTranslation("translation");

  const { setFieldValue } = useFormikContext<any>();
  const [field, meta] = useField<TransactionStatus>(name);

  const isSelected = (item: TransactionStatus) => field.value === item;

  const selectOne = (item: TransactionStatus) => {
    setFieldValue(name, item);
  };

  return (
    <Box sx={{ border: "1px solid #e0e0e0", p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        <Trans i18nKey="Titles.transaction_status">Transaction Status</Trans>
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {TRANSACTION_STATUS_OPTIONS.map((item) => (
          <Box
            key={item.label}
            onClick={() => selectOne(item.value)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.6,
              py: 0.7,
              borderRadius: 3,
              fontSize: 14,
              border: "1px solid",
              borderColor: isSelected(item.value) ? "primary.main" : "#ccc",
              backgroundColor: isSelected(item.value)
                ? "rgba(25, 118, 210, 0.08)"
                : "transparent",
              color: isSelected(item.value) ? "primary.main" : "text.primary",
              userSelect: "none",
              transition: "all 0.2s ease",
              cursor: "pointer",
            }}
          >
            <Stack
              direction="row"
              justifyContent="center"
              alignItems="center"
              minWidth={90}
            >
              {isSelected(item.value) && (
                <div
                  style={{
                    transform: "scaleX(-1) !important",
                    width: 30,
                    height: 20,
                  }}
                >
                  <CheckIcon fontSize="small" />
                </div>
              )}

              {t(`Status.${item.label}`)}
            </Stack>
          </Box>
        ))}
      </Box>
      {meta.touched && meta.error && (
        <Typography
          variant="caption"
          sx={{
            color: "error.main",
            mt: 1,
            display: "block",
            textAlign: "left",
          }}
        >
          {t(`RadioError.${meta.error}`)}
        </Typography>
      )}
    </Box>
  );
};

export default StatusSelector;
