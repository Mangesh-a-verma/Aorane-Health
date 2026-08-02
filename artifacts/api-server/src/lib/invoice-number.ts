import { pool } from "@workspace/db";

/**
 * ISSUE 4 FIX: returns a guaranteed-unique, guaranteed-sequential invoice
 * number in the format AOR/{financial-year}/{seq}, backed by a Postgres
 * SEQUENCE (invoice_number_seq, created in migrate.ts). Replaces the old
 * Math.random()-based generation, which could produce duplicate numbers
 * across different invoices — a GST Rule 46 compliance violation.
 *
 * Call this ONLY at the point an invoice is actually being finalized
 * (payment success), not at order-preview time — this keeps the sequence
 * tightly correlated with real invoices instead of burning numbers on
 * orders that never complete.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const fy = new Date().getMonth() >= 3
    ? `${year}-${String(year + 1).slice(2)}`
    : `${year - 1}-${String(year).slice(2)}`;
  const { rows } = await pool.query<{ nextval: string }>(`SELECT nextval('invoice_number_seq')`);
  return `AOR/${fy}/${rows[0]!.nextval}`;
}
