/**
 * lib/firebase.ts — Minimal stub
 *
 * Firebase SDK was previously included for a "firebase" login mode that was
 * never actually triggered by the login screen (no router.push with
 * mode: "firebase" existed). The full firebase package (~8-12 MB in the
 * Android bundle) was loaded at startup for zero benefit.
 *
 * This stub replaces the full SDK with no-op functions so verify-otp.tsx
 * compiles without changes, while completely removing Firebase from the
 * bundle.
 *
 * If Firebase phone auth is needed in future, re-add the full SDK then.
 * For now, all auth uses the existing OTP/PIN/email flow via the Aorane
 * backend — no Firebase dependency needed.
 *
 * SIZE SAVING: ~8-12 MB removed from APK/AAB.
 *
 * NOTE: this used to `import type { ConfirmationResult } from "firebase/auth"`
 * for typing only, but that required the `firebase` package to be installed
 * purely for its types — defeating the point of removing the dependency, and
 * breaking `tsc --noEmit` when the package wasn't present. Since verify-otp.tsx
 * only ever calls `.confirm(code)` on this object (and this whole branch is
 * unreachable dead code today, see above), a minimal local type is enough.
 */

// Minimal local stand-in for firebase/auth's ConfirmationResult — only the
// one method this codebase actually calls. Not a real Firebase type; if
// Firebase phone auth is reintroduced, replace this with the real import.
interface MinimalConfirmationResult {
  confirm(verificationCode: string): Promise<{ user: { getIdToken(): Promise<string> } }>;
}

// Stub — never called at runtime since mode:"firebase" is never pushed
export const auth = null as unknown as { currentUser: null };
export default null as unknown as { name: string };

let _confirmationResult: MinimalConfirmationResult | null = null;

export function setConfirmationResult(result: MinimalConfirmationResult) {
  _confirmationResult = result;
}

export function getConfirmationResult(): MinimalConfirmationResult | null {
  return _confirmationResult;
}

export function clearConfirmationResult() {
  _confirmationResult = null;
}