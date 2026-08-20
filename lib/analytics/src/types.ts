// ─── Consent ───────────────────────────────────────────────────────────────
// "necessary" isn't a real toggle — it's always on and isn't shown as a
// choice — but it's listed here so a consent-state object can describe all
// four categories uniformly instead of special-casing one of them.
export type ConsentCategory = "necessary" | "analytics" | "marketing" | "preferences";

export type ConsentState = Record<ConsentCategory, boolean>;

// ─── Attribution ───────────────────────────────────────────────────────────
// One captured "touch" — a visit that arrived with campaign context worth
// remembering. Mirrors AttributionSnapshot in lib/db/src/schema/platform.ts;
// kept as an independent type here (rather than importing from @workspace/db)
// because this package runs in the browser and must never pull in
// server/DB-only code.
export interface AttributionSnapshot {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landingPage?: string;
  capturedAt?: string;
}

export interface AttributionData {
  firstTouch?: AttributionSnapshot;
  lastTouch?: AttributionSnapshot;
}

// ─── Events ──────────────────────────────────────────────────────────────
// Values are strings/numbers/booleans only — this is a hard constraint, not
// a convenience. It's what makes the privacy filter's job tractable: a
// nested object could smuggle in a medical-report field under a name the
// denylist doesn't recognise. Flat, and only these three primitive types.
export type EventProperties = Record<string, string | number | boolean | undefined>;

export type ConsentCategoryForEvent = "analytics" | "marketing";

export interface TrackedEvent {
  name: string;
  properties?: EventProperties;
  /** Which consent category gates this event. Defaults to "analytics". */
  category?: ConsentCategoryForEvent;
}

// ─── Destination configuration ──────────────────────────────────────────
// Every field is optional on purpose: the app must run identically whether
// zero or all of these are configured. A destination that has no ID simply
// never loads.
export interface MarketingConfig {
  /** Which app is initializing — used for default event context, nothing else. */
  appName: "landing" | "business-portal";
  ga4MeasurementId?: string;
  gtmContainerId?: string;
  metaPixelId?: string;
  clarityProjectId?: string;
  /** Business portal only — LinkedIn Insight Tag partner ID. */
  linkedinPartnerId?: string;
  /** Show the consent banner automatically on init. Defaults to true. */
  showConsentBanner?: boolean;
}
