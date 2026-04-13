import { User } from "@/types/user";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface loginResponse {
  data: {
    token: string;
    user: User;
  };
}
