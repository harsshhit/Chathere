import { Route, BrowserRouter, Routes, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Login from "./pages/Login";
// import "./style.scss";
import "./index.css";
import { UIProvider } from "./context/UIContext";
import Profile from "./pages/Profile"

const App = () => {
  const { currentUser } = useContext(AuthContext);

  const ProtectedRoute = ({ children }) =>
    currentUser ? children : <Navigate to="/login" />;

  return (
    <UIProvider>
      <BrowserRouter basename="/">
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
          <Route path="profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </UIProvider>
  );
};

export default App;
