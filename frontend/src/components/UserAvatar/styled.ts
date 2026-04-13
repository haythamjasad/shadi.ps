import Avatar, { AvatarProps } from "@mui/material/Avatar";
import { styled } from "@mui/material/styles";

export const StyledAvatar = styled(Avatar)<AvatarProps>(({ theme }) => ({
  width: 32,
  height: 32,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: theme.typography.fontWeightMedium,
  letterSpacing: "0.5px",
}));
