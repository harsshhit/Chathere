export const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : typeof value.toDate === "function"
    ? value.toDate()
    : new Date(typeof value === "number" ? value : value.seconds ? value.seconds * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTime = (value, options = { hour: "numeric", minute: "2-digit" }) => {
  const date = toDate(value);
  return date ? date.toLocaleTimeString([], options) : "";
};

export const formatLongDate = (value, options, fallback = "") => {
  const date = toDate(value);
  return date ? date.toLocaleDateString(undefined, options) : fallback;
};

export const formatChatListDate = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const diffDays = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatDayLabel = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric" });
};

export const formatFileSize = (bytes = 0, fallback = "0 KB") => {
  if (!Number.isFinite(bytes) || bytes <= 0) return fallback;
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
};

export const getInitials = (name) => {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
