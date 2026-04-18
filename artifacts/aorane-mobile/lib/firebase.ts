import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";

/**
 * SECURITY NOTE — Firebase client config is intentionally public.
 * Firebase client API keys are NOT secrets. They are project identifiers
 * designed to be embedded in client apps. Actual access control is enforced
 * by Firebase Security Rules configured in the Firebase Console.
 * Reference: https://firebase.google.com/docs/projects/api-keys
 *
 * Prefer setting EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_APP_ID
 * as environment variables for cleaner config management. The hardcoded
 * fallbacks are safe here per Firebase's architecture.
 */
export const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY  || "AIzaSyCKyvmW9BTn1ZLhFdXyHjHUQPCmgeuH87A",
  authDomain:        "aorane-51d93.firebaseapp.com",
  projectId:         "aorane-51d93",
  storageBucket:     "aorane-51d93.firebasestorage.app",
  messagingSenderId: "294648735770",
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID   || "1:294648735770:web:76c6a1856f829ac316c9a3",
  measurementId:     "G-61RRXNMPW5",
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
