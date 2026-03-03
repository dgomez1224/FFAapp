import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "../src/pages/router";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import { runDiagnostics } from "../src/lib/diagnostics";
import "../src/styles/index.css";
import "../src/styles/fpl-tables.css";

if (import.meta.env.DEV) {
  runDiagnostics();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  </React.StrictMode>
);
