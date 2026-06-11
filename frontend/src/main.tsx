import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorHandler } from "./lib/logger";
import { initWebVitals } from "./lib/tracking";

installGlobalErrorHandler();
initWebVitals();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
