import { noop } from "@/utils/functionsUtils";
import { MixinsOptions } from "@mui/material/styles/createMixins";
import { APP_SIDE_DRAWER_PALETTE, USER_AVATAR_PALETTE } from "./palettes";

export interface GlobalPalette {
  userAvatar: typeof USER_AVATAR_PALETTE;
  appMenu: typeof APP_SIDE_DRAWER_PALETTE;
}

export interface GlobalThemeMixins extends MixinsOptions {
  niceScroll: (width?: number) => object;
  showTextOverflowEllipsis: typeof noop;
  removeInputNumberArrows: typeof noop;
  hideTextFieldBorder: typeof noop;
}
