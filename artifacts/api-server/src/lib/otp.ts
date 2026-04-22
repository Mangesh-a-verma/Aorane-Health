import crypto from "crypto";
import { Resend } from "resend";

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
      Body: `Your Aorane OTP is: ${otp}\n\nValid for 5 minutes. Do not share with anyone.\n- Team Aorane`,
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

export async function sendEmailOtp(email: string, otp: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "support@aorane.com";
  if (!apiKey) {
    console.warn("[Email OTP] RESEND_API_KEY not set — skipping email send");
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `Aorane <${fromEmail}>`,
      to: [email],
      subject: `${otp} — Your Aorane Login OTP`,
      html: `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:22px;font-weight:800;color:#005d90;margin:0;letter-spacing:-0.02em;">Aorane</h1>
            <p style="font-size:12px;color:#9ca3af;margin:4px 0 0;">Your Health, In Your Hands 🇮🇳</p>
          </div>
          <div style="background:white;border-radius:14px;padding:28px;border:1.5px solid #e5e7eb;text-align:center;">
            <p style="font-size:14px;color:#374151;margin:0 0 16px;">Your login OTP is:</p>
            <div style="font-size:48px;font-weight:900;letter-spacing:14px;color:#005d90;margin:0 0 16px;font-family:monospace;">${otp}</div>
            <p style="font-size:12px;color:#6b7280;margin:0 0 8px;">This OTP expires in <strong>5 minutes</strong>.</p>
            <p style="font-size:12px;color:#ef4444;margin:0;">Do not share this with anyone.</p>
          </div>
          <p style="font-size:11px;color:#9ca3af;text-align:center;margin:20px 0 0;">
            If you did not request this, please ignore this email.<br/>
            &copy; ${new Date().getFullYear()} Aorane
          </p>
        </div>
      `,
    });
    if (error) {
      console.warn("[Email OTP] Resend error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email OTP] Failed:", err);
    return false;
  }
}

export async function sendWhatsappOtp(phone: string, otp: string): Promise<{ success: boolean; fallback?: boolean }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    const smsSent = await sendSmsOtp(phone, otp);
    return { success: smsSent, fallback: true };
  }
  try {
    const message = encodeURIComponent(`Your Aorane OTP is: *${otp}*\n\nThis code expires in 5 minutes.\nDo not share it with anyone.\n\n- Team Aorane`);
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
