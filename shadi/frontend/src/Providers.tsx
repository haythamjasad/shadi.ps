import QueryClientProvider from "@/containers/QueryClientProvider";
import Store from "@/store/store";
import ThemeProvider from "@/style/ThemeProvider";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { FC, PropsWithChildren } from "react";
import { Provider } from "react-redux";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

const cache = createCache({
  key: "material-ui-rtl",
  stylisPlugins: [rtlPlugin],
});

const Providers: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Provider store={Store}>
      <CacheProvider value={cache}>
        <QueryClientProvider>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ThemeProvider>{children}</ThemeProvider>
            <ReactQueryDevtools
              initialIsOpen={false}
              position="right"
              buttonPosition="bottom-right"
            />
          </LocalizationProvider>
        </QueryClientProvider>
      </CacheProvider>
    </Provider>
  );
};

export default Providers;
