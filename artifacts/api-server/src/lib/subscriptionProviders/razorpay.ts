// ─── Razorpay provider adapter ───────────────────────────────────────────────
// Thin adapter around the existing lib/razorpay.ts so Razorpay fits the same
// SubscriptionProvider contract as Google Play / Apple IAP. This is what
// keeps Razorpay's *architecture* alive for web checkout / business-portal
// seat billing / future international gateways, per the migration scope —
// only the Android native app's digital-subscription purchase path has
// moved off Razorpay onto Google Play Billing.
import { fetchSubscription, cancelSubscription as rzCancelSubscription } from "../razorpay";
import type { CancelResult, SubscriptionProvider, VerifiedPurchase } from "./types";

function toVerifiedPurchase(planId: string, subscriptionId: string, sub: Awaited<ReturnType<typeof fetchSubscription>>): VerifiedPurchase {
  const activeStatuses = new Set(["active", "authenticated"]);
  return {
    productId: planId,
    providerSubscriptionId: subscriptionId,
    isActive: activeStatuses.has(sub.status),
    autoRenewing: activeStatuses.has(sub.status),
    expiresAt: new Date(sub.current_end * 1000),
    rawStatus: sub.status,
  };
}

export const razorpayProvider: SubscriptionProvider = {
  name: "razorpay",

  async verifyPurchase({ productId, purchaseToken }): Promise<VerifiedPurchase> {
    // For Razorpay, `purchaseToken` is the Razorpay subscription id — actual
    // payment-signature verification still happens where it always has
    // (routes/modules/payment.ts, via verifySubscriptionSignature), because
    // that check needs the payment_id + signature pair from the checkout
    // callback, which this generic interface doesn't carry. This method is
    // used for the reconciliation/status-refresh path only.
    const sub = await fetchSubscription(purchaseToken);
    return toVerifiedPurchase(productId, purchaseToken, sub);
  },

  async getPurchaseState({ productId, purchaseToken }): Promise<VerifiedPurchase> {
    const sub = await fetchSubscription(purchaseToken);
    return toVerifiedPurchase(productId, purchaseToken, sub);
  },

  async cancelSubscription({ purchaseToken }): Promise<CancelResult> {
    const result = await rzCancelSubscription(purchaseToken, true);
    return { autoRenewCancelled: result.status === "cancelled" || result.status === "pending" };
  },
};
