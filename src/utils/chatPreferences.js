import { deleteField, doc, FieldPath, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export const saveChatPreference = (uid, chatId, key, value) => {
  if (!uid || !chatId) throw new Error("A user and chat are required to save chat preferences.");
  if (typeof value === "undefined") throw new Error("Chat preference values cannot be undefined.");
  return updateDoc(doc(db, "users", uid), new FieldPath("chatPrefs", chatId, key), value);
};

export const saveMutePreference = (uid, chatId, duration) => {
  const value = duration === "off"
    ? deleteField()
    : duration === "always"
    ? 9999999999999
    : Date.now() + duration;
  return saveChatPreference(uid, chatId, "mutedUntil", value);
};
