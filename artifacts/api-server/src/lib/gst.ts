/**
 * Shared GST computation.
 *
 * Two pricing models, used deliberately differently across the platform:
 *
 * 1. INCLUSIVE (computeGstInclusive) — used for individual/App (B2C) pricing.
 *    The displayed price IS the charged price (e.g. ₹199 stays ₹199).
 *    GST is backed out of that number for the invoice/tax records, not
 *    added on top. This matches how Indian consumer subscription pricing
 *    is normally presented — individual consumers can't claim input tax
 *    credit, so an itemized "+18% GST" surcharge only reads as a price
 *    hike, not a benefit. GST is still correctly computed and remitted;
 *    it's just embedded in the sticker price instead of added to it.
 *
 * 2. EXCLUSIVE / add-on (computeGst) — used for Business Portal (B2B)
 *    pricing. The base price is shown, GST is added on top and itemized
 *    (CGST+SGST or IGST) at checkout. This is standard and expected for
 *    B2B — businesses claim the GST back as input tax credit, so an
 *    itemized GST line is a feature, not friction.
 */
export const GST_RATE = 0.18;
export const AORANE_STATE = "UP"; // Aorane's registered state for CGST/SGST vs IGST split

export interface GstBreakdown {
  baseAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isSameState: boolean;
}

/**
 * Computes GST breakdown for a given base (pre-tax) amount.
 * @param baseAmount - amount before tax, in rupees
 * @param buyerState - buyer's state code (2-letter, e.g. "UP", "MH"); if
 *   unknown/undefined, we conservatively treat as different-state (IGST) —
 *   for individual consumers we generally don't collect state, so IGST is
 *   the safe default until/unless billing-address collection is added.
 */
export function computeGst(baseAmount: number, buyerState?: string | null): GstBreakdown {
  const isSameState = !!buyerState && buyerState.toUpperCase() === AORANE_STATE;
  const gstAmount = Math.round(baseAmount * GST_RATE);
  const cgstAmount = isSameState ? Math.round(gstAmount / 2) : 0;
  const sgstAmount = isSameState ? Math.round(gstAmount / 2) : 0;
  const igstAmount = isSameState ? 0 : gstAmount;
  return {
    baseAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: baseAmount + gstAmount,
    isSameState,
  };
}

/**
 * Computes GST breakdown for a GST-INCLUSIVE displayed price — used for
 * individual/App (B2C) pricing. `displayedPrice` is exactly what the user
 * sees and exactly what gets charged; GST is backed out of it for invoicing
 * purposes only, never added on top.
 */
export function computeGstInclusive(displayedPrice: number): GstBreakdown {
  const baseAmount = Math.round((displayedPrice / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((displayedPrice - baseAmount) * 100) / 100;
  return {
    baseAmount,
    gstAmount,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: gstAmount,
    totalAmount: displayedPrice,
    isSameState: false,
  };
}
