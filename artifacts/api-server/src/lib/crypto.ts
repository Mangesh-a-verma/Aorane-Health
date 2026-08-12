/**
 * Encrypts/decrypts secrets stored at rest in the database — currently used
 * for `ai_config.api_key` and `ai_config.fallback_api_key` (Admin Panel >
 * AI Configuration per-feature key overrides).
 *
 * PHASE 3 — API key encryption at rest:
 * Previously these columns were stored (and returned to the admin-panel
 * frontend) as plain, readable text — visible in the database, in server
 * logs of any query that touched the row, and in the browser's DevTools
 * Network tab every time the AI Config page loaded. This module fixes the
 * at-rest half of that; see routes/modules/admin.ts for the "never send
 * the real key back to the browser" half.
 *
 * AES-256-GCM, random 12-byte IV per value, auth tag verified on decrypt
 * (so a corrupted/tampered ciphertext throws instead of silently returning
 * garbage). The encryption key itself is derived (SHA-256) from the
 * AI_CONFIG_ENCRYPTION_KEY env var — set this once on Render and keep it
 * secret; losing it makes every already-encrypted key unrecoverable.
 *
 * Backward compatibility: values written before this change are plain,
 * un-prefixed text. `decryptSecret` detects the "enc:v1:" prefix this
 * module writes and, if a stored value doesn't have it, returns it
 * unchanged (treats it as legacy plaintext) rather than erroring — so
 * existing configured keys keep working with zero manual migration. The
 * next time an admin re-saves that feature, `encryptSecret` runs on write
 * and the value becomes encrypted from then on.
 */

import crypto from "node:crypto";
import { logger } from "./logger";

const ENC_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

let cachedKey: Buffer | null = null;
let warnedMissingKey = false;

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY;
  if (!secret) {
    if (!warnedMissingKey) {
      logger.warn(
        "[crypto] AI_CONFIG_ENCRYPTION_KEY not set — AI provider API keys " +
        "saved from Admin Panel will be stored in PLAINTEXT. Set this env " +
        "var (e.g. `openssl rand -hex 32`) before storing any per-feature " +
        "API key overrides.",
      );
      warnedMissingKey = true;
    }
    return null;
  }
  cachedKey = crypto.createHash("sha256").update(secret).digest();
  return cachedKey;
}

/** Encrypts a secret for storage. Returns the plaintext UNCHANGED (with a
 * warning already logged once) if AI_CONFIG_ENCRYPTION_KEY isn't set —
 * callers don't need special-case handling either way. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ENC_PREFIX + [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

/** Decrypts a value previously written by encryptSecret. Legacy (pre-Phase-3)
 * plaintext values — anything without the "enc:v1:" prefix — are returned
 * unchanged. Throws if a value LOOKS encrypted but fails to decrypt (wrong
 * key, corrupted data, or tampering) rather than silently returning garbage
 * that would then get sent to an AI provider as an "API key". */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const key = getKey();
  if (!key) {
    throw new Error(
      "Stored value is encrypted but AI_CONFIG_ENCRYPTION_KEY is not set — cannot decrypt. " +
      "Set the same AI_CONFIG_ENCRYPTION_KEY that was used when this value was saved.",
    );
  }

  const [ivB64, authTagB64, ciphertextB64] = stored.slice(ENC_PREFIX.length).split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Stored value has the encrypted-value prefix but is malformed.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Safe last-4-chars preview for displaying "which key is configured"
 * in the admin panel WITHOUT ever sending the real key to the browser. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return "••••" + plaintext.slice(-4);
}
