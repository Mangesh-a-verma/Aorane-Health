import { Resend } from "resend";

const SUPPORT_EMAIL = "support@aorane.com";
const AORANE_GSTIN = process.env.AORANE_GSTIN || "09AAFCA1234A1Z5";
const AORANE_ADDRESS = "Aorane Health Technologies Pvt. Ltd., Uttar Pradesh, India";

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orgName: string;
  orgGstin?: string;
  orgState?: string;
  planLabel: string;
  seats: number;
  billingCycle: string;
  pricePerSeat: number;
  months: number;
  baseAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
  isSameState: boolean;
  razorpayPaymentId?: string;
}

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

function buildInvoiceHtml(data: InvoiceData): string {
  const {
    invoiceNumber, invoiceDate, orgName, orgGstin, orgState,
    planLabel, seats, billingCycle, pricePerSeat, months,
    baseAmount, cgstAmount, sgstAmount, igstAmount, gstAmount, totalAmount,
    isSameState, razorpayPaymentId,
  } = data;

  const billingLabel = billingCycle === "yearly" ? "12 months (Annual)" : "1 month (Monthly)";
  const description = `Aorane Business ${planLabel} Plan — ${seats} seats × ${billingLabel}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0077B6 0%,#006a60 100%);padding:32px 40px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.02em;">AORANE</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">Your Health, In Your Hands</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:700;color:#fff;">TAX INVOICE</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">${invoiceNumber}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px;">${invoiceDate}</div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">

      <!-- Billing parties -->
      <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:32px;">
        <div style="flex:1;">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">From</div>
          <div style="font-size:14px;font-weight:700;color:#0d1f33;">Aorane Health Technologies Pvt. Ltd.</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;line-height:1.6;">
            ${AORANE_ADDRESS}<br/>
            GSTIN: ${AORANE_GSTIN}<br/>
            support@aorane.com
          </div>
        </div>
        <div style="flex:1;">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Bill To</div>
          <div style="font-size:14px;font-weight:700;color:#0d1f33;">${orgName}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;line-height:1.6;">
            ${orgState ? `${orgState}, India<br/>` : ""}
            ${orgGstin ? `GSTIN: ${orgGstin}` : "GSTIN: Not provided"}
          </div>
        </div>
      </div>

      <!-- Line items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:10px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid #e5e7eb;">Description</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid #e5e7eb;">SAC</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid #e5e7eb;">Qty</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid #e5e7eb;">Unit Price</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:12px 12px;font-size:13px;color:#0d1f33;border-bottom:1px solid #f3f4f6;">
              ${description}
            </td>
            <td style="padding:12px 12px;font-size:13px;color:#6b7280;text-align:right;border-bottom:1px solid #f3f4f6;">998313</td>
            <td style="padding:12px 12px;font-size:13px;color:#0d1f33;text-align:right;border-bottom:1px solid #f3f4f6;">${seats}</td>
            <td style="padding:12px 12px;font-size:13px;color:#0d1f33;text-align:right;border-bottom:1px solid #f3f4f6;">${formatINR(pricePerSeat * months)}</td>
            <td style="padding:12px 12px;font-size:13px;color:#0d1f33;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;">${formatINR(baseAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Totals -->
      <div style="max-width:280px;margin-left:auto;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#6b7280;">
          <span>Subtotal</span><span>${formatINR(baseAmount)}</span>
        </div>
        ${isSameState ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#6b7280;">
          <span>CGST @9%</span><span>${formatINR(cgstAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#6b7280;">
          <span>SGST @9%</span><span>${formatINR(sgstAmount)}</span>
        </div>
        ` : `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#6b7280;">
          <span>IGST @18%</span><span>${formatINR(igstAmount)}</span>
        </div>
        `}
        <div style="display:flex;justify-content:space-between;padding:10px 12px;font-size:15px;font-weight:700;color:#0d1f33;background:#f0f7ff;border-radius:8px;margin-top:8px;">
          <span>Total</span><span>${formatINR(totalAmount)}</span>
        </div>
      </div>

      <!-- Payment info -->
      ${razorpayPaymentId ? `
      <div style="margin-top:24px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
        <div style="font-size:12px;font-weight:700;color:#15803d;margin-bottom:4px;">Payment Confirmed</div>
        <div style="font-size:12px;color:#166534;">Transaction ID: ${razorpayPaymentId}</div>
      </div>
      ` : ""}

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af;line-height:1.8;">
        This is a computer-generated invoice and does not require a physical signature.<br/>
        For queries, write to <a href="mailto:support@aorane.com" style="color:#0077B6;text-decoration:none;">support@aorane.com</a><br/>
        &copy; ${new Date().getFullYear()} Aorane Health Technologies Pvt. Ltd.
      </div>

    </div>
  </div>
</body>
</html>`;
}

export async function sendInvoiceEmail(params: {
  toEmail: string;
  orgName: string;
  invoiceData: InvoiceData;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Invoice Email] RESEND_API_KEY not set — skipping invoice email");
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const html = buildInvoiceHtml(params.invoiceData);
    const { error } = await resend.emails.send({
      from: `Aorane <${SUPPORT_EMAIL}>`,
      to: [params.toEmail],
      subject: `Invoice ${params.invoiceData.invoiceNumber} — Aorane Business Plan`,
      html,
    });
    if (error) {
      console.warn("[Invoice Email] Resend error:", error.message);
      return false;
    }
    console.info("[Invoice Email] Sent to", params.toEmail, "invoice", params.invoiceData.invoiceNumber);
    return true;
  } catch (err) {
    console.error("[Invoice Email] Failed:", err);
    return false;
  }
}
