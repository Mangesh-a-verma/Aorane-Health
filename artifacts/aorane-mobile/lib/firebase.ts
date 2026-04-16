import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCKyvmW9BTn1ZLhFdXyHjHUQPCmgeuH87A",
  authDomain: "aorane-51d93.firebaseapp.com",
  projectId: "aorane-51d93",
  storageBucket: "aorane-51d93.firebasestorage.app",
  messagingSenderId: "294648735770",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:294648735770:web:76c6a1856f829ac316c9a3",
  measurementId: "G-61RRXNMPW5",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export default app;

let _confirmationResult: ConfirmationResult | null = null;

export function setConfirmationResult(result: ConfirmationResult) {
  _confirmationResult = result;
}

export function getConfirmationResult(): ConfirmationResult | null {
  return _confirmationResult;
}

export function clearConfirmationResult() {
  _confirmationResult = null;
}
