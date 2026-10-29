import React from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@carbon/react";
import App from "./App";
import AuthGate from "./auth/AuthGate";
import "./styles.css";
import "@carbon/react/css/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme theme="white">
      <AuthGate><App /></AuthGate>
    </Theme>
  </React.StrictMode>,
);
