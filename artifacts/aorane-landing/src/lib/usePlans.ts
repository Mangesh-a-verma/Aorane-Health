import { useEffect, useState } from "react";

// Live plan pricing/features, read from the same `plan_pricing` table the
// admin panel edits and the mobile app + Business Portal already fetch from
// (mobile: GET /plans, Business Portal: GET /business/public/plans). This
// file exists so the landing page's pricing section stops carrying its own
// hardcoded numbers that drift from what's actually billed — see
// PricingSection.tsx, which merges this over its local (visual-only)
// plan definitions.
//
// Same fetch/cache shape as useSiteSettings.ts in this folder.

const API_BASE = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, "")
  : (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type LiveIndividualPlan = {
  planKey: string;
  monthlyPrice: string;
  yearlyPrice: string | null;
  features: string[];
  badgeText: string | null;
  badgeColor: string | null;
};

let individualCache: LiveIndividualPlan[] | null = null;
let individualInflight: Promise<LiveIndividualPlan[]> | null = null;

async function fetchIndividualPlans(): Promise<LiveIndividualPlan[]> {
  if (individualCache) return individualCache;
  if (individualInflight) return individualInflight;
  individualInflight = fetch(`${API_BASE}/api/plans?type=individual`)
    .then((r) => (r.ok ? r.json() : { plans: [] }))
    .then((d) => {
      individualCache = d.plans || [];
      return individualCache as LiveIndividualPlan[];
    })
    .catch(() => [])
    .finally(() => { individualInflight = null; });
  return individualInflight;
}

/** Returns null until the fetch resolves — callers should fall back to their own static data until then. */
export function useIndividualPlans(): LiveIndividualPlan[] | null {
  const [plans, setPlans] = useState<LiveIndividualPlan[] | null>(individualCache);
  useEffect(() => { fetchIndividualPlans().then(setPlans); }, []);
  return plans;
}

export type LiveBusinessPlan = { pricePerSeat: number; yearlyPricePerSeat: number; features: string[] };

let businessCache: Record<string, LiveBusinessPlan> | null = null;
let businessInflight: Promise<Record<string, LiveBusinessPlan>> | null = null;

async function fetchBusinessPlans(): Promise<Record<string, LiveBusinessPlan>> {
  if (businessCache) return businessCache;
  if (businessInflight) return businessInflight;
  businessInflight = fetch(`${API_BASE}/api/business/public/plans`)
    .then((r) => (r.ok ? r.json() : { plans: {} }))
    .then((d) => {
      businessCache = d.plans || {};
      return businessCache as Record<string, LiveBusinessPlan>;
    })
    .catch(() => ({}))
    .finally(() => { businessInflight = null; });
  return businessInflight;
}

/** Keyed by short plan id ("pro", "max") — same keys Business Portal's Landing page already uses. */
export function useBusinessPlans(): Record<string, LiveBusinessPlan> | null {
  const [plans, setPlans] = useState<Record<string, LiveBusinessPlan> | null>(businessCache);
  useEffect(() => { fetchBusinessPlans().then(setPlans); }, []);
  return plans;
}
