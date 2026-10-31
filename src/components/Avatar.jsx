import { avatarUrl } from "../utils/cloudinary";
import { getInitials } from "../utils/formatters";
import LazyImage from "./ui/LazyImage";

/**
 * Validate that an avatar URL is a secure https URL under 2000 chars.
 * Rejects data:, javascript:, blob:, and non-https schemes.
 */
export function isValidAvatarUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return false;
  if (!trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extract 1-2 uppercase initials from a user's display name.
 */
function getAvatarBackground() {
  return "var(--primary-soft)";
}

/**
 * Shared Avatar component used across the app (Navbar, Chats list, Messages, Headers, etc.)
 * Supports:
 * - src: direct https image/avatar URL
 * - name: displayName (with fallback to alt)
 * - size: optional number or string dimension
 * - className: CSS classes for layout/rounding
 * - style: custom style overrides
 * - Fallback: graceful initials fallback on dead/blocked images or invalid URLs
 */
const Avatar = ({ src, name, alt, size, className = "", style = {} }) => {
  const displayName = (name || alt || "User").trim();
  const initials = getInitials(displayName);
  const isValidUrl = isValidAvatarUrl(src);

  const sizeStyle = size
    ? typeof size === "number"
      ? { width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }
      : { width: size, height: size, minWidth: size, minHeight: size }
    : {};

  const combinedStyle = {
    ...sizeStyle,
    ...style,
  };
  const numericSize = typeof size === "number"
    ? size
    : Number.parseFloat(size) || 48;

  // If URL is invalid or failed to load, display initials fallback
  if (!isValidUrl) {
    return (
      <div
        role="img"
        aria-label={displayName}
        className={`inline-flex items-center justify-center font-bold text-[var(--text-1)] select-none overflow-hidden flex-shrink-0 ${className}`}
        style={{
          background: getAvatarBackground(),
          fontSize: size ? (typeof size === "number" ? `${Math.max(10, size * 0.38)}px` : "0.75rem") : "inherit",
          lineHeight: 1,
          ...combinedStyle,
        }}
      >
        <span>{initials}</span>
      </div>
    );
  }

  return <LazyImage
    src={avatarUrl(src, numericSize * 2)}
    alt={displayName}
    width={numericSize}
    height={numericSize}
    sizes={`${numericSize}px`}
    widths={[numericSize * 2]}
    className={`flex-shrink-0 rounded-full ${className}`}
    style={combinedStyle}
    manualLoadAction="container"
    fallbackContent={<div
      role="img"
      aria-label={displayName}
      className={`absolute inset-0 inline-flex items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] font-bold text-[var(--text-1)] select-none ${className}`}
      style={{
        fontSize: `${Math.max(10, numericSize * 0.38)}px`,
        lineHeight: 1,
        ...combinedStyle,
      }}
    ><span>{initials}</span></div>}
  />;
};

export default Avatar;
