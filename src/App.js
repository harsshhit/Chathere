import { Route, BrowserRouter, Routes, Navigate } from "react-router-dom";
import { useContext, lazy, Suspense } from "react";
import { AuthContext } from "./context/AuthContext";
import { UIProvider } from "./context/UIContext";
import { Loader2 } from "lucide-react";
import "./index.css";

const Register = lazy(() => import("./pages/Register"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LoadingFallback = () => (
  <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--surface)]">
    <Loader2 size={32} className="animate-spin text-indigo-400" />
  </div>
);

const App = () => {
  const { currentUser } = useContext(AuthContext);

  const ProtectedRoute = ({ children }) =>
    currentUser ? children : <Navigate to="/login" />;

  return (
    <UIProvider>
      <BrowserRouter basename="/" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route
              index
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
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
      </BrowserRouter>
    </UIProvider>
  );
};

export default App;
