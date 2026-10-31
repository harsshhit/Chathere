import { clearAllChatMessages } from "./chatMessagesStore";
import { clearMediaCache } from "./mediaCache";
import { clearOwnMediaCache } from "./ownMediaCache";
import { pendingMessagesStore } from "./pendingMessages";
import { clearUserDocumentCache } from "./userDocumentCache";

const PRESERVED_STORAGE_KEYS = new Set([
  "chathere-theme",
  "chathere:theme",
  "chathere:language",
]);

const clearAppStorage = () => {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        (key?.startsWith("chathere:") || key?.startsWith("chathere_")) &&
        !PRESERVED_STORAGE_KEYS.has(key)
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Could not clear all ChatHere local storage:", error);
  }
};

const clearServiceWorkerCaches = async () => {
  if (typeof caches === "undefined") return;
  try {
    const cacheNames = await caches.keys();
    const appCaches = cacheNames.filter((name) => name.startsWith("chathere-"));
    const results = await Promise.allSettled(appCaches.map((name) => caches.delete(name)));
    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount) console.warn("Could not clear some ChatHere service-worker caches:", failedCount);
  } catch (error) {
    console.warn("Could not list ChatHere service-worker caches:", error);
  }
};

export const cleanupUserSession = async (uid) => {
  try {
    const { unregisterPushToken } = await import("./pushToken");
    await unregisterPushToken(uid);
  } catch (error) {
    console.warn("Could not remove this device's push token:", error?.code, error?.message);
  }

  clearAppStorage();
  await Promise.all([
    clearMediaCache(),
    clearServiceWorkerCaches(),
  ]);
  clearOwnMediaCache();
  clearAllChatMessages();
  pendingMessagesStore.clearAll();
  clearUserDocumentCache(uid);
};
