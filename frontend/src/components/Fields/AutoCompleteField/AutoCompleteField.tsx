import { FILTER_DELAY_TIME } from "@/constants";
import { CircularProgress } from "@mui/material";
import MuiAutocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useField } from "formik";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { AutocompleteFieldProps, BaseAutoCompleteItem } from "./types";

const AutoCompleteField = <T extends BaseAutoCompleteItem>({
  name,
  placeholder,
  loading,
  setFilter,
  ...rest
}: AutocompleteFieldProps<T>) => {
  const [field, meta] = useField<string>(name);
  const config: Omit<
    AutocompleteFieldProps<T>,
    "renderInput" | "placeholder" | "setFilter"
  > = {
    ...field,
    ...rest,
    fullWidth: true,
  };

  const { t } = useTranslation("translation");

  let error: boolean;

  if (meta && meta.touched && meta.error) {
    error = true;
  }

  return (
    <MuiAutocomplete
      renderInput={(params) => (
        <TextField
          {...params}
          label={t(`AutoComplete.${placeholder}`)}
          name={name}
          helperText={
            meta &&
            meta.touched &&
            meta.error &&
            t(`AutoCompleteErrors.${name}`)
          }
          onChange={(e) => {
            if (setFilter) {
              setTimeout(() => setFilter(e.target.value), FILTER_DELAY_TIME);
            }
            field.onChange(e);
          }}
          onBlur={(e) => {
            if (setFilter) {
              setFilter("");
            }
            field.onBlur(e);
          }}
          error={error}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <Fragment>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </Fragment>
              ),
            },
          }}
        />
      )}
      {...config}
    />
  );
};

export default AutoCompleteField;
