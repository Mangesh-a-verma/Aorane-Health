/**
 * Market / region configuration — single source of truth.
 *
 * WHY THIS FILE EXISTS
 * Aorane is launching India-first. Every currency symbol, tax label, and
 * region code the UI shows should be READ from here — never hardcoded as a
 * literal "₹" or "INR" inline in a component. That way, adding a new market
 * later (US, or a generic worldwide/USD tier) is a matter of:
 *   1. Adding a new entry to `MARKETS` below with its own currency/tax rules.
 *   2. Pointing `ACTIVE_MARKET` at it (or wiring up real market detection).
 * No component code needs to change, and no one has to grep the repo for
 * every stray "₹" when that day comes.
 *
 * CURRENT STATE (India launch)
 * `ACTIVE_MARKET` is hardcoded to "IN". There is deliberately no runtime
 * market-detection logic yet (geo-IP, Accept-Language, etc.) — that's a
 * decision to make when a second market actually goes live, not before.
 * When that happens, replace the hardcoded `ACTIVE_MARKET` export with a
 * `getActiveMarket()` resolver (e.g. based on domain, user setting, or
 * geo-IP) without touching any of the formatting helpers below.
 */

export type MarketCode = "IN";
// When a second market launches, extend this union, e.g.:
// export type MarketCode = "IN" | "US" | "GLOBAL";

export interface TaxRule {
  /** Display label, e.g. "GST", "VAT". */
  label: string;
  /** Percentage rate applied on top of listed prices. */
  ratePercent: number;
  /** Whether the rate is already included in the displayed price. */
  includedInPrice: boolean;
}

export interface MarketConfig {
  code: MarketCode;
  /** ISO 4217 currency code, used in JSON-LD `priceCurrency` and og/meta text. */
  currencyCode: string;
  /** Symbol shown in the UI, e.g. "₹", "$". */
  currencySymbol: string;
  /** BCP-47 locale used for number formatting (toLocaleString). */
  numberLocale: string;
  /** schema.org Organization/Offer `areaServed` value. */
  areaServed: string;
  /** html lang / og:locale style tag, e.g. "en-IN". */
  htmlLang: string;
  tax: TaxRule | null;
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  IN: {
    code: "IN",
    currencyCode: "INR",
    currencySymbol: "₹",
    numberLocale: "en-IN",
    areaServed: "IN",
    htmlLang: "en-IN",
    tax: { label: "GST", ratePercent: 18, includedInPrice: false },
  },
  // Add future markets here, e.g.:
  // US: {
  //   code: "US",
  //   currencyCode: "USD",
  //   currencySymbol: "$",
  //   numberLocale: "en-US",
  //   areaServed: "US",
  //   htmlLang: "en-US",
  //   tax: null,
  // },
};

/** The market this build currently serves. India-first launch. */
export const ACTIVE_MARKET: MarketConfig = MARKETS.IN;

/** Format a plain number amount using the active market's currency + locale. */
export function formatPrice(amount: number, market: MarketConfig = ACTIVE_MARKET): string {
  return `${market.currencySymbol}${amount.toLocaleString(market.numberLocale)}`;
}

/** Standard one-line tax disclaimer for pricing sections, or "" if the market has no tax rule. */
export function taxDisclaimer(market: MarketConfig = ACTIVE_MARKET): string {
  if (!market.tax) return `Prices in ${market.currencyCode}.`;
  return `Prices in ${market.currencyCode}. ${market.tax.label} @${market.tax.ratePercent}% extra on paid plans.`;
}
