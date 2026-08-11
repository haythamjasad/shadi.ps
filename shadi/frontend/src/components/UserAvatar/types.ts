import { AvatarProps } from "@mui/material/Avatar";

type UserAvatarContent = {
  fullName: string;
  initials?: string;
};

export type UserAvatarProps = AvatarProps & UserAvatarContent;
