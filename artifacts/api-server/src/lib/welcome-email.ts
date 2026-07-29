import { Resend } from "resend";
import { getCompanyDetails } from "./company-settings";

const FROM_EMAIL = "Aorane <noreply@aorane.com>";
const SUPPORT_EMAIL = "support@aorane.com";
const APP_STORE_URL = "https://play.google.com/store/apps/details?id=com.aorane.app";
const LOGO_URL = "https://aorane.com/logo-full.png";

// ─────────────────────────────────────────────────────────────────────────
// Shared email design system — light theme
//
// Brand palette matches the redesigned website (teal-deep / teal-bright),
// on a light background so the actual logo and content read cleanly across
// Gmail, Outlook, and Apple Mail. Email clients don't support backdrop-blur
// or custom web fonts reliably, so depth is created with soft shadows,
// thin borders, and a restrained color palette instead of true glass
// effects — plus a small "mini dashboard" graphic (built from plain
// divs, not images) on business emails to visually reinforce the product's
// value, similar in spirit to the website's dashboard preview.
// ─────────────────────────────────────────────────────────────────────────

const COLOR = {
  tealDeep: "#05473C",
  tealDark: "#082F28",
  tealBright: "#00C79A",
  bg: "#F5F8F6",
  card: "#FFFFFF",
  ink: "#0E1F1B",
  inkSoft: "#4B5F5A",
  inkMute: "#8A9B96",
  border: "#E7EFEC",
};

const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";

async function emailShell(title: string, bodyHtml: string): Promise<string> {
  const year = new Date().getFullYear();
  const footer = await emailFooterOuter(year);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:${FONT_BODY};">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:${COLOR.card};border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(5,71,60,0.07);border:1px solid ${COLOR.border};">
      ${bodyHtml}
    </div>
    ${footer}
  </div>
</body>
</html>`;
}

/** Light-theme header — real logo image, eyebrow label, and a headline. */
function emailHeader(opts: { eyebrow: string; headline: string; subheadline: string; emoji?: string }): string {
  return `
    <div style="background:linear-gradient(180deg,#EEF6F2 0%,${COLOR.bg} 100%);padding:38px 40px 36px;text-align:center;border-bottom:1px solid ${COLOR.border};">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;">
        <tr><td style="background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 4px 16px rgba(5,71,60,0.08);">
          <img src="${LOGO_URL}" alt="Aorane" height="26" style="height:26px;width:auto;display:block;" />
        </td></tr>
      </table>
      <div style="display:inline-block;background:rgba(0,199,154,0.12);color:${COLOR.tealDeep};font-size:10.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;border-radius:100px;margin-bottom:22px;">${opts.eyebrow}</div>
      ${opts.emoji ? `<div style="font-size:34px;margin-bottom:10px;line-height:1;">${opts.emoji}</div>` : ""}
      <div style="font-size:25px;font-weight:700;color:${COLOR.ink};line-height:1.28;font-family:${FONT_DISPLAY};letter-spacing:-0.01em;">${opts.headline}</div>
      <div style="margin-top:11px;font-size:14px;color:${COLOR.inkSoft};line-height:1.6;max-width:400px;margin-left:auto;margin-right:auto;">${opts.subheadline}</div>
    </div>`;
}

/** The single reusable call-to-action button. */
function ctaButton(label: string, href: string): string {
  return `
    <div style="text-align:center;margin-bottom:8px;">
      <a href="${href}" style="display:inline-block;background:${COLOR.tealDeep};color:#ffffff;font-size:15px;font-weight:700;padding:15px 38px;border-radius:100px;text-decoration:none;letter-spacing:0.01em;">
        ${label}
      </a>
    </div>`;
}

/** A single feature row with an emoji icon, title, and short description. */
function featureRow(emoji: string, title: string, desc: string): string {
  return `
    <div style="display:flex;align-items:flex-start;gap:14px;padding:15px;background:${COLOR.bg};border-radius:14px;margin-bottom:10px;">
      <div style="font-size:24px;flex-shrink:0;line-height:1;">${emoji}</div>
      <div>
        <div style="font-size:13.5px;font-weight:700;color:${COLOR.ink};margin-bottom:3px;">${title}</div>
        <div style="font-size:12.5px;color:${COLOR.inkSoft};line-height:1.55;">${desc}</div>
      </div>
    </div>`;
}

/** A label/value row used in payment summaries. */
function summaryRow(label: string, value: string, opts?: { valueColor?: string; last?: boolean }): string {
  const borderStyle = opts?.last ? `border-top:1px solid ${COLOR.border};padding-top:11px;margin-top:5px;` : "";
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;${borderStyle}">
      <span style="font-size:13px;color:${COLOR.inkSoft};">${label}</span>
      <span style="font-size:13px;font-weight:700;color:${opts?.valueColor ?? COLOR.ink};">${value}</span>
    </div>`;
}

