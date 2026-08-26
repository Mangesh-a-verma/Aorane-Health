import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Single source of truth for what "accepting the onboarding legal bundle"
 * means today. Bump CONSENT_BUNDLE_VERSION whenever Terms of Service,
 * Privacy Policy, or the Medical Disclaimer change materially enough that
 * existing users should be asked to re-accept.
 *
 * The onboarding intro screen (app/(onboarding)/intro.tsx) runs BEFORE
 * login/signup, so there's no user_id yet to attach a server-side consent
 * record to. Instead: save the acceptance locally here the moment the user
 * checks all three boxes, then flush it to the server (POST
 * /users/consent) the moment a user_id actually exists — see
 * AuthContext's flushPendingConsent, called right after loginWithToken.
 */
export const CONSENT_BUNDLE_VERSION = "2026-08-26";
export const CONSENT_DOCS = ["terms", "privacy", "medical_disclaimer"] as const;

const PENDING_CONSENT_KEY = "pending_consent_sync";

export type PendingConsent = {
  docsAccepted: string[];
  version: string;
  acceptedAt: string; // ISO 8601
};

export async function savePendingConsent(consent: PendingConsent): Promise<void> {
  await AsyncStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(consent));
}

export async function getPendingConsent(): Promise<PendingConsent | null> {
  const raw = await AsyncStorage.getItem(PENDING_CONSENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingConsent;
  } catch {
    return null;
  }
}

export async function clearPendingConsent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_CONSENT_KEY);
}
