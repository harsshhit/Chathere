import { BrowserRouter, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { UIProvider } from "./context/UIContext";
import { ChatContextProvider } from "./context/ChatContext";
import { InstallProvider } from "./context/InstallContext";
import useVisualViewport from "./utils/useVisualViewport";
import GlobalNotificationListener from "./components/GlobalNotificationListener";
import CommandPalette from "./components/CommandPalette";
import MobileTabShell from "./components/MobileTabShell";
import "./index.css";

// Listen for service worker notification clicks and navigate to the target chat
function ServiceWorkerMessageListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = (event) => {
      if (event.data?.type === "OPEN_CHAT" && event.data.chatId) {
        navigate(`/chat/${event.data.chatId}`);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [navigate]);

  return null;
}

const App = () => {
  useVisualViewport();

  return (
    <UIProvider>
      <InstallProvider>
        <BrowserRouter
          basename="/"
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <ChatContextProvider>
          <ServiceWorkerMessageListener />
          <GlobalNotificationListener />
          <CommandPalette />
          <MobileTabShell />
        </ChatContextProvider>
      </BrowserRouter>
    </InstallProvider>
  </UIProvider>
  );
};

export default App;
