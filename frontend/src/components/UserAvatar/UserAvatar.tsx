import getAvatarAbbreviation from "@/utils/getAvatarAbbreviation";
import { FC } from "react";
import { StyledAvatar } from "./styled";
import { UserAvatarProps } from "./types";
import { getAvatarColor } from "./utils";

const UserAvatar: FC<UserAvatarProps> = ({
  fullName,
  initials,
  sx,
  ...props
}) => {
  const avatarAbbreviation = initials
    ? initials.toUpperCase().slice(0, 2)
    : getAvatarAbbreviation(fullName);

  const avatarColor = getAvatarColor(getAvatarAbbreviation(fullName));

  return (
    <StyledAvatar sx={{ bgcolor: avatarColor, ...sx }} {...props}>
      {avatarAbbreviation}
    </StyledAvatar>
  );
};

export default UserAvatar;
