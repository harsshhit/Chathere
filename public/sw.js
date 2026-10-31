/* Service Worker for ChatHere - Notification & Web Push handling */
const CACHE_VERSION = "v1";
const MEDIA_CACHE = `chathere-media-${CACHE_VERSION}`;
const IMAGE_CACHE = `chathere-img-${CACHE_VERSION}`;
const AVATAR_CACHE = `chathere-avatar-${CACHE_VERSION}`;
const STATIC_CACHE = `chathere-static-${CACHE_VERSION}`;
const FONT_CACHE = `chathere-font-${CACHE_VERSION}`;
const CURRENT_CACHES = [MEDIA_CACHE, IMAGE_CACHE, AVATAR_CACHE, STATIC_CACHE, FONT_CACHE];
const MAX_CACHE_ENTRY_BYTES = 5 * 1024 * 1024;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name.startsWith("chathere-") && !CURRENT_CACHES.includes(name))
        .map((name) => caches.delete(name))
    ))
  );
});

// OS-level notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawChatId = event.notification.data?.chatId;
  const chatId = typeof rawChatId === "string" && rawChatId.length <= 200 ? rawChatId : "";
  const targetPath = chatId ? `/chat/${encodeURIComponent(chatId)}` : "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client =
        clientList.find((item) => item.visibilityState === "visible" && item.focused) ||
        clientList.find((item) => typeof item.focus === "function");

      if (client && typeof client.focus === "function") {
        try {
          await client.focus();
          if (chatId) {
            client.postMessage({ type: "OPEN_CHAT", chatId });
          }
          return;
        } catch (error) {
          console.warn("Could not focus a window for the notification:", error);
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(new URL(targetPath, self.location.origin).href);
      }
    })()
  );
});

// Web Push event listener (receives pushes when browser tab is backgrounded or closed)
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        data = { body: event.data.text() };
      } catch (err) {
        data = {};
      }
    }
  }

  const payloadData = data.data || {};
  const title = payloadData.title || data.title || data.notification?.title || "ChatHere";
  const rawBody = payloadData.body || data.body || data.notification?.body || "You have a new message";
  const body = payloadData.showPreview === "false" ? "New message received" : rawBody;
  const icon = payloadData.icon || data.icon || data.notification?.icon || "/icon-192.png";
  const chatId = payloadData.chatId || data.chatId || "";

  const options = {
    body,
    icon,
    badge: "/icon-192.png",
    tag: chatId ? "chat-" + chatId : "chat-notification",
    renotify: true,
    data: { chatId },
  };
  if (payloadData.vibrate !== "false") options.vibrate = [150, 60, 150];

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const hasFocusedVisibleClient = clientList.some(
          (client) => client.visibilityState === "visible" && client.focused
        );
        if (hasFocusedVisibleClient) return;
        return self.registration.showNotification(title, options);
      })
  );
});

const isCloudinaryPoster = (url) => {
  if (url.hostname !== "res.cloudinary.com") return false;
  const transformation = url.pathname.split("/video/upload/")[1]?.split("/")[0] || "";
  const values = transformation.split(",");
  const filename = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  return values.includes("so_0") &&
    values.some((value) => /^f_jpe?g$/i.test(value)) &&
    /\.jpe?g$/i.test(filename);
};

const isVideoRequest = (url, request) => {
  if (request.destination === "video") return true;
  if (isCloudinaryPoster(url)) return false;
  return /\/video\/upload\//i.test(url.pathname) ||
    /\.(?:mp4|m4v|mov|webm|avi|mkv|ogv)(?:$|[?#])/i.test(url.pathname);
};

const isGoogleApi = (hostname) =>
  hostname === "googleapis.com" ||
  hostname.endsWith(".googleapis.com") ||
  hostname === "identitytoolkit.googleapis.com" ||
  hostname === "securetoken.googleapis.com" ||
  hostname === "fcmregistrations.googleapis.com";

const allowedAvatarHost = (hostname) =>
  hostname === "lh3.googleusercontent.com" ||
  hostname === "api.dicebear.com";

const shouldIgnoreRequest = (request, url) => {
  if (request.method !== "GET" || request.headers.has("range")) return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  if (url.pathname.startsWith("/api/") || isVideoRequest(url, request)) return true;
  if (url.hostname === "firestore.googleapis.com" || isGoogleApi(url.hostname)) return true;
  if (url.hostname === "api.cloudinary.com") return true;
  if (url.origin !== self.location.origin &&
      url.hostname !== "res.cloudinary.com" &&
      !allowedAvatarHost(url.hostname) &&
      url.hostname !== "fonts.googleapis.com" &&
      url.hostname !== "fonts.gstatic.com") return true;
  return false;
};

const responseIsSmallEnough = async (response) => {
  if (!response.ok || response.status !== 200 || response.type === "opaque") return false;
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_CACHE_ENTRY_BYTES) return false;
  return (await response.clone().blob()).size <= MAX_CACHE_ENTRY_BYTES;
};

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  for (const request of requests.slice(0, Math.max(0, requests.length - maxEntries))) {
    await cache.delete(request);
  }
};

