/**
 * Native Notification & Web Audio Helper for ChatHere
 * Handles Service Worker notifications (Chrome Android, iOS 16.4+ standalone, desktop)
 * with robust fallbacks and audio unlocks.
 */

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
 * Checks if Notification API and Service Worker are supported in current browser.
 */
export const isNotificationSupported = () => {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
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
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    console.warn("Notifications not supported in this environment");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch (swErr) {
          console.warn("Service worker registration failed after permission granted:", swErr);
        }
      }
      return true;
    }
    return false;
  } catch (error) {
    console.warn("Error requesting notification permission:", error);
    return false;
  }
};

/**
 * Synthesizes and plays message sound chime using Web Audio API.
 * Never throws, catches any promise rejection, and never blocks notifications.
 */
export const playMessageSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch((err) => {
        console.warn("AudioContext resume failed:", err);
      });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (err) {
    console.warn("Sound playback error:", err);
  }
};

/**
 * Displays an OS-level notification via ServiceWorkerRegistration.showNotification().
 * Falls back to new Notification() in try/catch only if no service worker is available.
 * Never throws; logs warnings on failures.
 */
export const notifyMessage = async ({ chatId, title, body, icon }) => {
  try {
    // Play sound non-blockingly
    try {
      playMessageSound();
    } catch (soundErr) {
      console.warn("Sound error in notifyMessage:", soundErr);
    }

    if (!("Notification" in window) || Notification.permission !== "granted") {
      console.warn("notifyMessage: Notification permission is not granted");
      return;
    }

    const resolvedIcon = icon || "/icon-192.png";
    const notificationOptions = {
      body: body || "",
      icon: resolvedIcon,
      badge: "/icon-192.png",
      tag: "chat-" + chatId,
      renotify: true,
      vibrate: [100, 50, 100],
      data: { chatId },
    };

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title || "ChatHere", notificationOptions);
          return;
        }
      } catch (swErr) {
        console.warn("ServiceWorker showNotification failed, trying fallback:", swErr);
      }
    }

    // Fall back to new Notification() only if service worker was unavailable
    try {
      const fallbackNotification = new Notification(title || "ChatHere", {
        body: notificationOptions.body,
        icon: notificationOptions.icon,
        badge: notificationOptions.badge,
        tag: notificationOptions.tag,
        renotify: notificationOptions.renotify,
        data: notificationOptions.data,
      });
      fallbackNotification.onclick = () => {
        window.focus();
        fallbackNotification.close();
      };
    } catch (nErr) {
      console.warn("new Notification fallback failed:", nErr);
    }
  } catch (err) {
    console.warn("Unexpected error in notifyMessage:", err);
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
