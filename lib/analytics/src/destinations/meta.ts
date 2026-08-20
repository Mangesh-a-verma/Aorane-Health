// ─── Meta Pixel ────────────────────────────────────────────────────────────
// Loads fbevents.js only after "marketing" consent is granted and only if a
// pixel ID is configured. Client-side pixel only — server-side Conversions
// API (for revenue events fired off the payment webhook, which don't rely
// on the browser at all) is a backend concern and lives in the API server,
// not here.

import type { EventProperties } from "../types";

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: unknown;
  }
}

type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
};

let loaded = false;

export function loadMetaPixel(pixelId: string): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;

  const fbq: FbqFunction = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue = fbq.queue || [];
      fbq.queue.push(args);
    }
  };
  fbq.loaded = true;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");
}

export function trackMetaPixel(eventName: string, properties: EventProperties): void {
  try {
    window.fbq?.("trackCustom", eventName, properties);
  } catch {
    // Never let a broken tracker take down the calling code path.
  }
}
