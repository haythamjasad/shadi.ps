import appSettingsReducer from "@/features/AppSettings/appSettingsSlice";
import snackbarReducer from "@/features/Snackbar/snackbarSlice";
import userReducer from "@/features/User/userSlice";
import { combineReducers } from "@reduxjs/toolkit";

const RootReducer = combineReducers({
  user: userReducer,
  snackbar: snackbarReducer,
  appSettings: appSettingsReducer,
});

export default RootReducer;
