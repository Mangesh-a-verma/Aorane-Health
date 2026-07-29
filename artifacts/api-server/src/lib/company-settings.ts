import { db, companySettingsTable } from "@workspace/db";

/**
 * Company / legal details used across all outgoing emails (welcome, payment,
 * invoice, corporate report).
 *
 * These are read from the `company_settings` DB table, which is editable
 * from Admin Panel → Settings → Company. This means once the company is
 * formally registered and someone fills in the legal name, GSTIN, CIN, PAN,
 * and registered address there, EVERY email automatically picks up the new
 * values on the next send — no code changes needed here.
 *
 * Until that row is filled in, sensible non-legal-claiming defaults are used
 * (e.g. "Aorane" rather than assuming a "Pvt. Ltd." suffix that may not be
 * accurate yet).
 */
export interface CompanyDetails {
  companyName: string;
  gstin: string | null;
  cin: string | null;
  pan: string | null;
  address: string | null;
  registeredAddress: string | null;
  city: string | null;
  state: string | null;
  country: string;
}

const DEFAULTS: CompanyDetails = {
  companyName: "Aorane",
  gstin: null,
  cin: null,
  pan: null,
  address: "Uttar Pradesh, India",
  registeredAddress: null,
  city: null,
  state: "Uttar Pradesh",
  country: "India",
};

let cache: { value: CompanyDetails; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — company details change rarely

export async function getCompanyDetails(): Promise<CompanyDetails> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    const rows = await db.select().from(companySettingsTable).limit(1);
    const row = rows[0];
    const value: CompanyDetails = row
      ? {
          companyName: row.companyName || DEFAULTS.companyName,
          gstin: row.gstin || null,
          cin: row.cin || null,
          pan: row.pan || null,
          address: row.address || DEFAULTS.address,
          registeredAddress: row.registeredAddress || null,
          city: row.city || null,
          state: row.state || DEFAULTS.state,
          country: row.country || DEFAULTS.country,
        }
      : { ...DEFAULTS };

    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    console.error("[CompanyDetails] Failed to load company_settings, using defaults:", err);
    return { ...DEFAULTS };
  }
}

/** A short "Company · State, Country" line for email footers. */
export function formatFooterLine(c: CompanyDetails): string {
  const location = c.city ? `${c.city}, ${c.state || c.country}` : c.address || `${c.state}, ${c.country}`;
  return `${c.companyName} · ${location}`;
}
