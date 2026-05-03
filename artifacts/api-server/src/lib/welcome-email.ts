import { Resend } from "resend";

const FROM_EMAIL = "Aorane <support@aorane.com>";
const SUPPORT_EMAIL = "support@aorane.com";
const APP_STORE_URL = "https://play.google.com/store/apps/details?id=com.aorane.app";

// ─── Beautiful HTML Welcome Email ─────────────────────────────────────────────
function buildWelcomeHtml(name: string): string {
  const firstName = name?.trim().split(" ")[0] || "there";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Aorane!</title>
</head>
<body style="margin:0;padding:0;background:#f0f7ff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,119,182,0.10);">

    <!-- Header Gradient -->
    <div style="background:linear-gradient(135deg,#0077B6 0%,#023E8A 60%,#1B998B 100%);padding:48px 40px 40px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>
      <div style="position:absolute;bottom:-60px;left:-30px;width:140px;height:140px;background:rgba(255,255,255,0.04);border-radius:50%;"></div>
      <div style="font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;margin-bottom:4px;">AORANE</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:0.05em;">YOUR HEALTH, IN YOUR HANDS 🇮🇳</div>
      <div style="margin-top:28px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">
        Welcome, ${firstName}! 👋
      </div>
      <div style="margin-top:10px;font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;max-width:400px;margin-left:auto;margin-right:auto;">
        You've just joined India's most loved health & wellness platform. Apka health journey shuru ho gaya hai!
      </div>
    </div>

    <!-- Main Content -->
    <div style="padding:40px 40px 32px;">

      <!-- Getting Started -->
      <div style="margin-bottom:32px;">
        <div style="font-size:16px;font-weight:700;color:#0d1f33;margin-bottom:16px;">Shuru kahan se karein? 🚀</div>
        <div style="display:grid;gap:12px;">

          <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#f0f9ff;border-radius:14px;border:1px solid #bae6fd;">
            <div style="font-size:28px;flex-shrink:0;">🍎</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0d1f33;margin-bottom:3px;">Food Tracker</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">Apna khana log karo — calories, protein, carbs sab track hoga AI se.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#f0fdf4;border-radius:14px;border:1px solid #bbf7d0;">
            <div style="font-size:28px;flex-shrink:0;">💧</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0d1f33;margin-bottom:3px;">Water Tracker</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">Pani peene ki reminder aur daily goal track karo.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#fdf4ff;border-radius:14px;border:1px solid #e9d5ff;">
            <div style="font-size:28px;flex-shrink:0;">🧘</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0d1f33;margin-bottom:3px;">Stress Tracker</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">5-Pillar assessment se apna stress level check karo aur AI tips pao.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#fff7ed;border-radius:14px;border:1px solid #fed7aa;">
            <div style="font-size:28px;flex-shrink:0;">🏃</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0d1f33;margin-bottom:3px;">Exercise Log</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;">Workout track karo aur apna fitness score badhao.</div>
            </div>
          </div>

        </div>
      </div>

      <!-- Health Score Banner -->
      <div style="background:linear-gradient(135deg,#0077B6,#023E8A);border-radius:16px;padding:24px;margin-bottom:32px;text-align:center;">
        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-bottom:8px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Aapka Aorane Health Score</div>
        <div style="font-size:48px;font-weight:900;color:#ffffff;line-height:1;">0</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:6px;">App use karo — score automatically update hoga!</div>
        <div style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.9);">
          💡 <strong>Tip:</strong> Roz ek baar food, water aur exercise log karo — score 100 tak le jao!
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${APP_STORE_URL}" style="display:inline-block;background:linear-gradient(135deg,#0077B6,#023E8A);color:#ffffff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:50px;text-decoration:none;letter-spacing:0.01em;box-shadow:0 4px 16px rgba(0,119,182,0.35);">
          📱 App Kholo &amp; Track Karo
        </a>
        <div style="margin-top:10px;font-size:11px;color:#9ca3af;">Android · iOS · Web — sabpe available</div>
      </div>

      <!-- Divider -->
      <div style="border-top:1.5px solid #f3f4f6;margin-bottom:24px;"></div>

      <!-- Help -->
      <div style="text-align:center;">
        <div style="font-size:13px;color:#6b7280;line-height:1.7;">
          Koi sawal? Hum yahan hain! 😊<br/>
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a> pe mail karo.
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #f3f4f6;padding:24px 40px;text-align:center;">
      <div style="font-size:14px;font-weight:800;color:#0d1f33;letter-spacing:-0.02em;margin-bottom:6px;">AORANE</div>
      <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
        Aorane Health Technologies Pvt. Ltd., Uttar Pradesh, India<br/>
        &copy; ${year} Aorane. All rights reserved.<br/>
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </div>
    </div>

  </div>
</body>
</html>`;
}

// ─── Business Welcome Email ────────────────────────────────────────────────────
function buildBusinessWelcomeHtml(adminName: string, orgName: string, orgCode: string): string {
  const firstName = adminName?.trim().split(" ")[0] || "there";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Aorane Business!</title>
</head>
<body style="margin:0;padding:0;background:#f0f7ff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,119,182,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0077B6 0%,#023E8A 60%,#1B998B 100%);padding:48px 40px 40px;text-align:center;">
      <div style="font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;margin-bottom:4px;">AORANE</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">Business Portal</div>
      <div style="margin-top:28px;font-size:26px;font-weight:800;color:#ffffff;">Welcome, ${firstName}! 🎉</div>
      <div style="margin-top:10px;font-size:13px;color:rgba(255,255,255,0.85);">
        <strong>${orgName}</strong> ab Aorane Business par hai!
      </div>
    </div>

    <!-- Content -->
    <div style="padding:40px;">

      <div style="background:#f0f9ff;border-radius:16px;padding:24px;margin-bottom:28px;border:1.5px solid #bae6fd;text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#0077B6;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Aapka Org Code</div>
        <div style="font-size:32px;font-weight:900;color:#023E8A;letter-spacing:0.15em;font-family:monospace;">${orgCode}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:8px;">Ye code apne employees ko share karo — woh Aorane app mein join kar sakte hain.</div>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;font-weight:700;color:#0d1f33;margin-bottom:12px;">Next Steps 👇</div>
        ${[
          ["1️⃣", "Business Portal login karo", "Billing section se plan activate karo"],
          ["2️⃣", "Enrollment Codes banao", "Employees ke liye specific codes generate karo"],
          ["3️⃣", "Org Code share karo", `Code: <strong style="font-family:monospace;color:#0077B6;">${orgCode}</strong> — employees Aorane app → Profile → Join Organization mein enter karein`],
          ["4️⃣", "Dashboard dekho", "Real-time team health analytics, stress levels, activity scores"],
        ].map(([num, title, desc]) => `
          <div style="display:flex;gap:14px;padding:14px;background:#f8fafc;border-radius:12px;margin-bottom:10px;">
            <div style="font-size:20px;flex-shrink:0;">${num}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0d1f33;">${title}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:3px;line-height:1.5;">${desc}</div>
            </div>
          </div>
        `).join("")}
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://aorane.in/business-portal" style="display:inline-block;background:linear-gradient(135deg,#0077B6,#023E8A);color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:50px;text-decoration:none;box-shadow:0 4px 16px rgba(0,119,182,0.3);">
          🏢 Business Portal Kholo
        </a>
      </div>

      <div style="text-align:center;font-size:12px;color:#6b7280;line-height:1.7;">
        Help chahiye? <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a> pe mail karo.
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #f3f4f6;padding:20px 40px;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
        &copy; ${year} Aorane Health Technologies Pvt. Ltd. · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Individual Payment Welcome Email ─────────────────────────────────────────
function buildIndividualPaymentWelcomeHtml(
  name: string,
  aoraneId: string,
  planName: string,
  amountPaid: number,
  expiresAt: Date,
): string {
  const firstName = name?.trim().split(" ")[0] || "there";
  const year = new Date().getFullYear();
  const expiryStr = expiresAt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const amountStr = "₹" + amountPaid.toLocaleString("en-IN");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Successful — Aorane</title>
</head>
<body style="margin:0;padding:0;background:#f0f7ff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,119,182,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0077B6 0%,#023E8A 60%,#1B998B 100%);padding:48px 40px 36px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>
      <div style="position:absolute;bottom:-50px;left:-20px;width:120px;height:120px;background:rgba(255,255,255,0.04);border-radius:50%;"></div>
      <div style="font-size:52px;margin-bottom:12px;">✅</div>
      <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;margin-bottom:4px;">AORANE</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;">YOUR HEALTH, IN YOUR HANDS 🇮🇳</div>
      <div style="font-size:22px;font-weight:800;color:#ffffff;">Payment Successful! 🎉</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:8px;">Congratulations, ${firstName}! Aapka ${planName} plan active ho gaya hai.</div>
    </div>

    <!-- Content -->
    <div style="padding:40px 40px 32px;">

      <!-- Payment Summary -->
      <div style="background:#f0f9ff;border-radius:16px;padding:24px;margin-bottom:28px;border:1.5px solid #bae6fd;">
        <div style="font-size:12px;font-weight:700;color:#0077B6;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">Payment Summary</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:13px;color:#6b7280;">Plan</span>
          <span style="font-size:13px;font-weight:700;color:#0d1f33;">${planName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:13px;color:#6b7280;">Amount Paid</span>
          <span style="font-size:13px;font-weight:700;color:#059669;">${amountStr}</span>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #e0f2fe;padding-top:10px;margin-top:4px;">
          <span style="font-size:13px;color:#6b7280;">Valid Until</span>
          <span style="font-size:13px;font-weight:700;color:#0d1f33;">${expiryStr}</span>
        </div>
      </div>

      <!-- Aorane ID Box -->
      <div style="background:linear-gradient(135deg,#023E8A,#0077B6);border-radius:16px;padding:28px;margin-bottom:28px;text-align:center;">
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Aapka Aorane ID</div>
        <div style="font-size:34px;font-weight:900;color:#ffffff;letter-spacing:0.15em;font-family:monospace;">${aoraneId}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:10px;line-height:1.6;">Ye aapka unique health identity hai. App ke Profile section mein milega.<br/>Emergency mein doctor ko dikhayein.</div>
      </div>

      <!-- What's Included -->
      <div style="margin-bottom:28px;">
        <div style="font-size:14px;font-weight:700;color:#0d1f33;margin-bottom:14px;">${planName} mein kya milega? 🚀</div>
        <div style="display:grid;gap:10px;">
          ${[
            ["🍎", "Advanced Nutrition Tracking", "Calories, Protein, Carbs, Fiber — plus Calcium, Iron, B12, Vit C & D (ICMR RDA 2024)"],
            ["🏃", "Exercise & MET Tracking", "WHO-standard MET-minute scoring, workout logs, activity goals"],
            ["💧", "Smart Water Intake", "Activity-adjusted daily goals, 2000–3000 ml tracking"],
            ["💊", "Medicine Adherence", "WHO protocol — daily dose reminders & compliance tracking"],
            ["😴", "Sleep Quality Monitor", "CDC/WHO 7–9h optimal sleep scoring"],
            ["⚖️", "BMI (Asia-Pacific)", "India-calibrated BMI with body composition analysis"],
            ["🧘", "Stress Assessment", "5-Pillar model — AI tips & mental wellness guidance"],
            ["⭐", "Daily Health Score", "100-point scientific score across all 6 health parameters"],
          ].map(([emoji, title, desc]) => `
            <div style="display:flex;align-items:flex-start;gap:14px;padding:13px;background:#f8fafc;border-radius:12px;">
              <div style="font-size:22px;flex-shrink:0;">${emoji}</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#0d1f33;margin-bottom:2px;">${title}</div>
                <div style="font-size:11px;color:#6b7280;line-height:1.5;">${desc}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${APP_STORE_URL}" style="display:inline-block;background:linear-gradient(135deg,#0077B6,#023E8A);color:#ffffff;font-size:15px;font-weight:700;padding:16px 44px;border-radius:50px;text-decoration:none;box-shadow:0 4px 16px rgba(0,119,182,0.35);">
          📱 App Kholo — Start Tracking
        </a>
        <div style="margin-top:10px;font-size:11px;color:#9ca3af;">Android · iOS · Web — sabpe available</div>
      </div>

      <div style="border-top:1.5px solid #f3f4f6;padding-top:20px;text-align:center;">
        <div style="font-size:13px;color:#6b7280;line-height:1.7;">
          Koi sawal? <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a> pe mail karo.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #f3f4f6;padding:20px 40px;text-align:center;">
      <div style="font-size:14px;font-weight:800;color:#0d1f33;margin-bottom:4px;">AORANE</div>
      <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
        Aorane Health Technologies Pvt. Ltd., Uttar Pradesh, India<br/>
        &copy; ${year} Aorane. All rights reserved. · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Corporate Payment Welcome Email ──────────────────────────────────────────
function buildCorporatePaymentWelcomeHtml(
  adminName: string,
  orgName: string,
  orgCode: string,
  planName: string,
  seats: number,
  amountPaid: number,
  expiresAt: Date,
): string {
  const firstName = adminName?.trim().split(" ")[0] || "there";
  const year = new Date().getFullYear();
  const expiryStr = expiresAt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const amountStr = "₹" + amountPaid.toLocaleString("en-IN");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plan Activated — Aorane Business</title>
</head>
<body style="margin:0;padding:0;background:#f0f7ff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,119,182,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0077B6 0%,#023E8A 60%,#1B998B 100%);padding:48px 40px 36px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>
      <div style="font-size:52px;margin-bottom:12px;">🏢</div>
      <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;margin-bottom:2px;">AORANE</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:18px;">Business Portal</div>
      <div style="font-size:22px;font-weight:800;color:#ffffff;">Plan Activated! 🎉</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:8px;"><strong>${orgName}</strong> ka ${planName} plan active ho gaya, ${firstName}!</div>
    </div>

    <!-- Content -->
    <div style="padding:40px 40px 32px;">

      <!-- Payment Summary -->
      <div style="background:#f0f9ff;border-radius:16px;padding:22px;margin-bottom:24px;border:1.5px solid #bae6fd;">
        <div style="font-size:12px;font-weight:700;color:#0077B6;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Payment Summary</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:9px;">
          <span style="font-size:13px;color:#6b7280;">Plan</span>
          <span style="font-size:13px;font-weight:700;color:#0d1f33;">${planName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:9px;">
          <span style="font-size:13px;color:#6b7280;">Seats Activated</span>
          <span style="font-size:13px;font-weight:700;color:#0d1f33;">${seats} seats</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:9px;">
          <span style="font-size:13px;color:#6b7280;">Amount Paid</span>
          <span style="font-size:13px;font-weight:700;color:#059669;">${amountStr}</span>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #e0f2fe;padding-top:9px;margin-top:4px;">
          <span style="font-size:13px;color:#6b7280;">Valid Until</span>
          <span style="font-size:13px;font-weight:700;color:#0d1f33;">${expiryStr}</span>
        </div>
      </div>

      <!-- Enrollment Code Box -->
      <div style="background:linear-gradient(135deg,#023E8A,#0077B6);border-radius:16px;padding:28px;margin-bottom:24px;text-align:center;">
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Aapka Enrollment Code</div>
        <div style="font-size:38px;font-weight:900;color:#ffffff;letter-spacing:0.18em;font-family:monospace;">${orgCode}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:12px;line-height:1.6;">Ye code apne ${seats} employees ko share karo.<br/>Woh Aorane app → Profile → Join Organization mein enter karein.</div>
      </div>

      <!-- Next Steps -->
      <div style="margin-bottom:28px;">
        <div style="font-size:14px;font-weight:700;color:#0d1f33;margin-bottom:14px;">Agle Steps 👇</div>
        ${[
          ["1️⃣", "Employees ko Enrollment Code share karo", `Code: <strong style="font-family:monospace;font-size:15px;color:#0077B6;">${orgCode}</strong> — WhatsApp, email ya HR portal se bhejo`],
          ["2️⃣", "Employees Aorane app download karein", "Play Store / App Store se Aorane download karke account banayein"],
          ["3️⃣", "App mein code enter karein", "Profile → Join Organization → Enrollment Code enter karo"],
          ["4️⃣", "Business Dashboard se track karo", "Real-time health scores, department analytics, risk alerts — sabkuch ek jagah"],
        ].map(([num, title, desc]) => `
          <div style="display:flex;gap:14px;padding:14px;background:#f8fafc;border-radius:12px;margin-bottom:10px;border:1px solid #f1f5f9;">
            <div style="font-size:20px;flex-shrink:0;">${num}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0d1f33;">${title}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;line-height:1.5;">${desc}</div>
            </div>
          </div>
        `).join("")}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://business.aorane.com" style="display:inline-block;background:linear-gradient(135deg,#0077B6,#023E8A);color:#ffffff;font-size:14px;font-weight:700;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 4px 16px rgba(0,119,182,0.3);">
          🏢 Business Dashboard Kholo
        </a>
      </div>

      <div style="border-top:1.5px solid #f3f4f6;padding-top:18px;text-align:center;">
        <div style="font-size:13px;color:#6b7280;line-height:1.7;">
          Help chahiye? <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a> pe mail karo.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #f3f4f6;padding:20px 40px;text-align:center;">
      <div style="font-size:14px;font-weight:800;color:#0d1f33;margin-bottom:4px;">AORANE Business</div>
      <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
        Aorane Health Technologies Pvt. Ltd., Uttar Pradesh, India<br/>
        &copy; ${year} Aorane. All rights reserved. · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Send Functions ────────────────────────────────────────────────────────────

/** Send welcome email to a new individual user */
export async function sendWelcomeEmail(params: { toEmail: string; name?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Welcome to Aorane — Aapka Health Journey Shuru Hua! 🎉`,
      html: buildWelcomeHtml(params.name || ""),
    });
    if (error) console.warn("[Welcome Email] Resend error:", error.message);
    else console.info("[Welcome Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Welcome Email] Failed:", err);
  }
}

/** Send welcome email to a new business admin when org is created */
export async function sendBusinessWelcomeEmail(params: {
  toEmail: string;
  adminName: string;
  orgName: string;
  orgCode: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `${params.orgName} — Aorane Business pe Welcome! 🎉`,
      html: buildBusinessWelcomeHtml(params.adminName, params.orgName, params.orgCode),
    });
    if (error) console.warn("[Business Welcome Email] Resend error:", error.message);
    else console.info("[Business Welcome Email] Sent to", params.toEmail, "org:", params.orgName);
  } catch (err) {
    console.error("[Business Welcome Email] Failed:", err);
  }
}

/** Send payment success email to individual user (with Aorane ID) */
export async function sendIndividualPaymentWelcomeEmail(params: {
  toEmail: string;
  name: string;
  aoraneId: string;
  planName: string;
  amountPaid: number;
  expiresAt: Date;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Aorane ${params.planName} Plan Active! Aapka ID: ${params.aoraneId} 🎉`,
      html: buildIndividualPaymentWelcomeHtml(
        params.name,
        params.aoraneId,
        params.planName,
        params.amountPaid,
        params.expiresAt,
      ),
    });
    if (error) console.warn("[Individual Payment Email] Resend error:", error.message);
    else console.info("[Individual Payment Email] Sent to", params.toEmail, "plan:", params.planName);
  } catch (err) {
    console.error("[Individual Payment Email] Failed:", err);
  }
}

/** Send payment success email to corporate admin (with Enrollment Code) */
export async function sendCorporatePaymentWelcomeEmail(params: {
  toEmail: string;
  adminName: string;
  orgName: string;
  orgCode: string;
  planName: string;
  seats: number;
  amountPaid: number;
  expiresAt: Date;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `${params.orgName} — Aorane Business Plan Active! Enrollment Code: ${params.orgCode} 🎉`,
      html: buildCorporatePaymentWelcomeHtml(
        params.adminName,
        params.orgName,
        params.orgCode,
        params.planName,
        params.seats,
        params.amountPaid,
        params.expiresAt,
      ),
    });
    if (error) console.warn("[Corporate Payment Email] Resend error:", error.message);
    else console.info("[Corporate Payment Email] Sent to", params.toEmail, "org:", params.orgName, "seats:", params.seats);
  } catch (err) {
    console.error("[Corporate Payment Email] Failed:", err);
  }
}