/** A numbered step row used in "next steps" lists. */
function stepRow(num: string, title: string, desc: string): string {
  return `
    <div style="display:flex;gap:14px;padding:14px;background:${COLOR.bg};border-radius:12px;margin-bottom:10px;">
      <div style="font-size:14px;font-weight:800;color:${COLOR.tealDeep};flex-shrink:0;width:22px;height:22px;background:#ffffff;border:1.5px solid ${COLOR.tealDeep};border-radius:50%;display:flex;align-items:center;justify-content:center;">${num}</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};">${title}</div>
        <div style="font-size:12px;color:${COLOR.inkSoft};margin-top:3px;line-height:1.5;">${desc}</div>
      </div>
    </div>`;
}

/** A highlighted code/ID box (Aorane ID, Org Code, Enrollment Code) — kept as a
    solid teal card, used sparingly as the one accent block on an otherwise
    light page so the code still visually "pops". */
function codeBox(label: string, code: string, note: string): string {
  return `
    <div style="background:linear-gradient(135deg,${COLOR.tealDeep},${COLOR.tealDark});border-radius:16px;padding:28px;margin-bottom:26px;text-align:center;">
      <div style="font-size:11.5px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">${label}</div>
      <div style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:0.14em;font-family:'Courier New',monospace;">${code}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.62);margin-top:12px;line-height:1.6;">${note}</div>
    </div>`;
}

/**
 * A small "mini dashboard" graphic built entirely from divs (no external
 * images, so it renders reliably everywhere) — shows a simple bar chart to
 * visually communicate the aggregate-wellness-analytics value proposition
 * on B2B emails. Mirrors the website's dashboard preview in spirit.
 */
