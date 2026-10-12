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
  getNotificationSettings,
  saveNotificationSettings,
  playTonePreview,
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
  getNotificationSettings,
  saveNotificationSettings,
  playTonePreview,
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