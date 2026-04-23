import Providers from "./Providers";
import Snackbar from "./components/Snackbar";
import AppRoutes from "./routes/AppRoutes";
import "./config/i18n";

function App() {
  return (
    <Providers>
      <AppRoutes />
      <Snackbar />
    </Providers>
  );
}

export default App;