function miniDashboardGraphic(): string {
  const bars = [
    { label: "Engagement", value: 82 },
    { label: "Avg. Health Score", value: 76 },
    { label: "Activity Goals Met", value: 68 },
    { label: "Stress Managed Well", value: 71 },
  ];
  const rows = bars.map((b) => `
    <tr>
      <td style="padding:8px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:2px;">
          <tr>
            <td style="font-size:12px;font-weight:600;color:${COLOR.ink};">${b.label}</td>
            <td align="right" style="font-size:12px;font-weight:800;color:${COLOR.tealDeep};font-family:'Courier New',monospace;">${b.value}%</td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;">
          <tr>
            <td style="background:#ffffff;border-radius:7px;height:10px;padding:0;box-shadow:inset 0 1px 2px rgba(5,71,60,0.06);">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:${b.value}%;">
                <tr><td style="background:linear-gradient(90deg,${COLOR.tealDeep},${COLOR.tealBright});height:10px;border-radius:7px;"></td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  return `
    <div style="background:linear-gradient(160deg,#F0F8F5 0%,${COLOR.card} 55%);border:1px solid ${COLOR.border};border-radius:18px;padding:4px;margin-bottom:26px;box-shadow:0 4px 20px rgba(5,71,60,0.05);">
      <div style="padding:22px 22px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td>
              <div style="font-size:10.5px;font-weight:700;color:${COLOR.tealDeep};text-transform:uppercase;letter-spacing:0.1em;">Organization Wellness Snapshot</div>
              <div style="font-size:10px;color:${COLOR.inkMute};margin-top:2px;">Illustrative example</div>
            </td>
            <td align="right">
              <div style="display:inline-block;background:rgba(0,199,154,0.14);color:${COLOR.tealDeep};font-size:10px;font-weight:800;padding:4px 10px;border-radius:100px;">LIVE</div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${rows}
        </table>
      </div>
      <div style="background:#ffffff;border-radius:14px;padding:12px 18px;font-size:11px;color:${COLOR.inkMute};line-height:1.5;">
        Your dashboard will reflect your organization's real, aggregate data once employees start logging — individual data always stays private.
      </div>
    </div>`;
}

function helpLine(): string {
  return `
    <div style="border-top:1px solid ${COLOR.border};padding-top:20px;text-align:center;">
      <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;">
        Questions? We're happy to help.<br/>
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.tealDeep};font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </div>
    </div>`;
}

async function emailFooterOuter(year: number): Promise<string> {
  const company = await getCompanyDetails();
  return `
    <div style="text-align:center;padding:22px 20px 0;">
      <div style="font-size:11.5px;color:${COLOR.inkMute};line-height:1.8;">
        ${company.companyName} · ${company.state || company.country}, ${company.country}<br/>
        &copy; ${year} ${company.companyName}. All rights reserved.
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────
// Individual Welcome Email
// ─────────────────────────────────────────────────────────────────────────

async function buildWelcomeHtml(name: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "India's AI Health Platform",
      headline: `Welcome, ${firstName}.`,
      subheadline: "You've joined a platform built to give you one clear, honest picture of your health — starting today.",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="font-size:15px;font-weight:700;color:${COLOR.ink};margin-bottom:16px;">Where to start</div>
      ${featureRow("🍛", "Food Tracker", "Log your meals — our AI recognizes Indian dishes and tracks calories, protein, and carbs automatically.")}
      ${featureRow("💧", "Water Tracker", "Get reminders and track your daily water intake goal.")}
      ${featureRow("🧘", "Stress Tracker", "Check your stress level with our 5-pillar assessment and get personalized AI guidance.")}
      ${featureRow("🏃", "Exercise Log", "Log your workouts and watch your fitness score grow.")}

      <div style="background:linear-gradient(135deg,${COLOR.tealDeep},${COLOR.tealDark});border-radius:16px;padding:24px;margin:26px 0 30px;text-align:center;">
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:8px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Your Aorane Health Score</div>
        <div style="font-size:44px;font-weight:800;color:#ffffff;line-height:1;font-family:${FONT_DISPLAY};">0</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px;">Start logging today — your score updates automatically as you go.</div>
      </div>

      ${ctaButton("Open the App", APP_STORE_URL)}
      <div style="text-align:center;font-size:11px;color:${COLOR.inkMute};margin-bottom:28px;">Available on Android</div>
      ${helpLine()}
    </div>`;

  return await emailShell("Welcome to Aorane", body);
}

// ─────────────────────────────────────────────────────────────────────────
// Business Welcome Email (org created, before payment)
// ─────────────────────────────────────────────────────────────────────────

async function buildBusinessWelcomeHtml(adminName: string, orgName: string, orgCode: string): Promise<string> {
  const firstName = adminName?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "Business Portal",
      headline: `Welcome, ${firstName}.`,
      subheadline: `${orgName} now has an Aorane Business account.`,
      emoji: "🏢",
    })}
    <div style="padding:36px 40px 30px;">
      ${miniDashboardGraphic()}
      ${codeBox("Your Organization Code", orgCode, "Share this with your employees — they'll use it to join your organization inside the Aorane app.")}

      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:14px;">Next steps</div>
      ${stepRow("1", "Log in to the Business Portal", "Activate your plan from the Billing section.")}
      ${stepRow("2", "Generate enrollment codes", "Create specific codes for your employees to join.")}
      ${stepRow("3", "Share your organization code", `Employees enter <strong style="font-family:'Courier New',monospace;color:${COLOR.tealDeep};">${orgCode}</strong> inside the Aorane app under Profile → Join Organization.`)}
      ${stepRow("4", "View your dashboard", "See real-time team health analytics, stress levels, and activity scores.")}

      <div style="margin-top:6px;">
        ${ctaButton("Open Business Portal", "https://business.aorane.com")}
      </div>
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Welcome to Aorane Business", body);
}

// ─────────────────────────────────────────────────────────────────────────
// Individual Payment Welcome Email
// ─────────────────────────────────────────────────────────────────────────

async function buildIndividualPaymentWelcomeHtml(
  name: string,
  aoraneId: string,
  planName: string,
  amountPaid: number,
  expiresAt: Date,
): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";
  const expiryStr = expiresAt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const amountStr = "₹" + amountPaid.toLocaleString("en-IN");

  const body = `
    ${emailHeader({
      eyebrow: "Payment Confirmed",
      headline: "You're all set.",
      subheadline: `${firstName}, your ${planName} plan is now active.`,
      emoji: "✅",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:22px;margin-bottom:26px;">
        <div style="font-size:11.5px;font-weight:700;color:${COLOR.tealDeep};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Payment Summary</div>
        ${summaryRow("Plan", planName)}
        ${summaryRow("Amount Paid", amountStr, { valueColor: COLOR.tealDeep })}
        ${summaryRow("Valid Until", expiryStr, { last: true })}
      </div>

      ${codeBox("Your Aorane ID", aoraneId, "This is your unique health identity — find it in your Profile, and share it with your doctor in an emergency.")}

      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:14px;">What's included in ${planName}</div>
      ${featureRow("🍛", "Advanced Nutrition Tracking", "Calories, protein, carbs, fibre, plus calcium, iron, B12, and Vitamins C &amp; D (ICMR RDA 2024).")}
      ${featureRow("🏃", "Exercise &amp; MET Tracking", "WHO-standard MET-minute scoring, workout logs, and activity goals.")}
      ${featureRow("💧", "Smart Water Intake", "Activity-adjusted daily goals, tracked from 2,000–3,000 ml.")}
      ${featureRow("💊", "Medicine Adherence", "WHO-protocol dose reminders and compliance tracking.")}
      ${featureRow("😴", "Sleep Quality Monitor", "CDC/WHO 7–9 hour optimal sleep scoring.")}
      ${featureRow("⚖️", "BMI (Asia-Pacific)", "India-calibrated BMI with body composition analysis.")}
      ${featureRow("🧘", "Stress Assessment", "5-pillar model with AI-guided mental wellness tips.")}
      ${featureRow("⭐", "Daily Health Score", "A 100-point score combining all six health parameters.")}

      <div style="margin-top:20px;">
        ${ctaButton("Open App & Start Tracking", APP_STORE_URL)}
      </div>
      <div style="text-align:center;font-size:11px;color:${COLOR.inkMute};margin:10px 0 26px;">Available on Android</div>
      ${helpLine()}
    </div>`;

  return await emailShell("Payment Successful — Aorane", body);
}

// ─────────────────────────────────────────────────────────────────────────
// Corporate Payment Welcome Email
// ─────────────────────────────────────────────────────────────────────────

async function buildCorporatePaymentWelcomeHtml(
  adminName: string,
  orgName: string,
  orgCode: string,
  planName: string,
  seats: number,
  amountPaid: number,
  expiresAt: Date,
): Promise<string> {
  const firstName = adminName?.trim().split(" ")[0] || "there";
  const expiryStr = expiresAt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const amountStr = "₹" + amountPaid.toLocaleString("en-IN");

  const body = `
    ${emailHeader({
      eyebrow: "Business Portal",
      headline: "Plan activated.",
      subheadline: `${firstName}, ${orgName}'s ${planName} plan is now live.`,
      emoji: "🏢",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:22px;margin-bottom:24px;">
        <div style="font-size:11.5px;font-weight:700;color:${COLOR.tealDeep};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Payment Summary</div>
        ${summaryRow("Plan", planName)}
        ${summaryRow("Seats Activated", `${seats} seats`)}
        ${summaryRow("Amount Paid", amountStr, { valueColor: COLOR.tealDeep })}
        ${summaryRow("Valid Until", expiryStr, { last: true })}
      </div>

      ${miniDashboardGraphic()}
      ${codeBox("Your Enrollment Code", orgCode, `Share this with your ${seats} employees. They enter it inside the Aorane app under Profile → Join Organization.`)}

      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:14px;">Next steps</div>
      ${stepRow("1", "Share the enrollment code", `Send <strong style="font-family:'Courier New',monospace;color:${COLOR.tealDeep};">${orgCode}</strong> via WhatsApp, email, or your HR portal.`)}
      ${stepRow("2", "Employees download Aorane", "They install the app from the Play Store and create an account.")}
      ${stepRow("3", "Employees enter the code", "Under Profile → Join Organization → Enrollment Code.")}
      ${stepRow("4", "Track it all from your dashboard", "Real-time health scores, department analytics, and risk alerts in one place.")}

      <div style="margin-top:6px;">
        ${ctaButton("Open Business Dashboard", "https://business.aorane.com")}
      </div>
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Plan Activated — Aorane Business", body);
}

// ─────────────────────────────────────────────────────────────────────────
// Send functions (unchanged signatures — only the HTML/subject content and
// internal helpers were redesigned, so no caller needs to change)
// ─────────────────────────────────────────────────────────────────────────

/** Send welcome email to a new individual user */
export async function sendWelcomeEmail(params: { toEmail: string; name?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: "Welcome to Aorane — your health journey starts now",
      html: await buildWelcomeHtml(params.name || ""),
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
      subject: `${params.orgName} is now on Aorane Business`,
      html: await buildBusinessWelcomeHtml(params.adminName, params.orgName, params.orgCode),
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
      subject: `Your Aorane ${params.planName} plan is active — ID: ${params.aoraneId}`,
      html: await buildIndividualPaymentWelcomeHtml(
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
      subject: `${params.orgName} — your Aorane Business plan is active (Code: ${params.orgCode})`,
      html: await buildCorporatePaymentWelcomeHtml(
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

// ─────────────────────────────────────────────────────────────────────────
// Payment Failed Email — Individual
// ─────────────────────────────────────────────────────────────────────────

async function buildPaymentFailedHtml(name: string, planName: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    <div style="background:linear-gradient(180deg,#FFF7ED 0%,${COLOR.bg} 100%);padding:38px 40px 34px;text-align:center;border-bottom:1px solid ${COLOR.border};">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;">
        <tr><td style="background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 4px 16px rgba(180,83,9,0.08);">
          <img src="${LOGO_URL}" alt="Aorane" height="26" style="height:26px;width:auto;display:block;" />
        </td></tr>
      </table>
      <div style="display:inline-block;background:rgba(180,83,9,0.12);color:#B45309;font-size:10.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;border-radius:100px;margin-bottom:22px;">Payment Issue</div>
      <div style="font-size:36px;margin-bottom:10px;line-height:1;">⚠️</div>
      <div style="font-size:23px;font-weight:700;color:${COLOR.ink};line-height:1.28;font-family:${FONT_DISPLAY};letter-spacing:-0.01em;">We couldn't renew your plan.</div>
      <div style="margin-top:11px;font-size:14px;color:${COLOR.inkSoft};line-height:1.6;max-width:400px;margin-left:auto;margin-right:auto;">${firstName}, the payment for your ${planName} plan didn't go through, so your account has reverted to the Free plan.</div>
    </div>
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};margin-bottom:8px;">This usually happens because of:</div>
        <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.9;">
          • Insufficient balance at the time of renewal<br/>
          • An expired or blocked card<br/>
          • Your bank declined the auto-debit request
        </div>
      </div>

      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:6px;">What you'll lose on Free</div>
      <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;margin-bottom:24px;">
        AI food scanning, medical report scanning, advanced nutrition tracking, and your AI Health Coach conversations will be paused until you resubscribe. Your logged history stays safe either way.
      </div>

      ${ctaButton("Update Payment & Resubscribe", APP_STORE_URL)}
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Payment Failed — Aorane", body);
}

/** Send payment-failed notification to an individual user (subscription.halted) */
export async function sendPaymentFailedEmail(params: {
  toEmail: string;
  name: string;
  planName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Action needed: your Aorane ${params.planName} payment failed`,
      html: await buildPaymentFailedHtml(params.name, params.planName),
    });
    if (error) console.warn("[Payment Failed Email] Resend error:", error.message);
    else console.info("[Payment Failed Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Payment Failed Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Payment Failed Email — Corporate
// ─────────────────────────────────────────────────────────────────────────

async function buildCorporatePaymentFailedHtml(adminName: string, orgName: string, planName: string): Promise<string> {
  const firstName = adminName?.trim().split(" ")[0] || "there";

  const body = `
    <div style="background:linear-gradient(180deg,#FFF7ED 0%,${COLOR.bg} 100%);padding:38px 40px 34px;text-align:center;border-bottom:1px solid ${COLOR.border};">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;">
        <tr><td style="background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 4px 16px rgba(180,83,9,0.08);">
          <img src="${LOGO_URL}" alt="Aorane" height="26" style="height:26px;width:auto;display:block;" />
        </td></tr>
      </table>
      <div style="display:inline-block;background:rgba(180,83,9,0.12);color:#B45309;font-size:10.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;border-radius:100px;margin-bottom:22px;">Payment Issue</div>
      <div style="font-size:36px;margin-bottom:10px;line-height:1;">⚠️</div>
      <div style="font-size:23px;font-weight:700;color:${COLOR.ink};line-height:1.28;font-family:${FONT_DISPLAY};letter-spacing:-0.01em;">We couldn't renew your plan.</div>
      <div style="margin-top:11px;font-size:14px;color:${COLOR.inkSoft};line-height:1.6;max-width:420px;margin-left:auto;margin-right:auto;">${firstName}, the renewal payment for ${orgName}'s ${planName} plan didn't go through. Your team's access has been paused.</div>
    </div>
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};margin-bottom:8px;">This usually happens because of:</div>
        <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.9;">
          • Insufficient balance at the time of renewal<br/>
          • An expired or blocked card<br/>
          • Your bank declined the auto-debit request
        </div>
      </div>

      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:6px;">What's paused right now</div>
      <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;margin-bottom:24px;">
        Your team's wellness dashboard, analytics, and compliance reports are on hold until the plan is renewed. Historical data collected so far stays safe.
      </div>

      ${ctaButton("Update Payment Method", "https://business.aorane.com/billing")}
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Payment Failed — Aorane Business", body);
}

/** Send payment-failed notification to a corporate admin (subscription.halted) */
export async function sendCorporatePaymentFailedEmail(params: {
  toEmail: string;
  adminName: string;
  orgName: string;
  planName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Action needed: ${params.orgName}'s Aorane Business payment failed`,
      html: await buildCorporatePaymentFailedHtml(params.adminName, params.orgName, params.planName),
    });
    if (error) console.warn("[Corporate Payment Failed Email] Resend error:", error.message);
    else console.info("[Corporate Payment Failed Email] Sent to", params.toEmail, "org:", params.orgName);
  } catch (err) {
    console.error("[Corporate Payment Failed Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Subscription Expiry Reminder Email
// ─────────────────────────────────────────────────────────────────────────

async function buildExpiryReminderHtml(name: string, planName: string, daysLeft: number, expiryDateStr: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";
  const urgency = daysLeft <= 1;
  const dayLabel = daysLeft <= 1 ? "today" : `in ${daysLeft} days`;

  const body = `
    ${emailHeader({
      eyebrow: "Subscription Reminder",
      headline: urgency ? "Your plan expires today." : `Your plan expires ${dayLabel}.`,
      subheadline: `${firstName}, your ${planName} plan is set to expire ${dayLabel} (${expiryDateStr}). Renew now to keep your features uninterrupted.`,
      emoji: urgency ? "⏰" : "📅",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};margin-bottom:8px;">What you'll lose if it lapses</div>
        <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.9;">
          • AI food scanning &amp; medical report scanning<br/>
          • Advanced nutrition &amp; MET-based exercise tracking<br/>
          • Your AI Health Coach conversations
        </div>
      </div>
      ${ctaButton("Renew Now", APP_STORE_URL)}
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Subscription Expiring — Aorane", body);
}

/** Send subscription-expiring reminder email (7/3/1 days before expiry) */
export async function sendExpiryReminderEmail(params: {
  toEmail: string;
  name: string;
  planName: string;
  daysLeft: number;
  expiryDateStr: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const subjectPrefix = params.daysLeft <= 1 ? "Expires today" : `${params.daysLeft} days left`;
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `${subjectPrefix}: your Aorane ${params.planName} plan`,
      html: await buildExpiryReminderHtml(params.name, params.planName, params.daysLeft, params.expiryDateStr),
    });
    if (error) console.warn("[Expiry Reminder Email] Resend error:", error.message);
    else console.info("[Expiry Reminder Email] Sent to", params.toEmail, "daysLeft:", params.daysLeft);
  } catch (err) {
    console.error("[Expiry Reminder Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Upcoming Auto-Renewal Email (heads-up before auto-debit)
// ─────────────────────────────────────────────────────────────────────────

async function buildRenewalUpcomingHtml(name: string, planName: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "Auto-Renewal Notice",
      headline: "Your plan renews in 3 days.",
      subheadline: `${firstName}, your ${planName} plan will auto-renew in 3 days. Make sure your payment method has sufficient balance.`,
      emoji: "🔄",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;margin-bottom:24px;">
        No action needed if everything looks good — we'll charge your saved payment method automatically. If you'd like to cancel or change your plan before then, you can do so from your app settings.
      </div>
      ${ctaButton("Manage Subscription", APP_STORE_URL)}
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Upcoming Renewal — Aorane", body);
}

/** Send heads-up email 3 days before an auto-renewal charge */
export async function sendRenewalUpcomingEmail(params: {
  toEmail: string;
  name: string;
  planName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Your Aorane ${params.planName} plan renews in 3 days`,
      html: await buildRenewalUpcomingHtml(params.name, params.planName),
    });
    if (error) console.warn("[Renewal Upcoming Email] Resend error:", error.message);
    else console.info("[Renewal Upcoming Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Renewal Upcoming Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Subscription Expired Confirmation Email
// ─────────────────────────────────────────────────────────────────────────

async function buildSubscriptionExpiredHtml(name: string, planName: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "Subscription Update",
      headline: "Your plan has expired.",
      subheadline: `${firstName}, your ${planName} plan has ended and your account is now on the Free plan.`,
      emoji: "📋",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};margin-bottom:8px;">Good news — nothing is lost</div>
        <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;">
          All your logged history, health scores, and past reports stay exactly as they are. You can pick up right where you left off any time you resubscribe.
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:14px;">What's available on Free</div>
      ${featureRow("🍛", "Basic Food Logging", "Manual meal logging and calorie tracking.")}
      ${featureRow("🏃", "Basic Exercise Log", "Log workouts and track activity minutes.")}
      ${featureRow("⭐", "Daily Health Score", "Your composite health score, still calculated daily.")}

      <div style="margin-top:24px;">
        ${ctaButton("Resubscribe", APP_STORE_URL)}
      </div>
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Subscription Expired — Aorane", body);
}

/** Send confirmation email when a subscription has fully expired (not renewed) */
export async function sendSubscriptionExpiredEmail(params: {
  toEmail: string;
  name: string;
  planName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Your Aorane ${params.planName} plan has expired`,
      html: await buildSubscriptionExpiredHtml(params.name, params.planName),
    });
    if (error) console.warn("[Subscription Expired Email] Resend error:", error.message);
    else console.info("[Subscription Expired Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Subscription Expired Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Account Deletion Confirmation Email
// ─────────────────────────────────────────────────────────────────────────

async function buildAccountDeletedHtml(name: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "Account Deleted",
      headline: "Your account has been deleted.",
      subheadline: `${firstName}, this confirms your Aorane account and associated data have been permanently deleted, as requested.`,
      emoji: "🗑️",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};margin-bottom:8px;">What this means</div>
        <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.9;">
          • Your profile, health logs, and history have been permanently removed<br/>
          • Your phone number and email are no longer linked to any Aorane account<br/>
          • Any active subscription has been cancelled<br/>
          • This action cannot be undone
        </div>
      </div>
      <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;margin-bottom:24px;">
        If you didn't request this, or if this was a mistake, please contact us immediately — we may be able to help within a short window after deletion.
      </div>
      ${helpLine()}
    </div>`;

  return await emailShell("Account Deleted — Aorane", body);
}

/** Send confirmation email after a user permanently deletes their account.
 *  IMPORTANT: call this BEFORE the user's email is anonymized in the DB. */
export async function sendAccountDeletedEmail(params: {
  toEmail: string;
  name: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: "Your Aorane account has been deleted",
      html: await buildAccountDeletedHtml(params.name),
    });
    if (error) console.warn("[Account Deleted Email] Resend error:", error.message);
    else console.info("[Account Deleted Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Account Deleted Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Support Ticket Reply Notification Email
// ─────────────────────────────────────────────────────────────────────────

async function buildSupportReplyHtml(name: string, subject: string, adminNotes: string, status: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";
  const isResolved = status === "resolved" || status === "closed";

  const body = `
    ${emailHeader({
      eyebrow: "Support Update",
      headline: isResolved ? "Your ticket has been resolved." : "You have a reply on your ticket.",
      subheadline: `${firstName}, there's an update on your support request: "${subject}"`,
      emoji: isResolved ? "✅" : "💬",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:11.5px;font-weight:700;color:${COLOR.tealDeep};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Response from Aorane Support</div>
        <div style="font-size:14px;color:${COLOR.ink};line-height:1.7;white-space:pre-wrap;">${adminNotes}</div>
      </div>
      <div style="font-size:12.5px;color:${COLOR.inkMute};margin-bottom:24px;">
        Status: <strong style="color:${COLOR.tealDeep};">${status.replace("_", " ")}</strong>
      </div>
      ${ctaButton("View Ticket in App", APP_STORE_URL)}
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("Support Ticket Update — Aorane", body);
}

/** Send email when an admin replies to or resolves a support ticket */
export async function sendSupportReplyEmail(params: {
  toEmail: string;
  name: string;
  subject: string;
  adminNotes: string;
  status: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail || !params.adminNotes) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Re: ${params.subject} — Aorane Support`,
      html: await buildSupportReplyHtml(params.name, params.subject, params.adminNotes, params.status),
    });
    if (error) console.warn("[Support Reply Email] Resend error:", error.message);
    else console.info("[Support Reply Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Support Reply Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// New Team Member Enrolled Email (B2B — sent to the employee who just joined)
// ─────────────────────────────────────────────────────────────────────────

async function buildTeamMemberJoinedHtml(name: string, orgName: string): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "Team Enrollment",
      headline: `Welcome to ${orgName}'s wellness program.`,
      subheadline: `${firstName}, you're now enrolled in ${orgName}'s Aorane Business plan — your premium features are active.`,
      emoji: "🎉",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:${COLOR.bg};border-radius:16px;padding:20px 22px;margin-bottom:26px;">
        <div style="font-size:13px;font-weight:700;color:${COLOR.ink};margin-bottom:8px;">A note on privacy</div>
        <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;">
          ${orgName} can only see aggregate, anonymized team trends — never your individual health data. What you log stays private to you.
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:14px;">What's unlocked</div>
      ${featureRow("🍛", "AI Food Scanner", "Full access to AI-powered meal logging for Indian dishes.")}
      ${featureRow("🧘", "Stress Assessment", "5-pillar model with AI-guided wellness tips.")}
      ${featureRow("⭐", "Daily Health Score", "Your full composite health score, updated daily.")}

      <div style="margin-top:24px;">
        ${ctaButton("Open the App", APP_STORE_URL)}
      </div>
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell(`Welcome to ${orgName} on Aorane`, body);
}

/** Send a personalized welcome to an employee who just joined an organization via enrollment code */
export async function sendTeamMemberJoinedEmail(params: {
  toEmail: string;
  name: string;
  orgName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `You've joined ${params.orgName} on Aorane`,
      html: await buildTeamMemberJoinedHtml(params.name, params.orgName),
    });
    if (error) console.warn("[Team Member Joined Email] Resend error:", error.message);
    else console.info("[Team Member Joined Email] Sent to", params.toEmail, "org:", params.orgName);
  } catch (err) {
    console.error("[Team Member Joined Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Individual Monthly Health Summary Email (engagement feature)
// ─────────────────────────────────────────────────────────────────────────

async function buildMonthlyHealthSummaryHtml(
  name: string,
  monthLabel: string,
  avgScore: number,
  scoreDelta: number,
  daysLogged: number,
  daysInMonth: number,
): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";
  const deltaText = scoreDelta === 0 ? "unchanged" : scoreDelta > 0 ? `up ${scoreDelta} pts` : `down ${Math.abs(scoreDelta)} pts`;
  const deltaColor = scoreDelta >= 0 ? COLOR.tealBright : "#B45309";

  const body = `
    ${emailHeader({
      eyebrow: "Monthly Summary",
      headline: `Your ${monthLabel} recap.`,
      subheadline: `${firstName}, here's how your health tracking went this month.`,
      emoji: "📊",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="background:linear-gradient(135deg,${COLOR.tealDeep},${COLOR.tealDark});border-radius:16px;padding:24px;margin-bottom:20px;text-align:center;">
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:8px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Average Health Score</div>
        <div style="font-size:44px;font-weight:800;color:#ffffff;line-height:1;font-family:${FONT_DISPLAY};">${avgScore}</div>
        <div style="font-size:12px;margin-top:8px;color:${deltaColor};font-weight:700;">${deltaText} vs last month</div>
      </div>

      <div style="background:${COLOR.bg};border-radius:16px;padding:18px 22px;margin-bottom:26px;text-align:center;">
        <div style="font-size:13px;color:${COLOR.inkSoft};">You logged data on <strong style="color:${COLOR.ink};">${daysLogged} of ${daysInMonth}</strong> days this month.</div>
      </div>

      <div style="font-size:13px;color:${COLOR.inkSoft};line-height:1.7;margin-bottom:24px;">
        The more consistently you log, the sharper your Health Score and AI Coach recommendations get. Keep going!
      </div>

      ${ctaButton("View Full Report", APP_STORE_URL)}
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell(`Your ${monthLabel} Health Summary — Aorane`, body);
}

/** Send a monthly personal health summary email to an individual user */
export async function sendMonthlyHealthSummaryEmail(params: {
  toEmail: string;
  name: string;
  monthLabel: string;
  avgScore: number;
  scoreDelta: number;
  daysLogged: number;
  daysInMonth: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Your ${params.monthLabel} health summary — Score: ${params.avgScore}`,
      html: await buildMonthlyHealthSummaryHtml(
        params.name, params.monthLabel, params.avgScore, params.scoreDelta, params.daysLogged, params.daysInMonth,
      ),
    });
    if (error) console.warn("[Monthly Health Summary Email] Resend error:", error.message);
    else console.info("[Monthly Health Summary Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Monthly Health Summary Email] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Re-engagement / Win-back Email for inactive users
// ─────────────────────────────────────────────────────────────────────────

async function buildWinBackHtml(name: string, daysInactive: number): Promise<string> {
  const firstName = name?.trim().split(" ")[0] || "there";

  const body = `
    ${emailHeader({
      eyebrow: "We miss you",
      headline: `It's been ${daysInactive} days, ${firstName}.`,
      subheadline: "Your health score has been waiting for you to check back in. Even a couple of minutes today helps.",
      emoji: "👋",
    })}
    <div style="padding:36px 40px 30px;">
      <div style="font-size:14px;font-weight:700;color:${COLOR.ink};margin-bottom:16px;">Pick up in under a minute</div>
      ${featureRow("🍛", "Log your last meal", "Snap a photo — our AI does the rest.")}
      ${featureRow("💧", "Log today's water intake", "One tap to stay on track.")}
      ${featureRow("⭐", "Check your Health Score", "See where you stand right now.")}

      <div style="margin-top:24px;">
        ${ctaButton("Open the App", APP_STORE_URL)}
      </div>
      <div style="margin-top:26px;">
        ${helpLine()}
      </div>
    </div>`;

  return await emailShell("We miss you — Aorane", body);
}

/** Send a re-engagement email to a user who hasn't logged any data in a while */
export async function sendWinBackEmail(params: {
  toEmail: string;
  name: string;
  daysInactive: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.toEmail) return;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `${params.name ? params.name.split(" ")[0] + ", w" : "W"}e miss you at Aorane`,
      html: await buildWinBackHtml(params.name, params.daysInactive),
    });
    if (error) console.warn("[Win-back Email] Resend error:", error.message);
    else console.info("[Win-back Email] Sent to", params.toEmail);
  } catch (err) {
    console.error("[Win-back Email] Failed:", err);
  }
}
