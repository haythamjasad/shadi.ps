import { clearAuthHeader } from "@/config/axios.config";
import { logout, selectUser } from "@/features/User";
import useMediaQuery from "@/hooks/useMediaQuery";
import { clearSession } from "@/lib/session";
import { useAppSelector } from "@/store";
import getAvatarAbbreviation from "@/utils/getAvatarAbbreviation";
import { MouseEvent, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

const useAccountMenu = () => {
  const dispatch = useDispatch();

  const { isMobile } = useMediaQuery();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const { firstName, lastName, email } = useAppSelector(selectUser);

  const avatarUrl = "";

  const userInitial = getAvatarAbbreviation(email ?? "");

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const navigate = useNavigate();

  const handleLogOut = () => {
    clearAuthHeader();
    clearSession();
    dispatch(logout());
    navigate("/");
  };

  return {
    isMobile,
    anchorEl,
    open,
    fullName: `${firstName} ${lastName}`,
    avatarUrl,
    userInitial,
    handleClick,
    handleClose,
    handleLogOut,
  };
};

export default useAccountMenu;
