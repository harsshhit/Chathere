import { safeHttpUrl } from "./safeUrl";

const scriptUrl = ["java", "script:alert(1)"].join("");

describe("safeHttpUrl", () => {
  it("accepts absolute HTTP and HTTPS URLs", () => {
    expect(safeHttpUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it.each([scriptUrl, "data:text/html,hi", "file:///secret", "//example.com", "https://user:pass@example.com"])(
    "rejects unsafe or ambiguous URLs: %s",
    (value) => {
      expect(safeHttpUrl(value)).toBeNull();
    }
  );
});
