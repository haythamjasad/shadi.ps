import { Box, Stack, Typography } from "@mui/material";
import { FC } from "react";

interface TitleWithIconProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

const TitleWithIcon: FC<TitleWithIconProps> = ({ icon, children }) => (
  <Stack
    direction="row"
    spacing={1.5}
    alignItems="center"
    justifyContent="center"
    sx={{ width: "100%", maxWidth: "600px" }}
  >
    <Box sx={{ color: "primary.main", display: "inline-flex" }}>{icon}</Box>
    <Typography variant="h4">{children}</Typography>
  </Stack>
);

export default TitleWithIcon;
