import { Card, CardProps } from "@mui/material";
import { FC } from "react";

const Container: FC<CardProps> = ({ children, sx, ...rest }) => {
  return (
    <Card
      sx={{
        width: "90%",
        m: "auto",
        my: 5,
        p: 2,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Card>
  );
};

export default Container;
