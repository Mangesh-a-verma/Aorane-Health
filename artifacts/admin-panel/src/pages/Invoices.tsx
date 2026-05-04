import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { adminRequest } from "@/lib/api";
import { FileText, Search, Download, CheckCircle, Clock, XCircle, RefreshCw, Building2 } from "lucide-react";

interface OrgInvoice {
  id: string;
  orgId: string;
  orgName: string;
  orgEmail: string;
  orgPhone: string | null;
  orgCity: string | null;
  orgState: string | null;
  orgGstin: string | null;
  plan: string;
  seats: number | null;
  amount: string;
  currency: string;
  status: string;
  paymentType: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountInWords(amount: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function toWords(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n/10)] + " " + toWords(n%10);
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred " + toWords(n%100);
    if (n < 100000) return toWords(Math.floor(n/1000)) + "Thousand " + toWords(n%1000);
    if (n < 10000000) return toWords(Math.floor(n/100000)) + "Lakh " + toWords(n%100000);
    return toWords(Math.floor(n/10000000)) + "Crore " + toWords(n%10000000);
  }
  const rounded = Math.round(amount);
  const paise = Math.round((amount - rounded) * 100);
  let result = "Rupees " + toWords(rounded).trim();
  if (paise > 0) result += " and " + toWords(paise).trim() + " Paise";
  return result + " Only";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle size={11} /> Paid
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
      <Clock size={11} /> Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      <XCircle size={11} /> {status}
    </span>
  );
}

