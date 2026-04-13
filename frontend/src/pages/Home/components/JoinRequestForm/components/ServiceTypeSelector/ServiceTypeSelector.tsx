import CheckIcon from "@mui/icons-material/Check";
import { Box, FormHelperText, Stack, Typography } from "@mui/material";
import { useField } from "formik";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { ServiceTypeItem } from "../../types";
import { SERVICE_TYPES } from "./constants.tsx";

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
    <Box
      sx={{
        border: "1px solid #b1aeb9ff",
        p: 1,
        borderRadius: 2,
        width: "100%",
      }}
    >
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        نوع الخدمة
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
                gap: 0.75,
                px: 1.2,
                py: 0.9,
                borderRadius: 3,
                fontSize: "clamp(9pt, 1vw, 12pt)",
                border: "1px solid #b1aeb9ff",
                borderColor: isSelected ? "primary.main" : "#b1aeb9ff",
                backgroundColor: isSelected
                  ? "rgba(25, 118, 210, 0.08)"
                  : "primary.light",
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
                minWidth={90}
                spacing={0.75}
              >
                {isSelected && (
                  <div
                    style={{ transform: "scaleX(-1)", width: 30, height: 20 }}
                  >
                    <CheckIcon fontSize="small" />
                  </div>
                )}
                {item.icon && (
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 28,
                      height: 28,
                    }}
                  >
                    {item.icon}
                  </Box>
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
