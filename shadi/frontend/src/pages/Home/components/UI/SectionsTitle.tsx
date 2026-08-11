import { Stack, StackProps, Typography } from "@mui/material";
import { FC, ReactNode } from "react";

export interface SectionTitleProps extends StackProps {
  logo: ReactNode;
}

const SectionTitle: FC<SectionTitleProps> = ({
  children,
  logo,
  ...stackProps
}) => {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      {...stackProps}
    >
      <div style={{ transform: "scaleX(-1)" }}>{logo}</div>
      <Typography
        variant="h2"
        sx={{ fontWeight: "bold", fontSize: { xs: "14pt", md: "34pt" } }}
      >
        {children}
      </Typography>
    </Stack>
  );
};

export default SectionTitle;
