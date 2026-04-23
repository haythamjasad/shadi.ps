import { Button, TypographyProps } from "@mui/material";
import { FC, useState } from "react";
import { logoBGColor } from "@/style/colors";

const TextSlicer: FC<TypographyProps> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const text = typeof children === "string" ? children : String(children);
  const shouldSlice = text.length > 200;
  const displayText =
    shouldSlice && !isExpanded ? text.slice(0, 200) + "..." : text;

  return (
    <div>
      {displayText}
      {shouldSlice && (
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          size="small"
          sx={{
            color: logoBGColor,
            mt: 1,
            fontSize: { xs: "8pt", md: "10pt" },
            paddingTop: 0,
          }}
        >
          {isExpanded ? "اقرأ أقل" : "اقرأ المزيد"}
        </Button>
      )}
    </div>
  );
};

export default TextSlicer;
