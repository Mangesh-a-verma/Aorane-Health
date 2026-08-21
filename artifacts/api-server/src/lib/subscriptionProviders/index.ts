import type { SubscriptionProvider, SubscriptionProviderName } from "./types";
import { googlePlayProvider } from "./googlePlay";
import { razorpayProvider } from "./razorpay";
import { appleIapProvider } from "./appleIap";

export type { SubscriptionProvider, SubscriptionProviderName, VerifiedPurchase, CancelResult } from "./types";

const registry: Record<SubscriptionProviderName, SubscriptionProvider> = {
  google_play: googlePlayProvider,
  razorpay: razorpayProvider,
  apple_iap: appleIapProvider,
  // Stripe/Cashfree: not implemented — registered as a clear "not yet
  // available" entry point rather than omitted, so the DB enum, engine
  // switch, and this registry all stay in lockstep as new gateways are added.
  stripe: {
    name: "stripe",
    verifyPurchase: () => { throw new Error("Stripe provider is not implemented yet"); },
    getPurchaseState: () => { throw new Error("Stripe provider is not implemented yet"); },
    cancelSubscription: () => { throw new Error("Stripe provider is not implemented yet"); },
  },
  cashfree: {
    name: "cashfree",
    verifyPurchase: () => { throw new Error("Cashfree provider is not implemented yet"); },
    getPurchaseState: () => { throw new Error("Cashfree provider is not implemented yet"); },
    cancelSubscription: () => { throw new Error("Cashfree provider is not implemented yet"); },
  },
};

export function getSubscriptionProvider(name: SubscriptionProviderName): SubscriptionProvider {
  const provider = registry[name];
  if (!provider) throw new Error(`Unknown subscription provider: ${name}`);
  return provider;
}
