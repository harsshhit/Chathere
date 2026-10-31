import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthContextProvider } from "./context/AuthContext";
import reportWebVitals from "./reportWebVitals";
import { initAudioUnlock } from "./utils/notify";
import "./utils/perf";

const syncPageVisibility = () => {
  document.documentElement.toggleAttribute("data-page-hidden", document.hidden);
};
syncPageVisibility();
document.addEventListener("visibilitychange", syncPageVisibility);

// Initialize one-time audio unlock on first user gesture
initAudioUnlock();

// Register notification service worker on window load
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => {
          // Successfully registered
        })
        .catch((error) => {
          console.warn("Service worker registration failed:", error);
        });
    } catch (err) {
      console.warn("Error registering service worker:", err);
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <AuthContextProvider>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </AuthContextProvider>
);

reportWebVitals();
