import {
  selectIsNavbarVisible,
  selectIsSideDrawerVisible,
} from "@/features/AppSettings/selectors";
import { useSelector } from "react-redux";
import AppMenu from "../AppMenu";
import { StyledDrawer } from "./styled";

const AppSideDrawer = () => {
  const isSidebarOpen = useSelector(selectIsSideDrawerVisible);

  const isNavbarVisible = useSelector(selectIsNavbarVisible);

  return (
    <StyledDrawer
      variant="persistent"
      open={isSidebarOpen}
      anchor="left"
      isNavbarVisible={isNavbarVisible}
    >
      <AppMenu />
    </StyledDrawer>
  );
};

export default AppSideDrawer;
