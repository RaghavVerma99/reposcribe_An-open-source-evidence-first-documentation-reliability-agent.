import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./app/App";
import ErrorBoundary from "./app/ErrorBoundary";
import { AppStateProvider } from "./app/AppState";
import "./styles/fonts.css";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
