import { clearSession } from "@/lib/session";
import { User } from "@/types/user";
import { PayloadAction, createSlice } from "@reduxjs/toolkit";

const initialState: User = {
  id: "",
  email: "",
  firstName: "",
  lastName: "",
  role: "ROLE_USER",
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    login: (state, action: PayloadAction<User>) => {
      state = { ...action.payload };
      return state;
    },
    updateUserSession: (state, action: PayloadAction<User>) => {
      state = { ...action.payload };
      return state;
    },
    logout: (state) => {
      state = initialState;
      clearSession();
      return state;
    },
  },
});

export const { login, updateUserSession, logout } = userSlice.actions;

export default userSlice.reducer;
