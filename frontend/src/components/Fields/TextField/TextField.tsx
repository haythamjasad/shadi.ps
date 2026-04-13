import MuiTextField from "@mui/material/TextField";
import { useField } from "formik";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { TextFieldProps } from "./types";

const TextField: FC<TextFieldProps> = ({
  name,
  onBlur: onExternalBlur = () => {},
  ...rest
}) => {
  const { t } = useTranslation("translation");
  const [field, meta, helpers] = useField<string>(name);

  const textFieldConfigs = {
    ...field,
    ...rest,
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      helpers.setValue(e.target.value.trim());
      field.onBlur(e);
      onExternalBlur(e);
    },
  };

  if (meta && meta.touched && meta.error) {
    textFieldConfigs.error = true;
  }

  return (
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      helperText={
        meta && meta.touched && meta.error && t(`TextfieldErrors.${meta.error}`)
      }
      slotProps={{
        formHelperText: {
          sx: { textAlign: "left" },
        },
      }}
      label={t(`Textfields.${name}`)}
      {...textFieldConfigs}
    />
  );
};

export default TextField;
