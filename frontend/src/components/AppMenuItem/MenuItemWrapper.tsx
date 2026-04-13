import MuiLink from "@mui/material/Link"
import ListItem from "@mui/material/ListItem"
import { FC, MouseEvent, ReactNode } from "react"

export interface ItemWrapperProps {
  className?: string
  link?: string
  toggleList?: (event: MouseEvent<HTMLElement>) => void
  children?: ReactNode
}

const MenuItemWrapper: FC<ItemWrapperProps> = (props) => {
  const { className, toggleList, link, children } = props

  // If link is not set, return the ordinary ListItem
  if (!link) {
    return (
      <ListItem disablePadding className={className} onClick={toggleList}>
        {children}
      </ListItem>
    )
  }

  // Return a ListItem with a hyperlink component
  return (
    <ListItem disablePadding className={className}>
      <MuiLink href={link} sx={{ width: "100%" }} underline="none">
        {children}
      </MuiLink>
    </ListItem>
  )
}

export default MenuItemWrapper
