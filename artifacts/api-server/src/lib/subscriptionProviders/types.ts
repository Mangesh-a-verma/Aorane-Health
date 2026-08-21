// ─── Provider-agnostic subscription verification contract ──────────────────
// Every payment provider (Google Play, Apple IAP, Razorpay, future
// Stripe/Cashfree) implements this same shape. The subscription engine
// (../subscriptionEngine.ts) and routes only ever talk to this interface —
// they never import a provider SDK directly. This is what makes adding
// Apple IAP later, or swapping Razorpay's web flow for Stripe, a matter of
// writing one new file rather than touching route/engine logic.

export type SubscriptionProviderName = "google_play" | "apple_iap" | "razorpay" | "stripe" | "cashfree";

/**
 * Canonical, server-verified facts about a purchase/subscription, entirely
 * derived from the provider's own API response — never from anything the
 * client sent us. `verifyPurchase` is the ONLY place a purchaseToken/receipt
 * is exchanged for these facts.
 */
export interface VerifiedPurchase {
  /** The provider's own product/SKU identifier for what was purchased. */
  productId: string;
  /** Provider-specific handle used for all future lookups of this purchase
   *  (Google: purchaseToken, Apple: originalTransactionId, Razorpay: subscription id). */
  providerSubscriptionId: string;
  /** True if the purchase is currently entitled to service (not expired/refunded/revoked). */
  isActive: boolean;
  /** True if the provider will auto-renew this subscription at `expiresAt`. */
  autoRenewing: boolean;
  /** Absolute expiry/next-charge time per the provider. */
  expiresAt: Date;
  /** Raw provider subscription/purchase status string, for logging/audit only —
   *  never branch business logic on this string outside the provider file itself. */
  rawStatus: string;
  /** Amount actually paid, in the smallest currency unit the provider reports (paise/cents), if known. */
  amountMicros?: number;
  currencyCode?: string;
}

export interface CancelResult {
  /** True if the provider confirms auto-renew has been turned off (plan may still be active until expiry). */
  autoRenewCancelled: boolean;
  /** If the provider doesn't support a direct server-side cancel (e.g. Google Play strongly
   *  prefers the user manage this in the Play Store subscriptions center), this points there. */
  manageUrl?: string;
}

export interface SubscriptionProvider {
  readonly name: SubscriptionProviderName;
  /**
   * Exchange a client-submitted purchase token/receipt for verified, provider-authoritative
   * purchase facts. MUST call the provider's server API — never trust the client's claims
   * about product/plan/expiry directly.
   */
  verifyPurchase(params: { productId: string; purchaseToken: string; userId: string }): Promise<VerifiedPurchase>;
  /**
   * Re-fetch current state for an existing purchase (used by webhook/RTDN handlers and
   * reconciliation jobs to get the latest truth rather than trusting the notification payload).
   */
  getPurchaseState(params: { productId: string; purchaseToken: string }): Promise<VerifiedPurchase>;
  /** Cancel auto-renew server-side where the provider's API supports it. */
  cancelSubscription(params: { purchaseToken: string; productId: string }): Promise<CancelResult>;
}