const cacheResponse = async (cacheName, request, response, maxEntries, event) => {
  if (!(await responseIsSmallEnough(response))) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  if (maxEntries && event) event.waitUntil(trimCache(cacheName, maxEntries).catch((error) => {
    console.warn("Could not trim the image cache:", error);
  }));
  return response;
};

const cacheStaticResponse = async (request, response) => {
  if (!response.ok || response.status !== 200 || response.type === "opaque") return response;
  const cache = await caches.open(STATIC_CACHE);
  await cache.put(request, response.clone());
  return response;
};

const networkFirstNavigation = async (event, url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(event.request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(new URL("/index.html", self.location.origin).href, response.clone());
      } catch {
        // Navigation succeeds even when the offline shell cannot be updated.
      }
    }
    return response;
  } catch {
    clearTimeout(timeout);
    try {
      const cache = await caches.open(STATIC_CACHE);
      const shell = await cache.match(new URL("/index.html", self.location.origin).href);
      if (shell) return shell;
    } catch {
      // Fall through to the regular network request below.
    }
    return fetch(event.request);
  }
};

const routeRequest = async (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (shouldIgnoreRequest(request, url)) return fetch(request);

  if (request.mode === "navigate") return networkFirstNavigation(event, url);

  if (url.origin === self.location.origin &&
      /^\/static\/(?:js|css|media)\/.+\.[a-f0-9]{6,}\./i.test(url.pathname)) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    return cacheStaticResponse(request, response);
  }

  if (url.hostname === "res.cloudinary.com" &&
      (/\/image\/upload\//i.test(url.pathname) || isCloudinaryPoster(url))) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const corsRequest = new Request(url.href, { mode: "cors", credentials: "omit" });
    const response = await fetch(corsRequest);
    return cacheResponse(IMAGE_CACHE, corsRequest, response, 500, event);
  }

  if (allowedAvatarHost(url.hostname)) {
    const cache = await caches.open(AVATAR_CACHE);
    const cached = await cache.match(request);
    const refresh = fetch(request).then(async (response) => {
      if (await responseIsSmallEnough(response)) {
        await cache.put(request, response.clone());
        await trimCache(AVATAR_CACHE, 200);
      }
      return response;
    }).catch(() => undefined);
    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    const response = await refresh;
    return response || fetch(request);
  }

  if (url.hostname === "fonts.googleapis.com") {
    const cache = await caches.open(FONT_CACHE);
    const cached = await cache.match(request);
    const refresh = fetch(request).then(async (response) => {
      if (await responseIsSmallEnough(response)) {
        await cache.put(request, response.clone());
        await trimCache(FONT_CACHE, 200);
      }
      return response;
    }).catch(() => undefined);
    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    return await refresh || fetch(request);
  }

  if (url.hostname === "fonts.gstatic.com") {
    const cache = await caches.open(FONT_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    return cacheResponse(FONT_CACHE, request, response, 200);
  }

  return fetch(request);
};

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (shouldIgnoreRequest(event.request, url)) return;
  event.respondWith(routeRequest(event).catch(() => fetch(event.request)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_MEDIA_CACHE") return;
  const replyPort = event.ports?.[0];
  event.waitUntil(Promise.all([
    caches.delete(MEDIA_CACHE),
    caches.delete(IMAGE_CACHE),
    caches.delete(AVATAR_CACHE),
  ]).then(() => {
    replyPort?.postMessage({ ok: true });
  }).catch((error) => {
    replyPort?.postMessage({ ok: false, error: error.message || "Could not clear media caches." });
  }));
});
