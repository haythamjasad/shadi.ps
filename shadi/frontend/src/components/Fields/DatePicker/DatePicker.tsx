import { DatePicker as MuiDatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { useField } from "formik";
import { FC } from "react";
import { useTranslation } from "react-i18next";

type DatePickerProps = {
  name: string;
  onBlur?: () => void;
} & Omit<React.ComponentProps<typeof MuiDatePicker>, "value" | "onChange">;

const DatePicker: FC<DatePickerProps> = ({
  name,
  onBlur: onExternalBlur = () => {},
  ...rest
}) => {
  const { t } = useTranslation("translation");
  const [field, meta, helpers] = useField<string | null>(name);

  const hasError = Boolean(meta.touched && meta.error);

  return (
    <MuiDatePicker
      {...rest}
      value={field.value ? dayjs(field.value) : null}
      onChange={(value) => {
        helpers.setValue(value ? value.toISOString() : null, false);
      }}
      // 2️⃣ Validate only when user accepts the date
      onAccept={(value) => {
        helpers.setTouched(true);
        helpers.setValue(value ? value.toISOString() : null, true);
      }}
      onClose={() => {
        helpers.setTouched(true);
        onExternalBlur();
      }}
      slotProps={{
        textField: {
          fullWidth: true,
          size: "small",
          variant: "outlined",
          error: hasError,
          label: t(`Textfields.${name}`),
          helperText: hasError && t(`TextfieldErrors.${meta.error}`),
          FormHelperTextProps: {
            sx: { textAlign: "left" },
          },
        },
      }}
    />
  );
};

export default DatePicker;
