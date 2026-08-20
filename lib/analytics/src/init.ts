// ─── Init ──────────────────────────────────────────────────────────────────
// One function each app calls once, on startup. Everything here is
// best-effort and wrapped so a missing/invalid config value can never
// prevent the app itself from rendering — see the "graceful failure"
// requirement this whole package is built around.

import type { MarketingConfig } from "./types";
import { consent } from "./consent";
import { captureAttribution } from "./attribution";
import { mountConsentBanner } from "./consent-banner";
import { registerDestination } from "./events";
import { loadGa4, updateGa4Consent } from "./destinations/ga4";
import { loadMetaPixel } from "./destinations/meta";
import { loadClarity } from "./destinations/clarity";
import { loadLinkedInInsight } from "./destinations/linkedin";

function loadDestinations(config: MarketingConfig): void {
  const analyticsGranted = consent.isGranted("analytics");
  const marketingGranted = consent.isGranted("marketing");

  if (config.ga4MeasurementId && analyticsGranted) {
    loadGa4(config.ga4MeasurementId);
    updateGa4Consent(analyticsGranted, marketingGranted);
    registerDestination("ga4", true);
  }
  if (config.clarityProjectId && analyticsGranted) {
    loadClarity(config.clarityProjectId);
  }
  if (config.metaPixelId && marketingGranted) {
    loadMetaPixel(config.metaPixelId);
    registerDestination("meta", true);
  }
  if (config.linkedinPartnerId && marketingGranted) {
    loadLinkedInInsight(config.linkedinPartnerId);
  }
}

/**
 * Call once, as early as convenient (app entry point). Never throws.
 */
export function initMarketing(config: MarketingConfig): void {
  try {
    captureAttribution();

    if (consent.hasResponded()) {
      loadDestinations(config);
    }

    consent.onChange(() => loadDestinations(config));

    if (config.showConsentBanner !== false) {
      mountConsentBanner();
    }
  } catch {
    // Marketing setup must never block the app from starting.
  }
}
