import { IAppMenuItem } from "@/types/layout";
/**
 * Recursively checks if a menu item has an active (selected) child item
 */
export const hasSelectedChild = (menuItem: IAppMenuItem) => {
  if (!menuItem.items) return false;
  if (typeof window === "undefined") return false;

  for (const child of menuItem.items) {
    if (child.link === window.location.pathname) return true;
    if (child.items && hasSelectedChild(child)) return true;
  }

  return false;
};
