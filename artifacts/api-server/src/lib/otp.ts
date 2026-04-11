import crypto from "crypto";

export function generateOtp(length = 6): string {
  const digits = "0123456789";
  let otp = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  const computed = hashOtp(otp);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

export async function sendSmsOtp(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn("FAST2SMS_API_KEY not set — OTP not sent:", otp);
    return true;
  }
  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=otp&variables_values=${otp}&flash=0&numbers=${phone}`;
    const res = await fetch(url);
    const data = await res.json() as { return: boolean };
    return data.return === true;
  } catch {
    console.error("Fast2SMS error sending to", phone);
    return false;
  }
}

export async function sendWhatsappOtp(phone: string, otp: string): Promise<{ success: boolean; fallback?: boolean }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn("FAST2SMS_API_KEY not set — WhatsApp OTP not sent:", otp);
    return { success: true };
  }
  try {
    const message = encodeURIComponent(`Aapka AORANE OTP hai: *${otp}*\n\nYeh code 5 minute mein expire ho jaayega.\nKisi ke saath share mat karein.\n\n- Team AORANE`);
    const url = `https://www.fast2sms.com/dev/wa?authorization=${apiKey}&message=${message}&language=english&route=q&numbers=${phone}`;
    const res = await fetch(url);
    const data = await res.json() as { return: boolean; message?: string[] };
    if (data.return === true) {
      return { success: true };
    }
    // WhatsApp failed — try SMS fallback
    console.warn("Fast2SMS WhatsApp failed, falling back to SMS:", data.message);
    const smsSent = await sendSmsOtp(phone, otp);
    return { success: smsSent, fallback: true };
  } catch {
    console.error("WhatsApp OTP error, falling back to SMS for", phone);
    const smsSent = await sendSmsOtp(phone, otp);
    return { success: smsSent, fallback: true };
  }
}
