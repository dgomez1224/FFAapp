import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "../src/pages/router";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import "../src/styles/index.css";
import "../src/styles/fpl-tables.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  </React.StrictMode>
);
