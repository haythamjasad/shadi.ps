import {
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItem as MuiListItem,
} from "@mui/material";
import { FC } from "react";

interface ListItemProps extends React.ComponentProps<typeof MuiListItem> {
  icon?: React.ReactNode;
  primary?: string;
  secondary?: string;
}

export const ListItem: FC<ListItemProps> = ({
  icon,
  primary,
  secondary,
  ...props
}) => {
  return (
    <MuiListItem {...props}>
      {icon && (
        <ListItemAvatar>
          <Avatar>{icon}</Avatar>
        </ListItemAvatar>
      )}
      <ListItemText
        primary={primary}
        secondary={secondary}
        sx={{
          "& .MuiListItemText-primary": {
            fontSize: { xs: "9pt", md: "14pt" },
            fontWeight: "bold",
          },
          "& .MuiListItemText-secondary": {
            fontSize: { xs: "8pt", md: "14pt" },
          },
        }}
      />
    </MuiListItem>
  );
};

export default ListItem;
