import { getUploadValidationError } from "./uploadValidation";

describe("getUploadValidationError", () => {
  it.each([
    [{ name: "picture.svg", type: "image/svg+xml" }, true],
    [{ name: "picture.svg", type: "application/octet-stream" }, true],
    [{ name: "picture.png", type: "image/svg+xml" }, true],
    [{ name: "script.exe", type: "application/octet-stream" }, true],
    [{ name: "script.txt", type: "application/x-msdownload" }, true],
    [{ name: "photo.jpg", type: "image/jpeg" }, false],
    [{ name: "recording.webm", type: "audio/webm" }, false],
  ])("validates %s", (file, isBlocked) => {
    expect(Boolean(getUploadValidationError(file))).toBe(isBlocked);
  });
});
