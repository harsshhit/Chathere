import { Route, BrowserRouter, Routes, Navigate, useNavigate } from "react-router-dom";
import { useContext, lazy, Suspense, useEffect } from "react";
import { AuthContext } from "./context/AuthContext";
import { UIProvider } from "./context/UIContext";
import { ChatContextProvider } from "./context/ChatContext";
import { InstallProvider } from "./context/InstallContext";
import useVisualViewport from "./utils/useVisualViewport";
import { Loader2 } from "lucide-react";
import "./index.css";

const Register = lazy(() => import("./pages/Register"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Preload heavy chunks after first paint so navigation is instant
function ChunkPreloader() {
  useEffect(() => {
    const preload = () => {
      import("./pages/Profile").catch(() => {});
      import("./pages/Home").catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload);
    } else {
      setTimeout(preload, 2000);
    }
  }, []);
  return null;
}

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

// Lightweight skeleton instead of full-screen spinner
const LoadingFallback = () => (
  <div
    className="min-h-[100dvh] flex items-center justify-center"
    style={{ background: "var(--surface)" }}
    aria-label="Loading"
  >
    <Loader2 size={28} className="animate-spin" style={{ color: "var(--primary-light)" }} />
  </div>
);

// ProtectedRoute defined at module scope — never re-created on render
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  return currentUser ? children : <Navigate to="/login" replace />;
};

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
          <ChunkPreloader />
          <ServiceWorkerMessageListener />
          <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/*
              Nested home layout: "/" and "/chat/:chatId" share the same Home
              shell (Sidebar always mounted), only the right-pane content changes.
              Home reads the :chatId param from useParams() to hydrate ChatContext.
            */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            >
              {/* /chat/:chatId is a child route so Sidebar stays mounted */}
              <Route path="chat/:chatId" element={null} />
            </Route>

            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ChatContextProvider>
      </BrowserRouter>
    </InstallProvider>
  </UIProvider>
  );
};

export default App;
