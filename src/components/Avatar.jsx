import React, { useState, useEffect } from "react";

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

/**
 * Deterministic color palette for avatar initials based on name string hash.
 */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", // indigo
  "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", // purple
  "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", // pink
  "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", // cyan
  "linear-gradient(135deg, #10b981 0%, #059669 100%)", // emerald
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", // amber
  "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", // orange
  "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", // blue
];

function getAvatarBackground(name) {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
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
        className={`inline-flex items-center justify-center font-bold text-white select-none overflow-hidden flex-shrink-0 ${className}`}
        style={{
          background: getAvatarBackground(displayName),
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
      src={src}
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
