import { FC } from "react";
import { useField, useFormikContext } from "formik";
import { Box, Stack, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { LocationItem } from "../../types";
import { LOCATIONS } from "./constants";
import { useTranslation } from "react-i18next";

interface Props {
  name: string; // formik field name
}

const LocationSelectorField: FC<Props> = ({ name }) => {
  const { t } = useTranslation("translation");

  const { setFieldValue } = useFormikContext<any>();
  const [field, meta] = useField<LocationItem | null>(name);

  const isSelected = (item: LocationItem) => field.value?.label === item.label;

  const selectOne = (item: LocationItem) => {
    setFieldValue(name, item);
  };

  return (
    <Box
      sx={{
        border: "1px solid rgba(248, 159, 50, 0.35)",
        p: 1,
        borderRadius: 2,
      }}
    >
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        الموقع
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {LOCATIONS.map((item) => (
          <Box
            key={item.label}
            onClick={() => selectOne(item)}
            sx={{
              pointerEvents: item.enabled ? "auto" : "none",
              opacity: item.enabled ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.8,
              borderRadius: 2,
              fontSize: "clamp(9pt, 1vw, 12pt)",
              border: "1px solid",
              borderColor: isSelected(item) ? "rgba(248, 159, 50, 1)" : "rgba(248, 159, 50, 0.35)",
              backgroundColor: isSelected(item)
                ? "rgba(248, 159, 50, 0.12)"
                : "#ffffff",
              color: isSelected(item) ? "rgba(248, 159, 50, 1)" : "text.primary",
              userSelect: "none",
              transition: "all 0.2s ease",
              cursor: "pointer",
            }}
          >
            <Stack
              direction="row"
              justifyContent="center"
              alignItems="center"
              minWidth={80}
            >
              {isSelected(item) && (
                <div
                  style={{
                    transform: "scaleX(-1)",
                    width: 30,
                    height: 20,
                  }}
                >
                  <CheckIcon fontSize="small" />
                </div>
              )}

              {item.label}
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

export default LocationSelectorField;
