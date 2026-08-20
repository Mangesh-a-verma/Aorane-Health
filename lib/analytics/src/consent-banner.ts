// ─── Consent banner ────────────────────────────────────────────────────────
//
// Deliberately plain DOM/CSS, not a React component — the two apps that use
// this package (aorane-landing, business-portal) don't currently share a
// UI package, and this way the banner has zero dependency on either app's
// React/Tailwind version. It mounts itself into a container and tears
// itself down on choice; nothing else on the page needs to know it exists.

import { consent } from "./consent";

const BRAND_TEAL = "#00B388";
const BRAND_NAVY = "#0D1B2A";

let mounted = false;

function buildBanner(onChoice: () => void): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Cookie and privacy preferences");
  el.style.cssText = `
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483000;
    background: ${BRAND_NAVY}; color: #fff;
    padding: 16px 20px; display: flex; flex-wrap: wrap; align-items: center;
    justify-content: space-between; gap: 12px;
    box-shadow: 0 -2px 16px rgba(0,0,0,0.25);
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    font-size: 14px; line-height: 1.5;
  `;

  const text = document.createElement("p");
  text.style.cssText = "margin: 0; max-width: 640px; flex: 1 1 320px; opacity: 0.92;";
  text.textContent =
    "We use cookies to understand how Aorane is used and to improve it. Analytics and marketing cookies are off by default — you choose what to allow.";

  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; gap: 8px; flex-wrap: wrap; align-items: center;";

  function makeButton(label: string, variant: "primary" | "ghost"): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    const base = "padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;";
    btn.style.cssText =
      variant === "primary"
        ? `${base} background: ${BRAND_TEAL}; color: #fff; border: none;`
        : `${base} background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.35);`;
    return btn;
  }

  const rejectBtn = makeButton("Necessary only", "ghost");
  rejectBtn.addEventListener("click", () => {
    consent.rejectAll();
    onChoice();
  });

  const acceptBtn = makeButton("Accept all", "primary");
  acceptBtn.addEventListener("click", () => {
    consent.acceptAll();
    onChoice();
  });

  actions.append(rejectBtn, acceptBtn);
  el.append(text, actions);
  return el;
}

/**
 * Shows the banner if the visitor hasn't responded yet. Safe to call
 * multiple times (e.g. on route change) — it only ever mounts once.
 */
export function mountConsentBanner(): void {
  if (mounted || typeof document === "undefined") return;
  if (consent.hasResponded()) return;

  mounted = true;
  const banner = buildBanner(() => {
    banner.remove();
  });
  // Wait for a body to exist rather than assuming script-tag placement.
  if (document.body) {
    document.body.appendChild(banner);
  } else {
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(banner), { once: true });
  }
}
