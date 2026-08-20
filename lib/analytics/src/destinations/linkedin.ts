// ─── LinkedIn Insight Tag ──────────────────────────────────────────────────
// B2B-only — used on the business portal/landing, never on the consumer
// app, since it's for tracking company decision-makers, not individual
// health-app users. Gated on "marketing" consent, only loads if a partner
// ID is configured.

declare global {
  interface Window {
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    lintrk?: LintrkFunction;
  }
}

type LintrkFunction = {
  (...args: unknown[]): void;
  q?: unknown[];
};

let loaded = false;

export function loadLinkedInInsight(partnerId: string): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;

  window._linkedin_partner_id = partnerId;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(partnerId);

  if (!window.lintrk) {
    const lintrk: LintrkFunction = function (...args: unknown[]) {
      lintrk.q = lintrk.q || [];
      lintrk.q.push(args);
    };
    window.lintrk = lintrk;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
  document.head.appendChild(script);
}

export function trackLinkedInConversion(conversionId: string): void {
  try {
    window.lintrk?.("track", { conversion_id: conversionId });
  } catch {
    // Never let a broken tracker take down the calling code path.
  }
}
