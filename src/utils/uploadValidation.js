import { BLOCKED_EXTENSIONS } from "../config/uploadLimits";

const BLOCKED_MIME_TYPES = new Set([
  "application/java-archive",
  "application/vnd.android.package-archive",
  "application/vnd.microsoft.portable-executable",
  "application/x-bat",
  "application/x-executable",
  "application/x-msdos-program",
  "application/x-msdownload",
  "application/x-msi",
  "application/x-sh",
  "application/x-sharedlib",
  "image/svg+xml",
  "text/x-shellscript",
]);

export const getUploadValidationError = (file) => {
  if (!file || typeof file !== "object") return "No file was selected.";
  const extension = typeof file.name === "string" && file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase()
    : "";
  const mimeType = typeof file.type === "string"
    ? file.type.split(";")[0].trim().toLowerCase()
    : "";

  if (
    BLOCKED_EXTENSIONS.includes(extension) ||
    BLOCKED_MIME_TYPES.has(mimeType) ||
    mimeType.startsWith("image/svg")
  ) {
    return "This file type is not allowed.";
  }
  return "";
};
