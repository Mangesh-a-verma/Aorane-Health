// ─── Google Play Billing wrapper ────────────────────────────────────────────
// Thin, typed wrapper around react-native-iap for Android native subscription
// purchases. This is what replaces the external-browser Razorpay checkout for
// the Android app's digital-subscription flow (Play Store policy requires
// Google Play's own billing system for in-app digital content/features).
//
// IMPORTANT: this module only ever hands the app a raw (productId,
// purchaseToken) pair from Google — it never decides what plan the user
// gets. That decision is made server-side in
// api-server/src/lib/subscriptionEngine.ts, from Google's own verified
// purchase data, via /payment/google/verify-purchase. Never trust
// `finishTransaction`/`purchaseUpdatedListener` locally as "the user is now
// Pro" — only a successful server verify response does that (see
// app/upgrade.tsx `purchaseWithGooglePlay`).
import { Platform } from "react-native";
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  deepLinkToSubscriptions,
  type Purchase,
  type PurchaseError,
  type ProductSubscription,
} from "react-native-iap";

export type AoranePlanKey = "pro" | "max" | "family";

/**
 * Play Console product IDs. These must exactly match the subscription
 * products/base-plans created in Play Console > Monetize > Subscriptions.
 * Server-side, the same mapping lives in `plan_pricing.google_play_product_ids`
 * (lib/db/src/schema/revenue.ts) — the two must be kept in sync manually,
 * since the server never trusts the client's plan claim regardless.
 */
export const GOOGLE_PLAY_PRODUCT_IDS: Record<AoranePlanKey, string> = {
  pro: "aorane_pro_monthly",
  max: "aorane_max_monthly",
  family: "aorane_family_monthly",
};

export const ALL_SUBSCRIPTION_SKUS = Object.values(GOOGLE_PLAY_PRODUCT_IDS);

let connected = false;

export function isGooglePlayBillingSupported(): boolean {
  return Platform.OS === "android";
}

export async function ensureBillingConnection(): Promise<void> {
  if (!isGooglePlayBillingSupported()) throw new Error("Google Play Billing is only available on Android");
  if (connected) return;
  await initConnection();
  connected = true;
}

export async function teardownBillingConnection(): Promise<void> {
  if (!connected) return;
  try {
    await endConnection();
  } finally {
    connected = false;
  }
}

export async function fetchSubscriptionProducts(): Promise<ProductSubscription[]> {
  await ensureBillingConnection();
  const result = await fetchProducts({ skus: ALL_SUBSCRIPTION_SKUS, type: "subs" });
  return (result as ProductSubscription[] | null) ?? [];
}

export interface PurchaseOutcome {
  productId: string;
  purchaseToken: string;
}

/**
 * Launches the native Play Billing purchase sheet for a plan and resolves
 * once Play Billing reports a result via its event listeners. The caller is
 * responsible for sending { productId, purchaseToken } to
 * POST /payment/google/verify-purchase and only calling
 * `completePurchase` after the server confirms activation — never before.
 */
export function purchaseSubscription(planKey: AoranePlanKey): Promise<PurchaseOutcome> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const productId = GOOGLE_PLAY_PRODUCT_IDS[planKey];

    const updateSub = purchaseUpdatedListener((purchase: Purchase) => {
      if (settled) return;
      if (purchase.productId !== productId) return; // ignore unrelated in-flight purchases
      const purchaseToken = purchase.purchaseToken;
      if (!purchaseToken) {
        settled = true;
        cleanup();
        reject(new Error("Play Billing did not return a purchase token"));
        return;
      }
      settled = true;
      cleanup();
      resolve({ productId: purchase.productId, purchaseToken });
    });

    const errorSub = purchaseErrorListener((error: PurchaseError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(error.message || "Purchase failed or was cancelled"));
    });

    function cleanup() {
      updateSub.remove();
      errorSub.remove();
    }

    (async () => {
      try {
        await ensureBillingConnection();
        const products = await fetchSubscriptionProducts();
        const product = products.find((p) => p.id === productId);
        const offerToken = product?.subscriptionOffers?.[0]?.offerTokenAndroid;
        if (!offerToken) {
          settled = true;
          cleanup();
          reject(new Error("No subscription offer available for this plan right now. Please try again shortly."));
          return;
        }
        await requestPurchase({
          type: "subs",
          request: {
            google: {
              skus: [productId],
              subscriptionOffers: [{ sku: productId, offerToken }],
            },
          },
        });
        // Result arrives via purchaseUpdatedListener/purchaseErrorListener above,
        // not via this call's return value (react-native-iap is event-based).
      } catch (err) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err instanceof Error ? err : new Error("Failed to start purchase"));
      }
    })();
  });
}

/**
 * Finalizes the purchase with Play Billing so it's removed from the pending
 * queue. MUST only be called AFTER the backend has confirmed the purchase
 * was verified and activated — finishing a transaction we failed to verify
 * would let the user keep access without the server ever granting it.
 */
export async function completePurchase(purchase: { purchaseToken: string; productId: string; isAutoRenewing: boolean; transactionId?: string }): Promise<void> {
  await finishTransaction({
    purchase: {
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
      transactionId: purchase.transactionId ?? purchase.purchaseToken,
      // Additional required Purchase fields are populated by the store at
      // runtime; this minimal shape matches what finishTransaction reads.
    } as unknown as Purchase,
    isConsumable: false,
  });
}

/** Deep-links to the Play Store's subscription management screen — the
 *  primary supported cancellation UX per Google's own guidance. */
export async function openPlayStoreSubscriptions(): Promise<void> {
  try {
    await deepLinkToSubscriptions({});
  } catch {
    // Non-fatal — the upgrade screen falls back to the manageUrl returned by
    // the backend's /payment/google/cancel response.
  }
}
