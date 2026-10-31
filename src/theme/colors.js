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
export const DEFAULT_THEME = "dark";
export const THEME_STORAGE_KEY = "chathere-theme";

/** Value written to <meta name="theme-color"> for each theme. */
export const META_THEME_COLORS = {
  light: "#f7efe8",
  dark: "#120d0b",
};

export const isValidTheme = (value) => THEMES.includes(value);

/** Core palette per theme (mirrors the CSS variables of the same name). */
export const palettes = {
  light: {
    wallpaper: "linear-gradient(180deg, #f7efe8, #efe3d9)",
    bg: "#f7efe8",
    primary: "#c8490b",
    primaryHover: "#b03e08",
    primarySoft: "rgba(217,86,15,.12)",
    primaryText: "#b4470b",
    primaryDark: "#c8490b",
    primaryLight: "#b4470b",
    onPrimary: "#ffffff",
    ring: "#d9560f",
    accent: "#9b5a35",
    accentName: "#8b4d2c",
    surface: "rgba(255,255,255,.72)",
    surface2: "rgba(255,255,255,.85)",
    surface3: "rgba(255,255,255,.95)",
    surface4: "#f3e9e1",
    glassBg: "rgba(255,255,255,.78)",
    border: "rgba(60,35,20,.10)",
    borderStrong: "rgba(60,35,20,.18)",
    borderLight: "rgba(60,35,20,.18)",
    text1: "#1e1613",
    text2: "#5b4f48",
    text3: "#75685f",
    textPrimary: "#1e1613",
    textSecondary: "#5b4f48",
    textMuted: "#75685f",
    glow: "rgba(217,86,15,.24)",
    danger: "#c62836",
    onDanger: "#ffffff",
    dangerHover: "#ad202d",
    dangerSoft: "rgba(198,40,54,.1)",
    dangerText: "#b42330",
    dangerBorder: "rgba(180,35,48,.34)",
    success: "#157a58",
    successSoft: "rgba(21,122,88,.1)",
    successText: "#157a58",
    successBackground: "rgba(21,122,88,.12)",
    warningText: "#8a4b08",
    warningSoft: "rgba(138,75,8,.08)",
    seen: "#2864a8",
    bubbleSent: "#1b1411",
    onBubbleSent: "#f6efe9",
    bubbleReceived: "rgba(255,255,255,.88)",
    bubbleReceivedBorder: "rgba(60,35,20,.08)",
    bubbleReceivedMeta: "#5b4f48",
    unreadText: "#1e1613",
    unreadMeta: "#b4470b",
  },
  dark: {
    wallpaper: "radial-gradient(ellipse at 20% 0%, rgba(242,115,43,.18), transparent 55%), linear-gradient(180deg, #5b3b2f 0%, #2a1b16 38%, #0e0a09 100%)",
    bg: "#0e0a09",
    primary: "#f2732b",
    primaryHover: "#e2621b",
    primarySoft: "rgba(242,115,43,.16)",
    primaryText: "#ffd3b8",
    primaryDark: "#e2621b",
    primaryLight: "#ffd3b8",
    onPrimary: "#0e0a09",
    ring: "#f2732b",
    accent: "#d9b894",
    accentName: "#d9b894",
    surface: "rgba(255,255,255,.06)",
    surface2: "rgba(255,255,255,.08)",
    surface3: "rgba(255,255,255,.11)",
    surface4: "rgba(255,255,255,.14)",
    glassBg: "rgba(28,19,16,.62)",
    border: "rgba(255,255,255,.09)",
    borderStrong: "rgba(255,255,255,.16)",
    borderLight: "rgba(255,255,255,.16)",
    text1: "#f6efe9",
    text2: "#b9aea6",
    text3: "#8f847c",
    textPrimary: "#f6efe9",
    textSecondary: "#e4d9d0",
    textMuted: "#d9d0c9",
    glow: "rgba(242,115,43,.32)",
    danger: "#ef3340",
    onDanger: "#0e0a09",
    dangerHover: "#d92a36",
    dangerSoft: "rgba(239,51,64,.14)",
    dangerText: "#ffced1",
    dangerBorder: "rgba(239,51,64,.4)",
    success: "#3fb68b",
    successSoft: "rgba(63,182,139,.16)",
    successText: "#8be0bd",
    successBackground: "rgba(63,182,139,.18)",
    warningText: "#ffdc9b",
    warningSoft: "rgba(245,183,107,.12)",
    seen: "#8ab4ff",
    bubbleSent: "#0a0706",
    onBubbleSent: "#f6efe9",
    bubbleReceived: "rgba(24,16,13,.62)",
    bubbleReceivedBorder: "rgba(255,255,255,.06)",
    bubbleReceivedMeta: "#d9d0c9",
    unreadText: "#f6efe9",
    unreadMeta: "#ffd3b8",
  },
};

export const success = "#3fb68b";
export const error = "#ef3340";