import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const USER_DOCUMENT_TTL = 5 * 60 * 1000;
const documents = new Map();
const pending = new Map();

const fetchAndCache = (uid) => {
  if (pending.has(uid)) return pending.get(uid);
  let request;
  request = getDoc(doc(db, "users", uid))
    .then((snapshot) => snapshot.exists() ? snapshot.data() || {} : {})
    .then((data) => {
      if (pending.get(uid) === request) {
        documents.set(uid, { data, fetchedAt: Date.now() });
      }
      return data;
    })
    .finally(() => {
      if (pending.get(uid) === request) pending.delete(uid);
    });
  pending.set(uid, request);
  return request;
};

export async function getUserDocument(uid) {
  if (!uid) return {};
  const cached = documents.get(uid);
  if (cached && Date.now() - cached.fetchedAt < USER_DOCUMENT_TTL) return cached.data;
  if (cached) {
    void fetchAndCache(uid).catch((error) => console.error("Could not refresh cached user document:", error));
    return cached.data;
  }
  return fetchAndCache(uid);
}

export function cacheUserDocument(uid, data) {
  if (!uid || !data || typeof data !== "object") return;
  documents.set(uid, { data, fetchedAt: Date.now() });
}

export function mergeCachedUserDocument(uid, changes) {
  if (!uid || !changes || typeof changes !== "object") return;
  const cached = documents.get(uid);
  cacheUserDocument(uid, { ...(cached?.data || {}), ...changes });
}

export function clearUserDocumentCache(uid) {
  if (uid) {
    documents.delete(uid);
    pending.delete(uid);
    return;
  }
  documents.clear();
  pending.clear();
}
