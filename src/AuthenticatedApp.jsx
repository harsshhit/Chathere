import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatContextProvider } from "./context/ChatContext";
import { ThemeProvider } from "./context/ThemeContext";
import GlobalNotificationListener from "./components/GlobalNotificationListener";
import MobileTabShell from "./components/MobileTabShell";
import { lazy, Suspense } from "react";

const CommandPalette = lazy(() => import("./components/CommandPalette"));

function DesktopCommandPalette() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const [initialMode, setInitialMode] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setIsDesktop(media.matches);
      if (!media.matches) setInitialMode("");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isDesktop || loaded) return undefined;
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setInitialMode("palette");
        setLoaded(true);
      } else if (
        event.key === "?" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(event.target instanceof HTMLElement && (
          event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
        ))
      ) {
        event.preventDefault();
        setInitialMode("help");
        setLoaded(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isDesktop, loaded]);

  return isDesktop && loaded ? <Suspense fallback={<div className="fixed inset-x-0 top-[12vh] z-[100] mx-auto h-14 max-w-lg animate-pulse rounded-xl bg-[var(--surface-2)]" aria-label="Loading command palette" />}><CommandPalette initialMode={initialMode} /></Suspense> : null;
}

function ServiceWorkerMessageListener() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;
    const handleMessage = (event) => {
      if (event.data?.type === "OPEN_CHAT" && event.data.chatId) navigate(`/chat/${event.data.chatId}`);
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [navigate]);
  return null;
}

export default function AuthenticatedApp() {
  return <ChatContextProvider>
    <ThemeProvider>
      <ServiceWorkerMessageListener />
      <GlobalNotificationListener />
      <DesktopCommandPalette />
      <MobileTabShell />
    </ThemeProvider>
  </ChatContextProvider>;
}
