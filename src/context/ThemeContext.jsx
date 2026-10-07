import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "./AuthContext";
import {
  DEFAULT_THEME,
  META_THEME_COLORS,
  THEME_STORAGE_KEY,
  isValidTheme,
} from "../theme/colors";

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

const readStoredTheme = () => {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(value) ? value : null;
  } catch {
    return null;
  }
};

const writeStoredTheme = (value) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    /* storage unavailable (private mode, quota) – ignore */
  }
};

const applyThemeToDocument = (value) => {
  document.documentElement.dataset.theme = value;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_THEME_COLORS[value]);
};

/**
 * Resolution order for the initial theme:
 *   1. localStorage "chathere-theme"
 *   2. users/{uid}.theme in Firestore (once logged in)
 *   3. "light"
 */
export const ThemeProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const uid = currentUser?.uid;

  const initialStored = useRef(readStoredTheme());
  // True once the user has an explicit preference on this device. Until then
  // we don't write localStorage, so a Firestore preference can still be adopted.
  const hasLocalPrefRef = useRef(initialStored.current !== null);

  const [theme, setThemeState] = useState(
    () => initialStored.current || DEFAULT_THEME
  );

  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Keep <html data-theme> and <meta name="theme-color"> in sync (before paint).
  useLayoutEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback(
    (next) => {
      if (!isValidTheme(next)) return;
      hasLocalPrefRef.current = true;
      setThemeState(next);
      writeStoredTheme(next);
      if (uid) {
        updateDoc(doc(db, "users", uid), { theme: next }).catch((err) =>
          console.error("Error saving theme preference:", err)
        );
      }
    },
    [uid]
  );

  const toggleTheme = useCallback(() => {
    setTheme(themeRef.current === "dark" ? "light" : "dark");
  }, [setTheme]);

  // After login: adopt the Firestore preference if this device has none, or
  // seed Firestore with the local preference if the account has none yet.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const remote = snap.data()?.theme;

        if (hasLocalPrefRef.current) {
          if (!isValidTheme(remote)) {
            updateDoc(doc(db, "users", uid), { theme: themeRef.current }).catch(
              () => {}
            );
          }
          return;
        }

        if (isValidTheme(remote)) {
          hasLocalPrefRef.current = true;
          setThemeState(remote);
          writeStoredTheme(remote);
        }
      })
      .catch((err) => console.error("Error loading theme preference:", err));

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY && isValidTheme(e.newValue)) {
        hasLocalPrefRef.current = true;
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);