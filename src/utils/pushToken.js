import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { app, db } from "../firebase";

const getCachedTokenKey = (uid) => `chathere_fcm_token_${uid}`;

const cacheToken = (uid, token) => {
  try {
    localStorage.setItem(getCachedTokenKey(uid), token);
  } catch (error) {
    console.warn("Could not cache this device's push token:", error);
  }
};

const readCachedToken = (uid) => {
  try {
    return localStorage.getItem(getCachedTokenKey(uid)) || "";
  } catch (error) {
    console.warn("Could not read this device's cached push token:", error);
    return "";
  }
};

export const registerPushToken = async (currentUser) => {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (
    !(await isSupported()) ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    !currentUser?.uid ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) return false;

  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Firebase Messaging returned no push token.");
  }

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
  cacheToken(currentUser.uid, token);
  return true;
};

export const unregisterPushToken = async (uid) => {
  if (!uid) return false;
  const { getMessaging, getToken, isSupported, deleteToken } = await import("firebase/messaging");
  const cachedToken = readCachedToken(uid);
  const messagingSupported = await isSupported();
  const messaging = messagingSupported ? getMessaging(app) : null;
  let token = cachedToken;

  if (
    !token &&
    messaging &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  ) {
    const registration = await navigator.serviceWorker.getRegistration("/");
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

  if (messaging) await deleteToken(messaging);
  try {
    localStorage.removeItem(getCachedTokenKey(uid));
  } catch (error) {
    console.warn("Could not clear this device's cached push token:", error);
  }
  return true;
};