function generateInvoiceHTML(inv: OrgInvoice, invNo: string): string {
  const date = new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const baseAmount = Number(inv.amount || 0);
  const gstRate = 18;
  const gstAmount = Math.round(baseAmount * gstRate / 100 * 100) / 100;
  const cgst = Math.round(gstAmount / 2 * 100) / 100;
  const sgst = Math.round(gstAmount / 2 * 100) / 100;
  const totalAmount = baseAmount + gstAmount;
  const planLabel = inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1);
  const orgAddress = [inv.orgCity, inv.orgState].filter(Boolean).join(", ");
  const validTill = inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${invNo} — ${inv.orgName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; font-size: 13px; line-height: 1.5; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 48px; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 28px; border-bottom: 3px solid #0077B6; margin-bottom: 28px; }
  .brand-block { display: flex; align-items: center; gap: 14px; }
  .logo-img { height: 52px; width: auto; object-fit: contain; }
  .logo-fallback { font-size: 24px; font-weight: 900; color: #0077B6; letter-spacing: -1px; }
  .brand-tagline { font-size: 11px; color: #6b7280; margin-top: 3px; }
  .brand-contact { margin-top: 10px; font-size: 11px; color: #6b7280; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 22px; font-weight: 800; color: #0077B6; letter-spacing: -0.5px; text-transform: uppercase; }
  .invoice-subtitle { font-size: 11px; color: #9ca3af; margin-top: 2px; letter-spacing: 1px; }
  .meta-row { display: flex; justify-content: flex-end; gap: 24px; margin-top: 12px; }
  .meta-item .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 2px; }
  .meta-item .value { font-size: 13px; font-weight: 700; color: #1a1a2e; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 8px; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-other { background: #fee2e2; color: #991b1b; }

  /* Parties */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .party-box { background: #f8fafc; border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; }
  .party-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #0077B6; font-weight: 800; margin-bottom: 10px; }
  .party-name { font-size: 15px; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .party-gstin { font-size: 12px; font-weight: 700; color: #374151; margin-top: 6px; font-family: monospace; }

  /* Items table */
  .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-weight: 800; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead tr { background: linear-gradient(135deg, #0077B6, #1B998B); }
  thead th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: white; }
  thead th:last-child { text-align: right; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td { padding: 12px 14px; font-size: 13px; color: #374151; }
  td:last-child { text-align: right; font-weight: 600; }
  .sac-code { font-size: 10px; color: #9ca3af; font-family: monospace; }

  /* Totals */
  .totals-block { display: flex; justify-content: flex-end; margin-top: 0; }
  .totals-table { width: 320px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; padding: 9px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .tot-row:last-child { border-bottom: none; }
  .tot-row .tot-label { color: #6b7280; }
  .tot-row .tot-val { font-weight: 600; color: #374151; }
  .tot-total { background: linear-gradient(135deg, #0077B6, #1B998B); }
  .tot-total .tot-label { color: rgba(255,255,255,0.85); font-weight: 700; font-size: 14px; }
  .tot-total .tot-val { color: white; font-weight: 800; font-size: 16px; }

  /* Amount in words */
  .words-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; margin-top: 16px; }
  .words-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; font-weight: 800; margin-bottom: 3px; }
  .words-text { font-size: 12px; font-weight: 600; color: #1e40af; }

  /* Payment details */
  .payment-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-top: 20px; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pay-item .pay-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700; margin-bottom: 3px; }
  .pay-item .pay-val { font-size: 12px; font-weight: 600; color: #374151; font-family: monospace; }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-note { font-size: 10px; color: #9ca3af; line-height: 1.6; }
  .footer-legal { font-size: 10px; color: #9ca3af; text-align: right; }
  .footer-stamp { background: #d1fae5; border: 2px solid #10b981; border-radius: 99px; padding: 6px 18px; font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 1px; display: inline-block; transform: rotate(-3deg); }

  @media print {
    @page { size: A4; margin: 0; }
    body { margin: 0; }
    .page { padding: 32px 40px; max-width: 100%; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="brand-block">
      <div>
        <img class="logo-img" src="https://aorane.com/logo-full.png" alt="Aorane" onerror="this.style.display='none';document.getElementById('logo-text').style.display='block'">
        <div id="logo-text" class="logo-fallback" style="display:none">AORANE</div>
        <div class="brand-tagline">Your Health, In Your Hands</div>
        <div class="brand-contact" style="margin-top:8px">
          Aorane Health Technologies Pvt. Ltd.<br>
          Mumbai, Maharashtra — India<br>
          GSTIN: 27AARCA0001A1Z1 &nbsp;|&nbsp; SAC: 998315<br>
          billing@aorane.in &nbsp;|&nbsp; +91 73078 26291
        </div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">Tax Invoice</div>
      <div class="invoice-subtitle">Original for Recipient</div>
      <div class="meta-row">
        <div class="meta-item">
          <div class="label">Invoice No.</div>
          <div class="value">${invNo}</div>
        </div>
        <div class="meta-item">
          <div class="label">Invoice Date</div>
          <div class="value">${date}</div>
        </div>
      </div>
      ${inv.expiresAt ? `
      <div class="meta-row" style="margin-top:8px">
        <div class="meta-item">
          <div class="label">Valid Till</div>
          <div class="value">${validTill}</div>
        </div>
      </div>` : ""}
      <div>
        <span class="status-badge ${inv.status === "success" ? "status-paid" : inv.status === "pending" ? "status-pending" : "status-other"}">
          ${inv.status === "success" ? "✓ PAID" : inv.status.toUpperCase()}
        </span>
      </div>
    </div>
  </div>

  <!-- PARTIES -->
  <div class="parties">
    <div class="party-box">
      <div class="party-label">Sold By (Supplier)</div>
      <div class="party-name">Aorane Health Technologies Pvt. Ltd.</div>
      <div class="party-detail">Mumbai, Maharashtra 400001</div>
      <div class="party-detail">India</div>
      <div class="party-gstin">GSTIN: 27AARCA0001A1Z1</div>
      <div class="party-detail" style="margin-top:4px">billing@aorane.in | +91 73078 26291</div>
    </div>
    <div class="party-box">
      <div class="party-label">Billed To (Recipient)</div>
      <div class="party-name">${inv.orgName}</div>
      ${orgAddress ? `<div class="party-detail">${orgAddress}</div>` : ""}
      <div class="party-detail">India</div>
      ${inv.orgGstin ? `<div class="party-gstin">GSTIN: ${inv.orgGstin}</div>` : `<div class="party-detail" style="margin-top:6px;color:#d97706;font-size:11px">GSTIN: Not provided</div>`}
      <div class="party-detail" style="margin-top:4px">${inv.orgEmail}</div>
      ${inv.orgPhone ? `<div class="party-detail">${inv.orgPhone}</div>` : ""}
    </div>
  </div>

  <!-- LINE ITEMS TABLE -->
  <div class="section-title">Invoice Line Items</div>
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Description of Service</th>
        <th>SAC Code</th>
        <th>Qty</th>
        <th>Rate (₹)</th>
        <th>GST %</th>
        <th style="text-align:right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <strong>Aorane Business — ${planLabel} Plan</strong><br>
          <span style="font-size:11px;color:#6b7280">
            Employee wellness & health management platform subscription
            ${inv.seats ? ` · ${inv.seats} seats` : ""}
            ${inv.paymentType ? ` · ${inv.paymentType} billing` : ""}
          </span>
        </td>
        <td><span class="sac-code">998315</span></td>
        <td>${inv.seats ?? 1}</td>
        <td style="font-weight:600">${formatINR(baseAmount)}</td>
        <td>18%</td>
        <td>${formatINR(baseAmount)}</td>
      </tr>
    </tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-block" style="margin-top:16px">
    <div class="totals-table">
      <div class="tot-row">
        <span class="tot-label">Subtotal (excl. GST)</span>
        <span class="tot-val">${formatINR(baseAmount)}</span>
      </div>
      <div class="tot-row">
        <span class="tot-label">CGST @ 9% (SAC: 998315)</span>
        <span class="tot-val">${formatINR(cgst)}</span>
      </div>
      <div class="tot-row">
        <span class="tot-label">SGST @ 9% (SAC: 998315)</span>
        <span class="tot-val">${formatINR(sgst)}</span>
      </div>
      <div class="tot-row tot-total">
        <span class="tot-label">Total Amount (INR)</span>
        <span class="tot-val">${formatINR(totalAmount)}</span>
      </div>
    </div>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="words-box">
    <div class="words-label">Total Amount in Words</div>
    <div class="words-text">${amountInWords(totalAmount)}</div>
  </div>

  <!-- PAYMENT DETAILS -->
  ${(inv.razorpayPaymentId || inv.razorpayOrderId) ? `
  <div class="payment-box">
    <div class="section-title" style="margin-bottom:12px">Payment Details</div>
    <div class="payment-grid">
      ${inv.razorpayPaymentId ? `
      <div class="pay-item">
        <div class="pay-label">Razorpay Payment ID</div>
        <div class="pay-val">${inv.razorpayPaymentId}</div>
      </div>` : ""}
      ${inv.razorpayOrderId ? `
      <div class="pay-item">
        <div class="pay-label">Razorpay Order ID</div>
        <div class="pay-val">${inv.razorpayOrderId}</div>
      </div>` : ""}
      <div class="pay-item">
        <div class="pay-label">Payment Mode</div>
        <div class="pay-val">${inv.paymentType ?? "Online (Razorpay)"}</div>
      </div>
      <div class="pay-item">
        <div class="pay-label">Currency</div>
        <div class="pay-val">INR (Indian Rupee)</div>
      </div>
    </div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-note">
      <strong>Terms & Notes:</strong><br>
      • This is a computer-generated tax invoice and does not require a signature.<br>
      • GST charged at 18% as per applicable Indian tax law (SAC Code: 998315).<br>
      • For billing queries: billing@aorane.in | +91 73078 26291<br>
      • Subject to Mumbai jurisdiction. © ${new Date().getFullYear()} Aorane Health Technologies Pvt. Ltd.
    </div>
    ${inv.status === "success" ? `<div class="footer-stamp">✓ Paid</div>` : ""}
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<OrgInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchInvoices = () => {
    setLoading(true);
    setError("");
    adminRequest<{ invoices: OrgInvoice[] }>("/admin/org-invoices")
      .then((d) => setInvoices(d.invoices || []))
      .catch(() => setError("Failed to load invoices"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filtered = invoices.filter((inv) => {
    const matchQ = !query ||
      inv.orgName.toLowerCase().includes(query.toLowerCase()) ||
      inv.orgEmail.toLowerCase().includes(query.toLowerCase()) ||
      (inv.razorpayPaymentId || "").toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === "all" || inv.status === statusFilter;
    return matchQ && matchS;
  });

  const totalRevenue = invoices.filter(i => i.status === "success").reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const paidCount = invoices.filter(i => i.status === "success").length;
  const pendingCount = invoices.filter(i => i.status === "pending").length;
  const totalWithGST = Math.round(totalRevenue * 1.18 * 100) / 100;

  function downloadInvoice(inv: OrgInvoice, idx: number) {
    const invNo = `AOR-${new Date(inv.createdAt).getFullYear()}-${String(idx + 1).padStart(4, "0")}`;
    const html = generateInvoiceHTML(inv, invNo);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invNo}-${inv.orgName.replace(/\s+/g, "-")}-invoice.html`;
      a.click();
    }
  }

  function exportCsv() {
    const header = "Invoice No,Organization,Email,GSTIN,City,State,Plan,Seats,Base Amount,GST (18%),Total Amount,Status,Payment ID,Date,Valid Till";
    const rows = filtered.map((inv, i) => {
      const invNo = `AOR-${new Date(inv.createdAt).getFullYear()}-${String(i + 1).padStart(4, "0")}`;
      const base = Number(inv.amount || 0);
      const gst = Math.round(base * 0.18 * 100) / 100;
      return [
        invNo,
        `"${inv.orgName}"`,
        inv.orgEmail,
        inv.orgGstin || "",
        inv.orgCity || "",
        inv.orgState || "",
        inv.plan,
        inv.seats ?? "",
        base.toFixed(2),
        gst.toFixed(2),
        (base + gst).toFixed(2),
        inv.status,
        inv.razorpayPaymentId || "",
        new Date(inv.createdAt).toLocaleDateString("en-IN"),
        inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("en-IN") : "",
      ].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aorane-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Business Invoices
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">GST tax invoices for all organization payments</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoices}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Base Revenue</div>
            <div className="text-xl font-bold text-emerald-600">{formatINR(totalRevenue)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">excl. GST</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total incl. GST</div>
            <div className="text-xl font-bold text-blue-600">{formatINR(totalWithGST)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">18% GST applied</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Paid Invoices</div>
            <div className="text-xl font-bold text-foreground">{paidCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">completed</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pending</div>
            <div className="text-xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">awaiting payment</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search org, email, payment ID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">All Status</option>
            <option value="success">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Organization</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan / Seats</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Base Amt</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">GST 18%</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((inv, i) => {
                    const base = Number(inv.amount || 0);
                    const gst = Math.round(base * 0.18 * 100) / 100;
                    const total = base + gst;
                    const invNo = `AOR-${new Date(inv.createdAt).getFullYear()}-${String(i + 1).padStart(4, "0")}`;
                    return (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono font-semibold">
                          {invNo}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            <Building2 size={12} className="text-muted-foreground shrink-0" />
                            {inv.orgName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{inv.orgEmail}</div>
                          {inv.orgGstin && (
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">GST: {inv.orgGstin}</div>
                          )}
                          {(inv.orgCity || inv.orgState) && (
                            <div className="text-xs text-muted-foreground">{[inv.orgCity, inv.orgState].filter(Boolean).join(", ")}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium capitalize">{inv.plan}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv.seats ? `${inv.seats} seats` : "—"}
                            {inv.paymentType ? ` · ${inv.paymentType}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {formatINR(base)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-orange-600 font-medium">
                          {formatINR(gst)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatINR(total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {inv.expiresAt && (
                            <div className="text-[10px] text-muted-foreground/60">
                              Till: {new Date(inv.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => downloadInvoice(inv, i)}
                            title="Download PDF Invoice"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Download size={12} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {filtered.length} of {invoices.length} invoices</span>
              <span className="text-xs">Click PDF to download · Opens print dialog → Save as PDF</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
