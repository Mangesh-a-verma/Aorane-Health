// ─── Google Play Billing provider ───────────────────────────────────────────
// Wraps the Play Developer API (androidpublisher v3) behind the shared
// SubscriptionProvider contract. This is the ONLY file that talks to Google
// directly — routes and the subscription engine only ever see the
// normalized `VerifiedPurchase` shape from ../types.ts.
//
// Auth: a Google Cloud service account with the "Play Android Developer"
// role (granted in Play Console > Users and permissions), authenticated via
// google-auth-library using a JWT client credential — NOT an API key, and
// never checked into source. See .env.example for the required variables.
//
// Docs this implementation follows:
//  - purchases.subscriptionsv2.get   (read current state — source of truth)
//  - purchases.subscriptions.acknowledge (must ack within 3 days or Google refunds it)
//  - purchases.subscriptions.cancel  (best-effort; Play Store subscription
//    center is still the primary supported cancellation path — see
//    CancelResult.manageUrl)

import { GoogleAuth } from "google-auth-library";
import { logger } from "../logger";
import type { CancelResult, SubscriptionProvider, VerifiedPurchase } from "./types";

const PACKAGE_NAME = () => process.env["GOOGLE_PLAY_PACKAGE_NAME"] || "in.aorane.app";
const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";

