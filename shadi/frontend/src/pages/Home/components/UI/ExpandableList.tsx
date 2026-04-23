import ListItem from "@/components/ListItem";
import { Button, List, Stack } from "@mui/material";
import { FC, useState } from "react";

interface ExpandableListProps {
  items: { icon: React.ReactNode; text: string }[];
  initialCount?: number;
  moreLabel?: string;
  lessLabel?: string;
}

const ExpandableList: FC<ExpandableListProps> = ({
  items,
  initialCount = 3,
  moreLabel = "عرض المزيد",
  lessLabel = "عرض أقل",
}) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);

  return (
    <Stack spacing={1} sx={{ width: "100%", maxWidth: "600px" }}>
      <List sx={{ width: "100%" }}>
        {visible.map((item, idx) => (
          <ListItem icon={item.icon} secondary={item.text} key={idx} />
        ))}
      </List>
      {items.length > initialCount && (
        <Button
          variant="text"
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ alignSelf: "flex-start" }}
        >
          {expanded ? lessLabel : moreLabel}
        </Button>
      )}
    </Stack>
  );
};

export default ExpandableList;
