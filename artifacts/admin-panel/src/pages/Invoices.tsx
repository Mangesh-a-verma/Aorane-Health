import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { adminRequest } from "@/lib/api";
import { FileText, Search, Download, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

interface OrgInvoice {
  id: string;
  orgId: string;
  orgName: string;
  orgEmail: string;
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
  return "₹" + n.toLocaleString("en-IN");
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

  function downloadInvoice(inv: OrgInvoice, idx: number) {
    const invNo = `AOR-${String(idx + 1).padStart(4, "0")}`;
    const date = new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#1a1a1a;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #0077B6}
  .brand{font-size:26px;font-weight:800;color:#0077B6;letter-spacing:-0.5px}
  .brand small{display:block;font-size:12px;font-weight:400;color:#666;margin-top:2px}
  .inv-meta{text-align:right}
  .inv-meta .label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px}
  .inv-meta .val{font-size:16px;font-weight:700;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:24px 0}
  th{background:#f4f8fb;border:1px solid #e2e8f0;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;color:#555;letter-spacing:0.4px}
  td{border:1px solid #e2e8f0;padding:11px 14px;font-size:14px}
  .total-row{background:#0077B6;color:#fff;font-weight:700;font-size:16px}
  .status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${inv.status === "success" ? "#d1fae5" : "#fef3c7"};color:${inv.status === "success" ? "#065f46" : "#92400e"}}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#888;text-align:center}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">Aorane Health<small>Your Health, In Your Hands</small></div>
    <div style="margin-top:16px;font-size:13px;color:#555">support@aorane.in &nbsp;|&nbsp; aorane.in</div>
  </div>
  <div class="inv-meta">
    <div class="label">Invoice Number</div>
    <div class="val">${invNo}</div>
    <div class="label" style="margin-top:8px">Date</div>
    <div style="font-size:14px;color:#333">${date}</div>
    <div style="margin-top:10px"><span class="status">${inv.status === "success" ? "PAID" : inv.status.toUpperCase()}</span></div>
  </div>
</div>

<div style="margin-bottom:24px">
  <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Billed To</div>
  <div style="font-size:17px;font-weight:700;color:#1a1a1a">${inv.orgName}</div>
  <div style="font-size:14px;color:#555;margin-top:2px">${inv.orgEmail}</div>
</div>

<table>
  <thead><tr><th>Description</th><th>Plan</th><th>Seats</th><th>Payment Type</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr>
      <td>Aorane Business Subscription — ${inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)} Plan</td>
      <td>${inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)}</td>
      <td>${inv.seats ?? "—"}</td>
      <td>${inv.paymentType ?? "Online"}</td>
      <td style="text-align:right;font-weight:700">₹${Number(inv.amount || 0).toLocaleString("en-IN")}</td>
    </tr>
    <tr class="total-row">
      <td colspan="4" style="text-align:right">Total (INR)</td>
      <td style="text-align:right">₹${Number(inv.amount || 0).toLocaleString("en-IN")}</td>
    </tr>
  </tbody>
</table>

${inv.razorpayPaymentId ? `<div style="margin:20px 0;font-size:13px;color:#555"><strong>Payment ID:</strong> ${inv.razorpayPaymentId}</div>` : ""}
${inv.razorpayOrderId ? `<div style="font-size:13px;color:#555"><strong>Order ID:</strong> ${inv.razorpayOrderId}</div>` : ""}
${inv.expiresAt ? `<div style="margin-top:8px;font-size:13px;color:#555"><strong>Subscription Valid Till:</strong> ${new Date(inv.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>` : ""}

<div class="footer">This is a computer-generated invoice. For queries, contact support@aorane.in<br>Aorane Health &copy; ${new Date().getFullYear()}</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${invNo}-${inv.orgName.replace(/\s+/g, "-")}.html`;
    a.click();
  }

  function exportCsv() {
    const header = "Invoice,Org,Email,Plan,Seats,Amount,Status,Payment ID,Date";
    const rows = filtered.map((inv, i) => [
      `AOR-${String(i + 1).padStart(4, "0")}`,
      `"${inv.orgName}"`,
      inv.orgEmail,
      inv.plan,
      inv.seats ?? "",
      inv.amount,
      inv.status,
      inv.razorpayPaymentId || "",
      new Date(inv.createdAt).toLocaleDateString("en-IN"),
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aorane-business-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
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
            <p className="text-sm text-muted-foreground mt-0.5">All organization payment records</p>
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
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-emerald-600">{formatINR(totalRevenue)}</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Paid Invoices</div>
            <div className="text-2xl font-bold text-foreground">{paidCount}</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Organization</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((inv, i) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        AOR-{String(i + 1).padStart(4, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.orgName}</div>
                        <div className="text-xs text-muted-foreground">{inv.orgEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium capitalize">{inv.plan}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.seats ? `${inv.seats} seats` : "—"}
                          {inv.paymentType ? ` · ${inv.paymentType}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatINR(Number(inv.amount || 0))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3">
                        {inv.razorpayPaymentId ? (
                          <span className="font-mono text-xs text-muted-foreground">{inv.razorpayPaymentId.slice(0, 20)}...</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {inv.expiresAt && (
                          <div className="text-[10px] text-muted-foreground/60">
                            Expires: {new Date(inv.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => downloadInvoice(inv, i)}
                          title="Download Invoice"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Download size={12} /> Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
              Showing {filtered.length} of {invoices.length} invoices
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
