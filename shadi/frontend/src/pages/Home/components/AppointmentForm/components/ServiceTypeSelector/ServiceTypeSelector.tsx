import CheckIcon from "@mui/icons-material/Check";
import { Box, Stack, Typography, FormHelperText } from "@mui/material";
import { FC } from "react";
import { useField } from "formik";
import { ServiceTypeItem } from "../../types";
import { SERVICE_TYPES } from "./constants";
import { useTranslation } from "react-i18next";

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

  return (
    <Box sx={{ border: "1px solid #e0e0e0", p: 1, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        نوع الخدمات التي تقدمها
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {SERVICE_TYPES.map((item) => {
          const isSelected = selectedServices.some(
            (selected) => selected.label === item.label
          );
          return (
            <Box
              key={item.label}
              onClick={() => toggle(item)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.8,
                borderRadius: 3,
                fontSize: "clamp(9pt, 1vw, 12pt)",
                border: "1px solid",
                borderColor: isSelected ? "primary.main" : "#ccc",
                backgroundColor: isSelected
                  ? "rgba(25, 118, 210, 0.08)"
                  : "transparent",
                color: isSelected ? "primary.main" : "text.primary",
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
                {isSelected && (
                  <div
                    style={{ transform: "scaleX(-1)", width: 30, height: 20 }}
                  >
                    <CheckIcon fontSize="small" />
                  </div>
                )}
                {item.label}
              </Stack>
            </Box>
          );
        })}
      </Box>
      {meta.touched && meta.error && (
        <FormHelperText error>
          {t(`CheckboxError.${meta.error}`)}
        </FormHelperText>
      )}
    </Box>
  );
};

export default FormikServiceTypeSelector;
