import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function verifyAndMigratePassword(
  plain: string,
  stored: string,
  updateHash: (h: string) => Promise<void>
): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  const sha = crypto.createHash("sha256").update(plain).digest("hex");
  if (sha !== stored) return false;
  const newHash = await bcrypt.hash(plain, 12);
  await updateHash(newHash);
  return true;
}
