/* Service Worker for ChatHere - Notification & Web Push handling */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// OS-level notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const targetPath = chatId ? `/chat/${chatId}` : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If an existing tab/window is found, focus it and tell it to navigate
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus().then((focusedClient) => {
              if (focusedClient && chatId) {
                focusedClient.postMessage({ type: "OPEN_CHAT", chatId });
              }
              return focusedClient;
            });
          }
        }
        // Otherwise, open a new window directly to the chat
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
      })
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

  const title = data.title || data.notification?.title || "ChatHere";
  const body = data.body || data.notification?.body || "You have a new message";
  const icon = data.icon || data.notification?.icon || "/icon-192.png";
  const chatId = data.chatId || data.data?.chatId || "";

  const options = {
    body,
    icon,
    badge: "/icon-192.png",
    tag: chatId ? "chat-" + chatId : "chat-notification",
    renotify: true,
    vibrate: [150, 60, 150],
    data: { chatId },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Pass-through fetch handler for PWA installability requirements (no caching)
self.addEventListener("fetch", (event) => {
  // Let browser handle network requests normally
});
