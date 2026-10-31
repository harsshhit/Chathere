import { normalizeSearchText } from "./searchableName";

describe("normalizeSearchText", () => {
  it("trims, collapses whitespace, and lowercases names for Firestore range queries", () => {
    expect(normalizeSearchText("  Alice   Wonderland  ")).toBe("alice wonderland");
    expect(normalizeSearchText("ALICE\nWonderland")).toBe("alice wonderland");
  });

  it("keeps empty strings empty", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
    expect(normalizeSearchText(null)).toBe("");
  });
});
