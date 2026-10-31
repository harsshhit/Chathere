import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { app, db } from "../firebase";

export const registerPushToken = async (currentUser) => {
  try {
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (
      !(await isSupported()) ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) return;
    if (!currentUser?.uid || !("serviceWorker" in navigator)) return;

    const registration =
      await navigator.serviceWorker.getRegistration("/") ||
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.info("push: no token returned");
      return;
    }

    // The user's own token document must be readable for this capped-list transaction.
    const tokenRef = doc(db, "fcmTokens", currentUser.uid);
    await runTransaction(db, async (transaction) => {
      const tokenSnapshot = await transaction.get(tokenRef);
      const tokens = tokenSnapshot.data()?.tokens;
      const nextTokens = [
        ...(Array.isArray(tokens) ? tokens.filter((value) => typeof value === "string" && value !== token) : []),
        token,
      ].slice(-10);
      transaction.set(tokenRef, {
        tokens: nextTokens,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    console.info("push token saved");
  } catch (error) {
    console.warn("Push token registration failed:", error?.code, error?.message);
  }
};

export const unregisterPushToken = async (uid) => {
  if (!uid) return;
  const { getMessaging, getToken, isSupported, deleteToken } = await import("firebase/messaging");
  if (!(await isSupported())) return;

  const messaging = getMessaging(app);
  let token = "";
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    "serviceWorker" in navigator
  ) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
    }
  }

  if (token) {
    const tokenRef = doc(db, "fcmTokens", uid);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(tokenRef);
      if (!snapshot.exists()) return;
      const tokens = snapshot.data()?.tokens;
      transaction.set(tokenRef, {
        tokens: Array.isArray(tokens) ? tokens.filter((value) => value !== token) : [],
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  await deleteToken(messaging);
};