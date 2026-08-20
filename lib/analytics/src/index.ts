export type { ConsentCategory, ConsentState, AttributionData, AttributionSnapshot, EventProperties, MarketingConfig } from "./types";
export { consent } from "./consent";
export { captureAttribution, getAttribution } from "./attribution";
export { mountConsentBanner } from "./consent-banner";
export { track, trackEvent, ConsumerEvents, BusinessEvents } from "./events";
export { initMarketing } from "./init";
export { trackLinkedInConversion } from "./destinations/linkedin";
