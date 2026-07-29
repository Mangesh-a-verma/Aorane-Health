import { useEffect, useState } from "react";

export type SiteSettings = {
  companyName?: string;
  socialTwitter?: string | null;
  socialLinkedin?: string | null;
  socialInstagram?: string | null;
  socialYoutube?: string | null;
  socialFacebook?: string | null;
  investorDeckUrl?: string | null;
  androidPlayStoreUrl?: string | null;
  iosAppStoreUrl?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

const API_BASE = import.meta.env.VITE_API_URL
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/$/, "")}`
  : "";

let cached: SiteSettings | null = null;
let inflight: Promise<SiteSettings> | null = null;

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch(`${API_BASE}/api/settings/company`)
    .then((r) => (r.ok ? r.json() : { settings: {} }))
    .then((d) => { cached = d.settings || {}; return cached as SiteSettings; })
    .catch(() => ({} as SiteSettings))
    .finally(() => { inflight = null; });
  return inflight;
}

export function useSiteSettings(): SiteSettings {
  const [s, setS] = useState<SiteSettings>(cached || {});
  useEffect(() => { fetchSiteSettings().then(setS); }, []);
  return s;
}

export function postEnquiry(payload: {
  type: "expert" | "investor_deck" | "general";
  name: string; email: string;
  mobile?: string; city?: string; accountType?: string; companyName?: string;
  message?: string; source?: string;
}): Promise<{ success: boolean; downloadUrl?: string | null; error?: string }> {
  return fetch(`${API_BASE}/api/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { success: false, error: d.error || "Submit failed" };
    return d;
  }).catch(() => ({ success: false, error: "Network error" }));
}
