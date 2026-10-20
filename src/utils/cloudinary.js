import { IMAGE_COMPRESSION } from "../config/uploadLimits";
import { compressImage } from "./compressImage";

export const uploadFile = async (file, { folder = "chathere", onProgress, signal } = {}) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary is not configured");
  if (!file || typeof file !== "object") throw new Error("No file was selected.");

  const mimeType = typeof file.type === "string" ? file.type : "";
  const resourceType = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
        ? "audio"
        : "raw";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("resource_type", resourceType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.timeout = resourceType === "video" ? 300000 : 60000;

    const handleAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (HTTP ${xhr.status}). Please retry.`));
        return;
      }

      try {
        const response = JSON.parse(xhr.responseText);
        if (!response.secure_url) throw new Error();
        resolve({
          url: response.secure_url,
          resourceType: response.resource_type || resourceType,
          bytes: typeof response.bytes === "number" ? response.bytes : file.size,
          format: response.format || (file.name.includes(".") ? file.name.split(".").pop() : ""),
          ...(typeof response.width === "number" ? { width: response.width } : {}),
          ...(typeof response.height === "number" ? { height: response.height } : {}),
          ...(typeof response.duration === "number" ? { duration: response.duration } : {}),
        });
      } catch {
        reject(new Error("Upload returned an invalid response. Please retry."));
      }
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      reject(new Error("Network error while uploading. Check your connection and retry."));
    };
    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      reject(new Error(`Upload timed out after ${xhr.timeout / 1000} seconds. Please retry.`));
    };
    xhr.onabort = () => {
      if (signal) signal.removeEventListener("abort", handleAbort);
      reject(new Error("Upload was canceled."));
    };

    xhr.send(formData);
  });
};

export const uploadImage = async (file, { folder = "chathere", onProgress } = {}) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary is not configured");
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const compressed = await compressImage(file, { maxDimension: IMAGE_COMPRESSION.AVATAR_MAX_DIMENSION });
  if (compressed.file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const result = await uploadFile(compressed.file, { folder, onProgress });
  return result.url;
};

export const optimizeUrl = (url, width = 800) => {
  if (typeof url !== "string") return url;
  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`)
    : url;
};