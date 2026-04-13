import CheckIcon from "@mui/icons-material/Check";
import { alpha, Box, Stack, Typography, FormHelperText } from "@mui/material";
import { FC } from "react";
import { useField } from "formik";
import { ServiceTypeItem } from "../../types";
import { SERVICE_TYPES } from "./constants.tsx";
import { useTranslation } from "react-i18next";
import { brand, logoColor } from "@/style/colors";

interface ServiceTypeSelectorProps {
  name: string;
}

const FormikServiceTypeSelector: FC<ServiceTypeSelectorProps> = ({ name }) => {
  const { t } = useTranslation("translation");
  const [field, meta, helpers] = useField<ServiceTypeItem[]>(name);

  const toggle = (item: ServiceTypeItem) => {
    const selected = field.value || [];
    if (selected.find((i) => i.label === item.label)) {
      helpers.setValue(selected.filter((i) => i.label !== item.label));
    } else {
      helpers.setValue([...selected, item]);
    }
  };

  const selectedServices = field.value || [];
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
        نوع الخدمة
      </Typography>
      <Box
        sx={{
          display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 1,
      }}
    >
      {SERVICE_TYPES.map((item) => {
        const isSelected = selectedServices.some(
          (selected) => selected.label === item.label,
        );
        return (
          <Box
            key={item.label}
            onClick={() => toggle(item)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              fontSize: "clamp(9pt, 1vw, 12pt)",
              border: "1px solid",
                borderColor: isSelected
                  ? accentColor
                  : alpha(brand[500], 0.25),
               backgroundColor: isSelected
                  ? alpha(accentColor, 0.12)
                  : alpha(baseBg, 1),
               color: brand[700],
               userSelect: "none",
               transition: "all 0.2s ease",
               cursor: "pointer",
               boxShadow: isSelected
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
                      color: isSelected ? brand[700] : accentColor,
                      border: `1px solid ${alpha(accentColor, 0.3)}`,
                    }}
                  >
                    {item.icon}
                  </Box>
                )}
                <Typography
                  component="span"
                  sx={{ fontWeight: "bold", color: brand[700] }}
                >
                  {item.label}
                </Typography>
              </Stack>
              {isSelected && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: accentColor,
                    transform: "scaleX(-1)",
                  }}
                >
                  <CheckIcon fontSize="small" />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {meta.touched && meta.error && (
        <FormHelperText error sx={{ color: "#ffcdc9" }}>
          {t(`CheckboxError.${meta.error}`)}
        </FormHelperText>
      )}
    </Box>
  );
};

export default FormikServiceTypeSelector;
