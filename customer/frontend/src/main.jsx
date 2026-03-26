import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initializeCacheManagement } from "./utils/cacheManager";

import "./App.css";
import "./styles/base.css";
import "./styles/navbar.css";
import "./styles/home.css";
import "./styles/search.css";
import "./styles/carousel.css";
import "./styles/footer.css";
import "./styles/responsive.css";
import "./styles/unified-modal.css";
import "./styles/unified-forms.css";
import "./styles/unified-buttons.css";
import "./index.css";
import "./styles/toast.css";
import { installAlertToasts } from "./utils/toast";

// Initialize cache management to prevent stale data
initializeCacheManagement();

/* Suppress CORS errors from location APIs - Multi-layer suppression */
const originalError = console.error;
const originalWarn = console.warn;

const isCORSError = (message) => {
  const str = String(message || "");
  return (
    str.includes("CORS") ||
    str.includes("nominatim") ||
    str.includes("Access to fetch") ||
    str.includes("blocked by CORS") ||
    str.includes("ERR_FAILED") ||
    str.includes("Failed to fetch")
  );
};

// Layer 1: Suppress console.error
console.error = function(...args) {
  if (isCORSError(args[0])) return;
  originalError.apply(console, args);
};

// Layer 2: Suppress console.warn
console.warn = function(...args) {
  if (isCORSError(args[0])) return;
  originalWarn.apply(console, args);
};

// Layer 3: Suppress unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  if (isCORSError(event.reason?.message || event.reason)) {
    event.preventDefault();
  }
});

// Layer 4: Override fetch to catch CORS errors
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args).catch((err) => {
    if (isCORSError(err.message)) {
      return Promise.reject(err); // Return rejected promise but don't log
    }
    throw err;
  });
};

installAlertToasts();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);