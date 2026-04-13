import { ReactElement } from "react";

export interface IAppMenuItem {
  label: string;
  link?: string;
  Icon?: () => ReactElement;
  items?: IAppMenuItem[];
  useIsVisible?: () => boolean;
}

export type StatusColor =
  | "error"
  | "success"
  | "primary"
  | "secondary"
  | "info"
  | "warning"
  | "default";
