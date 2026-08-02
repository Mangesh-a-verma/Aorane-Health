import { pool } from "@workspace/db";
import { logger } from "./logger";

export type AdminNotifType =
  | "new_payment"
  | "new_blood_emergency"
  | "new_enquiry"
  | "new_support_ticket"
  | "reconciliation_mismatch"
  | "refund_processed";

export async function createAdminNotif(
  type: AdminNotifType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, data)
       VALUES ($1, $2, $3, $4)`,
      [type, title, message, data ? JSON.stringify(data) : null]
    );
  } catch (e) {
    logger.warn({ err: (e as Error).message, type }, "createAdminNotif failed (non-fatal)");
  }
}
