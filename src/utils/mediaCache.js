export const MEDIA_CACHE_NAME = "chathere-media-v1";
const MAX_MEMORY_URLS = 40;
const MAX_CACHE_ENTRY_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_ENTRIES = 150;
const objectUrls = new Map();
const inFlight = new Map();

const isAudioUrl = (url, response) => {
  const contentType = response?.headers?.get("content-type") || "";
  return contentType.toLowerCase().startsWith("audio/") || /\.(?:mp3|m4a|aac|ogg|opus|wav)(?:$|[?#])/i.test(url);
};

const createObjectUrl = (url, blob) => {
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(url, objectUrl);
  while (objectUrls.size > MAX_MEMORY_URLS) {
    const [oldestUrl, oldestObjectUrl] = objectUrls.entries().next().value;
    objectUrls.delete(oldestUrl);
    URL.revokeObjectURL(oldestObjectUrl);
  }
  return objectUrl;
};

const touchObjectUrl = (url, objectUrl) => {
  objectUrls.delete(url);
  objectUrls.set(url, objectUrl);
};

const loadBlobUrl = async (url) => {
  if (typeof caches === "undefined" || typeof fetch !== "function" ||
      typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return url;

  let cache;
  try {
    cache = await caches.open(MEDIA_CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse?.ok && cachedResponse.status === 200) {
      const blob = await cachedResponse.blob();
      if (blob.size <= MAX_CACHE_ENTRY_BYTES) return createObjectUrl(url, blob);
      await cache.delete(url);
    }

    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok || response.status !== 200) return url;
    const cacheResponse = response.clone();
    const blob = await response.blob();
    if (blob.size > MAX_CACHE_ENTRY_BYTES) return url;
    await cache.put(url, cacheResponse);
    const objectUrl = createObjectUrl(url, blob);
    if (isAudioUrl(url, cacheResponse)) void trimCache();
    return objectUrl;
  } catch (error) {
    console.warn("Media cache unavailable; using the original URL:", error);
    return url;
  }
};

const awaitWithSignal = (promise, signal, fallback) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const onAbort = () => resolve(fallback);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, () => resolve(fallback)).finally(() => signal.removeEventListener("abort", onAbort));
  });
};

export async function getBlobUrl(url, { signal } = {}) {
  if (typeof url !== "string" || !url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    if (objectUrls.has(url)) {
      const objectUrl = objectUrls.get(url);
      touchObjectUrl(url, objectUrl);
      return signal?.aborted ? url : objectUrl;
    }
    if (!inFlight.has(url)) {
      const request = loadBlobUrl(url);
      inFlight.set(url, request);
      request.finally(() => inFlight.delete(url));
    }
    return await awaitWithSignal(inFlight.get(url), signal, url);
  } catch (error) {
    console.warn("Could not load media from cache:", error);
    return url;
  }
}

export async function prefetch(url) {
  const result = await getBlobUrl(url);
  return typeof result === "string" && result.startsWith("blob:");
}

export async function has(url) {
  if (!url) return false;
  if (objectUrls.has(url)) return true;
  try {
    if (typeof caches === "undefined") return false;
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const response = await cache.match(url);
    return Boolean(response?.ok && response.status === 200);
  } catch (error) {
    console.warn("Could not inspect media cache:", error);
    return false;
  }
}

export async function trimCache() {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const audioEntries = [];
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (isAudioUrl(request.url, response)) audioEntries.push(request);
    }
    for (const request of audioEntries.slice(0, Math.max(0, audioEntries.length - MAX_AUDIO_ENTRIES))) {
      await cache.delete(request);
    }
  } catch (error) {
    console.warn("Could not trim media cache:", error);
  }
}

export function releaseBlobUrl(url) {
  if (!url) return;
  let released = false;
  for (const [source, objectUrl] of objectUrls) {
    if (source === url || objectUrl === url) {
      objectUrls.delete(source);
      URL.revokeObjectURL(objectUrl);
      released = true;
    }
  }
  if (!released && url.startsWith("blob:") && typeof URL !== "undefined") URL.revokeObjectURL(url);
}

export async function clearMediaCache() {
  for (const objectUrl of objectUrls.values()) URL.revokeObjectURL(objectUrl);
  objectUrls.clear();
  try {
    if (typeof caches !== "undefined") {
      await Promise.all([
        caches.delete(MEDIA_CACHE_NAME),
        caches.delete("chathere-img-v1"),
        caches.delete("chathere-avatar-v1"),
      ]);
    }
  } catch (error) {
    console.warn("Could not clear the media cache:", error);
  }
}
