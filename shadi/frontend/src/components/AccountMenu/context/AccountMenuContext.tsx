import { noop } from "@/utils/functionsUtils";
import { createContext } from "react";

export interface AccountMenuContextValues {
  onClose: () => void;
  onLogOut: () => void;
}

export const AccountMenuContext = createContext<AccountMenuContextValues>({
  onClose: noop,
  onLogOut: noop,
});
