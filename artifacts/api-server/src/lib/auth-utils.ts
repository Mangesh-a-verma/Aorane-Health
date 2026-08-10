import bcrypt from "bcryptjs";

export async function verifyAndMigratePassword(
  plain: string,
  stored: string,
  updateHash: (h: string) => Promise<void>
): Promise<boolean> {
  // Only allow bcrypt formats ($2b$ or $2a$)
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  
  // SHA-256 fallback and auto-migration have been removed for security reasons.
  // If the stored hash is not in bcrypt format, reject the login.
  return false;
}