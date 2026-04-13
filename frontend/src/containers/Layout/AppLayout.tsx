import AppSideDrawer from "@/components/AppSideDrawer";
import Navbar from "@/components/Navbar";
import { APP_LAYOUT_CONTAINER_ID } from "@/constants";
import useAppLayoutNavbar from "@/hooks/useAppLayoutNavbar";
import useMediaQuery from "@/hooks/useMediaQuery";
import useSession from "@/hooks/useSession";
import { FC } from "react";
import { Outlet } from "react-router-dom";
import BlockUI from "../BlockUI";
import { AppLayoutContainer } from "./styled";

const AppLayout: FC = () => {
  const { isUpdatingSession } = useSession();

  const { isNavbarVisible, isSideDrawerVisible } = useAppLayoutNavbar();

  const { isMobile } = useMediaQuery();

  if (isUpdatingSession) return <BlockUI />;

  return (
    <>
      <Navbar />
      <AppSideDrawer />
      <AppLayoutContainer
        id={APP_LAYOUT_CONTAINER_ID}
        container
        isNavbarVisible={isNavbarVisible}
        isSideDrawerVisible={isSideDrawerVisible}
        isMobile={isMobile}
      >
        <Outlet />
        {/* <Footer /> */}
      </AppLayoutContainer>
    </>
  );
};

export default AppLayout;
