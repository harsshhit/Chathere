export const normalizeSearchText = (value = "") => {
  if (value == null) return "";

  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
};
