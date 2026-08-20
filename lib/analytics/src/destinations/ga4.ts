// ─── Google Analytics 4 ────────────────────────────────────────────────────
// Loads gtag.js only once, only after marketing/analytics consent is
// granted and only if a measurement ID is configured. IP anonymization and
// Google Signals are left at GA4's current defaults; ad personalization
// signals are only sent once "marketing" consent (not just "analytics") is
// granted, via Google's own consent mode so GA4 itself respects the choice
// as a second layer of protection on top of us never loading it early.

import type { EventProperties } from "../types";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

export function loadGa4(measurementId: string): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("config", measurementId, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

export function updateGa4Consent(analyticsGranted: boolean, marketingGranted: boolean): void {
  window.gtag?.("consent", "update", {
    analytics_storage: analyticsGranted ? "granted" : "denied",
    ad_storage: marketingGranted ? "granted" : "denied",
    ad_user_data: marketingGranted ? "granted" : "denied",
    ad_personalization: marketingGranted ? "granted" : "denied",
  });
}

export function trackGa4(eventName: string, properties: EventProperties): void {
  try {
    window.gtag?.("event", eventName, properties);
  } catch {
    // Never let a broken tracker take down the calling code path.
  }
}
