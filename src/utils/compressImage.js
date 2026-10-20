import { IMAGE_COMPRESSION } from "../config/uploadLimits";

const skippedResult = (file) => ({
  file,
  width: undefined,
  height: undefined,
  originalSize: file.size,
  compressedSize: file.size,
  skipped: true,
});

const loadWithImageElement = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, objectUrl });
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Unable to decode image"));
  };
  image.src = objectUrl;
});

const decodeImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, bitmap };
    } catch {
      // Fall back to the browser's Image decoder for formats it supports.
    }
  }
  return loadWithImageElement(file);
};

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  try {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas encoding failed"));
    }, type, quality);
  } catch (error) {
    reject(error);
  }
});

const isTransparent = (source) => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.clearRect(0, 0, 64, 64);
  context.drawImage(source, 0, 0, 64, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 250) return true;
  }
  return false;
};

const supportsWebp = async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const blob = await canvasToBlob(canvas, "image/webp", 0.75);
  return blob.type === "image/webp";
};

export const compressImage = async (
  file,
  { maxDimension = IMAGE_COMPRESSION.MAX_DIMENSION, targetRatio = IMAGE_COMPRESSION.TARGET_RATIO } = {}
) => {
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) return skippedResult(file);
  const extension = file.name?.split(".").pop()?.toLowerCase();
  if (file.type.toLowerCase() === "image/gif" || file.type.toLowerCase() === "image/svg+xml" || ["gif", "svg"].includes(extension)) {
    return skippedResult(file);
  }

  let decoded;
  try {
    decoded = await decodeImage(file);
    if (!decoded.width || !decoded.height) return skippedResult(file);

    const transparent = isTransparent(decoded.source);
    const outputType = transparent
      ? (await supportsWebp() ? "image/webp" : "image/png")
      : "image/jpeg";
    const initialScale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
    let width = Math.max(1, Math.round(decoded.width * initialScale));
    let height = Math.max(1, Math.round(decoded.height * initialScale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return skippedResult(file);

    let bestBlob = null;
    let bestWidth = width;
    let bestHeight = height;
    let quality = IMAGE_COMPRESSION.START_QUALITY;
    let iterations = 0;
    while (iterations < IMAGE_COMPRESSION.MAX_ITERATIONS) {
      canvas.width = width;
      canvas.height = height;
      if (outputType === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }
      context.drawImage(decoded.source, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, outputType, outputType === "image/png" ? undefined : quality);
      iterations += 1;
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
      }
      if (blob.size <= file.size * targetRatio) break;

      if (quality > IMAGE_COMPRESSION.MIN_QUALITY) {
        quality = Math.max(IMAGE_COMPRESSION.MIN_QUALITY, Math.round((quality - 0.1) * 10) / 10);
        continue;
      }

      const longestSide = Math.max(width, height);
      if (longestSide <= IMAGE_COMPRESSION.MIN_DIMENSION) break;
      const nextLongestSide = Math.max(IMAGE_COMPRESSION.MIN_DIMENSION, Math.round(longestSide * 0.85));
      const shrinkScale = nextLongestSide / longestSide;
      width = Math.max(1, Math.round(width * shrinkScale));
      height = Math.max(1, Math.round(height * shrinkScale));
      quality = IMAGE_COMPRESSION.START_QUALITY;
    }

    if (!bestBlob || bestBlob.size >= file.size) return skippedResult(file);
    const extensionByType = { "image/jpeg": ".jpg", "image/webp": ".webp", "image/png": ".png" };
    const baseName = file.name?.replace(/\.[^.]+$/, "") || "image";
    const compressedFile = new File([bestBlob], `${baseName}${extensionByType[outputType]}`, {
      type: outputType,
      lastModified: Date.now(),
    });
    return {
      file: compressedFile,
      width: bestWidth,
      height: bestHeight,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      skipped: false,
    };
  } catch {
    return skippedResult(file);
  } finally {
    if (decoded?.bitmap) decoded.bitmap.close();
    if (decoded?.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
  }
};