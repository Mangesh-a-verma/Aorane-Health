// ─── Event layer ───────────────────────────────────────────────────────────
//
// Aorane Event Layer → Consent Check → Privacy Filter → Destination
//
// track() is the one function every app calls. It never throws, and it
// never blocks the caller on network/script failures — a tracker going
// down must never be able to break a signup button or a form submit.
//
// Canonical event names below aren't exhaustive or enforced by a union
// type (new events will keep getting added as the funnel grows), but
// sticking to this naming convention — lowercase, snake_case, verb-first —
// keeps GA4/Meta reports readable across landing, business-portal and
// (later) the mobile app.

import type { ConsentCategoryForEvent, EventProperties, MarketingConfig, TrackedEvent } from "./types";
import { consent } from "./consent";
import { sanitizeEventProperties } from "./privacy";
import { trackGa4 } from "./destinations/ga4";
import { trackMetaPixel } from "./destinations/meta";

export const ConsumerEvents = {
  LANDING_PAGE_VIEW: "landing_page_view",
  FEATURE_VIEW: "feature_view",
  PRICING_VIEW: "pricing_view",
  PLAY_STORE_CLICK: "play_store_click",
  APP_STORE_CLICK: "app_store_click",
  SIGNUP_CTA_CLICK: "signup_cta_click",
  NOTIFY_ME_SUBMIT: "notify_me_submit",
  INVESTOR_DECK_REQUEST: "investor_deck_request",
} as const;

export const BusinessEvents = {
  BUSINESS_LANDING_VIEW: "business_landing_view",
  BUSINESS_PRICING_VIEW: "business_pricing_view",
  DEMO_REQUEST_SUBMIT: "demo_request_submit",
  TALK_TO_EXPERT_SUBMIT: "talk_to_expert_submit",
  BUSINESS_REGISTER_START: "business_register_start",
  BUSINESS_REGISTER_COMPLETE: "business_register_complete",
} as const;

interface Registry {
  ga4Enabled: boolean;
  metaEnabled: boolean;
}

// Set by init() once destinations have actually been loaded (config present
// + consent granted). Kept module-private — apps only ever go through
// track(), never call a destination directly.
const registry: Registry = { ga4Enabled: false, metaEnabled: false };

export function registerDestination(name: "ga4" | "meta", enabled: boolean): void {
  if (name === "ga4") registry.ga4Enabled = enabled;
  if (name === "meta") registry.metaEnabled = enabled;
}

function categoryGranted(category: ConsentCategoryForEvent): boolean {
  return consent.isGranted(category);
}

/**
 * Fire a marketing event. Safe to call unconditionally — if no destination
 * is configured, if consent hasn't been granted for the event's category,
 * or if a destination throws, this is a silent no-op from the caller's
 * point of view. Nothing here can break the surrounding user flow.
 */
export function track(name: string, properties?: EventProperties, category: ConsentCategoryForEvent = "analytics"): void {
  try {
    if (!categoryGranted(category)) return;
    const clean = sanitizeEventProperties(properties);
    if (registry.ga4Enabled) trackGa4(name, clean);
    if (registry.metaEnabled) trackMetaPixel(name, clean);
  } catch {
    // track() must never throw into caller code.
  }
}

export function trackEvent(event: TrackedEvent): void {
  track(event.name, event.properties, event.category ?? "analytics");
}

export type { MarketingConfig };
