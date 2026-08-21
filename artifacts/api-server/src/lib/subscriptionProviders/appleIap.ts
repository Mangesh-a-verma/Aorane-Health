// ─── Apple IAP provider — architecture placeholder ──────────────────────────
// NOT implemented yet — no iOS UI ships in this change (per migration scope,
// item 3: "do not implement unnecessary iOS UI now, but ensure the
// subscription architecture is fully compatible with Apple IAP for future
// implementation"). This file exists so:
//   1. `subscriptionEngine.ts` and the provider registry already have a slot
//      for "apple_iap" (the DB enum, routes, and engine switch statements
//      don't need to change shape when iOS lands — only this file's guts do).
//   2. Anyone picking up iOS work later has the exact contract to fill in.
//
// Real implementation notes for whoever does this next:
//  - Use Apple's App Store Server API (server-to-server, JWT-signed with an
//    ES256 key from App Store Connect) to call
//    GET /inApps/v1/subscriptions/{originalTransactionId}
//    for verification — never trust the on-device transaction/receipt data
//    alone, same principle as Google Play here.
//  - Apple's equivalent of RTDN is "App Store Server Notifications V2",
//    delivered as a signed JWS payload (verify with Apple's root certs via
//    the `jsonwebtoken`/`jose` cert chain, NOT google-auth-library).
//  - `providerSubscriptionId` should store `originalTransactionId` (stable
//    across renewals), matching the `providerSubscriptionId` semantics
//    already used for Google Play (`purchaseToken`) and Razorpay
//    (subscription id) — the uniqueness index in the `subscriptions` table
//    is (provider, providerSubscriptionId), so this convention is required
//    for the same replay/duplicate-activation protection to apply.
import type { SubscriptionProvider } from "./types";

const NOT_IMPLEMENTED = "Apple IAP provider is not implemented yet — iOS purchases are not shipped in this build.";

export const appleIapProvider: SubscriptionProvider = {
  name: "apple_iap",
  async verifyPurchase(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  },
  async getPurchaseState(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  },
  async cancelSubscription(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  },
};
