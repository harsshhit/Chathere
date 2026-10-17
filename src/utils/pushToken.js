import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { arrayUnion, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db } from "../firebase";

export const registerPushToken = async (currentUser) => {
  try {
    if (!(await isSupported()) || Notification.permission !== "granted") return;
    if (!currentUser?.uid || !("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
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

    // Firestore rules should allow writes to fcmTokens/{uid} only when request.auth.uid == uid.
    await setDoc(
      doc(db, "fcmTokens", currentUser.uid),
      { tokens: arrayUnion(token), updatedAt: serverTimestamp() },
      { merge: true }
    );
    console.info("push token saved");
  } catch (error) {
    console.warn("Push token registration failed:", error?.code, error?.message);
  }
};