import { alpha, Box, Stack, Typography } from "@mui/material";
import { FC } from "react";
import { useField, useFormikContext } from "formik";
import CheckIcon from "@mui/icons-material/Check";
import { LocationItem } from "../../types";
import { LOCATIONS } from "./constants.tsx";
import { useTranslation } from "react-i18next";
import { brand, logoColor } from "@/style/colors";

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
  const accentColor = logoColor;
  const baseBg = "#ffffff";

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: alpha(accentColor, 0.25),
        p: { xs: 1, md: 1.5 },
        borderRadius: 3,
        background: "#ffffff",
        boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ mb: 1, color: brand[600], fontWeight: "bold" }}
      >
        الموقع
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 1,
      }}
    >
      {LOCATIONS.map((item) => (
        <Box
            key={item.label}
            onClick={() => selectOne(item)}
            sx={{
              pointerEvents: item.enabled ? "auto" : "none",
              opacity: item.enabled ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              fontSize: "clamp(9pt, 1vw, 12pt)",
              border: "1px solid",
              borderColor: isSelected(item) ? accentColor : alpha(brand[500], 0.25),
              backgroundColor: isSelected(item)
                ? alpha(accentColor, 0.12)
                : alpha(baseBg, 1),
              color: brand[700],
              userSelect: "none",
              transition: "all 0.2s ease",
              cursor: "pointer",
              boxShadow: isSelected(item)
                ? "0 10px 18px rgba(0,0,0,0.12)"
                : "0 4px 10px rgba(0,0,0,0.06)",
              "&:hover": {
                borderColor: accentColor,
                backgroundColor: alpha(accentColor, 0.14),
                transform: "translateY(-1px)",
              },
            }}
          >
            <Stack
              direction="row"
              justifyContent="flex-start"
              alignItems="center"
              spacing={1}
              minWidth={0}
            >
              {item.icon && (
                <Box
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: alpha(accentColor, 0.16),
                    color: isSelected(item) ? brand[700] : accentColor,
                    border: `1px solid ${alpha(accentColor, 0.3)}`,
                  }}
                >
                  {item.icon}
                </Box>
              )}
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

              <Typography
                component="span"
                sx={{ fontWeight: "bold", color: brand[700] }}
              >
                {item.label}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Box>
      {meta.touched && meta.error && (
        <Typography
          variant="caption"
          sx={{
            color: "#ffcdc9",
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
