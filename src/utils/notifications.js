/**
 * Backwards compatibility wrapper forwarding to src/utils/notify.js
 */
import {
  isNotificationSupported,
  getPermissionState,
  requestNotificationPermission,
  playMessageSound,
  notifyMessage,
  updateTitleUnread,
  initAudioUnlock,
  isIOS,
  isStandalone,
} from "./notify";

export {
  isNotificationSupported,
  getPermissionState,
  requestNotificationPermission,
  playMessageSound,
  notifyMessage,
  updateTitleUnread,
  initAudioUnlock,
  isIOS,
  isStandalone,
};

export const playNotificationSound = playMessageSound;

export const showNotification = (title, options = {}) => {
  notifyMessage({
    chatId: options.tag || options.chatId || "general",
    title,
    body: options.body || "",
    icon: options.icon || "/icon-192.png",
  });
};