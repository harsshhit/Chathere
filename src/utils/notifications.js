export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
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
    console.error("Audio playback error:", err);
  }
};

export const showNotification = (title, options = {}) => {
  playNotificationSound();
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  try {
    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      renotify: true,
      ...options,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error("Error showing notification:", error);
  }
};

export const updateTitleUnread = (count) => {
  if (count > 0) {
    document.title = `(${count}) ChatHere`;
  } else {
    document.title = "ChatHere";
  }
};