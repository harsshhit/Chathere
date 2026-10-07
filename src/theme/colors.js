/**
 * Theme constants for ChatHere.
 *
 * The actual colour tokens live as CSS variables in `src/index.css`
 * (`:root` / `[data-theme="light"]` and `[data-theme="dark"]`). This file
 * mirrors the core palette for JS consumers and holds the shared theme
 * configuration used by ThemeContext and the inline no-flash script in
 * `public/index.html` (keep the storage key and meta colours in sync there).
 */

export const THEMES = ["light", "dark"];
export const DEFAULT_THEME = "light";
export const THEME_STORAGE_KEY = "chathere-theme";

/** Value written to <meta name="theme-color"> for each theme. */
export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#0f0f17",
};

export const isValidTheme = (value) => THEMES.includes(value);

/** Core palette per theme (mirrors the CSS variables of the same name). */
export const palettes = {
  light: {
    primary: "#6366f1",
    primaryDark: "#4f46e5",
    primaryLight: "#4f46e5",
    accent: "#a78bfa",
    surface: "#f8f9fc",
    surface2: "#ffffff",
    surface3: "#f1f2f8",
    surface4: "#e9eaf3",
    border: "rgba(0,0,0,0.08)",
    borderLight: "rgba(0,0,0,0.14)",
    textPrimary: "#14141f",
    textSecondary: "#52526b",
    textMuted: "#8a8aa3",
    glow: "rgba(99,102,241,0.18)",
  },
  dark: {
    primary: "#6366f1",
    primaryDark: "#4f46e5",
    primaryLight: "#818cf8",
    accent: "#a78bfa",
    surface: "#0f0f17",
    surface2: "#16161f",
    surface3: "#1e1e2e",
    surface4: "#262636",
    border: "rgba(255,255,255,0.07)",
    borderLight: "rgba(255,255,255,0.12)",
    textPrimary: "#f1f1f7",
    textSecondary: "#a3a3b8",
    textMuted: "#6b6b82",
    glow: "rgba(99,102,241,0.3)",
  },
};

export const success = "#22c55e";
export const error = "#ef4444";