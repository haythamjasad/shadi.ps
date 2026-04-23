import { AutocompleteProps } from "@mui/material/Autocomplete"

export interface BaseAutoCompleteItem extends Record<string, unknown> {
  disabled?: boolean
  disabledTooltip?: string
}

export interface MultiSelectAutoCompleteProps<T>
  extends AutocompleteProps<T, true, boolean, boolean> {
  showChips?: boolean
  showChipFullText?: boolean
  showCheckbox?: boolean
}
