import { IAppMenuItem } from "@/types/layout";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StyledListItemButton,
  StyledListItemIcon,
  StyledListItemText,
  StyledMenuItem,
} from "./styled";
import { doesUrlMatchMenuItem } from "./utils";

export interface AppMenuItemProps extends IAppMenuItem {
  isChild?: boolean;
  hasSelectedChild?: boolean;
}

const AppMenuItem: FC<AppMenuItemProps> = ({
  label,
  Icon,
  items,
  link,
  isChild = false,
  hasSelectedChild = false,
  useIsVisible = () => true,
}) => {
  const [open, setOpen] = useState(false);

  const isExpandable =
    items && items.filter((item) => item.useIsVisible?.() ?? true).length > 0;

  const isActive = link ? doesUrlMatchMenuItem(link) : false;

  const toggleList = () => setOpen(!open);

  const isVisible = useIsVisible();
  const { t } = useTranslation("translation");

  if (!isVisible) return null;

  const MenuItemRoot = (
    <StyledMenuItem toggleList={toggleList} link={link} isChild={isChild}>
      <StyledListItemButton
        selected={isActive}
        isChild={isChild}
        hasIcon={!!Icon}
        hasSelectedChild={hasSelectedChild}
      >
        <StyledListItemText
          primary={t(`SideDrawerLinks.${label}`)}
          inset={isChild && !Icon}
          isChild={isChild}
          hasIcon={!!Icon}
        />

        {isExpandable && open && (
          <StyledListItemIcon>
            <ExpandLess />
          </StyledListItemIcon>
        )}

        {isExpandable && !open && (
          <StyledListItemIcon>
            <ExpandMore />
          </StyledListItemIcon>
        )}

        {Icon && <StyledListItemIcon>{Icon()}</StyledListItemIcon>}
      </StyledListItemButton>
    </StyledMenuItem>
  );

  const MenuItemChildren = isExpandable && (
    <Collapse in={open} timeout="auto" unmountOnExit>
      <Divider />
      <List disablePadding>
        {items?.map((item, index) => (
          <AppMenuItem {...item} key={index} isChild />
        ))}
      </List>
    </Collapse>
  );

  return (
    <>
      {MenuItemRoot}
      {MenuItemChildren}
    </>
  );
};

export default AppMenuItem;
