/**
 * Native Notification & Web Audio Helper for ChatHere
 * Handles Service Worker notifications (Chrome Android, iOS 16.4+ standalone, desktop)
 * with robust fallbacks, audio unlocks, sound preferences, and vibration.
 */

const SETTINGS_KEY = "chathere_notification_settings";

export const DEFAULT_NOTIFICATION_SETTINGS = {
  sound: true,
  vibrate: true,
  showPreview: true,
  tone: "chime", // "chime" | "ping" | "pop" | "bell"
};

/**
 * Retrieves user notification preferences from localStorage.
 */
export const getNotificationSettings = () => {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

/**
 * Persists user notification preferences.
 */
export const saveNotificationSettings = (settings) => {
  if (typeof window === "undefined") return;
  try {
    const current = getNotificationSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Failed to save notification settings:", e);
  }
};

let audioCtx = null;
let audioUnlocked = false;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch (e) {
      console.warn("Failed to create AudioContext:", e);
    }
  }
  return audioCtx;
};

/**
 * One-time audio unlock: on first pointerdown/touchstart anywhere in the app,
 * creates/plays and pauses silent audio so future sound playback is permitted.
 */
export const initAudioUnlock = () => {
  if (typeof window === "undefined" || audioUnlocked) return;

  const unlock = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;

    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch((err) => {
          console.warn("AudioContext unlock resume failed:", err);
        });
      }

      // Silent HTML Audio element unlock
      const silentAudio = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      );
      const playPromise = silentAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            silentAudio.pause();
          })
          .catch(() => {
            // Safe ignore
          });
      }
    } catch (e) {
      console.warn("Audio unlock attempt error:", e);
    } finally {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
    }
  };

  window.addEventListener("pointerdown", unlock, { capture: true, once: true });
  window.addEventListener("touchstart", unlock, { capture: true, once: true });
};

/**
 * Checks if Notification API is supported in current browser.
 */
export const isNotificationSupported = () => {
  return (
    typeof window !== "undefined" &&
    "Notification" in window
  );
};

/**
 * Returns 'unsupported' | 'default' | 'granted' | 'denied'.
 */
export const getPermissionState = () => {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
};

/**
 * Checks if current device is running iOS / iPadOS.
 */
export const isIOS = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

/**
 * Checks if running as installed standalone PWA.
 */
export const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    Boolean(window.matchMedia("(display-mode: standalone)").matches) ||
    Boolean(navigator.standalone)
  );
};

/**
 * Must ONLY be called from a user gesture (click/tap handler).
 * Requests notification permission and registers service worker on success.
 */
export const requestNotificationPermission = async (currentUser) => {
  if (!isNotificationSupported()) {
    console.warn("Notifications not supported in this environment");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const { registerPushToken } = await import("./pushToken");
  await registerPushToken(currentUser);
  return true;
};

/**
 * Synthesizes and plays a chosen message sound chime using Web Audio API.
 * Never throws, catches any promise rejection, and never blocks notifications.
 */
export const playMessageSound = (customTone) => {
  try {
    const settings = getNotificationSettings();
    if (!settings.sound && !customTone) return;

    const tone = customTone || settings.tone || "chime";
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch((err) => {
        console.warn("AudioContext resume failed:", err);
      });
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (tone === "ping") {
      // High crisp ping (C6 -> E6)
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (tone === "pop") {
      // Soft gentle bubble pop
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (tone === "bell") {
      // Warm resonant bell
      osc.type = "triangle";
      osc.frequency.setValueAtTime(784, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Default: Melodic chime (D5 -> A5)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn("Sound playback error:", err);
  }
};

/**
 * Preview sound tone specifically for user selection in settings.
 */
export const playTonePreview = (toneName) => {
  playMessageSound(toneName);
};

/**
 * Displays an OS-level notification via ServiceWorkerRegistration.showNotification().
 * Returns whether the browser accepted the notification for display.
 */
export const notifyMessage = async ({ chatId, title, body, icon }) => {
  try {
    if (typeof window === "undefined" || !isNotificationSupported()) return false;
    if (Notification.permission !== "granted") return false;

    const settings = getNotificationSettings();

    // 1. Play sound chime if sound setting enabled
    if (settings.sound) {
      try {
        playMessageSound(settings.tone);
      } catch (soundErr) {
        console.warn("Sound error in notifyMessage:", soundErr);
      }
    }

    // Check notification permission
    // Resolve message content according to privacy preview setting
    const resolvedBody = settings.showPreview ? (body || "") : "New message received";
    const resolvedIcon = icon || "/icon-192.png";

    const notificationOptions = {
      body: resolvedBody,
      icon: resolvedIcon,
      badge: "/icon-192.png",
      tag: "chat-" + chatId,
      renotify: true,
      vibrate: settings.vibrate ? [150, 60, 150] : undefined,
      data: { chatId },
    };

    // 3. Try OS-level Service Worker showNotification with a safe timeout
    let swShown = false;
    if ("serviceWorker" in navigator) {
      try {
        // Check for existing active registration first (fastest)
        let registration = await navigator.serviceWorker.getRegistration("/");

        // If not immediately available, race navigator.serviceWorker.ready with a 1000ms timeout
        if (!registration) {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Service worker ready timeout")), 1000)
            ),
          ]).catch(() => null);
        }

        if (registration && registration.showNotification) {
          await registration.showNotification(title || "ChatHere", notificationOptions);
          swShown = true;
          return true;
        }
      } catch (swErr) {
        console.warn("ServiceWorker showNotification failed, trying fallback:", swErr);
      }
    }

    // 4. Fall back to window Notification constructor only if service worker was unavailable
    if (!swShown) {
      try {
        const fallbackNotification = new Notification(title || "ChatHere", {
          body: notificationOptions.body,
          icon: notificationOptions.icon,
          badge: notificationOptions.badge,
          tag: notificationOptions.tag,
          renotify: notificationOptions.renotify,
          vibrate: notificationOptions.vibrate,
          data: notificationOptions.data,
        });
        fallbackNotification.onclick = () => {
          window.focus();
          if (chatId) window.location.assign(`/chat/${encodeURIComponent(chatId)}`);
          fallbackNotification.close();
        };
        return true;
      } catch (nErr) {
        console.warn("new Notification fallback failed:", nErr);
      }
    }
    return false;
  } catch (err) {
    console.warn("Unexpected error in notifyMessage:", err);
    return false;
  }
};

/**
 * Tab-title unread badge helper.
 */
export const updateTitleUnread = (count) => {
  if (typeof document === "undefined") return;
  if (count > 0) {
    document.title = `(${count}) ChatHere`;
  } else {
    document.title = "ChatHere";
  }
};
