import { APP_LAYOUT_CONTAINER_ID } from "@/constants";
import {
  hideNavbar,
  selectIsNavbarVisible,
  selectIsSideDrawerVisible,
  showNavbar,
} from "@/features/AppSettings";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

const useAppLayoutNavbar = () => {
  const isNavbarVisible = useSelector(selectIsNavbarVisible);

  const isSideDrawerVisible = useSelector(selectIsSideDrawerVisible);

  const dispatch = useDispatch();

  useEffect(() => {
    const appLayoutContainer = document.getElementById(APP_LAYOUT_CONTAINER_ID);

    if (!appLayoutContainer) return;

    const handleOnScroll = () => {
      const scrollTop = appLayoutContainer.scrollTop;

      // If scrolling down AND navbar is visible, hide it
      if (scrollTop > 200 && isNavbarVisible) {
        dispatch(hideNavbar());
      }

      if (scrollTop <= 200 && !isNavbarVisible) {
        dispatch(showNavbar());
      }
    };

    // Add event handler to the scroll event
    appLayoutContainer.addEventListener("scroll", handleOnScroll);

    // Detach the event handler when component unmounts
    return () => {
      appLayoutContainer.removeEventListener("scroll", handleOnScroll);
    };
  }, [dispatch, isNavbarVisible]);

  return {
    isNavbarVisible,
    isSideDrawerVisible,
  };
};

export default useAppLayoutNavbar;
