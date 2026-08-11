import { AutocompleteProps as MuiAutocompleteProps } from "@mui/material/Autocomplete";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
export interface BaseAutoCompleteItem extends Record<string, any> {}

export interface AutocompleteFieldProps<T extends BaseAutoCompleteItem>
  extends Omit<
    MuiAutocompleteProps<T, boolean, boolean, boolean>,
    "renderInput"
  > {
  name: string;
  placeholder: string;
  setFilter?: (filter: string) => void;
}