// ── Service-account auth (lazy singleton; never logs the key material) ─────
let authClient: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (authClient) return authClient;
  const rawJson = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  if (!rawJson) {
    throw new Error(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured — cannot verify Google Play purchases. " +
      "Set it to the full service-account JSON (as a single-line string) in the deploy environment, never in source."
    );
  }
  let credentials: Record<string, unknown>;
  try {
    // Support either raw JSON or base64-encoded JSON (base64 is friendlier
    // for platforms whose env-var UI mangles newlines in the PEM key).
    const looksLikeJson = rawJson.trim().startsWith("{");
    const decoded = looksLikeJson ? rawJson : Buffer.from(rawJson, "base64").toString("utf8");
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON (or valid base64-encoded JSON).");
  }
  authClient = new GoogleAuth({
    credentials: credentials as never,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return authClient;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = getAuth();
  const client = await auth.getClient();
  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) throw new Error("Failed to obtain Google Play API access token");
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

// ── subscriptionsv2 response shape (only the fields we use) ────────────────
interface SubscriptionPurchaseV2 {
  kind: string;
  subscriptionState:
    | "SUBSCRIPTION_STATE_ACTIVE"
    | "SUBSCRIPTION_STATE_CANCELED"
    | "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    | "SUBSCRIPTION_STATE_ON_HOLD"
    | "SUBSCRIPTION_STATE_PAUSED"
    | "SUBSCRIPTION_STATE_EXPIRED"
    | "SUBSCRIPTION_STATE_PENDING"
    | "SUBSCRIPTION_STATE_UNSPECIFIED"
    | string;
  latestOrderId?: string;
  acknowledgementState?: "ACKNOWLEDGEMENT_STATE_PENDING" | "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" | string;
  testPurchase?: Record<string, unknown> | null;
  lineItems?: Array<{
    productId: string;
    expiryTime: string; // RFC3339
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    prepaidPlan?: Record<string, unknown>;
  }>;
}

function redactToken(token: string): string {
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function toVerifiedPurchase(productId: string, purchaseToken: string, data: SubscriptionPurchaseV2): VerifiedPurchase {
  const lineItem = data.lineItems?.find(li => li.productId === productId) ?? data.lineItems?.[0];
  const expiresAt = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : new Date(0);
  const activeStates = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_ON_HOLD"]);
  return {
    productId: lineItem?.productId ?? productId,
    providerSubscriptionId: purchaseToken,
    isActive: activeStates.has(data.subscriptionState) && expiresAt.getTime() > Date.now() - 3 * 24 * 60 * 60 * 1000, // grace tolerance handled by state, not just expiry math
    autoRenewing: !!lineItem?.autoRenewingPlan?.autoRenewEnabled,
    expiresAt,
    rawStatus: data.subscriptionState,
  };
}

async function fetchSubscriptionV2(purchaseToken: string): Promise<SubscriptionPurchaseV2> {
  const pkg = PACKAGE_NAME();
  const res = await authedFetch(
    `/applications/${encodeURIComponent(pkg)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, tokenRedacted: redactToken(purchaseToken) }, "Google Play subscriptionsv2.get failed");
    throw new Error(`Google Play verification failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as SubscriptionPurchaseV2;
}

/**
 * Acknowledge a subscription purchase. Google auto-refunds any subscription
 * purchase not acknowledged within 3 days, so this MUST be called right
 * after a successful verify+activate. Uses the legacy (v3, non-"v2")
 * acknowledge endpoint, which remains the documented mechanism for
 * subscriptionsv2-verified purchases.
 */
export async function acknowledgeGooglePurchase(productId: string, purchaseToken: string): Promise<void> {
  const pkg = PACKAGE_NAME();
  const res = await authedFetch(
    `/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    { method: "POST", body: JSON.stringify({}) }
  );
  // 400 here commonly means "already acknowledged" (e.g. a retried verify
  // call) — treat as success rather than failing the whole purchase flow.
  if (!res.ok && res.status !== 400) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, tokenRedacted: redactToken(purchaseToken) }, "Google Play acknowledge failed");
    throw new Error(`Google Play acknowledge failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
}

export const googlePlayProvider: SubscriptionProvider = {
  name: "google_play",

  async verifyPurchase({ productId, purchaseToken }): Promise<VerifiedPurchase> {
    const data = await fetchSubscriptionV2(purchaseToken);
    const verified = toVerifiedPurchase(productId, purchaseToken, data);
    // Server-side sanity check: the productId the client claims to have
    // bought must actually appear in Google's own record of this token.
    // Prevents a tampered client from sending a cheap productId alongside
    // someone else's (or a different) purchaseToken to claim a plan it
    // didn't pay for.
    const productIds = data.lineItems?.map(li => li.productId) ?? [];
    if (!productIds.includes(productId)) {
      logger.warn(
        { claimedProductId: productId, actualProductIds: productIds, tokenRedacted: redactToken(purchaseToken) },
        "Google Play productId mismatch — rejecting purchase"
      );
      throw new Error("Purchase token does not match the claimed product");
    }
    return verified;
  },

  async getPurchaseState({ productId, purchaseToken }): Promise<VerifiedPurchase> {
    const data = await fetchSubscriptionV2(purchaseToken);
    return toVerifiedPurchase(productId, purchaseToken, data);
  },

  async cancelSubscription({ purchaseToken, productId }): Promise<CancelResult> {
    const pkg = PACKAGE_NAME();
    try {
      const res = await authedFetch(
        `/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:cancel`,
        { method: "POST", body: JSON.stringify({}) }
      );
      return {
        autoRenewCancelled: res.ok,
        manageUrl: "https://play.google.com/store/account/subscriptions",
      };
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Google Play server-side cancel failed — falling back to deep link");
      // Google's own guidance: even if the server-side cancel call fails,
      // the user can always manage/cancel directly in the Play Store.
      return { autoRenewCancelled: false, manageUrl: "https://play.google.com/store/account/subscriptions" };
    }
  },
};

// ── RTDN (Real-time Developer Notifications) OIDC token verification ───────
// Google Pub/Sub push delivers RTDN with a signed OIDC ID token in the
// Authorization header. We must verify it came from Google AND was minted
// for OUR push endpoint (audience) before trusting the notification body —
// otherwise anyone who guesses the webhook URL could forge subscription
// events (fake renewals, fake cancellations, fake revokes).
import { OAuth2Client } from "google-auth-library";
const oidcClient = new OAuth2Client();

export async function verifyGoogleRtdnToken(authorizationHeader: string | undefined, expectedAudience: string): Promise<boolean> {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  const idToken = authorizationHeader.slice("Bearer ".length);
  try {
    const ticket = await oidcClient.verifyIdToken({ idToken, audience: expectedAudience });
    const payload = ticket.getPayload();
    // Additionally require the token was issued to the service account we
    // configured for the Pub/Sub push subscription, not just "any Google-signed token".
    const expectedIssuer = process.env["GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL"];
    if (expectedIssuer && payload?.email !== expectedIssuer) {
      logger.warn({ tokenEmail: payload?.email }, "Google RTDN token has unexpected service-account email");
      return false;
    }
    return !!payload;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Google RTDN OIDC token verification failed");
    return false;
  }
}

/** Decodes the base64 Pub/Sub message data into the RTDN JSON payload. */
export interface GooglePlayDeveloperNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number; // see NOTIFICATION_TYPE map below
    purchaseToken: string;
    subscriptionId: string; // productId
  };
  testNotification?: { version: string };
}

export const RTDN_NOTIFICATION_TYPE = {
  SUBSCRIPTION_RECOVERED: 1,
  SUBSCRIPTION_RENEWED: 2,
  SUBSCRIPTION_CANCELED: 3,
  SUBSCRIPTION_PURCHASED: 4,
  SUBSCRIPTION_ON_HOLD: 5,
  SUBSCRIPTION_IN_GRACE_PERIOD: 6,
  SUBSCRIPTION_RESTARTED: 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED: 8,
  SUBSCRIPTION_DEFERRED: 9,
  SUBSCRIPTION_PAUSED: 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED: 11,
  SUBSCRIPTION_REVOKED: 12,
  SUBSCRIPTION_EXPIRED: 13,
} as const;

export function decodeRtdnMessage(base64Data: string): GooglePlayDeveloperNotification {
  const json = Buffer.from(base64Data, "base64").toString("utf8");
  return JSON.parse(json) as GooglePlayDeveloperNotification;
}
