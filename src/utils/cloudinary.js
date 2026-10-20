const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const COMPRESSION_THRESHOLD = 1024 * 1024;

const loadImage = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Could not read this image. Please choose another file."));
  };
  image.src = objectUrl;
});

const compressImage = async (file) => {
  if (file.type === "image/gif") return file;

  const image = await loadImage(file);
  if (file.size <= COMPRESSION_THRESHOLD && image.width <= MAX_IMAGE_DIMENSION) return file;

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image compression is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let hasTransparency = false;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) {
      hasTransparency = true;
      break;
    }
  }

  const outputType = hasTransparency ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Could not compress this image.")),
      outputType,
      outputType === "image/jpeg" ? 0.8 : undefined
    );
  });
  const extension = outputType === "image/png" ? ".png" : ".jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}${extension}`, { type: outputType, lastModified: Date.now() });
};

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
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const uploadFileData = await compressImage(file);
  const result = await uploadFile(uploadFileData, { folder, onProgress });
  return result.url;
};

export const optimizeUrl = (url, width = 800) => {
  if (typeof url !== "string") return url;
  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`)
    : url;
};