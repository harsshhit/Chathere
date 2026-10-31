import { BrowserRouter } from "react-router-dom";
import { lazy, Suspense, useContext } from "react";
import { UIProvider } from "./context/UIContext";
import { InstallProvider } from "./context/InstallContext";
import { AuthContext } from "./context/AuthContext";
import useVisualViewport from "./utils/useVisualViewport";
import MobileTabShell from "./components/MobileTabShell";
import "./index.css";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));

function RouteContent() {
  const { currentUser } = useContext(AuthContext);
  return currentUser
    ? <Suspense fallback={<div className="min-h-full animate-pulse bg-[var(--surface-2)]" role="status" aria-live="polite">Loading chats</div>}><AuthenticatedApp /></Suspense>
    : <MobileTabShell />;
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
          <Suspense fallback={<div className="min-h-[100dvh] animate-pulse bg-[var(--surface-2)]" role="status" aria-live="polite">Loading application</div>}>
            <RouteContent />
          </Suspense>
      </BrowserRouter>
    </InstallProvider>
  </UIProvider>
  );
};

export default App;
