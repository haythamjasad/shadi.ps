export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface ResetPasswordFormPayload {
  token: string;
  password: string;
  confirmPassword: string;
}
