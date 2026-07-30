import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAcvEX-ePPc7bzuqulXx9tcnd540BGpNPE",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "chat-89b0a.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "chat-89b0a",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "chat-89b0a.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "761719250179",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:761719250179:web:2036c18783861ad9891d36",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-1N5HJK3NN6",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const storage = getStorage();
export const db = getFirestore();
export const googleProvider = new GoogleAuthProvider();
