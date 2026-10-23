import React, { useState, useEffect } from "react";
import { optimizeUrl } from "../utils/cloudinary";

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
function getInitials(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const [hasError, setHasError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

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

  // If URL is invalid or failed to load, display initials fallback
  if (!isValidUrl || hasError) {
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

  return (
    <img
      src={optimizeUrl(src, 96)}
      alt={displayName}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasError(true)}
      className={`object-cover flex-shrink-0 ${className}`}
      style={combinedStyle}
    />
  );
};

export default Avatar;
