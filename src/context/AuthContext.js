import { onAuthStateChanged } from "firebase/auth";
import { createContext, useEffect, useState } from "react";
import { auth } from "../firebase";

export const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
      },
      (error) => {
        setError(error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center"
        style={{ background: "var(--surface)" }}
        aria-label="Loading authentication state"
      >
        <div
          className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--primary-light)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, error }}>
      {children}
    </AuthContext.Provider>
  );
};
