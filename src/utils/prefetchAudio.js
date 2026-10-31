import { getBlobUrl, has } from "./mediaCache";

const MAX_PREFETCH_BYTES = 2 * 1024 * 1024;

export async function prefetchAudio(url) {
  if (!url) return null;
  try {
    if (await has(url)) return getBlobUrl(url);
    if (typeof navigator !== "undefined" && !navigator.onLine) return url;
    const head = await fetch(url, { method: "HEAD", mode: "cors", credentials: "omit" });
    const size = Number(head.headers.get("content-length"));
    if (!head.ok || !Number.isFinite(size) || size <= 0 || size > MAX_PREFETCH_BYTES) return url;
    return await getBlobUrl(url);
  } catch (error) {
    console.warn("Could not prefetch voice message:", error);
    return url;
  }
}
