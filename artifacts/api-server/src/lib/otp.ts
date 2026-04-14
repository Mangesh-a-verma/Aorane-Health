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

async function sendViaTwilio(phone: string, otp: string): Promise<boolean> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;

  try {
    const body = new URLSearchParams({
      To:   `+91${phone}`,
      From: from,
      Body: `Your AORANE OTP is: ${otp}\n\nValid for 5 minutes. Do not share with anyone.\n- Team AORANE`,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method:  "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type":  "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );
    const data = await res.json() as { sid?: string; status?: string; error_message?: string };
    if (data.sid) {
      console.log("Twilio SMS sent:", data.sid, "status:", data.status);
      return true;
    }
    console.warn("Twilio error:", data.error_message);
    return false;
  } catch (err) {
    console.error("Twilio fetch error:", err);
    return false;
  }
}

async function sendViaFast2Sms(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return false;
  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=otp&variables_values=${otp}&flash=0&numbers=${phone}`;
    const res  = await fetch(url);
    const data = await res.json() as { return: boolean };
    return data.return === true;
  } catch {
    console.error("Fast2SMS error sending to", phone);
    return false;
  }
}

export async function sendSmsOtp(phone: string, otp: string): Promise<boolean> {
  const twilioOk = await sendViaTwilio(phone, otp);
  if (twilioOk) return true;

  const fast2Ok = await sendViaFast2Sms(phone, otp);
  if (fast2Ok) return true;

  console.warn("All SMS providers failed — devOtp:", otp);
  return false;
}

export async function sendWhatsappOtp(phone: string, otp: string): Promise<{ success: boolean; fallback?: boolean }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    const smsSent = await sendSmsOtp(phone, otp);
    return { success: smsSent, fallback: true };
  }
  try {
    const message = encodeURIComponent(`Aapka AORANE OTP hai: *${otp}*\n\nYeh code 5 minute mein expire ho jaayega.\nKisi ke saath share mat karein.\n\n- Team AORANE`);
    const url     = `https://www.fast2sms.com/dev/wa?authorization=${apiKey}&message=${message}&language=english&route=q&numbers=${phone}`;
    const res     = await fetch(url);
    const data    = await res.json() as { return: boolean; message?: string[] };
    if (data.return === true) return { success: true };
    console.warn("Fast2SMS WhatsApp failed, trying SMS fallback:", data.message);
    const smsSent = await sendSmsOtp(phone, otp);
    return { success: smsSent, fallback: true };
  } catch {
    console.error("WhatsApp OTP error, falling back to SMS for", phone);
    const smsSent = await sendSmsOtp(phone, otp);
    return { success: smsSent, fallback: true };
  }
}
