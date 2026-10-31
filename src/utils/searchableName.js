export const normalizeSearchText = (value = "") =>
  String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
