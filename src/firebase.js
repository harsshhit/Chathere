import { app } from "./firebaseApp";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

export { app, auth, googleProvider } from "./firebaseApp";

let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (error) {
  console.warn("Could not initialize persistent Firestore cache; using default Firestore:", error);
  firestore = getFirestore(app);
}
export const db = firestore;
