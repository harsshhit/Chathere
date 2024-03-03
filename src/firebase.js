import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAcvEX-ePPc7bzuqulXx9tcnd540BGpNPE",
  authDomain: "chat-89b0a.firebaseapp.com",
  projectId: "chat-89b0a",
  storageBucket: "chat-89b0a.appspot.com",
  messagingSenderId: "761719250179",
  appId: "1:761719250179:web:2036c18783861ad9891d36",
  measurementId: "G-1N5HJK3NN6",
};
// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const storage = getStorage();
export const db = getFirestore();
