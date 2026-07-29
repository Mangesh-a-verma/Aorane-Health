import bcrypt from "bcryptjs";

export async function verifyAndMigratePassword(
  plain: string,
  stored: string,
  updateHash: (h: string) => Promise<void>
): Promise<boolean> {
  // Sirf bcrypt formats ($2b$ ya $2a$) allow karein
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  
  // SHA-256 fallback aur auto-migration security reasons se hata diya gaya hai.
  // Agar password hash bcrypt format mein nahi hai, toh login reject kar dein.
  return false;
}