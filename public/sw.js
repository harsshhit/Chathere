/* Service Worker for ChatHere - Notification handling only (no Workbox, no caching) */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const targetPath = chatId ? `/chat/${chatId}` : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
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
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
      })
  );
});
