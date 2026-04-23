export type UserRole = "ROLE_ADMIN" | "ROLE_USER";
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface TokenUserPayload extends Omit<User, "role"> {
  roles: UserRole[];
}
