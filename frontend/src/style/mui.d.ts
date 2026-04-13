import { GlobalPalette } from "./types";

declare module "@mui/material" {
  interface Palette {
    userAvatar: GlobalPalette["userAvatar"];
    appMenu: GlobalPalette["appMenu"];
  }

  interface PaletteOptions {
    userAvatar: GlobalPalette["userAvatar"];
    appMenu: GlobalPalette["appMenu"];
  }

  interface Theme {
    mixins: AnharThemeMixins;
    palette: Palette;
  }
}
