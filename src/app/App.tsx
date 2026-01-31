import { BrowserRouter } from "react-router-dom";

import "../shared/styles/App.css";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
