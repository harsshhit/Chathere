import { IMAGE_COMPRESSION } from "../config/uploadLimits";
import { compressImage } from "./compressImage";
import { getUploadValidationError } from "./uploadValidation";
import { safeHttpUrl } from "./safeUrl";

export const uploadFile = async (file, { folder = "chathere", onProgress, signal, resourceType: resourceTypeOverride } = {}) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary is not configured");
  const validationError = getUploadValidationError(file);
  if (validationError) throw new Error(validationError);

  const mimeType = typeof file.type === "string" ? file.type : "";
  const inferredResourceType = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
        ? "audio"
        : "raw";
  const resourceType = resourceTypeOverride || inferredResourceType;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("resource_type", resourceType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const uploadResourcePath = resourceTypeOverride ? resourceType : "auto";
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${uploadResourcePath}/upload`);
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
        const secureUrl = safeHttpUrl(response.secure_url);
        if (!secureUrl) throw new Error();
        resolve({
          url: secureUrl,
          resourceType: response.resource_type || resourceType,
          bytes: typeof response.bytes === "number" ? response.bytes : file.size,
          format: response.format || (file.name?.includes(".") ? file.name.split(".").pop() : ""),
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
  return cloudinaryUrl(url, { w: width, q: "auto", fmt: "auto" });
};

const isCloudinaryUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "cloudinary.com" ||
      parsed.hostname.endsWith(".cloudinary.com");
  } catch {
    return false;
  }
};

const TRANSFORMATION_KEYS = new Set(
  "a ac af ar b bo c ca co cs d du e f fl fn g h if ih ii iw ki l o oq p pg q r s so sp t u vc w x y z".split(" ")
);

const isTransformation = (segment) =>
  Boolean(segment) && segment.split(",").every((value) => {
    const separator = value.indexOf("_");
    return separator > 0 && TRANSFORMATION_KEYS.has(value.slice(0, separator));
  });

const asTransformations = ({ w, h, crop, q, fmt, extra } = {}) => {
  const transformations = [];
  if (crop) transformations.push(`c_${crop}`);
  if (w) transformations.push(`w_${Math.round(w)}`);
  if (h) transformations.push(`h_${Math.round(h)}`);
  if (q) transformations.push(`q_${q}`);
  if (fmt) transformations.push(`f_${fmt}`);
  if (typeof extra === "string") {
    extra.split("/").filter(Boolean).forEach((value) => transformations.push(value));
  } else if (extra && typeof extra === "object") {
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        transformations.push(`${key}_${value}`);
      }
    });
  }
  return transformations;
};

export const cloudinaryUrl = (url, options = {}) => {
  if (typeof url !== "string" || !url || !isCloudinaryUrl(url)) return url;
  try {
    const parsed = new URL(url);
    const uploadIndex = parsed.pathname.indexOf("/upload/");
    if (uploadIndex < 0) return url;
    const prefix = parsed.pathname.slice(0, uploadIndex + "/upload/".length);
    const remainder = parsed.pathname.slice(prefix.length);
    const segments = remainder.split("/");
    const transformSegments = [];
    while (segments.length && isTransformation(segments[0])) {
      transformSegments.push(segments.shift().split(","));
    }
    const requested = asTransformations(options);
    const requestedByKey = new Map(requested.map((value) => [value.slice(0, value.indexOf("_")), value]));
    const appliedKeys = new Set();
    const updatedSegments = transformSegments.map((segment) => segment.map((value) => {
      const key = value.slice(0, value.indexOf("_"));
      if (!requestedByKey.has(key) || appliedKeys.has(key)) return value;
      appliedKeys.add(key);
      return requestedByKey.get(key);
    }));
    const additions = requested.filter((value) => !appliedKeys.has(value.slice(0, value.indexOf("_"))));
    if (updatedSegments.length) updatedSegments[0].push(...additions);
    else if (additions.length) updatedSegments.push(additions);
    if (requestedByKey.has("so")) {
      const frameTransforms = [];
      updatedSegments.forEach((segment) => {
        for (let index = segment.length - 1; index >= 0; index -= 1) {
          if (segment[index].startsWith("so_")) frameTransforms.unshift(...segment.splice(index, 1));
        }
      });
      if (frameTransforms.length) {
        if (!updatedSegments.length) updatedSegments.push(frameTransforms);
        else updatedSegments[0].unshift(...frameTransforms);
      }
    }
    parsed.pathname = `${prefix}${updatedSegments.map((segment) => segment.join(",")).join("/")}${updatedSegments.length ? "/" : ""}${segments.join("/")}`;
    return parsed.toString();
  } catch {
    return url;
  }
};

export const buildSrcSet = (url, widths = [320, 640, 960]) =>
  widths.map((width) => `${cloudinaryUrl(url, { w: width, q: "auto", fmt: "auto" })} ${width}w`).join(", ");

export const placeholderUrl = (url) =>
  cloudinaryUrl(url, { w: 24, q: "auto:low", fmt: "auto", extra: "e_blur:200" });

export const posterUrl = (videoUrl, w) => {
  const transformed = cloudinaryUrl(videoUrl, { w, fmt: "jpg", q: "auto", extra: "so_0" });
  if (transformed === videoUrl) return videoUrl;
  try {
    const parsed = new URL(transformed);
    const slash = parsed.pathname.lastIndexOf("/");
    const filename = parsed.pathname.slice(slash + 1);
    parsed.pathname = `${parsed.pathname.slice(0, slash + 1)}${filename.replace(/\.[^/.]+$/, "")}.jpg`;
    return parsed.toString();
  } catch {
    return videoUrl;
  }
};

export const avatarUrl = (url, size) => {
  if (typeof url !== "string" || !url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "lh3.googleusercontent.com") {
      parsed.pathname = parsed.pathname.replace(/=s\d+(?:-[a-z]+)*$/i, "");
      parsed.pathname += `=s${Math.max(1, Math.round(size || 96))}-c`;
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return isCloudinaryUrl(url)
    ? cloudinaryUrl(url, { w: size, h: size, crop: "fill", q: "auto", fmt: "auto", extra: "g_face" })
    : url;
};

export const getAudioPlaybackUrl = (url) => {
  if (typeof url !== "string" || !url) return url;
  try {
    const parsed = new URL(url);
    const isCloudinaryHost = parsed.hostname === "cloudinary.com" || parsed.hostname.endsWith(".cloudinary.com");
    if (!isCloudinaryHost || !parsed.pathname.includes("/video/upload/")) return url;
    parsed.pathname = parsed.pathname.replace("/upload/", "/upload/f_mp3/");
    const slash = parsed.pathname.lastIndexOf("/");
    const filename = parsed.pathname.slice(slash + 1);
    parsed.pathname = `${parsed.pathname.slice(0, slash + 1)}${filename.replace(/\.[^/.]+$/, "")}.mp3`;
    return parsed.toString();
  } catch {
    return url;
  }
};