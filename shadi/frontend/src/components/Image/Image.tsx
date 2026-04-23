import { Box, BoxProps } from "@mui/material";
import { ImgHTMLAttributes } from "react";

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    boxProps?: BoxProps;
}

const Image = ({ src, alt, boxProps }: ImageProps) => {
  return (
    <Box
      component="img"
      sx={{
        height: 233,
        width: 350,
        maxHeight: { xs: 233, md: 167 },
        maxWidth: { xs: 350, md: 250 },
      }}
      alt={alt}
      src={src}
      {...boxProps}
    />
  );
};

export default Image;
