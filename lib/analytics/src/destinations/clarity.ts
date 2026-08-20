// ─── Microsoft Clarity ─────────────────────────────────────────────────────
// Session-replay/heatmap tool — gated on "analytics" consent (not
// "marketing": it's understanding on-site behaviour, not ad targeting).
// Loaded only if a project ID is configured.

declare global {
  interface Window {
    clarity?: ClarityFunction;
  }
}

type ClarityFunction = {
  (...args: unknown[]): void;
  q?: unknown[];
};

let loaded = false;

export function loadClarity(projectId: string): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;

  (function initClarityStub(w: Window) {
    const c: ClarityFunction = function (...args: unknown[]) {
      c.q = c.q || [];
      c.q.push(args);
    };
    w.clarity = w.clarity || c;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
    document.head.appendChild(script);
  })(window);
}
