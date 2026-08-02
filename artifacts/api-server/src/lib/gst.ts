/**
 * ISSUE 5 FIX: shared GST computation — previously only the Business Portal
 * (org seat-based recurring flow) computed GST; the App's individual-user
 * payments charged the base plan price with NO GST added at all, despite
 * the pricing page explicitly stating "GST @18% extra on paid plans" for
 * individual plans too. This is now a single source of truth both payment
 * flows use, so they can't drift out of sync with each other.
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
