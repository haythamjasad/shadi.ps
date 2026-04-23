import { Button, Box } from "@mui/material";
import { FC, useState } from "react";
import { logoBGColor } from "@/style/colors";

interface ListItem {
  title: string;
  description: string;
}

interface NumberedExpandableListProps {
  items: ListItem[];
  defaultVisibleCount?: number;
}

const NumberedExpandableList: FC<NumberedExpandableListProps> = ({
  items,
  defaultVisibleCount = 1,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldShowToggle = items.length > defaultVisibleCount;
  const displayItems = isExpanded ? items : items.slice(0, defaultVisibleCount);

  return (
    <div>
      {displayItems.map((item, index) => (
        <Box key={index} sx={{ mb: 1 }}>
          <Box
            component="strong"
            sx={{
              fontSize: { xs: "11pt", md: "14pt" },
              color: "black",
            }}
          >
            {index + 1}. {item.title}
          </Box>
          <br />
          <Box component="span">{item.description}</Box>
        </Box>
      ))}

      {shouldShowToggle && (
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

export default NumberedExpandableList;
