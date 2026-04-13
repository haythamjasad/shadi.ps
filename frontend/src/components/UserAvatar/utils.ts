import { USER_AVATAR_PALETTE } from "@/style/palettes"
import stringToColor from "@/utils/stringToColor"

export const getAvatarColor = (label: string) =>
  stringToColor(label, Object.values(USER_AVATAR_PALETTE))
